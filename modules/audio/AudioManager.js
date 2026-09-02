// modules/audio/AudioManager.js
// ============================================================
// АУДИО-МЕНЕДЖЕР
// ------------------------------------------------------------
// Требование (п.2 и п.4 ТЗ): музыка боя включается ТОЛЬКО во
// время боевки, плавно (fade-in/fade-out через Web Audio API,
// без щелчков и рывков), и полностью останавливается, когда
// бой заканчивается.
//
// Работает независимо от остальной музыки/эмбиента — если в
// будущем добавится фоновая музыка мира, эта система её просто
// приглушит на время боя и вернёт обратно (см. duckBackgroundTrack).
// ============================================================

const DEFAULT_CONFIG = {
    fadeInSeconds: 0.8,
    fadeOutSeconds: 1.0,
    battleVolume: 0.55,
    loop: true,
};

function log(message, type = 'info') {
    const styles = {
        info: 'color: #4FC3F7; font-weight: bold;',
        success: 'color: #81C784; font-weight: bold;',
        warning: 'color: #FFB74D; font-weight: bold;',
        error: 'color: #E57373; font-weight: bold;',
    };
    console.log(`%c🔊 [AudioManager] ${message}`, styles[type] || styles.info);
}

export class AudioManager {
    /**
     * @param {Object} tracks - { battle: 'путь/к/файлу.mp3', ambient: '...' }
     * @param {Object} config
     */
    constructor(tracks = {}, config = {}) {
        this._config = { ...DEFAULT_CONFIG, ...config };
        this._tracks = tracks;

        this._ctx = null;
        this._buffers = new Map();      // url -> AudioBuffer (кэш, декодируется один раз)
        this._loadingPromises = new Map();

        this._battleSource = null;      // текущий играющий AudioBufferSourceNode боевой темы
        this._battleGain = null;        // GainNode для плавного fade
        this._isBattleMusicPlaying = false;
        this._battleStartId = 0;        // защита от гонок при быстром старте/стопе

        this._backgroundGain = null;    // GainNode фоновой музыки (для duck при бое, если появится)

        this._unlocked = false;
        this._setupUnlockOnGesture();
    }

    // === AudioContext создаётся лениво (браузеры блокируют автозапуск звука) ===
    _ensureContext() {
        if (this._ctx) return this._ctx;
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) {
            log('Web Audio API недоступен в этом браузере', 'warning');
            return null;
        }
        this._ctx = new AudioCtx();
        return this._ctx;
    }

    _setupUnlockOnGesture() {
        const unlock = () => {
            const ctx = this._ensureContext();
            if (ctx && ctx.state === 'suspended') {
                ctx.resume().catch(() => {});
            }
            this._unlocked = true;
            window.removeEventListener('pointerdown', unlock);
            window.removeEventListener('keydown', unlock);
        };
        window.addEventListener('pointerdown', unlock, { once: true });
        window.addEventListener('keydown', unlock, { once: true });
    }

    async _loadBuffer(url) {
        if (!url) return null;
        if (this._buffers.has(url)) return this._buffers.get(url);
        if (this._loadingPromises.has(url)) return this._loadingPromises.get(url);

        const ctx = this._ensureContext();
        if (!ctx) return null;

        const promise = fetch(url)
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status} при загрузке ${url}`);
                return res.arrayBuffer();
            })
            .then((arrayBuffer) => ctx.decodeAudioData(arrayBuffer))
            .then((buffer) => {
                this._buffers.set(url, buffer);
                this._loadingPromises.delete(url);
                return buffer;
            })
            .catch((err) => {
                log(`Не удалось загрузить трек ${url}: ${err.message}`, 'error');
                this._loadingPromises.delete(url);
                return null;
            });

        this._loadingPromises.set(url, promise);
        return promise;
    }

    /** Предзагрузка (можно вызвать заранее, чтобы бой стартовал без задержки) */
    async preload() {
        const urls = Object.values(this._tracks).filter(Boolean);
        await Promise.all(urls.map((url) => this._loadBuffer(url)));
        log('Треки предзагружены', 'success');
    }

    // === ГЛАВНОЕ: включить боевую музыку (плавно, п.4 ТЗ) ===
    async playBattleMusic() {
        const url = this._tracks.battle;
        if (!url) return;

        const ctx = this._ensureContext();
        if (!ctx) return;
        if (ctx.state === 'suspended') {
            try { await ctx.resume(); } catch (_) {}
        }

        // защита от повторного запуска, если уже играет
        if (this._isBattleMusicPlaying) return;

        const myId = ++this._battleStartId;
        const buffer = await this._loadBuffer(url);
        if (!buffer) return;
        if (myId !== this._battleStartId) return; // бой уже закончился, пока грузили

        this._stopBattleSourceImmediately();

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = this._config.loop;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, ctx.currentTime);
        source.connect(gain).connect(ctx.destination);

        // плавный fade-in — без щелчков и рывков
        gain.gain.linearRampToValueAtTime(
            this._config.battleVolume,
            ctx.currentTime + this._config.fadeInSeconds
        );

        source.start(0);

        this._battleSource = source;
        this._battleGain = gain;
        this._isBattleMusicPlaying = true;

        this.duckBackgroundTrack(true);

        log('Боевая тема запущена', 'success');
    }

    // === ГЛАВНОЕ: выключить боевую музыку (плавно) ===
    stopBattleMusic() {
        if (!this._isBattleMusicPlaying) return;
        this._battleStartId++; // отменяем любую отложенную загрузку/старт

        const ctx = this._ctx;
        const source = this._battleSource;
        const gain = this._battleGain;
        this._isBattleMusicPlaying = false;

        if (!ctx || !source || !gain) return;

        const fadeOut = this._config.fadeOutSeconds;
        const now = ctx.currentTime;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.linearRampToValueAtTime(0, now + fadeOut);

        try {
            source.stop(now + fadeOut + 0.05);
        } catch (_) {}

        this._battleSource = null;
        this._battleGain = null;
        this.duckBackgroundTrack(false);

        log('Боевая тема остановлена (fade-out)', 'info');
    }

    _stopBattleSourceImmediately() {
        if (this._battleSource) {
            try { this._battleSource.stop(); } catch (_) {}
            this._battleSource = null;
            this._battleGain = null;
        }
    }

    /** Приглушить/вернуть громкость фоновой музыки мира на время боя (если она есть) */
    duckBackgroundTrack(isDucked) {
        if (!this._backgroundGain || !this._ctx) return;
        const now = this._ctx.currentTime;
        const target = isDucked ? 0.08 : 1.0;
        this._backgroundGain.gain.cancelScheduledValues(now);
        this._backgroundGain.gain.setValueAtTime(this._backgroundGain.gain.value, now);
        this._backgroundGain.gain.linearRampToValueAtTime(target, now + 0.6);
    }

    isBattleMusicPlaying() {
        return this._isBattleMusicPlaying;
    }

    destroy() {
        this.stopBattleMusic();
        if (this._ctx) {
            this._ctx.close().catch(() => {});
            this._ctx = null;
        }
        this._buffers.clear();
    }
}
