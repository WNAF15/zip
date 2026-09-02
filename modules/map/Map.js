// Карта теперь является фасадом над WorldManager.
// Она больше не генерирует случайный мир и не использует seed.
// Базовая карта статична; чанки только подгружают нужные 15x15 участки.

import { TILE_TYPES } from './config.js';
import { WorldManager } from '../world/WorldManager.js';

const MAP_CONFIG = {
    chunkSize: 15,
    activeRadius: 1,     // чанки с полноценной игровой логикой
    preloadRadius: 2,    // заранее загружаем соседние
    unloadRadius: 4,     // выгружаем только заметно удалённые
    maxChunks: 169,
    circleId: 1,
};

function log(message, type = 'info') {
    console.log(`%c🗺️ [Map] ${message}`, 'color: #FFA726; font-weight: bold;');
}

function keyOf(x, y) { return `${x},${y}`; }

export class GameMap {
    constructor(options = {}) {
        // Совместимость со старым GameMap(seed): число больше не используется.
        if (typeof options === 'number') options = {};
        const config = { ...MAP_CONFIG, ...options };

        this.world = new WorldManager({
            circleId: config.circleId,
            chunkSize: config.chunkSize,
        });

        this.circleId = this.world.circleId;
        this.definition = this.world.definition;
        this.chunkSize = this.world.chunkSize;
        this.radius = this.definition.radius;
        this.hasBlueprintBoundary = this.definition.hasBlueprintBoundary === true;
        this.activeRadius = config.activeRadius;
        this.preloadRadius = Math.max(config.preloadRadius, config.activeRadius);
        this.unloadRadius = Math.max(config.unloadRadius, this.preloadRadius + 1);
        this.cacheRadius = this.preloadRadius * this.chunkSize;
        this.maxChunks = config.maxChunks;
        this.wallTileId = 3;

        this.chunks = new Map();
        this._generationQueue = [];
        this._queued = new Set();
        this._visibleCache = { playerX: null, playerY: null, radius: null, tiles: null };
        this._visibleObjectsCache = { playerX: null, playerY: null, radius: null, objects: null };
        this._lastCleanup = 0;
        this._lastGenerationTime = 0;
        this._cacheRevision = 0;

        log(`Загружен ${this.definition.name}: чанки ${this.chunkSize}x${this.chunkSize}, seed не используется`, 'success');
    }

    _chunkCoords(worldX, worldY) {
        return {
            chunkX: Math.floor(worldX / this.chunkSize),
            chunkY: Math.floor(worldY / this.chunkSize),
        };
    }

    _localCoords(worldX, worldY) {
        const localX = ((worldX % this.chunkSize) + this.chunkSize) % this.chunkSize;
        const localY = ((worldY % this.chunkSize) + this.chunkSize) % this.chunkSize;
        return { localX, localY };
    }

    _loadChunk(chunkX, chunkY) {
        const key = keyOf(chunkX, chunkY);
        let chunk = this.chunks.get(key);
        if (!chunk) {
            chunk = this.world.createChunk(chunkX, chunkY);
            this.chunks.set(key, chunk);
        }
        chunk.lastAccess = performance.now();
        return chunk;
    }

    _isChunkRelevant(chunkX, chunkY) {
        if (typeof this.definition.isChunkInside === 'function') {
            return this.definition.isChunkInside(chunkX, chunkY);
        }
        const cx = chunkX * this.chunkSize + this.chunkSize / 2;
        const cy = chunkY * this.chunkSize + this.chunkSize / 2;
        const reach = this.radius + Math.SQRT2 * this.chunkSize;
        return cx * cx + cy * cy <= reach * reach;
    }

    _fillGenerationQueue(playerX, playerY) {
        const { chunkX: pcx, chunkY: pcy } = this._chunkCoords(playerX, playerY);
        const candidates = [];

        for (let y = pcy - this.preloadRadius; y <= pcy + this.preloadRadius; y++) {
            for (let x = pcx - this.preloadRadius; x <= pcx + this.preloadRadius; x++) {
                const key = keyOf(x, y);
                if (this.chunks.has(key) || this._queued.has(key) || !this._isChunkRelevant(x, y)) continue;
                const distance = Math.max(Math.abs(x - pcx), Math.abs(y - pcy));
                candidates.push({ x, y, key, priority: distance });
            }
        }

        candidates.sort((a, b) => a.priority - b.priority);
        for (const item of candidates) {
            this._generationQueue.push(item);
            this._queued.add(item.key);
        }
    }

