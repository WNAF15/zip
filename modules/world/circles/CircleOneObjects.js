// Объектный слой Первого круга.
// Никаких объектов всей карты в памяти: для каждого загруженного чанка
// создаётся небольшой фиксированный набор по его координатам.

import { getCircleOneSettlementObjects } from '../settlements/CircleOneSettlements.js';
import { getStructuresForChunk } from '../structures/StructureGenerator.js';
import { getTerritoryObjectsForChunk } from '../territories/TerritoryGenerator.js';
import { isGenerationBlocked } from '../territories/TerritoryReservationSystem.js';
import { getBiomeEnvironmentForChunk } from '../environment/BiomeEnvironmentGenerator.js';
import { getEdgeEnvironmentForChunk } from '../environment/EdgeEnvironmentGenerator.js';

const CHUNK_SIZE = 15;

function hash32(a, b, c = 0) {
    let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2147483647);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return (h ^ (h >>> 16)) >>> 0;
}

function rand(chunkX, chunkY, index, salt = 0) {
    return hash32(chunkX, chunkY, index * 37 + salt) / 4294967295;
}

function id(type, x, y) { return `${type}:${x.toFixed(2)}:${y.toFixed(2)}`; }

function push(objects, type, x, y, extra = {}) {
    objects.push({ id: id(type, x, y), type, x, y, ...extra });
}

function nearRoad(x, y, getRoadAt) {
    if (!getRoadAt) return false;
    return Boolean(getRoadAt(Math.round(x), Math.round(y)));
}

function scatter(chunkX, chunkY, count, type, getRoadAt, objects, options = {}) {
    const baseX = chunkX * CHUNK_SIZE;
    const baseY = chunkY * CHUNK_SIZE;
    const margin = options.margin ?? 1.2;
    for (let i = 0; i < count; i++) {
        const x = baseX + Math.floor(margin + rand(chunkX, chunkY, i, options.salt || 0) * (CHUNK_SIZE - margin * 2));
        const y = baseY + Math.floor(margin + rand(chunkX, chunkY, i, options.salt || 11) * (CHUNK_SIZE - margin * 2));
        if (nearRoad(x, y, getRoadAt) || isGenerationBlocked(x, y)) continue;
        push(objects, type, x, y, { tileX:x, tileY:y, tileWidth:1, tileHeight:1, ...(options.extra || {}) });
    }
}

function makeCamp(chunkX, chunkY, getRoadAt, objects) {
    const baseX = chunkX * CHUNK_SIZE;
    const baseY = chunkY * CHUNK_SIZE;
    const active = hash32(chunkX, chunkY, 901) % 5 === 0;
    if (isGenerationBlocked(baseX + 7.5, baseY + 7.5)) return;
    if (!active) return;

    const cx = baseX + 7.5;
    const cy = baseY + 7.5;
    if (nearRoad(cx, cy, getRoadAt)) {
        scatter(chunkX, chunkY, 3, 'tent', getRoadAt, objects, { salt: 200 });
        return;
    }

    const tentCount = 3 + (hash32(chunkX, chunkY, 902) % 4);
    for (let i = 0; i < tentCount; i++) {
        const angle = (Math.PI * 2 * i) / tentCount;
        const r = 2.0 + rand(chunkX, chunkY, i, 211) * 2.0;
        push(objects, 'tent', cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
    }
    push(objects, 'campfire', cx, cy);
}

function makeFactoryDetail(chunkX, chunkY, getRoadAt, objects) {
    // Заводской декор теперь создаёт StructureGenerator, случайный декор здесь запрещён.
    return;
    const active = hash32(chunkX, chunkY, 700) % 4 === 0;
    if (!active) return;
    scatter(chunkX, chunkY, 1, 'machinery', getRoadAt, objects, { salt: 701 });
    scatter(chunkX, chunkY, 2, 'pipe', getRoadAt, objects, { salt: 702 });
    scatter(chunkX, chunkY, 2, 'crate', getRoadAt, objects, { salt: 703 });
}

export function getCircleOneObjectsForChunk(chunkX, chunkY, biome, { getRoadAt, district = 'resource' } = {}) {
    const objects = [];

    // Крупные постройки независимы от биома и могут занимать много чанков.
    objects.push(...getStructuresForChunk(chunkX, chunkY));
    objects.push(...getTerritoryObjectsForChunk(chunkX, chunkY));
    // Край мира — отдельный декоративный слой, не влияющий на географию.
    objects.push(...getEdgeEnvironmentForChunk(chunkX, chunkY, { getRoadAt }));

    // Природная среда вынесена в отдельный генератор: он создаёт
    // плотные/редкие зоны и разновидности природы, не затрагивая стратегические территории.
    // Социальный слой независим от базового terrain: палатки могут стоять на земле, траве
    // или у кромки леса. Богатый центр остаётся чистым и контролируемым.
    if (district === 'poor' || district === 'tent') {
        objects.push(...getCircleOneSettlementObjects(chunkX, chunkY, district));
    }
    if (biome !== 'factory' && biome !== 'shop' && biome !== 'pharmacy' && biome !== 'supply' && biome !== 'spawn') {
        objects.push(...getBiomeEnvironmentForChunk(chunkX, chunkY, biome, { getRoadAt, district }));
    }


    return objects;
}
