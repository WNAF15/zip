// assets/games/circle-of-hell/modules/rendering/Renderer.js

import { IsometricRenderer } from './IsometricRenderer.js';

const RENDERER_CONFIG = {
    visibilityRadius: 35,
    visibilityOverscan: 6,
    showFPS: true,
    debugMode: false,
    drawTileBorder: false,
};

const _logOnce = {};

function log(message, type = 'info') {
    const prefix = '🟣 [Renderer.js]';
    const styles = {
        info: 'color: #CE93D8; font-weight: bold;',
        success: 'color: #81C784; font-weight: bold;',
        warning: 'color: #FFB74D; font-weight: bold;',
        error: 'color: #E57373; font-weight: bold;',
        debug: 'color: #B39DDB; font-weight: bold;',
    };
    console.log(`%c${prefix} ${message}`, styles[type] || styles.info);
}

log('Renderer инициализирован', 'info');

export class Renderer {
    constructor(ctx, map, camera, player, game = null) {
        if (!map) throw new Error('Renderer: map обязателен');
        if (!camera) throw new Error('Renderer: camera обязательна');
        if (!player) throw new Error('Renderer: player обязателен');

        this.ctx = ctx;
        this.map = map;
        this.camera = camera;
        this.player = player;
        this.game = game;
        this.isoRenderer = new IsometricRenderer(ctx);
        this.width = ctx.canvas.width;
        this.height = ctx.canvas.height;
        this.showHUD = true;
        this.showBorder = true;

        this.fps = 0;
        this.frameCount = 0;
        this.lastFpsUpdate = 0;

        this.debugMode = RENDERER_CONFIG.debugMode;
        this._logged = false;
        this.showDirectionIndicator = true;
        this._depthCache = { tiles: null, rotation: null, ordered: null };
        this._rotationDepthBucketSize = 5;
        this._objectDepthCache = { objects: null, rotation: null, playerX: null, playerY: null, back: null, front: null };
        this._lastRenderTime = performance.now();

        this.visibilityRadius = RENDERER_CONFIG.visibilityRadius;
        this.visibilityOverscan = RENDERER_CONFIG.visibilityOverscan;
        this._lastVisibilityRadius = this.visibilityRadius;

        // === СИСТЕМА ЧАСТИЦ ДЛЯ СЛЕДОВ (ПЫЛИ) ===
        this.particles = [];
        this.maxParticles = 200;
        this.particleLife = 1.5; // секунд

        log(`Инициализирован (${this.width}x${this.height})`, 'success');
        log(`Радиус видимости: ${this.visibilityRadius}`, 'info');
        if (this.debugMode) {
            log('🐞 Режим отладки ВКЛЮЧЁН', 'debug');
        }
    }

    async waitForAssets(timeoutMs = 15000) {
        return this.isoRenderer.waitForTerrainAtlas(timeoutMs);
    }

    updateSize(width, height, zoom = 1) {
        this.width = width;
        this.height = height;
        this.isoRenderer.setScale(zoom);
        this._depthCache.ordered = null;
        this._objectDepthCache.objects = null;
        if (this.debugMode) {
            log(`Размер обновлён: ${width}x${height}, зум: ${zoom}`, 'debug');
        }
    }

    // Radius is derived from the actual viewport and current zoom instead of being
    // a fixed world value. This prevents missing terrain when zooming far out.
    getVisibilityRadius() {
        const scale = Math.max(this.camera?.getZoom?.() || 1, 0.01);
        const tileW = this.isoRenderer.BASE_TILE_W * scale;
        const tileH = this.isoRenderer.BASE_TILE_H * scale;
        const spriteH = (this.isoRenderer.BASE_SPRITE_H || this.isoRenderer.BASE_TILE_H) * scale;
        const halfScreenW = this.width / 2 + tileW * 2;
        const halfScreenH = this.height / 2 + Math.max(tileH * 2, spriteH);
        const corners = [[-halfScreenW, -halfScreenH], [halfScreenW, -halfScreenH], [-halfScreenW, halfScreenH], [halfScreenW, halfScreenH]];
        let radius = 0;
        for (const [sx, sy] of corners) {
            const a = sx / tileW, b = sy / tileH;
            const x = (a + b) / 2, y = (b - a) / 2;
            radius = Math.max(radius, Math.hypot(x, y));
        }
        return Math.max(8, Math.ceil(radius + this.visibilityOverscan + 2));
    }

    // === ДОБАВЛЕНИЕ ЧАСТИЦЫ ПЫЛИ ===
    _addDustParticle(x, y, color) {
        if (this.particles.length >= this.maxParticles) {
            this.particles.shift(); // удаляем самую старую
        }
        this.particles.push({
            x: x + (Math.random() - 0.5) * 0.3,
            y: y + (Math.random() - 0.5) * 0.3,
            vx: (Math.random() - 0.5) * 0.2,
            vy: (Math.random() - 0.5) * 0.2 - 0.1,
            life: this.particleLife,
            maxLife: this.particleLife,
            size: 0.05 + Math.random() * 0.1,
            color: color || 'rgba(200,180,150,0.6)',
        });
    }

