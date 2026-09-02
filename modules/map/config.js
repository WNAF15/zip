// assets/games/circle-of-hell/modules/map/config.js

export { WORLD_OBJECT_TYPES } from '../world/objects/ObjectRegistry.js';

export const TILE_TYPES = {
    1: {
        id: 1,
        name: 'земля',
        color: '#8B7355',
        spriteFamily: 'ground',
        walkable: true,
        category: 'terrain',
        zones: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    },
    2: {
        id: 2,
        name: 'трава',
        color: '#6B8E23',
        spriteFamily: 'grass',
        walkable: true,
        category: 'terrain',
        zones: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    },
    3: {
        id: 3,
        name: 'стена',
        color: '#4A4A4A',
        walkable: false,
        category: 'structure',
        zones: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    },
    4: {
        id: 4,
        name: 'вода',
        color: '#4682B4',
        spriteFamily: 'water',
        walkable: false,
        category: 'terrain',
        zones: [1, 2, 3],
    },
    5: {
        id: 5,
        name: 'завод',
        color: '#8B0000',
        walkable: false,
        category: 'structure',
        zones: [1, 2],
    },
    6: {
        id: 6,
        name: 'палатка',
        color: '#DAA520',
        walkable: true,
        category: 'structure',
        zones: [1, 2, 3, 4],
    },
    7: {
        id: 7,
        name: 'магазин',
        color: '#FF8C00',
        walkable: true,
        category: 'structure',
        zones: [1, 2, 3],
    },
    8: {
        id: 8,
        name: 'портал',
        color: '#9400D3',
        walkable: true,
        category: 'structure',
        zones: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    },
    // === Дополнено по чертежу 1 круга (п.3 плана) ===
    // harvestable: true -> тайл можно собрать (п.3.1), при сборе даёт
    // ресурс (yields) и превращается в тайл becomesTileId.
    9: {
        id: 9,
        name: 'растительные ценности',
        color: '#3F7D20',
        spriteFamily: 'grass',
        walkable: true,
        category: 'resource',
        zones: [1],
        harvestable: true,
        yields: { item: 'herb', amount: 1 },
        becomesTileId: 1,
    },
    10: {
        id: 10,
        name: 'каменоломня',
        color: '#7A7A7A',
        walkable: true,
        category: 'resource',
        zones: [1],
        // Камень добывается отдельными объектами, а не сбором тайла.
    },
    11: {
        id: 11,
        name: 'добыча дерева',
        color: '#5B3A21',
        walkable: true,
        category: 'resource',
        zones: [1],
        // Дерево добывается отдельными объектами, а не сбором тайла.
    },
    12: {
        id: 12,
        name: 'аптека',
        color: '#2E8B8B',
        walkable: true,
        category: 'structure',
        zones: [1],
    },
    13: {
        id: 13,
        name: 'каменистая местность',
        color: '#5A5853',
        spriteFamily: 'stone',
        walkable: true,
        category: 'terrain',
        zones: [1],
    },
    14: { id:14, name:'переход земля-трава', color:'#78633E', spriteFamily:'transition-ground-grass', walkable:true, category:'terrain', zones:[1] },
    15: { id:15, name:'переход трава-лес', color:'#596136', spriteFamily:'transition-grass-forest', walkable:true, category:'terrain', zones:[1] },
    16: { id:16, name:'переход земля-камень', color:'#6A5148', spriteFamily:'transition-ground-rock', walkable:true, category:'terrain', zones:[1] },
    17: { id:17, name:'каменистая осыпь', color:'#625A50', spriteFamily:'scree', walkable:true, category:'terrain', zones:[1] },
    // Полноразмерные поверхности зданий. Рисуются тем же diamond tile renderer,
    // поэтому буквально заменяют землю под постройкой, а не накладываются маленькими ромбами.
    18: { id:18, name:'пол магазина', color:'#765D47', spriteFamily:'floor-store', walkable:true, category:'floor', zones:[1], floorStyle:'store' },
    19: { id:19, name:'пол аптеки', color:'#5B6D70', spriteFamily:'floor-tile', walkable:true, category:'floor', zones:[1], floorStyle:'tile' },
    20: { id:20, name:'промышленный пол', color:'#4A4745', spriteFamily:'floor-industrial', walkable:true, category:'floor', zones:[1], floorStyle:'industrial' },

    // Базовые поверхности биомов. Биом выбирает именно свой tile type,
    // а не общий тайл земли. В atlas каждому семейству соответствует
    // отдельная строка и отдельный вариант для каждого поворота камеры.
    21: { id:21, name:'лесная почва', color:'#566B35', spriteFamily:'forest', walkable:true, category:'terrain', zones:[1] },
    22: { id:22, name:'карьерная поверхность', color:'#6E6962', spriteFamily:'quarry', walkable:true, category:'terrain', zones:[1] },
    23: { id:23, name:'утоптанная земля лагеря', color:'#7C6044', spriteFamily:'camp', walkable:true, category:'terrain', zones:[1] },
    24: { id:24, name:'промышленная территория', color:'#514D49', spriteFamily:'industry', walkable:true, category:'terrain', zones:[1] },
    25: { id:25, name:'территория снабжения', color:'#8D6744', spriteFamily:'supply', walkable:true, category:'terrain', zones:[1] },
};

