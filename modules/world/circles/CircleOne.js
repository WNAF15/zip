// Первый круг — огромная статическая карта.
// 1000×1000 чанков × 15×15 тайлов = до 225 000 000 игровых тайлов.
// Полный мир никогда не материализуется в памяти: создаются только активные чанки.

import { getBlueprintBiome, getBlueprintDistrict, isBlueprintChunkInside } from './CircleOneBlueprint.js';
import { getLandmarksInBounds } from './CircleOneLandmarks.js';
import { getCircleOneRoadAt, getCircleOneRoads } from './CircleOneRoads.js';
import { getCircleOneObjectsForChunk } from './CircleOneObjects.js';
import { canPlayerBuildAt } from '../territories/TerritoryReservationSystem.js';
import { getStructureFloorAt } from '../structures/StructureGenerator.js';

const CHUNK_SIZE = 15;
const WORLD_CHUNKS = 1000;
const WORLD_SIZE_TILES = WORLD_CHUNKS * CHUNK_SIZE;

const BIOME_TILE = {
    // Каждый биом выбирает собственный базовый tile type.
    // Объекты и полы зданий накладываются поверх этой основы.
    ground: 1,
    grass: 2,
    forest: 21,
    quarry: 22,
    rock: 13,
    camp: 23,
    factory: 24,
    supply: 25,
    shop: 1,
    pharmacy: 1,
    spawn: 1,
    void: 3,
};

function chunkFromWorld(x, y) {
    return {
        x: Math.floor(x / CHUNK_SIZE),
        y: Math.floor(y / CHUNK_SIZE),
    };
}

// Это не генерация географии: основной биом уже жёстко задан blueprint.
// Здесь лишь фиксированная детализация ресурсов внутри разрешённого биома.
function transitionAt(x, y, biome, neighbors = null) {
    if (!neighbors) {
        const c = chunkFromWorld(x, y);
        neighbors = [
            getBlueprintBiome(c.x-1,c.y), getBlueprintBiome(c.x+1,c.y),
            getBlueprintBiome(c.x,c.y-1), getBlueprintBiome(c.x,c.y+1),
        ];
    }
    if (neighbors.every(n => n === biome || n === 'void')) return null;
    const a = Math.abs((x*19 + y*23) % 11);
    if (a > 2) return null;
    if ((biome==='ground' && neighbors.includes('grass')) || (biome==='grass' && neighbors.includes('ground'))) return 14;
    if ((biome==='grass' && neighbors.includes('forest')) || (biome==='forest' && neighbors.includes('grass'))) return 15;
    if (neighbors.includes('rock') || biome==='rock') return 16;
    return null;
}

function detailAt(x, y, biome, neighbors = null) {
    const transition = transitionAt(x, y, biome, neighbors);
    if (transition) return transition;
    const a = Math.abs((x * 17 + y * 31 + x * y * 3) % 97);

    if (biome === 'grass' && a % 19 === 0) return 9;
    // Дерево, камень и руда — отдельные объекты. Базовый тайл не превращаем в ресурс.
    if (biome === 'quarry' && a % 5 === 0) return 13;
    if (biome === 'rock' && a % 7 === 0) return 17;

    return BIOME_TILE[biome] ?? 1;
}

function localObjectsForChunk(chunkX, chunkY, biome, district) {
    return getCircleOneObjectsForChunk(chunkX, chunkY, biome, {
        getRoadAt: getCircleOneRoadAt,
        district,
    });
}

export const CircleOne = {
    id: 1,
    key: 'circle-1',
    name: 'Первый круг',
    chunkSize: CHUNK_SIZE,
    worldChunks: { width: WORLD_CHUNKS, height: WORLD_CHUNKS },
    worldTiles: { width: WORLD_SIZE_TILES, height: WORLD_SIZE_TILES },
    coordinateOrigin: 'center',
    // Используется старым HUD/Minimap только как приблизительный масштаб.
    radius: 7350,
    hasBlueprintBoundary: true,
    spawn: { x: 0, y: 0 },

    getChunkBiome(chunkX, chunkY) {
        return getBlueprintBiome(chunkX, chunkY);
    },

    isChunkInside(chunkX, chunkY) {
        return isBlueprintChunkInside(chunkX, chunkY);
    },

    isInside(x, y) {
        const chunk = chunkFromWorld(x, y);
        return this.isChunkInside(chunk.x, chunk.y);
    },

    getTileType(x, y, biomeOverride = null, neighborBiomes = null) {
        const chunk = biomeOverride === null ? chunkFromWorld(x, y) : null;
        const biome = biomeOverride ?? this.getChunkBiome(chunk.x, chunk.y);
        if (biome === 'void') return 3;
        return detailAt(x, y, biome, neighborBiomes);
    },

    // Пол здания является полноценной поверхностью тайла и заменяет terrain визуально.
    getBuildingFloorAt(x, y) { return getStructureFloorAt(x, y); },

    // Дороги — отдельный слой над тайлами. Они не заменяют базовый биом.
    getRoadAt(x, y) {
        return getCircleOneRoadAt(x, y);
    },

    getRoads() {
        return getCircleOneRoads();
    },

    getObjectsInBounds(minX, minY, maxX, maxY) {
        const minChunk = chunkFromWorld(minX, minY);
        const maxChunk = chunkFromWorld(maxX, maxY);
        const objects = getLandmarksInBounds(minX, minY, maxX, maxY).filter(o => !['factory', 'shop', 'pharmacy'].includes(o.type));

        for (let chunkY = minChunk.y; chunkY <= maxChunk.y; chunkY++) {
            for (let chunkX = minChunk.x; chunkX <= maxChunk.x; chunkX++) {
                if (!this.isChunkInside(chunkX, chunkY)) continue;
                const biome = this.getChunkBiome(chunkX, chunkY);
                const district = getBlueprintDistrict(chunkX, chunkY);
                objects.push(...localObjectsForChunk(chunkX, chunkY, biome, district));
            }
        }

        return objects;
    },

    getZoneAt(x, y) {
        const chunk = chunkFromWorld(x, y);
        const kind = this.getChunkBiome(chunk.x, chunk.y);
        const district = getBlueprintDistrict(chunk.x, chunk.y);
        return kind === 'void' ? null : { id: `${district}:${kind}`, kind, district, chunkX: chunk.x, chunkY: chunk.y };
    },

    canPlayerBuildAt(x, y) { return canPlayerBuildAt(x, y); },

    rules: {
        tier: 'low',
        monsters: 'low',
        resources: 'high',
        slaves: 'high',
        consciousDemons: 'rare',
    },

    influences: {
        blood: { threshold: 100, name: 'Кровавый' },
        civilization: { threshold: 80, name: 'Городской' },
        industry: { threshold: 70, name: 'Промышленный' },
    },
};

export default CircleOne;
