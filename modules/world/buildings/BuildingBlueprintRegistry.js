// Универсальные blueprint'ы статических зданий.
// Координаты задаются относительно центра комплекса, а генератор сам
// раскладывает элементы по чанкам. Это позволяет использовать один формат
// для заводов, магазинов, аптек и будущих построек игроков.

const room = (id, x, y, w, h, options = {}) => ({ id, x, y, w, h, ...options });

export function createFactoryBlueprint(landmark) {
    return {
        id: landmark.id,
        kind: 'factory',
        title: landmark.title,
        x: landmark.x,
        y: landmark.y,
        protection: { halfX: 48, halfY: 41, buildBuffer: 24 },
        rooms: [
            room('main-hall', -38, -24, 32, 22, { windows:true, roofStyle:'saw', doorOffset:16, interior:[
                { type:'machinery', x:5, y:6 }, { type:'machinery', x:11, y:6 }, { type:'machinery', x:17, y:6 },
                { type:'pipe', x:24, y:8 }, { type:'crate', x:27, y:16 }
            ]}),
            room('warehouse', 5, -28, 28, 18, { roofStyle:'flat', doorOffset:14, interior:[
                { type:'crate', x:4, y:4 }, { type:'crate', x:7, y:4 }, { type:'crate', x:10, y:4 },
                { type:'crate', x:4, y:9 }, { type:'crate', x:7, y:9 }, { type:'crate', x:10, y:9 }
            ]}),
            room('workshop', -10, 10, 22, 16, { windows:true, roofStyle:'saw', doorOffset:11, interior:[
                { type:'machinery', x:5, y:5 }, { type:'crate', x:11, y:6 }, { type:'pipe', x:16, y:7 }
            ]}),
            room('office', 20, 9, 15, 12, { windows:true, roofStyle:'flat', doorOffset:7, interior:[
                { type:'crate', x:4, y:4, blocks:false }, { type:'crate', x:8, y:4, blocks:false }
            ]}),
        ],
        yard: { halfX:48, halfY:41, gateSide:'south' },
    };
}

export function createShopBlueprint(landmark) {
    return {
        id: landmark.id, kind:'shop', title:landmark.title, x:landmark.x, y:landmark.y,
        protection:{ halfX:18, halfY:16, buildBuffer:10 },
        rooms:[
            room('sales-floor', -12, -9, 24, 18, { windows:true, roofStyle:'flat', doorOffset:12, interior:[
                { type:'crate', x:4, y:4, blocks:false }, { type:'crate', x:8, y:4, blocks:false },
                { type:'crate', x:15, y:4, blocks:false }, { type:'crate', x:19, y:4, blocks:false },
                { type:'crate', x:5, y:11, blocks:false }, { type:'crate', x:17, y:11, blocks:false }
            ]}),
            room('storage', -17, -7, 5, 14, { roofStyle:'flat', doorOffset:2, interior:[
                { type:'crate', x:1, y:3 }, { type:'crate', x:1, y:7 }, { type:'crate', x:1, y:10 }
            ]}),
        ],
    };
}

export function createPharmacyBlueprint(landmark) {
    return {
        id: landmark.id, kind:'pharmacy', title:landmark.title, x:landmark.x, y:landmark.y,
        protection:{ halfX:16, halfY:16, buildBuffer:10 },
        rooms:[
            room('pharmacy-floor', -10, -10, 20, 20, { windows:true, roofStyle:'flat', doorOffset:10, interior:[
                { type:'crate', x:3, y:4, blocks:false }, { type:'crate', x:7, y:4, blocks:false },
                { type:'crate', x:13, y:4, blocks:false }, { type:'crate', x:5, y:11, blocks:false },
                { type:'crate', x:12, y:12, blocks:false }
            ]}),
            room('medicine-storage', 10, -7, 5, 14, { roofStyle:'flat', doorOffset:2, interior:[
                { type:'crate', x:1, y:3 }, { type:'crate', x:1, y:7 }, { type:'crate', x:1, y:10 }
            ]}),
        ],
    };
}

export function getCircleOneBuildingBlueprints(landmarks) {
    return landmarks.filter(l => ['factory','shop','pharmacy'].includes(l.type)).map(l => {
        if (l.type === 'factory') return createFactoryBlueprint(l);
        if (l.type === 'shop') return createShopBlueprint(l);
        return createPharmacyBlueprint(l);
    });
}
