// Первый круг — статическая макрогеография на 1000×1000 чанков.
// Мир не материализуется целиком: функции ниже детерминированно отвечают
// на запрос конкретного чанка. Это даёт большую живую карту без нагрузки
// памяти и без хранения миллиона biome-записей.

export const CIRCLE_ONE_BLUEPRINT = Object.freeze({
    widthChunks: 1000,
    heightChunks: 1000,
    chunkSize: 15,
    coordinateOrigin: 'center',
    description: 'Первый круг: богатый центр → бедные районы → палаточный пояс → смешанные ресурсные земли',
});

const OUTER_BOUNDARY = [
    [152, 52], [382, 8], [603, 16], [820, 86], [972, 238],
    [1000, 472], [946, 734], [786, 936], [578, 1000],
    [344, 990], [146, 908], [18, 730], [0, 505], [44, 286],
];

// Внутренняя безопасная линия оставляет рваный каменный край и пустоту снаружи.
const INNER_BOUNDARY = [
    [172, 76], [390, 34], [598, 40], [798, 104], [944, 252],
    [970, 470], [920, 716], [770, 908], [572, 970],
    [358, 962], [168, 882], [48, 716], [30, 510], [70, 302],
];

const SPECIAL_REGIONS = [
    { id: 'spawn', polygon: [[470,470],[530,470],[550,500],[530,530],[470,530],[450,500]] },
    { id: 'supply', polygon: [[460,105],[550,105],[565,150],[525,185],[455,165]] },
    { id: 'pharmacy', polygon: [[430,715],[465,715],[470,755],[435,760]] },
    { id: 'shop', polygon: [[500,730],[540,730],[545,770],[505,775]] },
    { id: 'factory', polygon: [[55,360],[205,330],[290,420],[270,565],[95,590],[30,500]] },
    { id: 'factory', polygon: [[650,180],[820,190],[875,320],[760,390],[625,315]] },
    { id: 'factory', polygon: [[70,705],[250,675],[315,790],[255,900],[95,875],[35,790]] },
    { id: 'factory', polygon: [[780,620],[965,590],[975,765],[860,850],[755,770]] },
    { id: 'quarry', polygon: [[740,515],[965,500],[980,690],[860,810],[735,740],[680,610]] },
];

function pointInPolygon(x, y, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i][0], yi = polygon[i][1];
        const xj = polygon[j][0], yj = polygon[j][1];
        const intersects = ((yi > y) !== (yj > y)) &&
            (x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi);
        if (intersects) inside = !inside;
    }
    return inside;
}

function hash32(x, y, salt = 0) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(salt | 0, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return (h ^ (h >>> 16)) >>> 0;
}
function valueNoise(x, y, cellSize, salt) {
    const gx = Math.floor(x / cellSize), gy = Math.floor(y / cellSize);
    const fx = (x / cellSize) - gx, fy = (y / cellSize) - gy;
    const smooth = t => t * t * (3 - 2 * t);
    const sample = (ix, iy) => hash32(ix, iy, salt) / 4294967295;
    const sx = smooth(fx), sy = smooth(fy);
    const a = sample(gx, gy), b = sample(gx + 1, gy);
    const c = sample(gx, gy + 1), d = sample(gx + 1, gy + 1);
    return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
}
function terrainField(x, y, salt = 0) {
    // Несколько больших волн создают смешанные территории, а не клетчатую генерацию.
    return valueNoise(x, y, 28, salt) * 0.58 + valueNoise(x, y, 67, salt + 17) * 0.30 + valueNoise(x, y, 130, salt + 41) * 0.12;
}

export function worldChunkToBlueprint(chunkX, chunkY) {
    return { x: chunkX + 500, y: chunkY + 500 };
}

export function isBlueprintChunkInside(chunkX, chunkY) {
    const p = worldChunkToBlueprint(chunkX, chunkY);
    return p.x >= 0 && p.y >= 0 && p.x < 1000 && p.y < 1000 &&
        pointInPolygon(p.x + 0.5, p.y + 0.5, OUTER_BOUNDARY);
}

