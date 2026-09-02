// assets/games/circle-of-hell/core/Game.js

import { GameMap } from '../modules/map/Map.js';
import { Player } from './Player.js';
import { Camera } from './Camera.js';
import { Renderer } from '../modules/rendering/Renderer.js';
import { Minimap } from '../modules/rendering/Minimap.js';
import { AudioManager } from '../modules/audio/AudioManager.js';
import { BattleManager } from '../modules/combat/BattleManager.js';
import { BattleRenderer } from '../modules/combat/BattleRenderer.js';
import { CLASSES } from '../modules/data/GameContent.js';
import { createPlayerUnit, createEnemyUnit } from '../modules/combat/BattleUnit.js';
import { NPCWorld } from '../modules/npc/NPCWorld.js';
import { OfflineBattleCheckpoint } from '../modules/offline/OfflineBattleCheckpoint.js';

// ============================================================
// П.3 ТЗ: "Весь код с подключением базы данных пока убери и не
// оформляй, чтобы можно было проверить именно базу"
// ------------------------------------------------------------
// Флаг ниже отключает ЛЮБЫЕ сетевые обращения к БД-эндпоинтам
// мультиплеера (join.php / update.php / leave.php). Сам клиентский
// код мультиплеера физически удалён из Game.js (не просто закомменчен),
// остались только безопасные заглушки getOtherPlayers()/getOnlineStatus(),
// чтобы Renderer и Minimap не падали. Когда БД будет протестирована
// отдельно — здесь включится новый, отдельно написанный модуль сети.
// ============================================================
const DB_INTEGRATION_ENABLED = false;

const DEFAULT_CONFIG = {
    spawnX: null,
    spawnY: null,
    smoothSpeed: 0.25,
    maxDeltaTime: 0.05,
    circleId: 1,
    playerSpeed: 0.06,
    visibilityRadius: 35,
    showFPS: true,
    debugMode: false,
    // класс игрока по умолчанию для боевой системы (п.2 плана)
    playerClassId: 'carnivore',
};

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
let currentLogLevel = (typeof window !== 'undefined' && window.location?.search?.includes('debug=true')) ? 0 : 1;

function log(message, type = 'info', ...args) {
    const msgLevel = LOG_LEVELS[type] ?? 1;
    if (msgLevel < currentLogLevel) return;
    const prefix = '🟢 [Game.js]';
    const styles = {
        info: 'color: #4FC3F7; font-weight: bold;',
        success: 'color: #81C784; font-weight: bold;',
        warning: 'color: #FFB74D; font-weight: bold;',
        error: 'color: #E57373; font-weight: bold;',
        debug: 'color: #CE93D8; font-weight: bold;',
    };
    console.log(`%c${prefix} ${message}`, styles[type] || styles.info, ...args);
}

