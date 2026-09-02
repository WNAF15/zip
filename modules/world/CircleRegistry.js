import { CircleOne } from './circles/CircleOne.js';

// Реестр содержит метаданные всех кругов, но тяжёлые карты подключаются только
// при создании/загрузке активного круга.
const CIRCLES = new Map([
    [1, CircleOne],
    [2, { id: 2, key: 'circle-2', name: 'Второй круг', available: false }],
    [3, { id: 3, key: 'circle-3', name: 'Третий круг', available: false }],
    [4, { id: 4, key: 'circle-4', name: 'Четвёртый круг', available: false }],
    [5, { id: 5, key: 'circle-5', name: 'Пятый круг', available: false }],
    [6, { id: 6, key: 'circle-6', name: 'Шестой круг', available: false }],
    [7, { id: 7, key: 'circle-7', name: 'Седьмой круг', available: false }],
    [8, { id: 8, key: 'circle-8', name: 'Восьмой круг', available: false }],
    [9, { id: 9, key: 'circle-9', name: 'Девятый круг', available: false }],
]);

export function getCircleDefinition(circleId = 1) {
    return CIRCLES.get(Number(circleId)) || CircleOne;
}

export function getAvailableCircles() {
    return [...CIRCLES.values()].filter(circle => circle.available !== false);
}
