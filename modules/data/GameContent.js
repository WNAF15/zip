// modules/data/GameContent.js
// ============================================================
// ЕДИНЫЙ ФАЙЛ КОНТЕНТА ИГРЫ "КРУГ АДА"
// ------------------------------------------------------------
// Сюда вписаны ВСЕ элементы из "План_игры.txt" в виде структур
// данных, чтобы их можно было подключать к системам (бой, карта,
// диалоги, торговля) постепенно, не переписывая архитектуру.
//
// ВАЖНО (честно): это ДАННЫЕ и КАРКАС, а не полная реализация
// каждой системы (полноценный p2p-мультиплеер, генерация 9 карт,
// экономика чёрного рынка и т.д. — это отдельные большие задачи).
// То, что уже реально работает и подключено к геймплею прямо
// сейчас: классы (характеристики влияют на бой), чертёж 1 круга
// (новые тайлы + добыча ресурсов), система боя (см. modules/combat).
// Остальное — заготовленные структуры, которые легко развивать
// дальше, не ломая то, что уже написано.
// ============================================================

// ------------------------------------------------------------
// 2. КЛАССЫ ПЕРСОНАЖЕЙ (п.2 плана)
// S.P.E.C.I.A.L. + тотемное животное + фишка боя (п.6) + "Нюх" (п.2.4)
// ------------------------------------------------------------
export const SPECIAL_STATS = ['strength', 'perception', 'endurance', 'charisma', 'intelligence', 'agility', 'luck'];

export const CLASSES = {
    tempter: {
        id: 'tempter',
        name: 'Демон-искуситель',
        totem: 'змея / лиса',
        description: 'Слаб физически, силён разумом. Влияет на мысли, в облике духа перемещается быстро и летает.',
        special: { strength: 2, perception: 6, endurance: 3, charisma: 8, intelligence: 7, agility: 5, luck: 4 },
        sense: { id: 'spirit_sense', name: 'Нюх духа', desc: 'Чувствует разум и сны бесов поблизости, открывает тайные локации разума.' },
        // фишка боя: "внушение" — переопределяет цель действия врага (стратегия/контроль, см. design doc)
        combatQuirk: { id: 'suggestion', name: 'Внушение', kind: 'mind_control',
            desc: 'Раз в бой может перенаправить выбранное вражеское действие на другую клетку/цель.' },
    },
    merchant: {
        id: 'merchant',
        name: 'Демон-купец',
        totem: 'ворон / енот',
        description: 'Скупой хитрец с растягивающимися руками и хвостом, слаб телом, силён в воровстве и заговаривании зубов.',
        special: { strength: 3, perception: 6, endurance: 3, charisma: 7, intelligence: 6, agility: 5, luck: 6 },
        sense: { id: 'greed_sense', name: 'Нюх на золото', desc: 'Чувствует ценные предметы и тайники поблизости.' },
        // фишка боя: воровство/торг — быстрый тайминг-мини-игра (реакция)
        combatQuirk: { id: 'haggle', name: 'Обчистить', kind: 'timing_steal',
            desc: 'При успешной атаке может попытаться украсть предмет/ресурс через быстрый тайминг-жест.' },
    },
    carnivore: {
        id: 'carnivore',
        name: 'Демон-мясоед',
        totem: 'гиена / медведь',
        description: 'Дикий и безрассудный хищник, острые когти и зубы, ставка на грубую силу без оружия.',
        special: { strength: 8, perception: 5, endurance: 7, charisma: 2, intelligence: 2, agility: 6, luck: 3 },
        sense: { id: 'blood_sense', name: 'Нюх крови', desc: 'Чувствует раненых существ и свежую кровь на карте.' },
        // фишка боя: комбо быстрыми нажатиями (реакция), чем быстрее — тем больше урон
        combatQuirk: { id: 'frenzy_combo', name: 'Бешеный комбо', kind: 'quick_tap',
            desc: 'Атакуя, нужно быстро нажимать — серия попаданий без промаха даёт нарастающий бонус урона.' },
    },
    strategist: {
        id: 'strategist',
        name: 'Демон-стратег',
        totem: 'дельфин / мышь',
        description: 'Мудрец, читает действия противников, средняя физическая сила, сильное планирование.',
        special: { strength: 3, perception: 7, endurance: 4, charisma: 4, intelligence: 8, agility: 5, luck: 5 },
        sense: { id: 'insight_sense', name: 'Нюх на план', desc: 'Чувствует засады и просчитывает опасные маршруты.' },
        // фишка боя: перед выбором действия видит "намерение" врага (частичное) — планирование
        combatQuirk: { id: 'foresight', name: 'Предвидение', kind: 'preview_enemy_intent',
            desc: 'Перед своим ходом видит, какую клетку враг собирается атаковать в этом раунде.' },
    },
    spawner: {
        id: 'spawner',
        name: 'Демон-зарождатель',
        totem: 'ящерица / птица',
        description: 'Быстрая регенерация, отращивание/копирование конечностей, пугливый, полагается на укрытия.',
        special: { strength: 3, perception: 5, endurance: 6, charisma: 3, intelligence: 4, agility: 8, luck: 4 },
        sense: { id: 'hide_sense', name: 'Нюх укрытия', desc: 'Чувствует безопасные точки и пути отступления.' },
        // фишка боя: регенерация HP каждый ход + разовый клон-приманка
        combatQuirk: { id: 'regrowth', name: 'Отращивание', kind: 'regen_and_clone',
            desc: 'Каждый раунд немного восстанавливает HP; раз в бой может создать клона-приманку на клетке.' },
    },
};

