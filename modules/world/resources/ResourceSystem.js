// Этап 8: сбор ресурсов и изменяемый объектный слой.
// Сохраняются только изменения (собранные объекты), а не вся статическая карта.
const RESOURCE_TYPES = Object.freeze({
    herb_patch: { item:'herb', amount:1 },
    ore: { item:'stone', amount:1 },
    ore_rich: { item:'ore', amount:2 },
    tree: { item:'wood', amount:1 },
    tree_tall: { item:'wood', amount:2 },
    tree_dark: { item:'wood', amount:1 },
    fallen_tree: { item:'wood', amount:2 },
    dead_tree: { item:'wood', amount:1 },
    rock: { item:'stone', amount:1 },
    rock_sharp: { item:'stone', amount:1 },
    boulder: { item:'stone', amount:3 },
    cliff_rock: { item:'stone', amount:2 },
});

export function getResourceYield(object) {
    if (!object) return null;
    if (object.resource) return { item: object.resource, amount: object.amount || 1 };
    return RESOURCE_TYPES[object.type] || null;
}

export function findNearestResource(map, x, y, radius=1.65) {
    if (!map?.getObjectsAt) return null;
    let best=null, bestD=Infinity;
    for (const object of map.getObjectsAt(x,y,radius)) {
        if (!getResourceYield(object)) continue;
        const d=Math.hypot(object.x-x, object.y-y);
        if (d<=radius && d<bestD) { best=object; bestD=d; }
    }
    return best;
}
