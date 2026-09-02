(() => {
    'use strict';

    const input = document.getElementById('chatMediaInput');
    const button = document.getElementById('attachMediaBtn');
    const queueEl = document.getElementById('chatMediaQueue');
    const page = document.getElementById('chatPage');
    if (!input || !button || !queueEl || !page) return;

    const files = [];
    const maxImageSide = 2560;
    const imageQuality = 0.88;

    const formatBytes = bytes => {
        if (!Number.isFinite(bytes) || bytes <= 0) return '0 Б';
        const units = ['Б', 'КБ', 'МБ', 'ГБ'];
        let value = bytes, i = 0;
        while (value >= 1024 && i < units.length - 1) { value /= 1024; i++; }
        return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
    };

    const sha256Hex = async file => {
        // Browser-side hashing is an optimisation only. If WebCrypto is
        // unavailable (for example on an insecure origin), the local storage
        // backend calculates SHA-256 after upload, so uploads remain valid.
        if (!window.crypto?.subtle || file.size > 20 * 1024 * 1024) return '';
        const buffer = await file.arrayBuffer();
        const digest = await crypto.subtle.digest('SHA-256', buffer);
        return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
    };

    const compressImage = async file => {
        if (!file.type.startsWith('image/')) return {file, width: null, height: null};
        const bitmap = await createImageBitmap(file, {imageOrientation: 'from-image'}).catch(() => null);
        if (!bitmap) return {file, width: null, height: null};
        const sourceWidth = bitmap.width;
        const sourceHeight = bitmap.height;
        const scale = Math.min(1, maxImageSide / Math.max(bitmap.width, bitmap.height));
        if (scale === 1 && file.size < 1 * 1024 * 1024 && file.type === 'image/webp') {
            bitmap.close();
            return {file, width: sourceWidth, height: sourceHeight};
        }
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const ctx = canvas.getContext('2d', {alpha: true});
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', imageQuality));
        if (!blob) return {file, width: sourceWidth, height: sourceHeight};
        const base = (file.name || 'photo').replace(/\.[^.]+$/, '');
        return {
            file: new File([blob], `${base}.webp`, {type: 'image/webp', lastModified: file.lastModified}),
            width: canvas.width,
            height: canvas.height
        };
    };

    const classify = file => {
        if (file.type.startsWith('image/')) return 'photo';
        if (file.type.startsWith('video/')) return 'video';
        if (file.type.startsWith('audio/')) return 'voice';
        return null;
    };

    const render = () => {
        queueEl.hidden = files.length === 0;
        queueEl.innerHTML = files.map((item, i) => `<div class="chat-media-chip" data-index="${i}"><span class="chat-media-chip-name">${escapeHtml(item.file.name)}</span><small>${formatBytes(item.file.size)}</small><button type="button" aria-label="Убрать">×</button></div>`).join('');
        queueEl.querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => {
            files.splice(Number(btn.parentElement.dataset.index), 1);
            render();
        }));
    };

    const escapeHtml = value => {
        const div = document.createElement('div');
        div.textContent = value ?? '';
        return div.innerHTML;
    };

    const prepare = async original => {
        const type = classify(original);
        if (!type) throw new Error(`Файл «${original.name}» не поддерживается.`);
        const result = await compressImage(original);
        return {file: result.file, type, originalName: original.name, width: result.width, height: result.height, duration: null};
    };

    const uploadOne = async item => {
        const chatId = Number(page.dataset.activeChatId || 0);
        if (!chatId) throw new Error('Чат не выбран.');
        const sha = await sha256Hex(item.file);
        const body = new FormData();
        body.append('chat_id', String(chatId));
        body.append('type', item.type);
        body.append('mime_type', item.file.type || 'application/octet-stream');
        body.append('size', String(item.file.size));
        body.append('sha256', sha);
        body.append('name', item.file.name);

        const start = await fetch('/api/chat/media/presign', {method: 'POST', body, cache: 'no-store'});
        const startData = await start.json();
        if (!start.ok) throw new Error(startData.error || 'Не удалось подготовить загрузку.');

        if (startData.deduplicated) return Number(startData.upload_id);

        const upload = startData.upload;
        const put = await fetch(upload.url, {
            method: upload.method || 'POST',
            headers: upload.headers || {'Content-Type': item.file.type},
            body: item.file,
            credentials: 'same-origin',
            cache: 'no-store'
        });
        if (!put.ok) {
            let detail = '';
            try {
                const contentType = put.headers.get('content-type') || '';
                if (contentType.includes('application/json')) {
                    const payload = await put.json();
                    detail = payload.error ? ` — ${payload.error}` : '';
                } else {
                    const text = (await put.text()).trim();
                    if (text) detail = ` — ${text.slice(0, 180)}`;
                }
            } catch (_) {}
            throw new Error(`Ошибка загрузки файла: HTTP ${put.status}${detail}`);
        }

        const completeBody = new FormData();
        completeBody.append('upload_id', String(startData.upload_id));
        completeBody.append('size', String(item.file.size));
        if (sha) completeBody.append('sha256', sha);
        if (item.width) completeBody.append('width', String(item.width));
        if (item.height) completeBody.append('height', String(item.height));
        if (item.duration) completeBody.append('duration', String(item.duration));
        const done = await fetch('/api/chat/media/complete', {method: 'POST', body: completeBody, cache: 'no-store'});
        const doneData = await done.json();
        if (!done.ok) throw new Error(doneData.error || 'Не удалось завершить загрузку.');
        return Number(startData.upload_id);
    };

    window.NAVAMedia = {
        async uploadPending() {
            if (!files.length) return [];
            button.disabled = true;
            try {
                const ids = [];
                for (const item of files) ids.push(await uploadOne(item));
                files.splice(0, files.length);
                render();
                return ids;
            } finally {
                button.disabled = false;
            }
        },
        hasFiles: () => files.length > 0,
        clear: () => { files.splice(0, files.length); render(); },
    };

    button.addEventListener('click', () => input.click());
    input.addEventListener('change', async () => {
        for (const original of [...input.files]) {
            try {
                files.push(await prepare(original));
            } catch (e) {
                window.dispatchEvent(new CustomEvent('nava-media-error', {detail: e.message}));
            }
        }
        input.value = '';
        render();
    });

    window.addEventListener('nava-media-error', event => {
        if (event.detail && typeof window.showNavaToast === 'function') window.showNavaToast(event.detail);
    });
})();