    async preloadArea(playerX, playerY, radius, onProgress = null) {
        const minX = Math.floor(playerX - radius), maxX = Math.ceil(playerX + radius);
        const minY = Math.floor(playerY - radius), maxY = Math.ceil(playerY + radius);
        const minChunk = this._chunkCoords(minX, minY);
        const maxChunk = this._chunkCoords(maxX, maxY);
        const pc = this._chunkCoords(playerX, playerY);
        const jobs = [];
        for (let cy = minChunk.chunkY; cy <= maxChunk.chunkY; cy++) {
            for (let cx = minChunk.chunkX; cx <= maxChunk.chunkX; cx++) {
                if (!this._isChunkRelevant(cx, cy)) continue;
                jobs.push({ cx, cy, distance: Math.max(Math.abs(cx-pc.chunkX), Math.abs(cy-pc.chunkY)) });
            }
        }
        jobs.sort((a,b)=>a.distance-b.distance);
        let done = 0;
        for (const job of jobs) {
            this._loadChunk(job.cx, job.cy);
            done++;
            onProgress?.(done, jobs.length);
            // Даём браузеру отрисовать индикатор и не блокируем страницу.
            if (done % 2 === 0) await new Promise(resolve => setTimeout(resolve, 0));
        }
        this._invalidateVisibleCaches();
        return { loaded: done, total: jobs.length };
    }

    // Оставлено имя для совместимости с Game.js.
    generateNextChunks(playerX, playerY, maxChunks = 2) {
        const start = performance.now();
        this._fillGenerationQueue(playerX, playerY);
        let loaded = 0;

        while (loaded < maxChunks && this._generationQueue.length) {
            const item = this._generationQueue.shift();
            this._queued.delete(item.key);
            if (this.chunks.has(item.key)) continue;
            this._loadChunk(item.x, item.y);
            loaded++;
        }

        if (loaded) this._invalidateVisibleCaches();
        this._lastGenerationTime = performance.now() - start;
        return loaded;
    }

    getChunk(chunkX, chunkY) {
        const key = keyOf(chunkX, chunkY);
        if (this.chunks.has(key)) {
            const chunk = this.chunks.get(key);
            chunk.lastAccess = performance.now();
            return chunk;
        }
        if (!this._isChunkRelevant(chunkX, chunkY)) return null;
        // Статический чанк создаётся только при фактической потребности.
        return this._loadChunk(chunkX, chunkY);
    }

    getTile(worldX, worldY) {
        const x = Math.round(worldX);
        const y = Math.round(worldY);

        if (typeof this.definition.isInside === 'function' && !this.definition.isInside(x, y)) return makeWall();
        if (typeof this.definition.isInside !== 'function' && x * x + y * y > this.radius * this.radius) return makeWall();

        const { chunkX, chunkY } = this._chunkCoords(x, y);
        const chunk = this.getChunk(chunkX, chunkY);
        if (!chunk) return makeWall();

        const { localX, localY } = this._localCoords(x, y);
        return chunk.tiles[localY]?.[localX] || makeWall();
    }

    _forceTile(worldX, worldY, tileType) {
        this.world.changeTile(worldX, worldY, tileType, { forced: true });
        const { chunkX, chunkY } = this._chunkCoords(worldX, worldY);
        const chunk = this._loadChunk(chunkX, chunkY);
        const { localX, localY } = this._localCoords(worldX, worldY);
        const config = TILE_TYPES[tileType] || TILE_TYPES[1];
        chunk.tiles[localY][localX] = makeTile(config.id);
        this._invalidateVisibleCaches();
    }