    // === ОБНОВЛЕНИЕ ЧАСТИЦ ===
    _updateParticles(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 0.02 * dt; // гравитация вверх (имитация поднимающейся пыли)
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    // === ОТРИСОВКА ЧАСТИЦ ===
    _drawParticles(camX, camY, W, H) {
        const ctx = this.ctx;
        ctx.save();
        for (const p of this.particles) {
            const screen = this.isoRenderer.worldToScreen(p.x, p.y);
            const sx = screen.x - camX + W / 2;
            const sy = screen.y - camY + H / 2;
            const alpha = p.life / p.maxLife;
            const size = p.size * 20 * alpha;
            ctx.globalAlpha = alpha * 0.6;
            ctx.fillStyle = p.color || 'rgba(200,180,150,0.6)';
            ctx.beginPath();
            ctx.arc(sx, sy, size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    render() {
        if (!this.map || !this.player || !this.camera) {
            if (this.debugMode) log('⚠️ map/player/camera не доступны, пропускаем отрисовку', 'warning');
            return;
        }

        const ctx = this.ctx;
        const W = this.width;
        const H = this.height;

        ctx.fillStyle = '#2d1b0e';
        ctx.fillRect(0, 0, W, H);

        // === ПРИМЕНЯЕМ ЗУМ ===
        this.isoRenderer.setAngle(this.camera.angle);
        this.isoRenderer.setSpriteRotationIndex(this.camera.getSpriteRotationIndex ? this.camera.getSpriteRotationIndex() : 0);
        this.isoRenderer.setScale(this.camera.getZoom());

        // Камера теперь является единственным источником центра кадра.
        // Это синхронизирует плавное следование камеры и визуальную позицию игрока.
        const center = this.isoRenderer.worldToScreen(this.camera.x, this.camera.y);
        const camX = center.x;
        const camY = center.y;

        const visibilityRadius = this.getVisibilityRadius();
        this.visibilityRadius = visibilityRadius;
        this._lastVisibilityRadius = visibilityRadius;
        // Видимость привязана к реальному центру камеры. Это важно во время
        // плавного zoom/поворота: экран пересчитывается в том же кадре, а не
        // после следующего движения игрока.
        const visibleTiles = this.map.getVisibleTiles(
            this.camera.x,
            this.camera.y,
            visibilityRadius
        );

        // ============================================================
        // ГЛУБИНА ТАЙЛОВ
        // ============================================================
        // ВАЖНО: порядок глубины зависит от угла, но НЕ от zoom.
        // Раньше кэш хранил уже спроецированные координаты. При плавном zoom
        // они оставались рассчитанными для старого масштаба, из-за чего тайлы
        // могли внезапно оказаться вне viewport и "исчезнуть" до движения или
        // поворота. Теперь кэшируется только порядок тайлов, а экранные
        // координаты всегда вычисляются заново для текущего масштаба.
        const rotation = Math.round(this.camera.angle / this._rotationDepthBucketSize) * this._rotationDepthBucketSize;
        let depthTiles = this._depthCache.ordered;
        if (this._depthCache.tiles !== visibleTiles || this._depthCache.rotation !== rotation || !depthTiles) {
            depthTiles = visibleTiles
                .filter(({ tile }) => !!tile)
                .slice()
                .sort((a, b) => {
                    const pa = this.isoRenderer._rotateWorld(a.x, a.y);
                    const pb = this.isoRenderer._rotateWorld(b.x, b.y);
                    const depthA = pa.x + pa.y;
                    const depthB = pb.x + pb.y;
                    const dy = depthA - depthB;
                    if (Math.abs(dy) > 0.001) return dy;
                    const dx = (pa.x - pa.y) - (pb.x - pb.y);
                    if (Math.abs(dx) > 0.001) return dx;
                    return (a.x - b.x) || (a.y - b.y);
                });
            this._depthCache = { tiles: visibleTiles, rotation, ordered: depthTiles };
        }

        let drawnCount = 0;
        for (const tileData of depthTiles) {
            const { x, y, tile } = tileData;
            const projected = this.isoRenderer.worldToScreen(x, y);
            const sx = projected.x - camX + W / 2;
            const sy = projected.y - camY + H / 2;

            const tileW = this.isoRenderer.TILE_W;
            const tileH = this.isoRenderer.TILE_H;
            const spriteH = this.isoRenderer.SPRITE_H || tileH;

            // Консервативная отсечка учитывает полный 32×32 canvas и
            // промежуточную affine-трансформацию во время поворота.
            const marginX = Math.max(tileW * 2.25, spriteH * 0.9);
            const marginY = Math.max(spriteH * 1.75, tileH * 2.5);
            if (sx > -marginX && sx < W + marginX &&
                sy > -marginY && sy < H + marginY) {
                this.isoRenderer.drawTile(
                    tile, sx, sy, 1, x, y,
                    this.camera.getSpriteRotationIndex() * 90
                );
                drawnCount++;
            }
        }

        if (!this._logged) {
            log(`Отрисовано ${drawnCount} тайлов (из ${visibleTiles.length} видимых)`, 'success');
            this._logged = true;
        }

        // Дороги рисуются отдельным слоем поверх terrain, но под объектами и игроками.
        this._drawRoadLayer(visibleTiles, camX, camY, W, H);

        // Отдельный слой объектов мира. Объекты не являются тайлами.
        const worldObjects = this.map.getVisibleObjects
            ? this.map.getVisibleObjects(this.player.x, this.player.y, visibilityRadius)
            : [];
        // Сортировка объектов кэшируется. Она пересчитывается только при смене
        // набора объектов, клетки игрока или повороте камеры.
        const objectPlayerX = Math.round(this.player.x);
        const objectPlayerY = Math.round(this.player.y);
        const objectCache = this._objectDepthCache;
        let backObjects = objectCache.back;
        let frontObjects = objectCache.front;
        if (objectCache.objects !== worldObjects || objectCache.rotation !== rotation ||
            objectCache.playerX !== objectPlayerX || objectCache.playerY !== objectPlayerY ||
            !backObjects || !frontObjects) {
            const playerProjection = this.isoRenderer.worldToScreen(this.player.x, this.player.y);
            const playerDepth = playerProjection.y;
            const orderedObjects = worldObjects.map((object) => {
                const p = this.isoRenderer.worldToScreen(object.x, object.y);
                return { object, depthY: p.y, depthX: p.x };
            }).sort((a, b) => (a.depthY - b.depthY) || (a.depthX - b.depthX));
            backObjects = [];
            frontObjects = [];
            for (const item of orderedObjects) {
                (item.depthY <= playerDepth ? backObjects : frontObjects).push(item.object);
            }
            this._objectDepthCache = {
                objects: worldObjects, rotation, playerX: objectPlayerX, playerY: objectPlayerY,
                back: backObjects, front: frontObjects,
            };
        }
        this._drawWorldObjects(backObjects, camX, camY, W, H);

        // Граница круга
        if (this.showBorder && !this.map.hasBlueprintBoundary) {
            this._drawCircleBorder(camX, camY, W, H);
        }

        // === ЧАСТИЦЫ (пыль) ===
        const now = performance.now();
        const dt = Math.min(Math.max((now - this._lastRenderTime) / 1000, 0), 0.05);
        this._lastRenderTime = now;
        this._updateParticles(dt);
        this._drawParticles(camX, camY, W, H);

        // Свой игрок
        this._drawPlayer(camX, camY, W, H);

        // Объекты перед игроком перекрывают его, что создаёт нормальную глубину.
        this._drawWorldObjects(frontObjects, camX, camY, W, H);

        // Локальные визуальные представители NPC-групп. Не синхронизируются с БД по шагам.
        if (this.game?.npcWorld) {
            const agents = this.game.npcWorld.getVisualAgents();
            for (const npc of agents) {
                const p = this.isoRenderer.worldToScreen(npc.x, npc.y);
                const sx = p.x - camX + W / 2, sy = p.y - camY + H / 2;
                if (sx < -20 || sx > W + 20 || sy < -40 || sy > H + 20) continue;
                const bob = Math.sin(npc.phase) * 1.2;
                ctx.fillStyle = '#2a1714'; ctx.fillRect(Math.round(sx - 3), Math.round(sy - 12 + bob), 6, 10);
                ctx.fillStyle = '#9b5b48'; ctx.fillRect(Math.round(sx - 2), Math.round(sy - 16 + bob), 4, 4);
            }
        }

        // === ОТРИСОВКА ДРУГИХ ИГРОКОВ (МУЛЬТИПЛЕЕР) ===
        if (this.game && this.game.getOtherPlayers) {
            this._drawOtherPlayers(camX, camY, W, H);
        }

        if (this.showDirectionIndicator) {
            this._drawDirectionIndicator(camX, camY, W, H);
        }

        if (this.showHUD) {
            this._drawHUD();
        }
    }

    // ============================================================
    // ДОРОГИ — независимый слой поверх биома
    // ============================================================
    _drawRoadLayer(visibleTiles, camX, camY, W, H) {
        if (!visibleTiles?.length) return;
        const ctx = this.ctx;
        const halfW = this.isoRenderer.HALF_TILE_W;
        const halfH = this.isoRenderer.HALF_TILE_H;

        const styles = {
            main: { fill: 'rgba(78,45,31,0.78)', edge: 'rgba(196,121,63,0.55)', mark: 'rgba(238,183,95,0.42)' },
            industrial: { fill: 'rgba(48,47,46,0.82)', edge: 'rgba(148,118,91,0.62)', mark: 'rgba(204,101,53,0.28)' },
            secondary: { fill: 'rgba(97,68,45,0.70)', edge: 'rgba(171,121,74,0.42)', mark: null },
            trail: { fill: 'rgba(109,76,47,0.56)', edge: 'rgba(160,112,66,0.25)', mark: null },
        };

        for (const { x, y, tile } of visibleTiles) {
            const road = tile?.road;
            if (!road) continue;
            const center = this.isoRenderer.worldToScreen(x, y);
            const sx = center.x - camX + W / 2;
            const sy = center.y - camY + H / 2;
            if (sx < -this.isoRenderer.TILE_W || sx > W + this.isoRenderer.TILE_W || sy < -this.isoRenderer.TILE_H || sy > H + this.isoRenderer.TILE_H) continue;

            const style = styles[road.kind] || styles.secondary;
            const dirs = road.connections?.length ? road.connections : [{ dx: road.dx, dy: road.dy }, { dx: -road.dx, dy: -road.dy }];

            ctx.save();
            ctx.beginPath();
            ctx.moveTo(sx, sy-halfH); ctx.lineTo(sx+halfW, sy); ctx.lineTo(sx, sy+halfH); ctx.lineTo(sx-halfW, sy); ctx.closePath();
            ctx.clip();

            // Каждое направление рисуется от центра: развилки и перекрёстки
            // теперь имеют естественную форму вместо наложения случайных полос.
            for (const dir of dirs) {
                const ahead = this.isoRenderer.worldToScreen(x + dir.dx, y + dir.dy);
                let dx = ahead.x-center.x, dy = ahead.y-center.y;
                const len = Math.hypot(dx,dy)||1; dx/=len; dy/=len;
                const extent = Math.max(halfW, halfH)*1.9;

                ctx.strokeStyle=style.edge;
                ctx.lineWidth=Math.max(1.5, Math.min(halfH*1.25, halfW*0.40));
                ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(sx+dx*extent,sy+dy*extent); ctx.stroke();

                ctx.strokeStyle=style.fill;
                ctx.lineWidth=road.kind==='trail' ? Math.max(2, halfH*0.55) : Math.max(4, Math.min(halfW*0.68, halfH*2.05));
                ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(sx+dx*extent,sy+dy*extent); ctx.stroke();
            }

            if (road.junction) {
                const radius = road.kind==='main' ? Math.max(4, halfH*0.58) : Math.max(3, halfH*0.42);
                ctx.fillStyle=style.fill; ctx.beginPath(); ctx.arc(sx,sy,radius,0,Math.PI*2); ctx.fill();
                ctx.strokeStyle=style.edge; ctx.lineWidth=Math.max(1,this.isoRenderer.scale); ctx.stroke();
            }

            if (style.mark && road.kind === 'main' && !road.junction) {
                ctx.strokeStyle=style.mark; ctx.lineWidth=Math.max(1,this.isoRenderer.scale*1.05);
                ctx.setLineDash([Math.max(2,this.isoRenderer.scale*5),Math.max(2,this.isoRenderer.scale*4)]);
                for (const dir of dirs.slice(0,1)) {
                    const ahead=this.isoRenderer.worldToScreen(x+dir.dx,y+dir.dy);
                    let dx=ahead.x-center.x, dy=ahead.y-center.y; const len=Math.hypot(dx,dy)||1; dx/=len; dy/=len;
                    ctx.beginPath(); ctx.moveTo(sx-dx*halfW,sy-dy*halfH); ctx.lineTo(sx+dx*halfW,sy+dy*halfH); ctx.stroke();
                }
                ctx.setLineDash([]);
            }
            ctx.restore();
        }
    }

    // ============================================================
    // ОБЪЕКТНЫЙ СЛОЙ — небольшие процедурные спрайты до появления графических assets
    // ============================================================
    _drawWorldObjects(objects, camX, camY, W, H) {
        if (!objects?.length) return;
        // Списки приходят уже отсортированными из кэша render().
        for (const object of objects) this._drawWorldObject(object, camX, camY, W, H);
    }

    _drawWorldObject(object, camX, camY, W, H) {
        const ctx = this.ctx;
        const screen = this.isoRenderer.worldToScreen(object.x, object.y);
        const sx = screen.x - camX + W / 2;
        const sy = screen.y - camY + H / 2;
        const tile = this.isoRenderer.getTileSize();
        const u = Math.max(4, Math.min(tile.width, tile.height) * 0.20);
        if (sx < -u * 8 || sx > W + u * 8 || sy < -u * 10 || sy > H + u * 8) return;

        ctx.save();
        ctx.translate(sx, sy);
        ctx.shadowColor = 'rgba(0,0,0,.38)';
        ctx.shadowBlur = Math.max(2, u * .65);
        ctx.shadowOffsetY = Math.max(1, u * .22);

        switch (object.type) {
            case 'tree': this._drawTree(u); break;
            case 'tree_tall': this._drawTree(u, 1.25, '#1E3420'); break;
            case 'tree_dark': this._drawTree(u, 1.05, '#17291A'); break;
            case 'dead_tree': this._drawDeadTree(u); break;
            case 'fallen_tree': this._drawFallenTree(u); break;
            case 'bush': this._drawBush(u); break;
            case 'bush_dense': this._drawBush(u, 1.25, '#25451F'); break;
            case 'thorn_bush': this._drawBush(u, 1.05, '#493727'); break;
            case 'grass_clump': this._drawGrassClump(u); break;
            case 'herb_patch': this._drawHerbPatch(u); break;
            case 'rock': this._drawRock(u, 1); break;
            case 'rock_sharp': this._drawSharpRock(u); break;
            case 'boulder': this._drawRock(u, 1.45); break;
            case 'cliff_rock': this._drawRock(u, 1.9); break;
            case 'edge_cliff': this._drawEdgeCliff(u, object.edgeStrength); break;
            case 'edge_debris': this._drawEdgeDebris(u); break;
            case 'edge_crack': this._drawEdgeCrack(u); break;
            case 'abyss_rift': this._drawAbyssRift(u); break;
            case 'quarry_marker': this._drawQuarryMarker(u); break;
            case 'industrial_pipe': this._drawPipe(u); break;
            case 'industrial_lamp': this._drawIndustrialLamp(u); break;
            case 'territory_marker': this._drawTerritoryMarker(u); break;
            case 'ore': this._drawOre(u); break;
            case 'ore_rich': this._drawOre(u, 1.35); break;
            case 'tent': this._drawTent(u, object.tileWidth||2, object.tileHeight||2); break;
            case 'campfire': this._drawCampfire(u); break;
            case 'camp_path': this._drawCampPath(u); break;
            case 'camp_marker': this._drawCampMarker(u); break;
            case 'crate': this._drawCrate(u); break;
            case 'machinery': this._drawMachinery(u); break;
            case 'pipe': this._drawPipe(u); break;
            case 'fence': this._drawFence(u); break;
            case 'factory_gate': this._drawGate(u); break;
            case 'building_wall': this._drawWall(u, object.orientation); break;
            case 'window': this._drawWindow(u); break;
            case 'door': this._drawDoor(u, object.orientation); break;
            case 'building_roof': this._drawRoof(object,u); break;
            case 'factory_marker': this._drawFactoryMarker(u); break;
            case 'structure_marker': this._drawStructureMarker(object,u); break;
            default: this._drawLandmark(object, u); break;
        }

        ctx.restore();

        if (object.showLabel) {
            ctx.save();
            ctx.fillStyle = 'rgba(12,8,7,.72)';
            ctx.fillRect(sx - u * 3.2, sy - u * 7.1, u * 6.4, u * 1.35);
            ctx.fillStyle = '#EED9BC';
            ctx.font = `${Math.max(10, u * .75)}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(object.title || object.type, sx, sy - u * 6.42);
            ctx.restore();
        }
    }


    _drawEdgeCliff(u, strength=1) { const c=this.ctx; const h=u*(2.2+strength*1.8); c.fillStyle='#302B2A'; c.beginPath();c.moveTo(-u*1.8,0);c.lineTo(-u*.8,-h);c.lineTo(u*.7,-h*.75);c.lineTo(u*1.8,0);c.closePath();c.fill();c.fillStyle='#5A4A43';c.beginPath();c.moveTo(-u*1.8,0);c.lineTo(-u*.8,-h);c.lineTo(0,-h*.42);c.lineTo(-u*.25,-u*.15);c.closePath();c.fill(); }
    _drawEdgeDebris(u) { const c=this.ctx;c.fillStyle='#514640';for(const [x,y,r] of [[-.7,-.2,.45],[.15,-.45,.55],[.72,-.12,.32]]){c.beginPath();c.arc(x*u,y*u,r*u,0,Math.PI*2);c.fill();} }
    _drawEdgeCrack(u) { const c=this.ctx;c.shadowBlur=0;c.strokeStyle='#241719';c.lineWidth=Math.max(1,u*.13);c.beginPath();c.moveTo(-u,0);c.lineTo(-u*.25,-u*.4);c.lineTo(u*.12,-u*.1);c.lineTo(u*.85,-u*.7);c.stroke(); }
    _drawAbyssRift(u) { const c=this.ctx;c.shadowBlur=0;c.fillStyle='#120B16';c.beginPath();c.moveTo(-u*1.3,-u*.2);c.lineTo(-u*.3,-u*1.15);c.lineTo(u*1.25,-u*.35);c.lineTo(u*.35,u*.35);c.closePath();c.fill();c.strokeStyle='rgba(155,48,42,.55)';c.lineWidth=Math.max(1,u*.1);c.stroke(); }

    _drawQuarryMarker(u) { const ctx=this.ctx; this._drawRock(u,1.05); ctx.strokeStyle='#C9A36A'; ctx.lineWidth=Math.max(1,u*.12); ctx.beginPath();ctx.moveTo(-u*.6,-u*1.7);ctx.lineTo(u*.6,-u*1.7);ctx.stroke(); }
    _drawIndustrialLamp(u) { const ctx=this.ctx; ctx.fillStyle='#44372F';ctx.fillRect(-u*.14,-u*2.5,u*.28,u*2.5);ctx.fillStyle='#E6A84A';ctx.beginPath();ctx.arc(0,-u*2.6,u*.35,0,Math.PI*2);ctx.fill(); }
    _drawTerritoryMarker(u) { const ctx=this.ctx; ctx.strokeStyle='#B88452';ctx.lineWidth=Math.max(1,u*.12);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-u*3);ctx.stroke();ctx.fillStyle='#6E2F25';ctx.beginPath();ctx.moveTo(0,-u*3);ctx.lineTo(u*1.1,-u*2.55);ctx.lineTo(0,-u*2.1);ctx.closePath();ctx.fill(); }

    _drawWindow(u) { const ctx=this.ctx; ctx.fillStyle='#54788C'; ctx.fillRect(-u*.42,-u*.95,u*.84,u*.75); ctx.strokeStyle='rgba(220,235,240,.55)'; ctx.lineWidth=Math.max(1,u*.1); ctx.strokeRect(-u*.42,-u*.95,u*.84,u*.75); }

    _drawTree(u, scale = 1, crown = '#243F24') {
        const ctx = this.ctx;
        ctx.fillStyle = '#3A2418'; ctx.fillRect(-u*.35*scale, -u*2.2*scale, u*.7*scale, u*2.3*scale);
        ctx.fillStyle = crown;
        for (const [x,y,r] of [[0,-u*3.0*scale,u*1.45*scale],[-u*.9*scale,-u*2.45*scale,u*1.0*scale],[u*.85*scale,-u*2.35*scale,u*.95*scale]]) {
            ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
        }
        ctx.fillStyle = 'rgba(118,142,49,.34)'; ctx.beginPath(); ctx.arc(-u*.25*scale,-u*3.25*scale,u*.75*scale,0,Math.PI*2); ctx.fill();
    }

    _drawBush(u, scale = 1, color = '#315526') {
        const ctx=this.ctx; ctx.fillStyle=color;
        for(const [x,y,r] of [[-u*.7*scale,-u*.65*scale,u*.8*scale],[0,-u*.9*scale,u*.95*scale],[u*.75*scale,-u*.6*scale,u*.75*scale]]){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
    }

    _drawDeadTree(u) { const c=this.ctx;c.strokeStyle='#4A3326';c.lineWidth=Math.max(1,u*.32);c.beginPath();c.moveTo(0,0);c.lineTo(0,-u*3);c.moveTo(0,-u*2.1);c.lineTo(-u*.8,-u*2.75);c.moveTo(0,-u*1.65);c.lineTo(u*.9,-u*2.25);c.stroke(); }
    _drawFallenTree(u) { const c=this.ctx;c.strokeStyle='#49301F';c.lineWidth=Math.max(2,u*.55);c.lineCap='round';c.beginPath();c.moveTo(-u*1.7,-u*.15);c.lineTo(u*1.6,-u*1.25);c.stroke();c.strokeStyle='#735039';c.lineWidth=Math.max(1,u*.16);c.beginPath();c.moveTo(-u*1.2,-u*.25);c.lineTo(u*1.25,-u*1.08);c.stroke(); }
    _drawGrassClump(u) { const c=this.ctx;c.shadowBlur=0;c.strokeStyle='#667A31';c.lineWidth=Math.max(1,u*.12);for(let i=-3;i<=3;i++){c.beginPath();c.moveTo(0,0);c.lineTo(i*u*.18,-u*(.55+Math.abs(i)*.08));c.stroke();} }
    _drawHerbPatch(u) { const c=this.ctx;c.shadowBlur=0;c.fillStyle='#537B36';for(const [x,y] of [[-.5,-.25],[0,-.45],[.48,-.18]]){c.beginPath();c.arc(x*u,y*u,u*.34,0,Math.PI*2);c.fill();}c.fillStyle='#B9B45B';c.beginPath();c.arc(0,-u*.55,u*.16,0,Math.PI*2);c.fill(); }
    _drawSharpRock(u) { const c=this.ctx;c.fillStyle='#4C4948';c.beginPath();c.moveTo(-u*.9,u*.1);c.lineTo(-u*.35,-u*1.55);c.lineTo(u*.15,-u*.35);c.lineTo(u*.75,-u*1.25);c.lineTo(u*.95,u*.18);c.closePath();c.fill();c.strokeStyle='rgba(200,190,175,.18)';c.stroke(); }

    _drawRock(u, scale=1) {
        const ctx=this.ctx; ctx.fillStyle='#56545A';
        ctx.beginPath(); ctx.moveTo(-u*scale,-u*.45*scale); ctx.lineTo(-u*.55*scale,-u*1.25*scale); ctx.lineTo(u*.55*scale,-u*1.05*scale); ctx.lineTo(u*scale,-u*.2*scale); ctx.lineTo(u*.55*scale,u*.32*scale); ctx.lineTo(-u*.65*scale,u*.22*scale); ctx.closePath(); ctx.fill();
        ctx.fillStyle='rgba(190,183,170,.16)'; ctx.beginPath(); ctx.moveTo(-u*.55*scale,-u*.45*scale);ctx.lineTo(0,-u*1.05*scale);ctx.lineTo(u*.35*scale,-u*.65*scale);ctx.lineTo(-u*.1*scale,-u*.15*scale);ctx.closePath();ctx.fill();
    }

    _drawOre(u, scale=1) { const ctx=this.ctx; this._drawRock(u,.8*scale); ctx.fillStyle='#B9692A'; ctx.beginPath();ctx.arc(0,-u*.55*scale,u*.35*scale,0,Math.PI*2);ctx.fill(); }

    _drawTent(u, tw=2, th=2) {
        const ctx=this.ctx; ctx.fillStyle='#5B3427';
        const scale=Math.max(tw,th)*.78; ctx.beginPath();ctx.moveTo(-u*1.65*scale,0);ctx.lineTo(0,-u*2.9*scale);ctx.lineTo(u*1.65*scale,0);ctx.closePath();ctx.fill();
        ctx.fillStyle='#B08A5A';ctx.beginPath();ctx.moveTo(-u*.45*scale,-u*.55*scale);ctx.lineTo(0,-u*1.35*scale);ctx.lineTo(u*.45*scale,-u*.55*scale);ctx.closePath();ctx.fill();
        ctx.strokeStyle='rgba(240,200,140,.25)';ctx.lineWidth=Math.max(1,u*.12);ctx.beginPath();ctx.moveTo(0,-u*2.9*scale);ctx.lineTo(0,0);ctx.stroke();
    }

    _drawCampfire(u) { const ctx=this.ctx;ctx.fillStyle='#422A1B';ctx.beginPath();ctx.arc(0,0,u*.8,0,Math.PI*2);ctx.fill();ctx.fillStyle='#F06A2B';ctx.beginPath();ctx.moveTo(0,-u*1.7);ctx.quadraticCurveTo(u*.8,-u*.65,0,0);ctx.quadraticCurveTo(-u*.8,-u*.65,0,-u*1.7);ctx.fill();ctx.fillStyle='#FFD05A';ctx.beginPath();ctx.arc(0,-u*.65,u*.34,0,Math.PI*2);ctx.fill(); }

    _drawCampPath(u) { const ctx=this.ctx; ctx.shadowBlur=0; ctx.fillStyle='rgba(90,62,38,.72)'; ctx.beginPath(); ctx.ellipse(0,0,u*.72,u*.34,0,0,Math.PI*2); ctx.fill(); }

    _drawCampMarker(u) { const ctx=this.ctx; ctx.shadowBlur=0; ctx.strokeStyle='#D6A45D'; ctx.lineWidth=Math.max(1,u*.14); ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-u*3.1);ctx.stroke();ctx.fillStyle='#7A3D2A';ctx.beginPath();ctx.moveTo(0,-u*3.05);ctx.lineTo(u*1.25,-u*2.55);ctx.lineTo(0,-u*2.0);ctx.closePath();ctx.fill(); }

    _drawCrate(u) { const ctx=this.ctx;ctx.fillStyle='#70472B';ctx.fillRect(-u,-u*1.3,u*2,u*1.5);ctx.strokeStyle='#B07848';ctx.lineWidth=Math.max(1,u*.1);ctx.strokeRect(-u,-u*1.3,u*2,u*1.5);ctx.beginPath();ctx.moveTo(-u,-u*1.3);ctx.lineTo(u,u*.2);ctx.moveTo(u,-u*1.3);ctx.lineTo(-u,u*.2);ctx.stroke(); }

    _drawMachinery(u) { const ctx=this.ctx;ctx.fillStyle='#2B2930';ctx.fillRect(-u*1.4,-u*2.1,u*2.8,u*2.2);ctx.fillStyle='#5B1D1D';ctx.fillRect(-u*1.05,-u*1.8,u*.45,u*1.2);ctx.fillRect(u*.6,-u*1.8,u*.45,u*1.2);ctx.fillStyle='#D66A2B';ctx.beginPath();ctx.arc(0,-u*1.1,u*.34,0,Math.PI*2);ctx.fill(); }

    _drawPipe(u) { const ctx=this.ctx;ctx.strokeStyle='#343239';ctx.lineWidth=u*.55;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-u*.9,0);ctx.lineTo(-u*.25,-u*1.7);ctx.lineTo(u*.85,-u*1.7);ctx.stroke();ctx.fillStyle='#7A2E22';ctx.beginPath();ctx.arc(u*.85,-u*1.7,u*.38,0,Math.PI*2);ctx.fill(); }


    _drawFactoryFloor(u,style='industrial'){const c=this.ctx;c.shadowBlur=0;const colors={industrial:'#4a4745',store:'#765d47',tile:'#5b6d70'};c.fillStyle=colors[style]||colors.industrial;c.beginPath();c.moveTo(0,-u*1.28);c.lineTo(u*2.56,0);c.lineTo(0,u*1.28);c.lineTo(-u*2.56,0);c.closePath();c.fill();c.strokeStyle='rgba(230,220,205,.18)';c.lineWidth=Math.max(1,u*.06);c.stroke();}
    _drawFence(u){const c=this.ctx;c.fillStyle='#393338';c.fillRect(-u*.12,-u*2,u*.24,u*2.1);c.strokeStyle='#776c67';c.lineWidth=Math.max(1,u*.09);c.beginPath();c.moveTo(-u*1,-u*.65);c.lineTo(u,-u*1.45);c.stroke();}
    _drawGate(u){const c=this.ctx;c.strokeStyle='#7B5341';c.lineWidth=Math.max(1,u*.18);c.beginPath();c.moveTo(-u*1.4,0);c.lineTo(-u*1.4,-u*2.3);c.moveTo(u*1.4,0);c.lineTo(u*1.4,-u*2.3);c.stroke();}
    _drawWall(u,orientation='north'){
        const c=this.ctx; c.save();
        const along=(orientation==='north'||orientation==='south') ? Math.atan2(.5,1) : Math.atan2(.5,-1);
        c.rotate(along);
        const h=u*1.55, len=u*2.05;
        // Тонкая грань стены: она стоит на стороне клетки, а не занимает её целиком.
        c.fillStyle='#302D31'; c.beginPath();c.moveTo(-len/2,0);c.lineTo(len/2,0);c.lineTo(len/2,-h);c.lineTo(-len/2,-h);c.closePath();c.fill();
        c.fillStyle='#5A555B';c.beginPath();c.moveTo(-len/2,-h);c.lineTo(len/2,-h);c.lineTo(len/2-u*.22,-h-u*.18);c.lineTo(-len/2-u*.22,-h-u*.18);c.closePath();c.fill();
        c.strokeStyle='rgba(220,210,195,.18)';c.lineWidth=Math.max(1,u*.06);c.stroke();
        if(orientation==='south'||orientation==='east'){c.fillStyle='rgba(0,0,0,.16)';c.fillRect(-len/2,-h*.65,len,h*.18);}
        c.restore();
    }
    _drawDoor(u,orientation='north'){const c=this.ctx;c.save();const along=(orientation==='north'||orientation==='south')?Math.atan2(.5,1):Math.atan2(.5,-1);c.rotate(along);const h=u*1.35,len=u*1.15;c.fillStyle='#241D1A';c.fillRect(-len/2,-h,len,h);c.strokeStyle='#A36D45';c.lineWidth=Math.max(1,u*.08);c.strokeRect(-len/2,-h,len,h);c.restore();}
    _drawRoof(o,u){const c=this.ctx;const inside=this.player&&this.player.x>=o.x-(o.w||0)/2&&this.player.x<=o.x+(o.w||0)/2&&this.player.y>=o.y-(o.h||0)/2&&this.player.y<=o.y+(o.h||0)/2;c.globalAlpha=inside?.08:.78;const w=(o.w||12)*u*.42,h=(o.h||10)*u*.28;c.fillStyle='#24272B';c.beginPath();c.moveTo(0,-h*2);c.lineTo(w,-h);c.lineTo(0,0);c.lineTo(-w,-h);c.closePath();c.fill();c.strokeStyle='rgba(180,180,180,.12)';c.lineWidth=Math.max(1,u*.06);for(let i=-3;i<=3;i++){c.beginPath();c.moveTo(i*w/4,-h);c.lineTo(i*w/4+h*.55,-h*.2);c.stroke();}c.globalAlpha=1;}
    _drawFactoryMarker(u){const c=this.ctx;c.fillStyle='#3A2A31';c.fillRect(-u*2,-u*3,u*4,u*3);c.fillStyle='#252126';c.fillRect(-u*1.5,-u*5,u*.45,u*2);c.fillRect(u*1,-u*6,u*.5,u*3);}
    _drawStructureMarker(o,u){const c=this.ctx;const palette={factory:'#4A2B31',shop:'#8C5525',pharmacy:'#275D61'};c.fillStyle=palette[o.structureKind]||'#4A3A35';c.fillRect(-u*1.7,-u*2.4,u*3.4,u*2.4);c.fillStyle='rgba(255,220,170,.32)';c.fillRect(-u*1.2,-u*1.9,u*.45,u*.45);c.fillRect(u*.75,-u*1.9,u*.45,u*.45);}

    _drawLandmark(object, u) {
        const ctx=this.ctx;
        const palette={hub:'#2B2627',shop:'#B46A26',pharmacy:'#2E7F7C',quarry:'#6A6866',factory:'#452733',gate:'#623B79',camp:'#7A5A36'};
        const color=palette[object.type]||'#604238';
        const scale=object.type==='factory'?3.0:object.type==='hub'?3.4:object.type==='gate'?2.7:2.2;
        ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(-u*scale,-u*.25);ctx.lineTo(-u*scale*.55,-u*scale*1.45);ctx.lineTo(u*scale*.55,-u*scale*1.45);ctx.lineTo(u*scale,-u*.25);ctx.lineTo(u*scale*.5,u*.45);ctx.lineTo(-u*scale*.5,u*.45);ctx.closePath();ctx.fill();
        ctx.shadowBlur=0;ctx.strokeStyle='rgba(255,170,80,.28)';ctx.lineWidth=Math.max(1,u*.12);ctx.stroke();
        if(object.type==='factory'){ctx.fillStyle='#272329';ctx.fillRect(-u*2.0,-u*4.0,u*.45,u*2.8);ctx.fillRect(u*1.45,-u*4.7,u*.5,u*3.5);}
        if(object.type==='hub'){ctx.strokeStyle='#D38A44';ctx.lineWidth=Math.max(1,u*.14);ctx.beginPath();ctx.arc(0,-u*1.25,u*1.35,0,Math.PI*2);ctx.stroke();}
        if(object.type==='gate'){ctx.strokeStyle='#B06BDB';ctx.lineWidth=Math.max(1,u*.24);ctx.beginPath();ctx.arc(0,-u*1.8,u*1.1,Math.PI,Math.PI*2);ctx.stroke();}
    }

    // ============================================================
    // ГРАНИЦА КРУГА
    // ============================================================
    _drawCircleBorder(camX, camY, W, H) {
        const ctx = this.ctx;
        const radius = this.map.radius || 500;

        const points = 60;
        const screenPoints = [];
        for (let i = 0; i <= points; i++) {
            const angle = (i / points) * Math.PI * 2;
            const wx = radius * Math.cos(angle);
            const wy = radius * Math.sin(angle);
            const screen = this.isoRenderer.worldToScreen(wx, wy);
            screenPoints.push({
                x: screen.x - camX + W / 2,
                y: screen.y - camY + H / 2
            });
        }

        ctx.save();
        ctx.setLineDash([10, 10]);
        ctx.strokeStyle = 'rgba(255, 50, 50, 0.8)';
        ctx.lineWidth = 2;

        ctx.beginPath();
        for (let i = 0; i < screenPoints.length; i++) {
            const p = screenPoints[i];
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();

        const labelPos = screenPoints[0];
        ctx.fillStyle = 'rgba(255, 50, 50, 0.8)';
        ctx.font = '14px monospace';
        ctx.fillText('Граница круга', labelPos.x - 60, labelPos.y - 20);
    }

    // ============================================================
    // СВОЙ ИГРОК (с аватаркой)
    // ============================================================
    _drawPlayer(camX, camY, W, H) {
        if (!this.player) return;
        const ctx = this.ctx;
        const player = this.player;

        const screen = this.isoRenderer.worldToScreen(player.x, player.y);
        const px = screen.x - camX + W / 2;
        const py = screen.y - camY + H / 2;

        const tileSize = this.isoRenderer.getTileSize();
        const radius = (player.size * tileSize.width) / 2;
        const maxRadius = Math.min(tileSize.width, tileSize.height) * 0.45;
        const finalRadius = Math.min(radius, maxRadius) * 0.9;

        if (px < -50 || px > W + 50 || py < -50 || py > H + 50) return;

        // --- Имя над игроком ---
        let nickname = 'Гость';
        if (this.game && this.game._userNickname) {
            nickname = this.game._userNickname;
        }

        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.9)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText('⭐ ' + nickname, px, py - finalRadius * 2 - 16);
        const characterName = (this.game && this.game._playerNickname) ? this.game._playerNickname : '';
        if (characterName && characterName !== nickname) {
            ctx.fillStyle = '#EAD9C4';
            ctx.font = '12px monospace';
            ctx.fillText(characterName, px, py - finalRadius * 2 - 3);
        }
        ctx.shadowBlur = 0;

        // Основной игрок (аватарка: буква в круге)
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 15;
        ctx.shadowOffsetY = 6;

        // Круг
        ctx.beginPath();
        ctx.arc(px, py - finalRadius, finalRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#FF6B35';
        ctx.fill();
        ctx.strokeStyle = '#CC4400';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Буква аватарки (первая буква ника)
        const avatarLetter = (nickname || '?')[0].toUpperCase();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `${finalRadius * 0.8}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(avatarLetter, px, py - finalRadius);

        ctx.restore();
    }

    // ============================================================
    // ДРУГИЕ ИГРОКИ (МУЛЬТИПЛЕЕР) с аватарками, индикаторами и пылью
    // ============================================================
    _drawOtherPlayers(camX, camY, W, H) {
        const ctx = this.ctx;
        const players = this.game.getOtherPlayers();

        if (!players || players.length === 0) return;

        const now = Date.now();

        for (const player of players) {
            const screen = this.isoRenderer.worldToScreen(player.x, player.y);
            const px = screen.x - camX + W / 2;
            const py = screen.y - camY + H / 2;

            if (px < -50 || px > W + 50 || py < -50 || py > H + 50) continue;

            const tileSize = this.isoRenderer.getTileSize();
            const radius = Math.min(tileSize.width, tileSize.height) * 0.4;

            ctx.save();

            // Тень
            ctx.shadowColor = 'rgba(0,0,0,0.3)';
            ctx.shadowBlur = 10;
            ctx.shadowOffsetY = 4;

            // Аватарка (круг с буквой)
            const avatarLetter = (player.avatar || player.nickname?.[0] || '?').toUpperCase();

            // Круг
            ctx.beginPath();
            ctx.arc(px, py - 8, radius, 0, Math.PI * 2);
            ctx.fillStyle = player.color || '#00FF88';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.5)';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Буква
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#FFFFFF';
            ctx.font = `${radius * 0.7}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(avatarLetter, px, py - 8);

            // Имя игрока
            ctx.shadowColor = 'rgba(0,0,0,0.8)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 1;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(player.nickname || 'Игрок', px, py - radius - 10);
            ctx.shadowBlur = 0;

            // === ИНДИКАТОР АКТИВНОСТИ (зелёная точка) ===
            if (player.isMoving) {
                // Пульсация
                const pulse = Math.sin(now / 300) * 0.3 + 0.7; // 0.4 .. 1.0
                ctx.shadowBlur = 0;
                ctx.fillStyle = `rgba(76, 175, 80, ${pulse})`;
                ctx.beginPath();
                ctx.arc(px + radius + 4, py - radius - 6, 3, 0, Math.PI * 2);
                ctx.fill();
                // Добавляем свечение
                ctx.shadowColor = 'rgba(76, 175, 80, 0.5)';
                ctx.shadowBlur = 8;
                ctx.beginPath();
                ctx.arc(px + radius + 4, py - radius - 6, 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            }

            // === ДОБАВЛЯЕМ ЧАСТИЦЫ ПЫЛИ ДЛЯ ДВИЖУЩИХСЯ ИГРОКОВ ===
            if (player.isMoving && Math.random() < 0.3) { // не каждый кадр
                this._addDustParticle(player.x, player.y, player.color);
            }

            // Индикатор направления (стрелка)
            if (player.angle !== undefined) {
                const angleRad = (player.angle || 0) * Math.PI / 180;
                const arrowLen = radius * 1.2;
                const ax = px + Math.sin(angleRad) * arrowLen;
                const ay = (py - 8) - Math.cos(angleRad) * arrowLen;

                ctx.beginPath();
                ctx.moveTo(px, py - 8);
                ctx.lineTo(ax, ay);
                ctx.strokeStyle = 'rgba(255,255,255,0.6)';
                ctx.lineWidth = 2;
                ctx.stroke();

                ctx.beginPath();
                ctx.arc(ax, ay, 2.5, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255,255,255,0.8)';
                ctx.fill();
            }

            ctx.restore();
        }
    }

    // ============================================================
    // ИНДИКАТОР НАПРАВЛЕНИЯ (СВОЙ ИГРОК)
    // ============================================================
    _drawDirectionIndicator(camX, camY, W, H) {
        if (!this.player) return;
        const ctx = this.ctx;
        const player = this.player;

        const screen = this.isoRenderer.worldToScreen(player.x, player.y);
        const px = screen.x - camX + W / 2;
        const py = screen.y - camY + H / 2;

        if (px < -50 || px > W + 50 || py < -50 || py > H + 50) return;

        const indicatorRadius = 15;
        const direction = player.direction;
        let angle = 0;

        switch (direction) {
            case 'up':
            case 'up-right':
            case 'up-left':
                angle = -Math.PI / 2;
                break;
            case 'down':
            case 'down-right':
            case 'down-left':
                angle = Math.PI / 2;
                break;
            case 'left':
                angle = Math.PI;
                break;
            case 'right':
                angle = 0;
                break;
            default:
                angle = 0;
        }

        if (direction === 'up-right') angle = -Math.PI / 4;
        else if (direction === 'up-left') angle = -3 * Math.PI / 4;
        else if (direction === 'down-right') angle = Math.PI / 4;
        else if (direction === 'down-left') angle = 3 * Math.PI / 4;

        const indicatorX = px;
        const indicatorY = py - 30;

        ctx.save();
        ctx.beginPath();
        ctx.arc(indicatorX, indicatorY, indicatorRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,107,53,0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.translate(indicatorX, indicatorY);
        ctx.rotate(angle);

        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(-6, -6);
        ctx.lineTo(-6, 6);
        ctx.closePath();
        ctx.fillStyle = '#FF6B35';
        ctx.fill();
        ctx.strokeStyle = '#CC4400';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.restore();
    }

    // ============================================================
    // HUD
    // ============================================================
    _drawHUD() {
        const ctx = this.ctx;
        const player = this.player;
        const angle = this.camera ? this.camera.angle : 0;
        const zoom = this.camera ? this.camera.zoom : 1;

        this.frameCount++;
        const now = performance.now();
        if (now - this.lastFpsUpdate > 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.lastFpsUpdate = now;
        }

        const sprintMultiplier = this.game ? this.game.sprintMultiplier : 1;
        const radius = this.map ? this.map.radius : 500;

        let playersOnline = 0;
        let isOnline = false;
        let selfNickname = 'Гость';
        
        if (this.game) {
            const status = this.game.getOnlineStatus ? this.game.getOnlineStatus() : {};
            playersOnline = status.playersOnline || 0;
            isOnline = status.isOnline || false;
            selfNickname = status.selfNickname || 'Гость';
        }

        const statusColor = isOnline ? '#4CAF50' : '#f44336';
        const statusText = isOnline ? '🟢 В сети' : '🔴 Не в сети';

        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.fillRect(10, 10, 420, 218);
        
        ctx.fillStyle = '#fff';
        ctx.font = '14px monospace';
        ctx.fillText(`X: ${player.x.toFixed(2)}  Y: ${player.y.toFixed(2)}`, 20, 35);
        ctx.fillText(`Угол: ${Math.floor(angle)}°  |  Зум: ${zoom.toFixed(2)}`, 20, 55);
        ctx.fillText(`FPS: ${this.fps}  |  Скорость: ${sprintMultiplier}x`, 20, 75);
        ctx.fillText(`Радиус карты: ${radius}`, 20, 95);
        const resources = this.game?.resources || {};
        ctx.fillStyle = '#C9B27A';
        ctx.fillText(`⛏️ Дерево:${resources.wood||0}  Камень:${resources.stone||0}  Руда:${resources.ore||0}  Травы:${resources.herb||0}`, 20, 112);
        
        ctx.fillStyle = statusColor;
        ctx.font = 'bold 14px monospace';
        ctx.fillText(`👤 ${selfNickname}  ${statusText}`, 20, 140);
        
        ctx.fillStyle = '#aaa';
        ctx.font = '14px monospace';
        ctx.fillText(`👥 Игроков онлайн: ${playersOnline}`, 20, 162);
        
        // Контекстная подсказка сбора: показывается только когда рядом есть ресурс.
        if (this.map?.getObjectsAt && player) {
            const yields = { herb_patch:'Травы', ore:'Камень', ore_rich:'Руда', tree:'Дерево', tree_tall:'Высокое дерево', tree_dark:'Тёмное дерево', dead_tree:'Сухое дерево', tree_dead:'Сухое дерево', fallen_tree:'Древесина' };
            let nearest=null, best=1.65;
            for (const o of this.map.getObjectsAt(player.x, player.y, 1.65)) {
                if (!(o.resource || yields[o.type])) continue;
                const d=Math.hypot(o.x-player.x,o.y-player.y);
                if (d <= best) { nearest=o; best=d; }
            }
            if (nearest) {
                const label = nearest.resource === 'herb' ? 'Травы' : (yields[nearest.type] || 'Ресурс');
                const text = `F — собрать: ${label}`;
                ctx.font='bold 16px monospace';
                const w=ctx.measureText(text).width+30;
                const x=(this.canvas.width-w)/2, y=this.canvas.height-90;
                ctx.fillStyle='rgba(0,0,0,0.78)'; ctx.fillRect(x,y,w,38);
                ctx.strokeStyle='rgba(201,178,122,0.9)'; ctx.strokeRect(x,y,w,38);
                ctx.fillStyle='#fff'; ctx.fillText(text,x+15,y+25);
            }
        }

        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.font = '11px monospace';
        ctx.fillText('WASD — ходьба  |  Q/E — поворот  |  +/- — зум  |  F — собрать', 20, 185);
        ctx.fillText('Shift/двойное нажатие — бег  |  M — миникарта  |  X — телепорт', 20, 203);
    }

    // ============================================================
    // УПРАВЛЕНИЕ
    // ============================================================
    toggleDirectionIndicator() {
        this.showDirectionIndicator = !this.showDirectionIndicator;
        log(`Индикатор направления: ${this.showDirectionIndicator ? 'Включён' : 'Выключен'}`, 'info');
    }

    toggleHUD() {
        this.showHUD = !this.showHUD;
        log(`HUD: ${this.showHUD ? 'Включён' : 'Выключен'}`, 'info');
    }

    // ============================================================
    // УНИЧТОЖЕНИЕ
    // ============================================================
    destroy() {
        log('Ресурсы очищены', 'info');
        this.ctx = null;
        this.map = null;
        this.camera = null;
        this.player = null;
        this.game = null;
        this.isoRenderer = null;
        this.particles = [];
    }
}