export class Game {
    constructor(canvas, options = {}) {
        log('НАЧАЛО конструктора', 'info');

        const config = { ...DEFAULT_CONFIG, ...options };
        this._config = config;

        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;
        this._signal = options.signal || null;

        // --- Данные пользователя (из index.js) ---
        // P1: строгая проверка
        this._userId = (options.userId !== undefined && options.userId !== null) ? options.userId : null;
        this._userNickname = options.userNickname || 'Гость';
        this._playerNickname = options.playerNickname || options.character?.name || 'Безымянный';
        // Этап 8: лёгкий локальный инвентарь ресурсов. Позже сервер заменит
        // этот слой постоянным инвентарём персонажа.
        this.resources = { wood: 0, stone: 0, ore: 0, herb: 0 };
        try {
            const saved = JSON.parse(localStorage.getItem(`circleOfHellResources:${config.circleId}`) || 'null');
            if (saved && typeof saved === 'object') Object.assign(this.resources, saved);
        } catch (_) {}

        // U2: Восстановление из localStorage, если userId не передан
        if (this._userId === null) {
            try {
                const cached = localStorage.getItem('circleOfHellUser');
                if (cached) {
                    const data = JSON.parse(cached);
                    if (data && data.userId !== null && data.userId !== undefined) {
                        this._userId = data.userId;
                        this._userNickname = data.userNickname || 'Гость';
                        log(`👤 Восстановлены данные пользователя из localStorage: ID=${this._userId}, ник=${this._userNickname}`, 'info');
                    }
                }
            } catch (e) {
                // игнорируем
            }
        }

        // --- Карта ---
        log(`Загрузка статической карты круга: ${config.circleId}`, 'info');
        this.map = new GameMap({ circleId: config.circleId });

        // NPC: logical groups are cheap; only nearby representatives become visual agents.
        this.npcWorld = new NPCWorld({ map: this.map, player: null, maxVisualAgents: 48 });
        this.offlineBattleCheckpoint = new OfflineBattleCheckpoint(config.circleId);

        // --- Игрок ---
        const spawnX = Number.isFinite(config.spawnX) ? config.spawnX : this.map.definition.spawn.x;
        const spawnY = Number.isFinite(config.spawnY) ? config.spawnY : this.map.definition.spawn.y;
        log(`Создание игрока на (${spawnX}, ${spawnY})`, 'info');
        this.player = new Player(spawnX, spawnY, {
            speed: config.playerSpeed,
        });

        this.npcWorld.player = this.player;
        // Базовые демонстрационные группы. Это 2 записи состояния вместо десятков независимых NPC.
        this.npcWorld.spawnGroup({ type: 'workers', count: 40, x: spawnX + 8, y: spawnY + 6, targetX: spawnX + 14, targetY: spawnY + 10, state: 'moving', speed: 0.65 });
        this.npcWorld.spawnGroup({ type: 'camp', count: 22, x: spawnX - 10, y: spawnY + 4, targetX: spawnX - 7, targetY: spawnY + 7, state: 'moving', speed: 0.28 });
        this.npcWorld.addPopulation('first-circle-camps', { count: 73, working:31, sleeping:18, wandering:12, absent:12 });

        // P8: Сохраняем последнюю валидную позицию
        this._lastValidX = this.player.x;
        this._lastValidY = this.player.y;

        this._findSafeSpawn(spawnX, spawnY);

        // --- Камера ---
        log('Создание камеры', 'info');
        this.camera = new Camera(this.player);
        this.camera.setZoom(1.0);
        this.camera.snapToPlayer();

        // --- Рендерер ---
        log('Создание рендерера', 'info');
        this.renderer = new Renderer(this.ctx, this.map, this.camera, this.player, this);
        this.renderer.updateSize(this.canvas.width, this.canvas.height, this.camera.getZoom());
        if (config.debugMode) {
            this.renderer.debugMode = true;
        }

        // === МИНИКАРТА ===
        log('Создание миникарты', 'info');
        this.minimap = new Minimap(this.map, this.player, this.camera);
        this.minimap.setVisible(true);
        this._setupMinimapContainer();

        // ============================================================
        // 🎮 МУЛЬТИПЛЕЕР / БД — ОТКЛЮЧЕНО (см. DB_INTEGRATION_ENABLED, п.3 ТЗ)
        // Клиентский код синхронизации с сервером убран из Game.js,
        // чтобы БД можно было тестировать отдельно от игрового кода.
        // ============================================================
        this._multiplayer = { enabled: false, initialized: false };

        // P7: время последней очистки кэша
        this._lastCacheCleanTime = performance.now();

        // ============================================================
        // 🔊 АУДИО (п.2 и п.4 ТЗ): боевая тема включается только в бою
        // ============================================================
        this.audio = new AudioManager({
            battle: new URL('../assets/audio/battle-theme.mp3', import.meta.url).href,
        });
        // Боевая тема загружается лениво при первом реальном бою.

        // ============================================================
        // ⚔️ БОЕВАЯ СИСТЕМА (п.2.2 и п.6 плана)
        // ============================================================
        this.battle = null;
        this.battleRenderer = null;
        this._playerClassId = config.playerClassId;

        // --- Управление ---
        this.keys = { w: false, a: false, s: false, d: false };
        this.running = false;
        this.lastTime = 0;
        this._animationId = null;
        this._paused = false;
        this._isDestroyed = false;

        // Направления (8)
        this.directionMap = {
            0:   { w: [ -1, -1], a: [-1,  1], s: [ 1,  1], d: [ 1, -1] },
            90:  { w: [-1,  1], a: [ 1,  1], s: [ 1, -1], d: [-1, -1] },
            180: { w: [ 1,  1], a: [ 1, -1], s: [-1, -1], d: [-1,  1] },
            270: { w: [ 1, -1], a: [-1, -1], s: [-1,  1], d: [ 1,  1] },
        };

        this._cachedAngle = 0;
        this._cachedRoundedAngle = 0;

        this.smoothDx = 0;
        this.smoothDy = 0;
        this.smoothSpeed = config.smoothSpeed;

        this.lastPressedKey = null;

        // --- Переменные для бега ---
        this.sprintMultiplier = 1;
        this.sprintByDoubleTap = false;
        this.lastPressTimes = { w: 0, a: 0, s: 0, d: 0 };
        this.doubleTapThreshold = 300;
        this.shiftPressed = false;

        // --- Таймеры ---
        this._resizeTimeout = null;
        this._cacheCleanCounter = 0;

        // --- Управление ---
        this._setupControls();

        // --- Фоновая генерация чанков ---
        // Работает только при наличии свободного времени браузера и не держит
        // постоянный setInterval, который будил бы игру даже без движения.
        this._generationTask = null;
        this._generationPending = false;
        this._requestChunkGeneration();

        // --- Мультиплеер отключён на время проверки БД (п.3 ТЗ), см. DB_INTEGRATION_ENABLED ---
        if (DB_INTEGRATION_ENABLED) {
            log('🎮 Мультиплеер включён бы здесь — но код синхронизации сейчас удалён из проекта', 'warning');
        }

        if (this._signal) {
            this._signal.addEventListener('abort', () => {
                log('Получен сигнал abort, уничтожаем игру', 'info');
                this.destroy();
            }, { once: true });
        }

        log(`ФИНАЛЬНЫЙ СПАВН ИГРОКА: (${this.player.x}, ${this.player.y})`, 'info');
        log('Управление: WASD — движение, Q/E — поворот, +/- — зум, M — миникарта', 'info');
        log('Игра инициализирована', 'success');
    }

