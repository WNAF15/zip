// Крупные постоянные ориентиры первого круга.
// Координаты в тайлах мира (центр мира = 0,0).
// Список конечный и не зависит от случайной генерации.

export const CIRCLE_ONE_LANDMARKS = [
    { id: 'central-hub', type: 'hub', title: 'Центральный круг', x: 0, y: 0, blocks: false },

    { id: 'supply-gate', type: 'gate', title: 'Врата поставок', x: 0, y: -5200, blocks: false },
    { id: 'main-shop', type: 'shop', title: 'Единственный магазин', x: 270, y: 3650, blocks: false },
    { id: 'main-pharmacy', type: 'pharmacy', title: 'Аптека', x: -780, y: 3500, blocks: false },

    { id: 'west-factory', type: 'factory', title: 'Западный заводской комплекс', x: -5700, y: 750, blocks: true },
    { id: 'north-east-factory', type: 'factory', title: 'Северо-восточный заводской комплекс', x: 4300, y: -3200, blocks: true },
    { id: 'south-west-factory', type: 'factory', title: 'Юго-западный заводской комплекс', x: -5400, y: 4700, blocks: true },
    { id: 'south-east-factory', type: 'factory', title: 'Юго-восточный заводской комплекс', x: 6000, y: 4200, blocks: true },

    { id: 'great-quarry', type: 'quarry', title: 'Большая каменоломня', x: 5300, y: 2800, blocks: false },
];

export function getLandmarksInBounds(minX, minY, maxX, maxY) {
    return CIRCLE_ONE_LANDMARKS.filter((object) =>
        object.x >= minX && object.x <= maxX &&
        object.y >= minY && object.y <= maxY
    );
}