function radialDistrict(x, y) {
    const dx = (x - 500) / 500;
    const dy = (y - 500) / 500;
    // Лёгкая деформация делает социальные пояса не идеально круглыми.
    const angle = Math.atan2(dy, dx);
    const wobble = 1 + Math.sin(angle * 3 + 0.8) * 0.035 + Math.cos(angle * 5 - 0.4) * 0.022;
    const r = Math.hypot(dx, dy) / wobble;
    if (r <= 0.18) return 'rich';
    if (r <= 0.42) return 'poor';
    if (r <= 0.69) return 'tent';
    return 'resource';
}

export function getBlueprintDistrict(chunkX, chunkY) {
    if (!isBlueprintChunkInside(chunkX, chunkY)) return 'void';
    const p = worldChunkToBlueprint(chunkX, chunkY);
    if (!pointInPolygon(p.x + 0.5, p.y + 0.5, INNER_BOUNDARY)) return 'edge';
    return radialDistrict(p.x + 0.5, p.y + 0.5);
}

function mixedResourceBiome(x, y) {
    const fForest = terrainField(x, y, 101);
    const fGrass = terrainField(x + 41, y - 17, 211);
    const fRock = terrainField(x - 29, y + 53, 307);
    const fQuarry = terrainField(x + 73, y + 19, 401);
    const northSouth = terrainField(x, y, 509);

    // Самая высокая "сила" побеждает; области получаются крупными и с мягкими границами.
    const scores = [
        ['forest', fForest + (northSouth > .57 ? .08 : 0)],
        ['grass', fGrass],
        ['rock', fRock + (x > 610 || y > 650 ? .05 : 0)],
        ['quarry', fQuarry + (fRock > .56 ? .06 : 0)],
        ['ground', 0.53 + terrainField(x, y, 613) * .16],
    ];
    scores.sort((a, b) => b[1] - a[1]);
    return scores[0][0];
}

function mixedCivilBiome(x, y, district) {
    const f = terrainField(x, y, district === 'poor' ? 701 : 809);
    const g = terrainField(x + 37, y - 23, 719);
    if (district === 'rich') return 'ground'; // богатый центр специально стабилен
    if (district === 'poor') {
        if (f > .69) return 'grass';
        if (g < .28) return 'rock';
        return 'ground';
    }
    // Палаточный пояс: почва и природа смешиваются, но не превращаются в один сплошной лагерь.
    if (f > .70) return 'grass';
    if (g > .73) return 'rock';
    if (f < .31 && g < .43) return 'forest';
    return 'ground';
}

export function getBlueprintBiome(chunkX, chunkY) {
    if (!isBlueprintChunkInside(chunkX, chunkY)) return 'void';
    const p = worldChunkToBlueprint(chunkX, chunkY);
    const x = p.x + 0.5, y = p.y + 0.5;
    if (!pointInPolygon(x, y, INNER_BOUNDARY)) return 'rock';

    for (const region of SPECIAL_REGIONS) {
        if (pointInPolygon(x, y, region.polygon)) return region.id;
    }

    const district = radialDistrict(x, y);
    return district === 'resource' ? mixedResourceBiome(x, y) : mixedCivilBiome(x, y, district);
}

function pointToSegmentDistance(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const lengthSq = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((px-ax)*dx + (py-ay)*dy) / lengthSq));
    return Math.hypot(px - (ax + dx*t), py - (ay + dy*t));
}

export function getOuterBoundaryDistance(x, y) {
    let best = Infinity;
    for (let i=0, j=OUTER_BOUNDARY.length-1; i<OUTER_BOUNDARY.length; j=i++) {
        best = Math.min(best, pointToSegmentDistance(x, y, OUTER_BOUNDARY[j][0], OUTER_BOUNDARY[j][1], OUTER_BOUNDARY[i][0], OUTER_BOUNDARY[i][1]));
    }
    return best;
}
export function getBlueprintBounds() { return { minChunkX:-500, maxChunkX:499, minChunkY:-500, maxChunkY:499 }; }