export const TILE_CATEGORIES = {
    terrain: {
        id: 'terrain',
        name: 'Ландшафт',
        description: 'Основные тайлы местности',
        types: [1, 2, 13, 14, 15, 16, 17, 21, 22, 23, 24, 25],
    },
    structure: {
        id: 'structure',
        name: 'Структуры',
        description: 'Здания и сооружения',
        types: [3, 4, 5, 6, 7, 8, 12],
    },
    resource: {
        id: 'resource',
        name: 'Ресурсы',
        description: 'Тайлы, которые можно собирать (дают предмет и меняют вид)',
        types: [9, 10, 11],
    },
};

// Реестр объектных типов вынесен в modules/world/objects/ObjectRegistry.js.

export const ZONES = {
    1: { id: 1, name: 'Лимб', description: 'Первый круг ада' },
    2: { id: 2, name: 'Похоть', description: 'Второй круг ада' },
    3: { id: 3, name: 'Чревоугодие', description: 'Третий круг ада' },
    4: { id: 4, name: 'Жадность', description: 'Четвёртый круг ада' },
    5: { id: 5, name: 'Гнев', description: 'Пятый круг ада' },
    6: { id: 6, name: 'Ересь', description: 'Шестой круг ада' },
    7: { id: 7, name: 'Насилие', description: 'Седьмой круг ада' },
    8: { id: 8, name: 'Обман', description: 'Восьмой круг ада' },
    9: { id: 9, name: 'Предательство', description: 'Девятый круг ада' },
};

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (оставлены для совместимости)
// ============================================================
export function getTile(id) {
    return TILE_TYPES[id] || null;
}

export function getTilesByCategory(category) {
    const result = [];
    for (const id in TILE_TYPES) {
        if (TILE_TYPES[id].category === category) {
            result.push(TILE_TYPES[id]);
        }
    }
    return result;
}

export function getTilesByZone(zoneId) {
    const result = [];
    for (const id in TILE_TYPES) {
        if (TILE_TYPES[id].zones && TILE_TYPES[id].zones.includes(zoneId)) {
            result.push(TILE_TYPES[id]);
        }
    }
    return result;
}

export function isWalkable(id) {
    const tile = TILE_TYPES[id];
    return tile ? tile.walkable : false;
}

export function getTileName(id) {
    const tile = TILE_TYPES[id];
    return tile ? tile.name : 'неизвестно';
}

export function getTileColor(id) {
    const tile = TILE_TYPES[id];
    return tile ? tile.color : '#FFFFFF';
}

export function getTileFromMask(mask) {
    return TILE_TYPES[mask] || null;
}

export function getConfigStats() {
    const total = Object.keys(TILE_TYPES).length;
    const categories = {};
    const zones = {};

    for (const id in TILE_TYPES) {
        const tile = TILE_TYPES[id];
        if (tile.category) {
            categories[tile.category] = (categories[tile.category] || 0) + 1;
        }
        if (tile.zones) {
            for (const zone of tile.zones) {
                zones[zone] = (zones[zone] || 0) + 1;
            }
        }
    }

    return {
        totalTiles: total,
        categories: categories,
        zones: zones,
    };
}

export default TILE_TYPES;