    harvestTile(worldX, worldY) {
        const x = Math.round(worldX);
        const y = Math.round(worldY);
        const tile = this.getTile(x, y);
        const config = TILE_TYPES[tile?.type];
        if (!config?.harvestable) return null;

        const nextType = config.becomesTileId ?? 1;
        this.world.changeTile(x, y, nextType, {
            state: 'harvested',
            harvestedFrom: tile.type,
        });

        const { chunkX, chunkY } = this._chunkCoords(x, y);
        const chunk = this._loadChunk(chunkX, chunkY);
        const { localX, localY } = this._localCoords(x, y);
        chunk.tiles[localY][localX] = makeTile(nextType);
        this._invalidateVisibleCaches();
        this.world.save();

        return { item: config.yields?.item || null, amount: config.yields?.amount || 0 };
    }

    recordChunkEvent(worldX, worldY, changes = {}) {
        const { chunkX, chunkY } = this._chunkCoords(worldX, worldY);
        const influence = this.world.changeChunkInfluence(chunkX, chunkY, changes);
        const chunk = this.getChunk(chunkX, chunkY);
        if (chunk) chunk.influence = influence;
        this.world.save();
        return influence;
    }

    _invalidateVisibleCaches() {
        this._cacheRevision++;
        this._visibleCache.tiles = null;
        this._visibleObjectsCache.objects = null;
    }

    getVisibleTiles(playerX, playerY, radius) {
        const px = Math.round(playerX), py = Math.round(playerY);
        const cacheRadius = Math.ceil(radius);
        if (this._visibleCache.tiles &&
            this._visibleCache.playerX === px &&
            this._visibleCache.playerY === py &&
            this._visibleCache.radius === cacheRadius &&
            this._visibleCache.revision === this._cacheRevision) {
            return this._visibleCache.tiles;
        }

        // Загружаем только чанки, пересекающие viewport/радиус.
        const minX = Math.floor(playerX - radius), maxX = Math.ceil(playerX + radius);
        const minY = Math.floor(playerY - radius), maxY = Math.ceil(playerY + radius);
        const minChunk = this._chunkCoords(minX, minY);
        const maxChunk = this._chunkCoords(maxX, maxY);
        const radiusSq = radius * radius;
        const result = [];

        for (let cy = minChunk.chunkY; cy <= maxChunk.chunkY; cy++) {
            for (let cx = minChunk.chunkX; cx <= maxChunk.chunkX; cx++) {
                const chunk = this.getChunk(cx, cy);
                if (!chunk) continue;
                const baseX = cx * this.chunkSize;
                const baseY = cy * this.chunkSize;

                for (let ly = 0; ly < this.chunkSize; ly++) {
                    const y = baseY + ly;
                    if (y < minY || y > maxY) continue;
                    for (let lx = 0; lx < this.chunkSize; lx++) {
                        const x = baseX + lx;
                        if (x < minX || x > maxX) continue;
                        const dx = x - playerX, dy = y - playerY;
                        if (dx * dx + dy * dy > radiusSq) continue;
                        const tile = chunk.tiles[ly][lx];
                        if (tile) result.push({ x, y, tile });
                    }
                }
            }
        }

        this._visibleCache = { playerX: px, playerY: py, radius: cacheRadius, tiles: result, revision: this._cacheRevision };
        return result;
    }

    getObjectsAt(worldX, worldY, radius = 0.5) {
        const minX = worldX - radius, maxX = worldX + radius;
        const minY = worldY - radius, maxY = worldY + radius;
        const minChunk = this._chunkCoords(Math.floor(minX));
        const maxChunk = this._chunkCoords(Math.ceil(maxX));
        const result = [];
        const seen = new Set();

        for (let cy = minChunk.chunkY; cy <= maxChunk.chunkY; cy++) {
            for (let cx = minChunk.chunkX; cx <= maxChunk.chunkX; cx++) {
                const chunk = this.getChunk(cx, cy);
                if (!chunk) continue;
                for (const object of chunk.objects || []) {
                    if (seen.has(object.id)) continue;
                    const objectRadius = object.collisionRadius ?? 0;
                    if (Math.abs(object.x - worldX) <= radius + objectRadius &&
                        Math.abs(object.y - worldY) <= radius + objectRadius) {
                        seen.add(object.id);
                        result.push(object);
                    }
                }
            }
        }
        return result;
    }

    isObjectBlocked(worldX, worldY, radius = 0) {
        const objects = this.getObjectsAt(worldX, worldY, radius + 0.75);
        for (const object of objects) {
            if (!object.blocks) continue;
            const r = (object.collisionRadius ?? 0.5) + radius;
            const dx = object.x - worldX;
            const dy = object.y - worldY;
            if (dx * dx + dy * dy < r * r) return true;
        }
        return false;
    }

