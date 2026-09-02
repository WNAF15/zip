// assets/games/circle-of-hell/modules/rendering/IsometricRenderer.js
// Terrain renderer for the user-supplied 4×4 pixel-art atlas.
// Rows: ground, grass, stone, water.
// Columns: 0°, 90°, 180°, 270° camera-facing versions.

export class IsometricRenderer {
    constructor(ctx) {
        this.ctx = ctx;

        this.terrainAtlas = new Image();
        this.terrainAtlasLoaded = false;
        this.terrainAtlasError = null;
        this._terrainAtlasPromise = new Promise((resolve, reject) => {
            this._resolveTerrainAtlas = resolve;
            this._rejectTerrainAtlas = reject;
        });
        this.terrainAtlas.onload = async () => {
            this.terrainAtlasLoaded = true;
            try { if (typeof this.terrainAtlas.decode === 'function') await this.terrainAtlas.decode(); } catch (_) {}
            this._resolveTerrainAtlas?.(this.terrainAtlas);
            console.log('🟣 [IsometricRenderer] Загружен terrain atlas 4×4 (земля/трава/камень/вода × 4 стороны)');
        };
        this.terrainAtlas.onerror = () => {
            this.terrainAtlasError = new Error('Не удалось загрузить terrain atlas');
            this._rejectTerrainAtlas?.(this.terrainAtlasError);
            console.warn('⚠️ [IsometricRenderer] Не удалось загрузить terrain atlas');
        };
        this.terrainAtlas.src = new URL('../../assets/tiles/hell-terrain-current.png', import.meta.url).href;

        // Runtime atlas is a clean 128×128 sheet (4×4 cells, 32×32 each).
        // The source sheet's technical corner marker is removed during import so it
        // can never become a visible dot/stripe in the repeated terrain.
        this.ATLAS_COLS = 4;
        this.ATLAS_ROWS = 4;
        this.ATLAS_CELL_W = 32;
        this.ATLAS_CELL_H = 32;
        this.SOURCE_SURFACE_W = 32;
        this.SOURCE_SURFACE_H = 20;
        this.SOURCE_CANVAS_H = 32;

        // The 32 px artwork is rendered at integer 4× scale. The logical grid is
        // still based on a 2:1 surface, while the full 32 px sprite canvas is
        // bottom-anchored. Integer scaling keeps pixels sharp and avoids seams.
        this.PIXEL_SCALE = 4;
        this.BASE_TILE_W = this.SOURCE_SURFACE_W * this.PIXEL_SCALE; // 128
        this.BASE_TILE_H = this.SOURCE_SURFACE_H * this.PIXEL_SCALE; // 80
        this.BASE_SPRITE_H = this.SOURCE_CANVAS_H * this.PIXEL_SCALE; // 128

        this.TILE_W = this.BASE_TILE_W;
        this.TILE_H = this.BASE_TILE_H;
        this.SPRITE_H = this.BASE_SPRITE_H;
        this.HALF_TILE_W = this.TILE_W / 2;
        this.HALF_TILE_H = this.TILE_H / 2;
        this.INV_TILE_W = 2 / this.TILE_W;
        this.INV_TILE_H = 2 / this.TILE_H;

        this.scale = 1;
        this.angle = 0;
        this.spriteRotationIndex = 0;
        this._prevScale = 1;
        this._cachedCos = 1;
        this._cachedSin = 0;
        this._cachedAngle = 0;
        this.DEG_TO_RAD = Math.PI / 180;
    }

    setAngle(angle) {
        this.angle = angle;
        if (this._cachedAngle !== angle) {
            this._cachedAngle = angle;
            const rad = angle * this.DEG_TO_RAD;
            this._cachedCos = Math.cos(rad);
            this._cachedSin = Math.sin(rad);
        }
    }

    setSpriteRotationIndex(index) {
        this.spriteRotationIndex = ((Math.round(index) % this.ATLAS_COLS) + this.ATLAS_COLS) % this.ATLAS_COLS;
    }