// ------------------------------------------------------------
// 3. ЧЕРТЁЖ 1 КРУГА (п.3) — новые типы тайлов сверх базовых
// Базовые (земля/трава/стена/вода/завод/палатка/магазин/портал)
// уже есть в modules/map/config.js. Здесь — то, чего не хватало
// по чертежу: растительные ценности, каменоломня, добыча дерева, аптека.
// harvestable-тайлы: сбор превращает тайл в другой и даёт ресурс (п.3.1).
// ------------------------------------------------------------
export const CIRCLE_1_EXTRA_TILES = {
    9:  { id: 9,  name: 'растительные ценности', color: '#3F7D20', walkable: true, category: 'resource',
          zones: [1], harvestable: true, yields: { item: 'herb', amount: 1 }, becomesTileId: 2 },
    10: { id: 10, name: 'каменоломня', color: '#7A7A7A', walkable: true, category: 'resource',
          zones: [1], harvestable: true, yields: { item: 'stone', amount: 1 }, becomesTileId: 1 },
    11: { id: 11, name: 'добыча дерева', color: '#5B3A21', walkable: true, category: 'resource',
          zones: [1], harvestable: true, yields: { item: 'wood', amount: 1 }, becomesTileId: 2 },
    12: { id: 12, name: 'аптека', color: '#2E8B8B', walkable: true, category: 'structure', zones: [1] },
};

// Элементы чертежа круга 1, которые ещё не тайлы, а объекты/события мира
export const CIRCLE_1_BLUEPRINT = {
    zoneId: 1,
    name: 'Круг 1 — Рабский рудник',
    description: 'Мало осознанных бесов, в основном рабы на добыче ценностей. Отсюда поставки идут в высшие круги.',
    elements: [
        'растительные ценности', 'каменоломня', 'добыча дерева', 'палатки для отдыха',
        'единственный магазин', 'аптека', 'переход между кругами (поставки и полёт в рай)', 'заводы',
    ],
};

// ------------------------------------------------------------
// 4. СОБЫТИЯ (п.4)
// ------------------------------------------------------------
export const CHUNK_EVENT_RULES = [
    { id: 'blood_chunk', trigger: 'many_kills_in_chunk', effect: 'monsters_stronger_more_loot' },
    { id: 'urban_chunk', trigger: 'many_buildings_nearby', effect: 'fewer_monsters_less_loot' },
];

export const GLOBAL_EVENTS = {
    circle1_strike: {
        id: 'circle1_strike', zone: 1, name: 'Забастовка рабов',
        desc: 'Заводы временно останавливаются, возрастает риск встретить толпу монстров.',
        effects: ['factories_offline', 'mob_spawn_up'],
    },
    blood_rain: {
        id: 'blood_rain', zone: 1, name: 'Кровавый дождь',
        desc: 'После убийства главного демона — эффект ярости: усиление демонов и игрока, но потеря контроля.',
        effects: ['buff_all_damage', 'lose_control_risk'],
    },
};

// ------------------------------------------------------------
// 8. КОНТРАКТЫ (п.8)
// ------------------------------------------------------------
export const CONTRACT_TYPES = {
    eternal: { id: 'eternal', name: 'Вечный', breakable: false },
    conditional: { id: 'conditional', name: 'Условный', breakable: false, hasCondition: true },
};
// Модель контракта (шаблон для будущей системы БД):
// { id, partyA, partyB, soulPercentA, soulPercentB, type, condition, createdAt }

// ------------------------------------------------------------
// 9. СНАРЯЖЕНИЕ (п.9)
// ------------------------------------------------------------
export const EQUIPMENT_CLASSES = {
    light: { id: 'light', name: 'Лёгкое', minAgility: 0, maxStrengthReq: 3 },
    medium: { id: 'medium', name: 'Среднее', minAgility: 3, maxStrengthReq: 6 },
    heavy: { id: 'heavy', name: 'Тяжёлое', minAgility: 0, maxStrengthReq: 999, minStrengthReq: 6 },
};

// ------------------------------------------------------------
// 10. АВТОРИТЕТ (п.10)
// ------------------------------------------------------------
export const AUTHORITY_AXES = {
    government: { id: 'government', name: 'Правительство' },
    people: { id: 'people', name: 'Народ' },
    // "сторона монстра" — вычисляется, когда обе шкалы низкие/высокие одновременно
};

// ------------------------------------------------------------
// 11. ЧЁРНЫЙ РЫНОК (п.11)
// ------------------------------------------------------------
export const BLACK_MARKET = {
    unlockCondition: 'authority_or_choice_gated',
    riskPerPurchase: 'government_attention_up',
};

// ------------------------------------------------------------
// 12. ДАРЫ (п.12) — 9 даров по числу кругов, известны только первые 7
// ------------------------------------------------------------
export const GIFTS = Array.from({ length: 9 }, (_, i) => ({
    circle: i + 1,
    known: i < 7,
    name: i < 7 ? `Дар ${i + 1}-го круга` : 'Неизвестен',
}));

export default {
    SPECIAL_STATS, CLASSES, CIRCLE_1_EXTRA_TILES, CIRCLE_1_BLUEPRINT,
    CHUNK_EVENT_RULES, GLOBAL_EVENTS, CONTRACT_TYPES, EQUIPMENT_CLASSES,
    AUTHORITY_AXES, BLACK_MARKET, GIFTS,
};