    // Стены — не круглые объекты в центре тайла, а отрезки на границах клеток.
    // Проверяем пересечение траектории игрока со стеной, поэтому сквозь неё
    // нельзя проскочить даже при диагональном движении.
    isWallBlockedBetween(ax, ay, bx, by, radius = 0) {
        const minX=Math.min(ax,bx)-1, maxX=Math.max(ax,bx)+1;
        const minY=Math.min(ay,by)-1, maxY=Math.max(ay,by)+1;
        const candidates=this.getObjectsAt((minX+maxX)/2,(minY+maxY)/2,Math.max(maxX-minX,maxY-minY));
        const orient=(px,py,qx,qy,rx,ry)=> (qx-px)*(ry-py)-(qy-py)*(rx-px);
        const intersects=(px,py,qx,qy,rx,ry,sx,sy)=>{
            const o1=orient(px,py,qx,qy,rx,ry), o2=orient(px,py,qx,qy,sx,sy);
            const o3=orient(rx,ry,sx,sy,px,py), o4=orient(rx,ry,sx,sy,qx,qy);
            return ((o1>0&&o2<0)||(o1<0&&o2>0)) && ((o3>0&&o4<0)||(o3<0&&o4>0));
        };
        const pointSegDistSq=(px,py,x1,y1,x2,y2)=>{
            const dx=x2-x1, dy=y2-y1, l=dx*dx+dy*dy;
            const t=l?Math.max(0,Math.min(1,((px-x1)*dx+(py-y1)*dy)/l)):0;
            const xx=x1+t*dx, yy=y1+t*dy; const ex=px-xx, ey=py-yy; return ex*ex+ey*ey;
        };
        for(const o of candidates){
            if(!o.blocks || !o.edge || o.type==='door') continue;
            const half=(o.wallLength||1)/2;
            let x1=o.x-half,y1=o.y,x2=o.x+half,y2=o.y;
            if(o.edgeAxis==='y'){x1=o.x;y1=o.y-half;x2=o.x;y2=o.y+half;}
            const pad=(o.collisionThickness??.075)+radius;
            if(intersects(ax,ay,bx,by,x1,y1,x2,y2)) return true;
            if(pointSegDistSq(bx,by,x1,y1,x2,y2)<pad*pad) return true;
            if(pointSegDistSq(ax,ay,x1,y1,x2,y2)<pad*pad) return true;
        }
        return false;
    }

    getVisibleObjects(playerX, playerY, radius) {
        const px = Math.round(playerX), py = Math.round(playerY);
        const cacheRadius = Math.ceil(radius);
        if (this._visibleObjectsCache.objects && this._visibleObjectsCache.playerX === px &&
            this._visibleObjectsCache.playerY === py && this._visibleObjectsCache.radius === cacheRadius &&
            this._visibleObjectsCache.revision === this._cacheRevision) {
            return this._visibleObjectsCache.objects;
        }
        const minX = playerX - radius, maxX = playerX + radius;
        const minY = playerY - radius, maxY = playerY + radius;
        const seen = new Set();
        const objects = [];

        for (const chunk of this.chunks.values()) {
            const cx = chunk.x * this.chunkSize;
            const cy = chunk.y * this.chunkSize;
            if (cx > maxX || cy > maxY || cx + this.chunkSize < minX || cy + this.chunkSize < minY) continue;
            for (const object of chunk.objects || []) {
                if (!seen.has(object.id) && object.x >= minX && object.x <= maxX && object.y >= minY && object.y <= maxY) {
                    seen.add(object.id);
                    objects.push(object);
                }
            }
        }
        this._visibleObjectsCache = { playerX: px, playerY: py, radius: cacheRadius, objects, revision: this._cacheRevision };
        return objects;
    }

