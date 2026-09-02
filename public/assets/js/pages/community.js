document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-demo-toast]').forEach(btn => {
        btn.addEventListener('click', () => {
            const message = btn.dataset.demoToast || 'Готово';
            const toast = document.createElement('div');
            toast.textContent = message;
            toast.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:9999;padding:12px 16px;border-radius:14px;background:rgba(20,24,40,.94);color:#fff;box-shadow:0 12px 30px rgba(0,0,0,.2)';
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 1700);
        });
    });

    const tracks = [...document.querySelectorAll('.music-track')];
    const playerTitle = document.getElementById('playerTitle');
    const playerArtist = document.getElementById('playerArtist');
    const nowPlayingTitle = document.getElementById('nowPlayingTitle');
    const toggle = document.querySelector('[data-music-action="toggle"]');
    let trackIndex = tracks.findIndex(x => x.classList.contains('is-active'));
    let playing = false;

    const selectTrack = index => {
        if (!tracks.length) return;
        trackIndex = (index + tracks.length) % tracks.length;
        tracks.forEach((track, i) => track.classList.toggle('is-active', i === trackIndex));
        const track = tracks[trackIndex];
        if (playerTitle) playerTitle.textContent = track.dataset.title || '';
        if (playerArtist) playerArtist.textContent = track.dataset.artist || '';
        if (nowPlayingTitle) nowPlayingTitle.textContent = track.dataset.title || '';
    };
    tracks.forEach((track, i) => track.addEventListener('click', () => { selectTrack(i); playing = true; if (toggle) toggle.textContent = 'Ⅱ'; }));
    document.querySelector('[data-music-action="prev"]')?.addEventListener('click', () => selectTrack(trackIndex - 1));
    document.querySelector('[data-music-action="next"]')?.addEventListener('click', () => selectTrack(trackIndex + 1));
    toggle?.addEventListener('click', () => { playing = !playing; toggle.textContent = playing ? 'Ⅱ' : '▶'; });

    const aiChat = document.getElementById('aiChat');
    const aiInput = document.getElementById('aiInput');
    const aiSend = document.getElementById('aiSend');

    const aiAnswer = prompt => {
        const lower = prompt.toLowerCase();
        if (lower.includes('игр')) return 'Попробуйте мини-игру «Секретный агент»: один человек загадывает предмет, остальные задают пять вопросов с ответами только «да/нет».';
        if (lower.includes('групп')) return 'Для группы отлично подойдёт название «Лунная связь», «Комната 404» или «Ночной штаб».';
        if (lower.includes('вечер')) return '20:00 — общий чат, 20:15 — короткая игра, 21:00 — свободное общение и музыка.';
        if (lower.includes('виктор')) return 'Вопрос: какая игра первой появилась в библиотеке? Ответ можно раскрыть через три подсказки.';
        return 'Демо-ИИ получил запрос. Позже сюда можно подключить настоящую модель без изменения интерфейса.';
    };

    const sendAi = text => {
        text = text.trim();
        if (!text || !aiChat) return;
        aiChat.insertAdjacentHTML('beforeend', `<div class="ai-message"><div class="ai-avatar">◌</div><div><strong>Вы</strong><p>${escapeHtml(text)}</p></div></div>`);
        setTimeout(() => {
            const answer = aiAnswer(text);
            aiChat.insertAdjacentHTML('beforeend', `<div class="ai-message ai-message-bot"><div class="ai-avatar">✦</div><div><strong>N-A-V-A AI</strong><p>${escapeHtml(answer)}</p></div></div>`);
            aiChat.scrollTop = aiChat.scrollHeight;
        }, 240);
        aiInput.value = '';
    };
    const escapeHtml = value => { const div = document.createElement('div'); div.textContent = value; return div.innerHTML; };
    document.querySelectorAll('[data-ai-prompt]').forEach(btn => btn.addEventListener('click', () => sendAi(btn.dataset.aiPrompt || '')));
    aiSend?.addEventListener('click', () => sendAi(aiInput?.value || ''));
    aiInput?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); sendAi(aiInput.value); } });
});
