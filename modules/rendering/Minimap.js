// Миникарта для больших статических миров.
// В отличие от старой версии она не пытается загрузить весь мир ради картинки.
// Фон строится по макрокарте чанков и кэшируется отдельно от позиции игрока.

const BIOME_COLORS = {
    void: 'rgba(0,0,0,0)',
    ground: '#7a342f',
    grass: '#4d6c2f',
    forest: '#5a3f28',
    quarry: '#4f9bb1',
    rock: '#66635f',
    camp: '#c89f72',
    factory: '#3b2639',
    supply: '#e5cf39',
    shop: '#6e3e86',
    pharmacy: '#c76a9c',
    spawn: '#ffffff',
};

export class Minimap {
    constructor(map, player, camera) {
        this.map = map;
        this.player = player;
        this.camera = camera;
        this.canvas = null;
        this.ctx = null;
        this.width = 200;
        this.height = 200;
        this.visible = true;
        this._background = null;
        this._backgroundKey = '';
        console.log('🗺️ [Minimap] Инициализирована для статической макрокарты');
    }

    setCanvas(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;
        this._invalidate();
    }

    setSize(width, height) {
        this.width = width;
        this.height = height;
        if (this.canvas) {
            this.canvas.width = width;
            this.canvas.height = height;
        }
        this._invalidate();
    }

    setVisible(visible) {
        this.visible = visible;
        if (this.canvas) this.canvas.style.display = visible ? 'block' : 'none';
    }

    toggleVisibility() {
        this.setVisible(!this.visible);
        return this.visible;
    }

    isVisible() { return this.visible; }

    _invalidate() {
        this._background = null;
        this._backgroundKey = '';
    }

    _buildBackground() {
        if (!this.ctx || !this.map?.definition) return;
        const definition = this.map.definition;
        const chunks = definition.worldChunks?.width || 100;
        const key = `${chunks}:${this.width}:${this.height}:${this.map.circleId}`;

        if (this._background && this._backgroundKey === key) return;

        const offscreen = document.createElement('canvas');
        offscreen.width = this.width;
        offscreen.height = this.height;
        const ctx = offscreen.getContext('2d');
        ctx.clearRect(0, 0, this.width, this.height);

        // Для 1000×1000 чанков рисуем по одному пикселю на несколько чанков.
        const sampleStep = Math.max(1, Math.ceil(chunks / Math.min(this.width, this.height)));
        const minChunk = -Math.floor(chunks / 2);
        const maxChunk = minChunk + chunks;
        const pixel = Math.max(1, sampleStep * this.width / chunks);

        for (let cy = minChunk; cy < maxChunk; cy += sampleStep) {
            for (let cx = minChunk; cx < maxChunk; cx += sampleStep) {
                const biome = definition.getChunkBiome(cx, cy);
                if (biome === 'void') continue;
                const px = Math.floor((cx - minChunk) / chunks * this.width);
                const py = Math.floor((cy - minChunk) / chunks * this.height);
                ctx.fillStyle = BIOME_COLORS[biome] || '#777';
                ctx.fillRect(px, py, Math.ceil(pixel), Math.ceil(pixel));
            }
        }

        // Дороги рисуются после биомов. Макрокарта уже известна и для этого
        // не требуется загружать ни одного игрового чанка.
        if (typeof definition.getRoads === 'function') {
            const roads = definition.getRoads() || [];
            const worldSize = chunks * this.map.chunkSize;
            const toMini = (point) => ({
                x: this.width / 2 + point[0] / worldSize * this.width,
                y: this.height / 2 + point[1] / worldSize * this.height,
            });
            ctx.save();
            for (const road of roads) {
                const pts = road.points || [];
                if (pts.length < 2) continue;
                ctx.strokeStyle = road.kind === 'main' ? 'rgba(231,174,91,0.88)' :
                    road.kind === 'industrial' ? 'rgba(174,110,72,0.78)' : road.kind === 'trail' ? 'rgba(132,96,63,0.48)' : 'rgba(184,145,92,0.66)';
                ctx.lineWidth = road.kind === 'main' ? 1.9 : road.kind === 'industrial' ? 1.4 : road.kind === 'trail' ? 0.7 : 1.1;
                ctx.beginPath();
                const first = toMini(pts[0]);
                ctx.moveTo(first.x, first.y);
                for (let i = 1; i < pts.length; i++) {
                    const q = toMini(pts[i]);
                    ctx.lineTo(q.x, q.y);
                }
                if (road.closed) ctx.closePath();
                ctx.stroke();
            }
            ctx.restore();
        }

        this._background = offscreen;
        this._backgroundKey = key;
    }

    update() {
        if (!this.visible || !this.canvas || !this.ctx) return;
        this._buildBackground();

        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, 0, this.width, this.height);
        if (this._background) ctx.drawImage(this._background, 0, 0);

        this._drawOtherPlayers(ctx);
        this._drawPlayer(ctx);
    }

    _worldToMinimap(x, y) {
        const chunks = this.map.definition.worldChunks?.width || 100;
        const worldSize = chunks * this.map.chunkSize;
        return {
            x: this.width / 2 + x / worldSize * this.width,
            y: this.height / 2 + y / worldSize * this.height,
        };
    }

    _drawOtherPlayers(ctx) {
        const game = window.game || this._game;
        if (!game || typeof game.getOtherPlayers !== 'function') return;
        for (const p of game.getOtherPlayers() || []) {
            const pos = this._worldToMinimap(p.x, p.y);
            if (pos.x < 0 || pos.x > this.width || pos.y < 0 || pos.y > this.height) continue;
            ctx.fillStyle = p.color || '#00FF88';
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    _drawPlayer(ctx) {
        const pos = this._worldToMinimap(this.player.x, this.player.y);
        if (pos.x < 0 || pos.x > this.width || pos.y < 0 || pos.y > this.height) return;

        ctx.fillStyle = '#FF6B35';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2);
        ctx.fill();

        const angle = this.camera.angle * Math.PI / 180;
        const endX = pos.x + Math.sin(angle) * 7;
        const endY = pos.y - Math.cos(angle) * 7;
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(endX, endY);
        ctx.stroke();
    }

    render() {
        // update() уже рисует готовый кадр.
    }

    destroy() {
        this.canvas = null;
        this.ctx = null;
        this._background = null;
        console.log('🗺️ [Minimap] Уничтожена');
    }
}