    harvestNearestResource(worldX, worldY, radius = 1.65) {
        const x = Number(worldX), y = Number(worldY);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
        // Ресурсный объект ищем среди уже загруженных чанков.
        const candidates = this.getObjectsAt(x, y, radius);
        let best = null, bestDistance = Infinity;
        const yields = { herb_patch:{item:'herb',amount:1}, ore:{item:'stone',amount:1}, ore_rich:{item:'ore',amount:2}, tree:{item:'wood',amount:1}, tree_tall:{item:'wood',amount:2}, tree_dark:{item:'wood',amount:1}, dead_tree:{item:'wood',amount:1}, tree_dead:{item:'wood',amount:1}, fallen_tree:{item:'wood',amount:2} };
        for (const object of candidates) {
            const yieldData = object.resource ? { item:object.resource, amount:object.amount||1 } : yields[object.type];
            if (!yieldData) continue;
            const distance = Math.hypot(object.x-x, object.y-y);
            if (distance < bestDistance) { best = { object, yieldData }; bestDistance = distance; }
        }
        if (!best) {
            // Тайлом собирается только явно помеченный растительный ресурс.
            // Камень, дерево и руда существуют как отдельные объекты.
            const tileResult = this.harvestTile(Math.round(x), Math.round(y));
            return tileResult ? { ...tileResult, source:'tile' } : null;
        }
        this.world.removeObject(best.object.id);
        for (const chunk of this.chunks.values()) {
            const index = (chunk.objects || []).findIndex(o => o.id === best.object.id);
            if (index >= 0) chunk.objects.splice(index, 1);
        }
        this._invalidateVisibleCaches();
        this.world.save();
        return { ...best.yieldData, source:'object', objectType:best.object.type };
    }

    clearCache(playerX, playerY) {
        const now = performance.now();
        const { chunkX: pcx, chunkY: pcy } = this._chunkCoords(playerX, playerY);
        const toRemove = [];
        // Дистанционная очистка может быть редкой, но жёсткий лимит памяти
        // проверяется всегда, поэтому быстрый переход игрока не раздувает cache.
        const shouldSweepByDistance = now - this._lastCleanup >= 2500;
        if (shouldSweepByDistance) {
            this._lastCleanup = now;
            for (const [key, chunk] of this.chunks) {
                const distance = Math.max(Math.abs(chunk.x - pcx), Math.abs(chunk.y - pcy));
                if (distance > this.unloadRadius) toRemove.push(key);
            }
        }

        // Страховка по памяти: удаляем самые давно использованные, но не активные.
        if (this.chunks.size - toRemove.length > this.maxChunks) {
            const active = new Set();
            for (let y = pcy - this.activeRadius; y <= pcy + this.activeRadius; y++) {
                for (let x = pcx - this.activeRadius; x <= pcx + this.activeRadius; x++) active.add(keyOf(x, y));
            }
            const extra = [...this.chunks.entries()]
                .filter(([key]) => !active.has(key) && !toRemove.includes(key))
                .sort((a, b) => a[1].lastAccess - b[1].lastAccess)
                .slice(0, this.chunks.size - toRemove.length - this.maxChunks)
                .map(([key]) => key);
            toRemove.push(...extra);
        }

        for (const key of new Set(toRemove)) this.chunks.delete(key);
        if (toRemove.length) this._invalidateVisibleCaches();
    }

    destroy() {
        this.world.destroy();
        this.chunks.clear();
        this._generationQueue = [];
        this._queued.clear();
        this._visibleCache.tiles = null;
        this._visibleObjectsCache.objects = null;
        log('Карта выгружена', 'info');
    }

    getStats() {
        return {
            circleId: this.circleId,
            circleName: this.definition.name,
            chunksLoaded: this.chunks.size,
            chunkSize: this.chunkSize,
            worldChunks: this.definition.worldChunks || null,
            worldTiles: this.definition.worldTiles || null,
            activeRadius: this.activeRadius,
            preloadRadius: this.preloadRadius,
            queueSize: this._generationQueue.length,
            lastGenTime: this._lastGenerationTime,
        };
    }
}

function makeTile(type) {
    const config = TILE_TYPES[type] || TILE_TYPES[1];
    return {
        type: config.id,
        color: config.color,
        walkable: config.walkable === true,
        name: config.name,
        category: config.category || 'terrain',
        zones: config.zones || [1],
        floorStyle: config.floorStyle || null,
        spriteFamily: config.spriteFamily || null,
    };
}

function makeWall() { return makeTile(3); }
