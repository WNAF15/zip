// Единый реестр объектных слоёв мира.
// Terrain отвечает только за поверхность, а объекты — за всё, что стоит НА ней.

export const WORLD_OBJECT_TYPES = Object.freeze({
    edge_cliff: { id:'edge_cliff', blocks:true, collisionRadius:.52, layer:'edge', label:false },
    edge_debris:{ id:'edge_debris', blocks:true, collisionRadius:.28, layer:'edge', label:false },
    edge_crack: { id:'edge_crack', blocks:false, collisionRadius:0, layer:'edge', label:false },
    abyss_rift: { id:'abyss_rift', blocks:true, collisionRadius:.48, layer:'edge', label:false },
    cliff_rock: { id:'cliff_rock', blocks:true, collisionRadius:.42, layer:'nature', label:false },
    quarry_marker: { id:'quarry_marker', blocks:false, collisionRadius:0, layer:'landmark', label:false },
    industrial_pipe: { id:'industrial_pipe', blocks:true, collisionRadius:.24, layer:'industry', label:false },
    industrial_lamp: { id:'industrial_lamp', blocks:false, collisionRadius:0, layer:'industry', label:false },
    territory_marker: { id:'territory_marker', blocks:false, collisionRadius:0, layer:'landmark', label:true },
    tree:       { id: 'tree',       blocks: true,  collisionRadius: 0.34, layer: 'nature',      label: false },
    tree_tall:  { id: 'tree_tall',  blocks: true,  collisionRadius: 0.38, layer: 'nature',      label: false },
    tree_dark:  { id: 'tree_dark',  blocks: true,  collisionRadius: 0.36, layer: 'nature',      label: false },
    dead_tree:  { id: 'dead_tree',  blocks: true,  collisionRadius: 0.30, layer: 'nature',      label: false },
    fallen_tree:{ id: 'fallen_tree',blocks: true,  collisionRadius: 0.55, layer: 'nature',      label: false },
    bush_dense: { id: 'bush_dense', blocks: true,  collisionRadius: 0.34, layer: 'nature',      label: false },
    thorn_bush: { id: 'thorn_bush', blocks: true,  collisionRadius: 0.30, layer: 'nature',      label: false },
    grass_clump:{ id: 'grass_clump',blocks: false, collisionRadius: 0.00, layer: 'nature',      label: false },
    herb_patch: { id: 'herb_patch', blocks: false, collisionRadius: 0.00, layer: 'resource',    label: false },
    rock_sharp: { id: 'rock_sharp', blocks: true,  collisionRadius: 0.36, layer: 'nature',      label: false },
    ore_rich:   { id: 'ore_rich',   blocks: false, collisionRadius: 0.00, layer: 'resource',    label: false },
    bush:       { id: 'bush',       blocks: false, collisionRadius: 0.00, layer: 'nature',      label: false },
    rock:       { id: 'rock',       blocks: true,  collisionRadius: 0.30, layer: 'nature',      label: false },
    boulder:    { id: 'boulder',    blocks: true,  collisionRadius: 0.46, layer: 'nature',      label: false },
    ore:        { id: 'ore',        blocks: false, collisionRadius: 0.00, layer: 'resource',    label: false },
    tent:       { id: 'tent',       blocks: true,  collisionRadius: 0.82, layer: 'settlement',  label: false, tileWidth:2, tileHeight:2 },
    campfire:   { id: 'campfire',   blocks: false, collisionRadius: 0.00, layer: 'settlement',  label: false },
    camp_path:   { id: 'camp_path',   blocks: false, collisionRadius: 0.00, layer: 'settlement',  label: false },
    camp_marker: { id: 'camp_marker', blocks: false, collisionRadius: 0.00, layer: 'settlement',  label: false },
    crate:      { id: 'crate',      blocks: true,  collisionRadius: 0.28, layer: 'industry',    label: false },
    machinery:  { id: 'machinery',  blocks: true,  collisionRadius: 0.46, layer: 'industry',    label: false },
    pipe:       { id: 'pipe',       blocks: true,  collisionRadius: 0.24, layer: 'industry',    label: false },
    camp:       { id: 'camp',       blocks: false, collisionRadius: 0.00, layer: 'landmark',    label: true  },
    shop:       { id: 'shop',       blocks: true,  collisionRadius: 0.72, layer: 'landmark',    label: true  },
    pharmacy:   { id: 'pharmacy',   blocks: true,  collisionRadius: 0.72, layer: 'landmark',    label: true  },
    quarry:     { id: 'quarry',     blocks: false, collisionRadius: 0.00, layer: 'landmark',    label: true  },
    building_floor:{ id: 'building_floor', blocks: false, collisionRadius: 0, layer: 'structure', label: false, tileWidth:1, tileHeight:1 },
    fence: { id: 'fence', blocks: true, collisionRadius: 0.32, layer: 'structure', label: false },
    factory_gate:{ id: 'factory_gate', blocks: false, collisionRadius: 0, layer: 'structure', label: false },
    building_wall:{ id: 'building_wall', blocks: true, collisionRadius: 0.08, layer: 'structure', label: false },
    window:{ id: 'window', blocks: true, collisionRadius: 0.08, layer: 'structure', label: false },
    door:{ id: 'door', blocks: false, collisionRadius: 0, layer: 'structure', label: false },
    building_roof:{ id: 'building_roof', blocks: false, collisionRadius: 0, layer: 'roof', label: false },
    factory_marker:{ id: 'factory_marker', blocks: false, collisionRadius: 0, layer: 'landmark', label: true },
    structure_marker:{ id: 'structure_marker', blocks: false, collisionRadius: 0, layer: 'landmark', label: true },
    factory:    { id: 'factory',    blocks: true,  collisionRadius: 1.05, layer: 'landmark',    label: true  },
    gate:       { id: 'gate',       blocks: false, collisionRadius: 0.00, layer: 'landmark',    label: true  },
    hub:        { id: 'hub',        blocks: false, collisionRadius: 0.00, layer: 'landmark',    label: true  },
});

export function getWorldObjectType(type) {
    return WORLD_OBJECT_TYPES[type] || null;
}

export function normalizeWorldObject(object) {
    const type = getWorldObjectType(object.type) || {};
    return {
        ...type,
        ...object,
        blocks: object.blocks ?? type.blocks ?? false,
        collisionRadius: object.collisionRadius ?? type.collisionRadius ?? 0,
        layer: object.layer ?? type.layer ?? 'nature',
        showLabel: object.showLabel ?? type.label ?? false,
    };
}
