// Природная среда Первого круга.
// География карты остаётся статической, но каждый чанк получает
// детерминированную «микросреду»: плотность, разновидности растений,
// каменные препятствия и ресурсные узлы. Никаких seed и хранения мира целиком.

import { isGenerationBlocked } from '../territories/TerritoryReservationSystem.js';

const CHUNK_SIZE = 15;

function hash32(a, b, c = 0) {
    let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2147483647);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return (h ^ (h >>> 16)) >>> 0;
}
function rand(cx, cy, index, salt = 0) { return hash32(cx, cy, index * 37 + salt) / 4294967295; }
function noise(cx, cy, salt = 0) {
    let total = 0, weight = 0;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const w = ox === 0 && oy === 0 ? 4 : (ox === 0 || oy === 0 ? 2 : 1);
        total += rand(cx + ox, cy + oy, 0, salt) * w; weight += w;
    }
    return total / weight;
}
function push(out, type, x, y, extra = {}) {
    out.push({ id: `${type}:${x.toFixed(2)}:${y.toFixed(2)}`, type, x, y, ...extra });
}
function free(x, y, getRoadAt) {
    return !isGenerationBlocked(x, y) && !(getRoadAt && getRoadAt(Math.round(x), Math.round(y)));
}
function scatter(out, cx, cy, count, choices, salt, getRoadAt, extra = {}) {
    const baseX = cx * CHUNK_SIZE, baseY = cy * CHUNK_SIZE, used=new Set(out.map(o=>`${Math.floor(o.x)},${Math.floor(o.y)}`));
    for (let i = 0; i < count * 3 && used.size < count; i++) {
        const tx = baseX + 1 + Math.floor(rand(cx, cy, i, salt) * 13);
        const ty = baseY + 1 + Math.floor(rand(cx, cy, i, salt + 11) * 13);
        const k=`${tx},${ty}`; if(used.has(k)) continue;
        if (!free(tx+.5, ty+.5, getRoadAt)) continue;
        const type = choices[Math.floor(rand(cx, cy, i, salt + 23) * choices.length)];
        push(out, type, tx, ty, {tileX:tx,tileY:ty,tileWidth:1,tileHeight:1,...extra}); used.add(k);
    }
}

export function getBiomeEnvironmentForChunk(chunkX, chunkY, biome, { getRoadAt, district = 'resource' } = {}) {
    const out = [];
    // Крупные стратегические территории всегда имеют абсолютный приоритет.
    if (isGenerationBlocked(chunkX * CHUNK_SIZE + 7.5, chunkY * CHUNK_SIZE + 7.5)) return out;

    let density = noise(chunkX, chunkY, 501);
    // В богатом центре природа подавлена инфраструктурой; в палаточном поясе
    // сохраняются клочья природы между лагерями.
    if (district === 'rich') density *= 0.25;
    if (district === 'poor') density *= 0.65;
    switch (biome) {
        case 'forest': {
            // От редкой окраины к густым участкам; плотность плавно меняется между соседними чанками.
            const trees = density > 0.68 ? 16 : density > 0.50 ? 11 : density > 0.34 ? 7 : 4;
            scatter(out, chunkX, chunkY, trees, ['tree', 'tree_tall', 'tree_dark', 'dead_tree'], 510, getRoadAt);
            scatter(out, chunkX, chunkY, density > 0.55 ? 7 : 4, ['bush', 'bush_dense', 'thorn_bush'], 530, getRoadAt);
            if (density > 0.58) scatter(out, chunkX, chunkY, 1, ['fallen_tree'], 550, getRoadAt);
            if (density > 0.62) scatter(out, chunkX, chunkY, 2, ['herb_patch'], 570, getRoadAt, { resource: 'herb' });
            break;
        }
        case 'grass': {
            scatter(out, chunkX, chunkY, density > 0.58 ? 6 : 3, ['bush', 'grass_clump', 'thorn_bush'], 610, getRoadAt);
            scatter(out, chunkX, chunkY, density > 0.50 ? 3 : 1, ['herb_patch'], 630, getRoadAt, { resource: 'herb' });
            if (density > 0.72) scatter(out, chunkX, chunkY, 1, ['tree_dark'], 650, getRoadAt);
            break;
        }
        case 'rock': {
            scatter(out, chunkX, chunkY, density > 0.55 ? 10 : 6, ['rock', 'rock_sharp', 'cliff_rock'], 710, getRoadAt);
            scatter(out, chunkX, chunkY, density > 0.62 ? 3 : 1, ['boulder'], 730, getRoadAt);
            if (density > 0.60) scatter(out, chunkX, chunkY, 2, ['ore'], 750, getRoadAt, { resource: 'stone' });
            break;
        }
        case 'quarry': {
            scatter(out, chunkX, chunkY, 5, ['boulder', 'rock_sharp', 'cliff_rock'], 810, getRoadAt);
            scatter(out, chunkX, chunkY, 5 + (hash32(chunkX, chunkY, 821) % 4), ['ore', 'ore_rich'], 830, getRoadAt, { resource: 'ore' });
            break;
        }
        case 'ground': {
            // Основная красная земля не должна быть пустой и одинаковой.
            if (density > 0.66) scatter(out, chunkX, chunkY, 2, ['rock', 'grass_clump'], 910, getRoadAt);
            else if (density < 0.30) scatter(out, chunkX, chunkY, 1, ['dead_tree', 'rock_sharp'], 930, getRoadAt);
            break;
        }
    }
    return out;
}