    // === НАСТРОЙКА КОНТЕЙНЕРА ДЛЯ МИНИКАРТЫ ===
    _setupMinimapContainer() {
        const container = this.canvas.parentElement;
        if (!container) return;

        let minimapContainer = document.getElementById('minimap-container');
        if (!minimapContainer) {
            minimapContainer = document.createElement('div');
            minimapContainer.id = 'minimap-container';
            minimapContainer.style.cssText = `
                position: absolute;
                top: 20px;
                right: 20px;
                pointer-events: none;
                z-index: 1000;
                border-radius: 8px;
                overflow: hidden;
                box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            `;
            container.appendChild(minimapContainer);
        }

        let minimapCanvas = document.getElementById('minimap-canvas');
        if (!minimapCanvas) {
            minimapCanvas = document.createElement('canvas');
            minimapCanvas.id = 'minimap-canvas';
            minimapCanvas.style.cssText = `
                display: block;
                width: 100%;
                height: 100%;
                pointer-events: none;
            `;
            minimapContainer.appendChild(minimapCanvas);
        }

        this.minimap.setCanvas(minimapCanvas);
        this._updateMinimapSize();
    }

    _updateMinimapSize() {
        const container = document.getElementById('minimap-container');
        if (!container) return;

        const size = Math.min(Math.max(window.innerWidth * 0.15, 150), 300);
        container.style.width = size + 'px';
        container.style.height = size + 'px';

        const canvas = document.getElementById('minimap-canvas');
        if (canvas) {
            canvas.width = size;
            canvas.height = size;
            if (this.minimap) {
                this.minimap.setSize(size, size);
            }
        }
    }

