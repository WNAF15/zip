import { getCircleDefinition } from './CircleRegistry.js';
import { WorldState } from './state/WorldState.js';
import { TILE_TYPES } from '../map/config.js';
import { normalizeWorldObject } from './objects/ObjectRegistry.js';

function makeTile(type, floor = null) {
    const floorTypeByStyle = { store: 18, tile: 19, industrial: 20 };
    const resolvedType = floor ? (floorTypeByStyle[floor.floorStyle] || type) : type;
    const config = TILE_TYPES[resolvedType] || TILE_TYPES[1];
    return {
        type: resolvedType,
        baseType: type,
        color: config.color,
        walkable: config.walkable === true,
        name: config.name,
        category: config.category || 'terrain',
        zones: config.zones || [1],
        floorStyle: floor?.floorStyle || config.floorStyle || null,
        // КРИТИЧНО: передаём семейство спрайтов в runtime-тайл.
        // Без этого IsometricRenderer не может выбрать строку atlas и падает в зелёный fallback.
        spriteFamily: config.spriteFamily || null,
        structureId: floor?.structureId || null,
        roomId: floor?.roomId || null,
    };
}

// Единый движок мира для всех 9 кругов.
// Он не знает деталей конкретного круга: круг передаёт только definition.
export class WorldManager {
    constructor({ circleId = 1, chunkSize = null } = {}) {
        this.definition = getCircleDefinition(circleId);
        this.circleId = this.definition.id;
        this.chunkSize = chunkSize || this.definition.chunkSize || 15;
        this.state = new WorldState(this.circleId);
    }

    createChunk(chunkX, chunkY) {
        const size = this.chunkSize;
        const baseX = chunkX * size;
        const baseY = chunkY * size;
        const tiles = new Array(size);
        // Биом чанка и его соседей неизменяемы: считаем один раз на чанк,
        // а не сотни раз на каждый terrain tile.
        const chunkBiome = typeof this.definition.getChunkBiome === 'function'
            ? this.definition.getChunkBiome(chunkX, chunkY)
            : null;
        const neighborBiomes = chunkBiome !== null && typeof this.definition.getChunkBiome === 'function'
            ? [
                this.definition.getChunkBiome(chunkX - 1, chunkY),
                this.definition.getChunkBiome(chunkX + 1, chunkY),
                this.definition.getChunkBiome(chunkX, chunkY - 1),
                this.definition.getChunkBiome(chunkX, chunkY + 1),
            ]
            : null;

        for (let localY = 0; localY < size; localY++) {
            tiles[localY] = new Array(size);
            for (let localX = 0; localX < size; localX++) {
                const worldX = baseX + localX;
                const worldY = baseY + localY;
                const change = this.state.getTileChange(worldX, worldY);
                const type = change?.type ?? this.definition.getTileType(worldX, worldY, chunkBiome, neighborBiomes);
                const floor = typeof this.definition.getBuildingFloorAt === 'function'
                    ? this.definition.getBuildingFloorAt(worldX, worldY)
                    : null;
                const tile = makeTile(type, floor);
                tile.worldX = worldX;
                tile.worldY = worldY;

                // Дорога хранится отдельным render/gameplay слоем и не заменяет terrain.
                // Изменения ресурса тайла при этом не уничтожают дорогу.
                if (tile.walkable && typeof this.definition.getRoadAt === 'function') {
                    const road = this.definition.getRoadAt(worldX, worldY);
                    if (road) tile.road = road;
                }

                tiles[localY][localX] = tile;
            }
        }

        return {
            x: chunkX,
            y: chunkY,
            tiles,
            objects: this.definition.getObjectsInBounds(
                baseX, baseY, baseX + size - 1, baseY + size - 1
            ).map(normalizeWorldObject).filter(object => !this.state.isObjectRemoved(object.id)),
            influence: this.state.getInfluence(chunkX, chunkY),
            lastAccess: performance.now(),
        };
    }

    removeObject(id) { this.state.removeObject(id); }

    changeTile(worldX, worldY, type, metadata = {}) {
        this.state.setTileChange(worldX, worldY, { type, ...metadata });
    }

    changeChunkInfluence(chunkX, chunkY, changes) {
        return this.state.changeInfluence(chunkX, chunkY, changes);
    }

    save() { this.state.save(); }
    destroy() { this.state.destroy(); }
}