    async waitForTerrainAtlas(timeoutMs = 15000) {
        if (this.terrainAtlasLoaded) return this.terrainAtlas;
        if (this.terrainAtlasError) throw this.terrainAtlasError;
        let timeoutId;
        const timeout = new Promise((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error('Превышено время загрузки terrain atlas')), timeoutMs);
        });
        try { return await Promise.race([this._terrainAtlasPromise, timeout]); }
        finally { clearTimeout(timeoutId); }
    }

    setScale(scale) {
        const newScale = Math.max(0.5, Math.min(2.0, scale));
        if (this._prevScale === newScale) return;
        this._prevScale = newScale;
        this.scale = newScale;
        this.TILE_W = this.BASE_TILE_W * newScale;
        this.TILE_H = this.BASE_TILE_H * newScale;
        this.SPRITE_H = this.BASE_SPRITE_H * newScale;
        this.HALF_TILE_W = this.TILE_W / 2;
        this.HALF_TILE_H = this.TILE_H / 2;
        this.INV_TILE_W = 2 / this.TILE_W;
        this.INV_TILE_H = 2 / this.TILE_H;
    }

    _rotateWorld(worldX, worldY) {
        return {
            x: worldX * this._cachedCos - worldY * this._cachedSin,
            y: worldX * this._cachedSin + worldY * this._cachedCos,
        };
    }

    worldToScreen(worldX, worldY) {
        if (!Number.isFinite(worldX) || !Number.isFinite(worldY)) return { x: 0, y: 0 };
        const p = this._rotateWorld(worldX, worldY);
        return {
            x: (p.x - p.y) * this.HALF_TILE_W,
            y: (p.x + p.y) * this.HALF_TILE_H,
        };
    }

    _familyRow(spriteFamily) {
        const rows = { ground: 0, grass: 1, stone: 2, water: 3 };
        return Object.prototype.hasOwnProperty.call(rows, spriteFamily) ? rows[spriteFamily] : null;
    }

    _placeholderStyle(tile) {
        const family = tile?.spriteFamily || 'ground';
        const base = tile?.color || '#8B7355';
        const styles = {
            forest: { color: '#566B35', accent: 'rgba(30,45,24,0.32)' },
            quarry: { color: '#6E6962', accent: 'rgba(40,38,35,0.34)' },
            camp: { color: '#7C6044', accent: 'rgba(55,35,24,0.28)' },
            industry: { color: '#514D49', accent: 'rgba(28,27,27,0.35)' },
            supply: { color: '#8D6744', accent: 'rgba(255,205,135,0.16)' },
            scree: { color: '#625A50', accent: 'rgba(35,31,28,0.30)' },
            'transition-ground-grass': { color: '#78633E', accent: 'rgba(95,122,55,0.35)' },
            'transition-grass-forest': { color: '#596136', accent: 'rgba(40,70,28,0.32)' },
            'transition-ground-rock': { color: '#6A5148', accent: 'rgba(62,58,53,0.32)' },
            'floor-store': { color: '#765D47', accent: 'rgba(40,30,24,0.28)' },
            'floor-tile': { color: '#5B6D70', accent: 'rgba(30,45,48,0.28)' },
            'floor-industrial': { color: '#4A4745', accent: 'rgba(24,23,22,0.34)' },
        };
        return styles[family] || { color: base, accent: 'rgba(0,0,0,0.16)' };
    }

    _placeholderSeed(x, y, family) {
        let h = Math.imul((x | 0) ^ 0x9e3779b9, 1103515245) ^ Math.imul((y | 0) ^ 0x85ebca6b, 1597334677);
        for (let i = 0; i < family.length; i++) h = Math.imul(h ^ family.charCodeAt(i), 16777619);
        return (h ^ (h >>> 16)) >>> 0;
    }

    _drawProceduralTile(tile, sx, sy, opacity, worldX, worldY) {
        const ctx = this.ctx;
        const hw = this.HALF_TILE_W;
        const hh = this.HALF_TILE_H;
        const style = this._placeholderStyle(tile);
        const family = tile?.spriteFamily || 'ground';
        const seed = this._placeholderSeed(worldX, worldY, family);
        ctx.save();
        ctx.globalAlpha = Math.min(Math.max(opacity, 0), 1);
        ctx.translate(sx, sy - hh);
        ctx.beginPath();
        ctx.moveTo(0, -hh); ctx.lineTo(hw, 0); ctx.lineTo(0, hh); ctx.lineTo(-hw, 0); ctx.closePath();
        ctx.fillStyle = style.color;
        ctx.fill();
        // Только лёгкие внутренние детали: они не выходят за границы ромба и не создают швов.
        ctx.clip();
        ctx.fillStyle = style.accent;
        const count = 2 + (seed % 4);
        for (let i = 0; i < count; i++) {
            const n = (seed >>> (i * 5)) & 31;
            const px = ((n / 31) - .5) * hw * 1.15;
            const py = ((((seed >>> (i * 3 + 2)) & 15) / 15) - .5) * hh * 0.8;
            const r = Math.max(1, Math.round(Math.min(hw, hh) * (0.025 + ((seed >>> (i + 11)) & 3) * 0.008)));
            ctx.fillRect(Math.round(px - r/2), Math.round(py - r/2), r, r);
        }
        ctx.restore();
    }

    // Матрица, которая превращает экранную форму тайла при одном из
    // кардинальных ракурсов в форму для текущего промежуточного угла.
    // Это P·R(delta)·P⁻¹ для нашей 2:1 изометрической проекции.
    _getScreenRotationMatrix(deltaDegrees) {
        const d = deltaDegrees * this.DEG_TO_RAD;
        const c = Math.cos(d);
        const s = Math.sin(d);
        const ratioX = this.HALF_TILE_W / Math.max(this.HALF_TILE_H, 0.0001);
        const ratioY = 1 / ratioX;
        return {
            a: c,
            b: s * ratioY,
            c: -s * ratioX,
            d: c,
        };
    }

    drawTile(tile, sx, sy, opacity = 1, _worldX = 0, _worldY = 0, spriteBaseAngle = null) {
        if (!tile || !Number.isFinite(sx) || !Number.isFinite(sy)) return;
        const ctx = this.ctx;
        const alpha = Math.min(Math.max(opacity, 0), 1);

        const row = this._familyRow(tile?.spriteFamily);
        if (this.terrainAtlasLoaded && row !== null) {
            const col = this.spriteRotationIndex;
            const sourceX = col * this.ATLAS_CELL_W;
            const sourceY = row * this.ATLAS_CELL_H;

            // Во время плавного поворота нельзя оставлять тайл неподвижным:
            // геометрия карты уже меняется, поэтому между ромбами появляются
            // "трещины". Поворачиваем сам sprite той же изометрической
            // матрицей. При 0° delta матрица тождественная и работает прежний
            // быстрый drawImage без дополнительных transform.
            const baseAngle = Number.isFinite(spriteBaseAngle)
                ? spriteBaseAngle
                : this.spriteRotationIndex * 90;
            const delta = ((this.angle - baseAngle + 540) % 360) - 180;
            const rotating = Math.abs(delta) > 0.001;

            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.imageSmoothingEnabled = false;

            if (rotating) {
                const m = this._getScreenRotationMatrix(delta);
                // Центр именно видимой 32×20 поверхности, а не центр полного
                // 32×32 canvas. Поэтому прозрачный верх не влияет на привязку.
                const surfaceCenterY = sy - this.TILE_H / 2;
                ctx.translate(sx, surfaceCenterY);
                ctx.transform(m.a, m.b, m.c, m.d, 0, 0);
                ctx.drawImage(
                    this.terrainAtlas,
                    sourceX, sourceY, this.ATLAS_CELL_W, this.ATLAS_CELL_H,
                    -this.TILE_W / 2,
                    -this.SPRITE_H + this.TILE_H / 2,
                    this.TILE_W, this.SPRITE_H
                );
            } else {
                ctx.drawImage(
                    this.terrainAtlas,
                    sourceX, sourceY, this.ATLAS_CELL_W, this.ATLAS_CELL_H,
                    sx - this.TILE_W / 2, sy - this.SPRITE_H,
                    this.TILE_W, this.SPRITE_H
                );
            }
            ctx.restore();
            return;
        }

        this._drawProceduralTile(tile, sx, sy, alpha, _worldX, _worldY);
        return;

        const w = this.HALF_TILE_W;
        const h = this.HALF_TILE_H;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(sx, sy - h);
        ctx.beginPath();
        ctx.moveTo(0, -h); ctx.lineTo(w, 0); ctx.lineTo(0, h); ctx.lineTo(-w, 0); ctx.closePath();
        ctx.fillStyle = tile.color || '#8B7355';
        ctx.fill();
        ctx.restore();
    }

    screenToWorld(screenX, screenY) {
        const a = screenX * this.INV_TILE_W;
        const b = screenY * this.INV_TILE_H;
        const rx = (a + b) / 2;
        const ry = (b - a) / 2;
        return {
            x: rx * this._cachedCos + ry * this._cachedSin,
            y: -rx * this._cachedSin + ry * this._cachedCos,
        };
    }

    getTileSize() {
        return {
            width: this.TILE_W,
            height: this.TILE_H,
            spriteHeight: this.SPRITE_H,
            halfWidth: this.HALF_TILE_W,
            halfHeight: this.HALF_TILE_H,
        };
    }

    getScale() { return this.scale; }

    worldToScreenFast(worldX, worldY) {
        const p = this._rotateWorld(worldX, worldY);
        const result = new Float32Array(2);
        result[0] = (p.x - p.y) * this.HALF_TILE_W;
        result[1] = (p.x + p.y) * this.HALF_TILE_H;
        return result;
    }
}

export default IsometricRenderer;