    // === ФОНОВАЯ ГЕНЕРАЦИЯ ЧАНКОВ ===
    _requestChunkGeneration() {
        if (this._isDestroyed || this._generationPending || !this.map || !this.player) return;
        this._generationPending = true;
        const run = (deadline) => {
            this._generationTask = null;
            this._generationPending = false;
            if (this._isDestroyed || !this.running || this._paused || !this.map || !this.player) return;
            const budget = deadline?.timeRemaining ? Math.max(1, deadline.timeRemaining()) : 4;
            const count = budget > 8 ? 2 : 1;
            const loaded = this.map.generateNextChunks(this.player.x, this.player.y, count);
            if (loaded > 0 && this.map.getStats().queueSize > 0) this._requestChunkGeneration();
        };
        if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
            this._generationTask = window.requestIdleCallback(run, { timeout: 250 });
        } else {
            this._generationTask = setTimeout(() => run(null), 16);
        }
    }

    // === ПОИСК БЕЗОПАСНОГО СПАВНА ===
    _findSafeSpawn(startX, startY) {
        const tile = this.map.getTile(startX, startY);
        if (tile && tile.walkable) {
            log(`Спавн на (${startX}, ${startY}) проходим`, 'debug');
            return;
        }

        log(`Тайл (${startX}, ${startY}) непроходим! Ищем ближайший...`, 'warning');
        
        for (let radius = 1; radius < 100; radius++) {
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
                    const nx = startX + dx;
                    const ny = startY + dy;
                    const t = this.map.getTile(nx, ny);
                    if (t && t.walkable) {
                        this.player.x = nx;
                        this.player.y = ny;
                        log(`✅ Спавн перемещён на (${nx}, ${ny})`, 'success');
                        return;
                    }
                }
            }
        }
        
        log('⚠️ Не найден проходимый тайл, используем расширенный fallback', 'warning');
        const fallbacks = [
            [0, 0], [1, 0], [0, 1], [-1, 0], [0, -1],
            [1, 1], [-1, -1], [1, -1], [-1, 1],
            [2, 0], [0, 2], [-2, 0], [0, -2],
            [2, 2], [-2, -2], [2, -2], [-2, 2],
            [3, 0], [0, 3], [-3, 0], [0, -3]
        ];
        
        for (const [fx, fy] of fallbacks) {
            const t = this.map.getTile(fx, fy);
            if (t && t.walkable) {
                this.player.x = fx;
                this.player.y = fy;
                log(`✅ Спавн принудительно установлен на (${fx}, ${fy})`, 'success');
                return;
            }
        }
        
        log('⚠️ Критическая ошибка: не найден ни один проходимый тайл! Создаём тайл под игроком.', 'error');
        this.map._forceTile(0, 0, 1);
        this.player.x = 0;
        this.player.y = 0;
        log(`✅ Создан проходимый тайл в центре карты, игрок установлен на (0, 0)`, 'success');
    }

    // === УПРАВЛЕНИЕ ===
    _setupControls() {
        const signal = this._signal;
        this._boundHandlers = {};

        const onKeyDown = (e) => {
            const code = e.code;
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.target.closest('.modal, .dialog')) return;

            const moveKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];
            if (moveKeys.includes(code)) {
                const key = code.toLowerCase().replace('key', '');
                const now = performance.now();

                if (!this.keys[key] && (now - this.lastPressTimes[key] < this.doubleTapThreshold)) {
                    this.sprintByDoubleTap = true;
                    this._updateSprintMultiplier();
                }
                this.lastPressTimes[key] = now;

                this.keys[key] = true;
                this.lastPressedKey = key;
                e.preventDefault();
            }

            if (code === 'ShiftLeft' || code === 'ShiftRight') {
                this.shiftPressed = true;
                this._updateSprintMultiplier();
                e.preventDefault();
            }

            if (code === 'KeyQ') { this.camera.rotate(-90); e.preventDefault(); }
            if (code === 'KeyE') { this.camera.rotate(90); e.preventDefault(); }

            if (code === 'Equal' || code === 'NumpadAdd') {
                e.preventDefault();
                this.camera.zoomIn();
                log(`🔍 Зум: ${this.camera.zoom.toFixed(2)}`, 'debug');
            }
            if (code === 'Minus' || code === 'NumpadSubtract') {
                e.preventDefault();
                this.camera.zoomOut();
                log(`🔍 Зум: ${this.camera.zoom.toFixed(2)}`, 'debug');
            }

            if (code === 'KeyM') {
                e.preventDefault();
                if (this.minimap) {
                    const visible = this.minimap.toggleVisibility();
                    log(`🗺️ Миникарта: ${visible ? 'показана' : 'скрыта'}`, 'info');
                }
            }

            if (code === 'KeyX') {
                e.preventDefault();
                this.openTeleportDialog();
                return;
            }

            if (code === 'KeyF') {
                e.preventDefault();
                this.harvestNearbyResource();
                return;
            }

            if (code === 'KeyH') {
                if (this.renderer) {
                    this.renderer.toggleHUD();
                    e.preventDefault();
                    log('💡 HUD переключен', 'info');
                }
            }

            // ТЕСТОВЫЙ ЗАПУСК БОЯ: пока на карте нет системы встреч с
            // врагами, бой можно вызвать вручную клавишей B, чтобы
            // проверить боевую систему и музыку (п.2, 2.2, 4 ТЗ).
            if (code === 'KeyB') {
                e.preventDefault();
                if (!this.battle) this.startBattle(['imp_slave', 'imp_slave'], false);
            }
        };

        const onKeyUp = (e) => {
            const code = e.code;
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            const moveKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];
            if (moveKeys.includes(code)) {
                const key = code.toLowerCase().replace('key', '');
                this.keys[key] = false;
                e.preventDefault();

                const anyMove = this.keys.w || this.keys.a || this.keys.s || this.keys.d;
                if (!anyMove && this.sprintByDoubleTap) {
                    this.sprintByDoubleTap = false;
                    this._updateSprintMultiplier();
                }
            }

            if (code === 'ShiftLeft' || code === 'ShiftRight') {
                this.shiftPressed = false;
                this._updateSprintMultiplier();
                e.preventDefault();
            }
        };

        const addOpts = signal ? { signal } : undefined;
        const onBlur = () => {
            this.keys.w = this.keys.a = this.keys.s = this.keys.d = false;
            this.shiftPressed = false;
            this.sprintByDoubleTap = false;
            this.smoothDx = this.smoothDy = 0;
            if (this.player) this.player.isMoving = false;
            this._updateSprintMultiplier();
        };

        window.addEventListener('keydown', onKeyDown, addOpts);
        window.addEventListener('keyup', onKeyUp, addOpts);
        window.addEventListener('blur', onBlur, addOpts);

        this._boundHandlers = { onKeyDown, onKeyUp, onBlur };
    }

    _updateSprintMultiplier() {
        if (this.shiftPressed || this.sprintByDoubleTap) {
            this.sprintMultiplier = 2;
        } else {
            this.sprintMultiplier = 1;
        }
    }


    // ============================================================
    // ЗАГЛУШКИ ВЗАМЕН УДАЛЁННОГО СЕТЕВОГО КОДА (п.3 ТЗ)
    // Renderer.js и Minimap.js вызывают эти методы для отрисовки
    // других игроков — пока БД/сеть отключены, просто отдаём пусто.
    // ============================================================
    getOtherPlayers() {
        return [];
    }

    getOnlineStatus() {
        return {
            isOnline: false,
            playersOnline: 0,
            selfId: this._userId,
            selfNickname: this._userNickname,
        };
    }

    // === ТЕЛЕПОРТАЦИЯ ДЛЯ ОТЛАДКИ/НАВИГАЦИИ БОЛЬШОЙ КАРТЫ ===
    openTeleportDialog() {
        if (this._teleportDialog) return;
        const root = this.canvas?.parentElement;
        if (!root) return;
        const modal = document.createElement('div');
        modal.className = 'teleport-dialog';
        modal.innerHTML = `<div class="teleport-card">
            <h2>Перемещение по координатам</h2>
            <p>Введите мировые координаты X и Y. <small>Esc — отмена</small></p>
            <div class="teleport-fields"><input data-x type="number" step="1" placeholder="X"><input data-y type="number" step="1" placeholder="Y"></div>
            <div class="teleport-actions"><button data-cancel>Отмена</button><button data-go>Переместиться</button></div>
            <div class="teleport-status"></div>
        </div>`;
        root.appendChild(modal); this._teleportDialog=modal;
        const x=modal.querySelector('[data-x]'), y=modal.querySelector('[data-y]'), status=modal.querySelector('.teleport-status');
        const close=()=>{modal.remove();this._teleportDialog=null;};
        const go=()=>{const tx=Math.round(Number(x.value)),ty=Math.round(Number(y.value)); if(!Number.isFinite(tx)||!Number.isFinite(ty)){status.textContent='Введите обе координаты.';return;} if(!this.teleportTo(tx,ty)){status.textContent='Эта точка находится вне круга или непроходима.';return;} close();};
        modal.querySelector('[data-go]').onclick=go; modal.querySelector('[data-cancel]').onclick=close;
        const esc=(ev)=>{if(ev.code==='Escape'){close();window.removeEventListener('keydown',esc,true);}}; window.addEventListener('keydown',esc,true);
        modal.addEventListener('keydown',ev=>{if(ev.code==='Enter')go();});
        x.value=Math.round(this.player.x); y.value=Math.round(this.player.y); x.focus();
    }

    teleportTo(x,y) {
        if (!this.map || !this.player || !this.camera) return false;
        const target=this.map.getTile(x,y);
        if(!target || !target.walkable) return false;
        // Не допускаем телепортацию в границу/пустоту и сразу сбрасываем движение.
        this.keys.w=this.keys.a=this.keys.s=this.keys.d=false;
        this.player.x=x; this.player.y=y; this.player.isMoving=false;
        this.smoothDx=this.smoothDy=0;
        this.camera.x=x; this.camera.y=y;
        if(this.map.generateNextChunks) this.map.generateNextChunks(x,y,12);
        if(this.minimap) this.minimap.update();
        log(`🌀 Телепортация: (${x}, ${y})`,'success');
        return true;
    }

    // === ЭТАП 8: СБОР РЕСУРСОВ ===
    harvestNearbyResource() {
        if (!this.map || !this.player || typeof this.map.harvestNearestResource !== 'function') return null;
        const result = this.map.harvestNearestResource(this.player.x, this.player.y, 1.65);
        if (!result?.item || !result.amount) {
            log('⛏️ Рядом нет доступного ресурса. Подойдите ближе и нажмите F.', 'info');
            return null;
        }
        this.resources[result.item] = (this.resources[result.item] || 0) + result.amount;
        try { localStorage.setItem(`circleOfHellResources:${this._config.circleId}`, JSON.stringify(this.resources)); } catch (_) {}
        log(`⛏️ Получено: ${result.item} ×${result.amount}`, 'success');
        return result;
    }

    // === МОБИЛЬНОЕ УПРАВЛЕНИЕ ===
    setTouchKeys(keys) {
        if (keys) {
            this.keys.w = Boolean(keys.w);
            this.keys.a = Boolean(keys.a);
            this.keys.s = Boolean(keys.s);
            this.keys.d = Boolean(keys.d);
            if (!this.keys.w && !this.keys.a && !this.keys.s && !this.keys.d) {
                this.smoothDx = this.smoothDy = 0;
                if (this.player) this.player.isMoving = false;
            }
        }
    }

    // === ПОДГОТОВКА ПЕРЕД ВХОДОМ В МИР ===
    // Игра не запускает игровой цикл, пока atlas и стартовая область не готовы.
    async prepareForStart(onProgress = null) {
        const report = (stage, progress) => onProgress?.({ stage, progress });
        report('Загрузка текстур...', 0.08);
        await this.renderer.waitForAssets(15000);
        report('Текстуры загружены. Подготовка мира...', 0.40);

        const visibleRadius = this.renderer.getVisibilityRadius();
        const radius = visibleRadius + this.map.chunkSize;
        await this.map.preloadArea(this.player.x, this.player.y, radius, (done, total) => {
            const ratio = total ? done / total : 1;
            report(`Подготовка мира: ${done}/${total}`, 0.40 + ratio * 0.50);
        });

        // Прогреваем видимые списки до первого кадра: после снятия загрузочного
        // экрана рендер уже не создаёт новые стартовые чанки синхронно.
        this.map.getVisibleTiles(this.player.x, this.player.y, visibleRadius);
        this.map.getVisibleObjects(this.player.x, this.player.y, visibleRadius);
        report('Запуск игры...', 1);
        return true;
    }

    // === ЖИЗНЕННЫЙ ЦИКЛ ===
    start() {
        if (this.running) return;
        this.running = true;
        this.lastTime = performance.now();

        this._requestChunkGeneration();

        this._gameLoop(performance.now());
        log('Игровой цикл запущен', 'success');
    }

    pause() {
        if (this._paused) return;
        this._paused = true;
        log('⏸️ Игра приостановлена', 'info');
    }

    resume() {
        if (!this._paused) return;
        this._paused = false;
        this.lastTime = performance.now();
        log('▶️ Игра возобновлена', 'info');
    }

    _gameLoop(timestamp) {
        if (!this.running || this._isDestroyed) {
            this._animationId = null;
            return;
        }

        if (this._paused) {
            this._animationId = requestAnimationFrame((t) => this._gameLoop(t));
            return;
        }

        try {
            const dt = this.lastTime
                ? Math.min((timestamp - this.lastTime) / 1000, this._config.maxDeltaTime)
                : 0.016;
            this.lastTime = timestamp;

            const snapshot = {
                w: this.keys.w,
                a: this.keys.a,
                s: this.keys.s,
                d: this.keys.d,
            };

            this.update(dt, snapshot);
            this.render();
        } catch (err) {
            log(`❌ Ошибка в игровом цикле: ${err.message}`, 'error');
            log(err.stack, 'error');
        }

        this._animationId = requestAnimationFrame((t) => this._gameLoop(t));
    }

    update(dt, snapshot) {
        if (!this.camera || !this.player || !this.map || !this.renderer) return;

        // ============================================================
        // ⚔️ ПОКА ИДЁТ БОЙ: мир на паузе, персонаж "стоит" в мире и ни с
        // чем не конфликтует (п.6 плана), но не двигается и не пересекается
        // с другими врагами. Обновляется только боевая сцена (плавная
        // анимация юнитов, п.2 ТЗ).
        // ============================================================
        if (this.battle) {
            if (this.battleRenderer) this.battleRenderer.update(dt);
            this._requestChunkGeneration();
        this.camera.update(dt);
            return;
        }

        const angle = this.camera.angle;
        const isExact = Math.abs(angle % 90) < 0.001 || Math.abs(angle % 90 - 90) < 0.001;

        let dx, dy;
        if (isExact) {
            const dir = this.getDirection(snapshot);
            dx = dir.dx;
            dy = dir.dy;
        } else {
            const dir = this.getInterpolatedDirection(snapshot);
            dx = dir.dx;
            dy = dir.dy;
        }

        // Движение должно быть строго привязано к текущему состоянию клавиш.
        // Сглаживание направления здесь нельзя использовать: оно оставляло остаточный
        // вектор после keyup и персонаж делал ещё несколько шагов.
        const moveDx = dx || 0;
        const moveDy = dy || 0;
        this.smoothDx = moveDx;
        this.smoothDy = moveDy;

        if (moveDx !== 0 || moveDy !== 0) {
            this.player.move(moveDx, moveDy, dt, this.map, this.sprintMultiplier);
        } else {
            this.player.isMoving = false;
        }

        // P7: Очистка кэша раз в 5 секунд
        const now = performance.now();
        if (now - this._lastCacheCleanTime > 5000) {
            this.map.clearCache(this.player.x, this.player.y, 100);
            this._lastCacheCleanTime = now;
        }

        this.camera.update(dt);

        // NPC AI обновляется отдельно от FPS и не делает запросов в БД.
        this.npcWorld?.update(dt);

        if (this.minimap && this._cacheCleanCounter % 5 === 0) {
            this.minimap.update();
        }
        this._cacheCleanCounter++;
    }

    render() {
        if (this.renderer) {
            this.renderer.render();
        }

        if (this.minimap) {
            this.minimap.render();
        }

        // Бой рисуется ПОВЕРХ экрана игры (п.6 плана), см. BattleRenderer
        if (this.battle && this.battleRenderer) {
            this.battleRenderer.render();
        }
    }

    // ============================================================
    // ⚔️ ЗАПУСК / ЗАВЕРШЕНИЕ БОЯ (п.2, 2.2, 4 ТЗ)
    // ============================================================

    /**
     * Запускает бой. enemyTemplateIds — список id из ENEMY_TEMPLATES
     * (modules/combat/BattleUnit.js), например ['imp_slave','imp_slave'].
     * isBoss -> сетка 15х15 вместо 10х10 (п.6 плана).
     */
    startBattle(enemyTemplateIds = ['imp_slave'], isBoss = false) {
        if (this.battle) return; // бой уже идёт

        const classDef = CLASSES[this._playerClassId] || CLASSES.carnivore;
        const size = isBoss ? 15 : 10;
        const playerUnit = createPlayerUnit(classDef, 2, Math.floor(size / 2));

        const enemyUnits = enemyTemplateIds.map((tplId, i) =>
            createEnemyUnit(tplId, size - 3, Math.floor(size / 2) + (i - Math.floor(enemyTemplateIds.length / 2)), i)
        );

        this.battle = new BattleManager([playerUnit], enemyUnits, {
            isBoss,
            onEnd: (result) => this._onBattleEnd(result),
            onPhaseChange: () => { if (this.battleRenderer) this.battleRenderer.render(); },
            onAnimation: () => { if (this.battleRenderer) this.battleRenderer.render(); },
        });

        const container = this.canvas.parentElement;
        this.battleRenderer = new BattleRenderer(container, this.battle);

        // п.4 ТЗ: боевая музыка включается ТОЛЬКО во время боя, плавно
        this.audio.playBattleMusic();

        log('⚔️ Бой начат', 'success');
    }

    _onBattleEnd(result) {
        log(`⚔️ Бой окончен: ${result.winner === 'player' ? 'победа' : 'поражение'}`, 'success');
        // Небольшая пауза, чтобы игрок увидел итог боя, прежде чем экран закроется
        setTimeout(() => this._endBattle(), 1200);
    }

    _endBattle() {
        if (!this.battle) return;

        // п.4 ТЗ: музыка боя плавно выключается сразу по завершении боя
        this.audio.stopBattleMusic();

        this.battle.destroy();
        this.battle = null;

        if (this.battleRenderer) {
            this.battleRenderer.destroy();
            this.battleRenderer = null;
        }

        this.lastTime = performance.now();
    }

    // === МЕТОДЫ ДЛЯ НАПРАВЛЕНИЙ ===
    getCachedAngle() {
        if (!this.camera) return 0;
        const currentAngle = this.camera.angle;
        if (currentAngle !== this._cachedAngle) {
            this._cachedAngle = currentAngle;
            this._cachedRoundedAngle = Math.round(currentAngle / 90) * 90;
            this._cachedRoundedAngle = ((this._cachedRoundedAngle % 360) + 360) % 360;
        }
        return this._cachedRoundedAngle;
    }

    getDirection(snapshot) {
        const pressed = [];
        if (snapshot.w) pressed.push('w');
        if (snapshot.a) pressed.push('a');
        if (snapshot.s) pressed.push('s');
        if (snapshot.d) pressed.push('d');

        if (pressed.length === 0) return { dx: 0, dy: 0 };

        const hasW = snapshot.w;
        const hasS = snapshot.s;
        const hasA = snapshot.a;
        const hasD = snapshot.d;

        if (hasW && hasS) {
            if (this.lastPressedKey === 'w') pressed.splice(pressed.indexOf('s'), 1);
            else if (this.lastPressedKey === 's') pressed.splice(pressed.indexOf('w'), 1);
        }
        if (hasA && hasD) {
            if (this.lastPressedKey === 'a') pressed.splice(pressed.indexOf('d'), 1);
            else if (this.lastPressedKey === 'd') pressed.splice(pressed.indexOf('a'), 1);
        }

        if (pressed.length === 0) return { dx: 0, dy: 0 };

        const angle = this.getCachedAngle();
        const dirs = this.directionMap[angle];
        if (!dirs) return { dx: 0, dy: 0 };

        let dx = 0, dy = 0;
        for (const key of pressed) {
            const vec = dirs[key];
            if (vec) {
                dx += vec[0];
                dy += vec[1];
            }
        }

        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0.001) {
            dx /= len;
            dy /= len;
        }
        return { dx, dy };
    }

    getInterpolatedDirection(snapshot) {
        if (!this.camera) return { dx: 0, dy: 0 };
        const angle = this.camera.angle;
        const angles = [0, 90, 180, 270];
        let prevAngle = 0, nextAngle = 0;

        for (let i = 0; i < angles.length; i++) {
            const a = angles[i];
            const next = angles[(i + 1) % angles.length];
            if (angle >= a && angle < next) {
                prevAngle = a;
                nextAngle = next;
                break;
            }
            if (angle >= 270 && angle < 360) {
                prevAngle = 270;
                nextAngle = 0;
                break;
            }
        }

        if (angle === prevAngle || angle === nextAngle) {
            return this.getDirection(snapshot);
        }

        const dirsPrev = this.directionMap[prevAngle];
        const dirsNext = this.directionMap[nextAngle];
        if (!dirsPrev || !dirsNext) return { dx: 0, dy: 0 };

        const pressed = [];
        if (snapshot.w) pressed.push('w');
        if (snapshot.a) pressed.push('a');
        if (snapshot.s) pressed.push('s');
        if (snapshot.d) pressed.push('d');
        if (pressed.length === 0) return { dx: 0, dy: 0 };

        let dx = 0, dy = 0;
        for (const key of pressed) {
            const v1 = dirsPrev[key];
            const v2 = dirsNext[key];
            if (!v1 || !v2) continue;

            let t = 0;
            if (nextAngle === 0 && prevAngle === 270) {
                const adjustedAngle = angle < 180 ? angle + 360 : angle;
                const adjustedPrev = 270;
                const adjustedNext = 360;
                t = (adjustedAngle - adjustedPrev) / (adjustedNext - adjustedPrev);
            } else {
                t = (angle - prevAngle) / (nextAngle - prevAngle);
            }

            const ix = v1[0] * (1 - t) + v2[0] * t;
            const iy = v1[1] * (1 - t) + v2[1] * t;
            dx += ix;
            dy += iy;
        }

        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0.001) {
            dx /= len;
            dy /= len;
        }
        return { dx, dy };
    }

    // === УНИЧТОЖЕНИЕ ===
    destroy() {
        if (this._isDestroyed) return;
        this._isDestroyed = true;
        log('УНИЧТОЖЕНИЕ ИГРЫ', 'info');

        if (this._teleportDialog) { this._teleportDialog.remove(); this._teleportDialog = null; }
        if (this.battle) this._endBattle();
        if (this.audio) this.audio.destroy();

        this.running = false;
        if (this._animationId) {
            cancelAnimationFrame(this._animationId);
            this._animationId = null;
        }

        if (this._generationTask) {
            if (typeof cancelIdleCallback === 'function') cancelIdleCallback(this._generationTask);
            else clearTimeout(this._generationTask);
            this._generationTask = null;
        }
        this._generationPending = false;

        if (this._resizeTimeout) {
            clearTimeout(this._resizeTimeout);
            this._resizeTimeout = null;
        }

        if (this._boundHandlers) {
            window.removeEventListener('keydown', this._boundHandlers.onKeyDown);
            window.removeEventListener('keyup', this._boundHandlers.onKeyUp);
            if (this._boundHandlers.onBlur) window.removeEventListener('blur', this._boundHandlers.onBlur);
            log('Обработчики удалены вручную', 'debug');
        }

        if (this.player && typeof this.player.clearCache === 'function') {
            this.player.clearCache();
        }

        if (this.map) {
            this.map.destroy();
            this.map = null;
        }

        if (this.minimap) {
            this.minimap.destroy();
            this.minimap = null;
        }

        this.camera = null;
        this.npcWorld?.destroy?.();
        this.npcWorld = null;
        this.renderer = null;
        this.keys = null;
        this._boundHandlers = null;

        log('Игра уничтожена', 'success');
    }

}