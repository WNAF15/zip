// Дорожная сеть Первого круга.
// Это отдельный слой мира: дороги накладываются поверх биома и не меняют terrain.
// Координаты заданы вручную, поэтому география дорог постоянна и не требует seed.

const MAIN = 'main';
const SECONDARY = 'secondary';
const INDUSTRIAL = 'industrial';
const TRAIL = 'trail';

export const CIRCLE_ONE_ROADS = Object.freeze([
    // Главные магистрали: широкие и заметные даже на миникарте.
    { id: 'north-south-main', kind: MAIN, width: 3.4, points: [[0,-5200],[0,-3600],[0,-1800],[0,0],[0,1800],[-350,3500],[-500,5100]] },
    { id: 'west-main', kind: MAIN, width: 3.4, points: [[0,0],[-1500,100],[-3200,400],[-5700,750]] },
    { id: 'east-main', kind: MAIN, width: 3.4, points: [[0,0],[1600,150],[3300,900],[5300,2800],[6000,4200]] },

    // Ключевые гражданские маршруты.
    { id: 'shop-road', kind: SECONDARY, width: 2.3, points: [[0,0],[150,1300],[270,3650]] },
    { id: 'pharmacy-road', kind: SECONDARY, width: 2.3, points: [[-100,1200],[-450,2400],[-780,3500]] },

    // Промышленность и добыча.
    { id: 'north-east-factory-road', kind: INDUSTRIAL, width: 2.8, points: [[0,-1800],[1500,-2300],[2800,-2800],[4300,-3200]] },
    { id: 'south-west-factory-road', kind: INDUSTRIAL, width: 2.8, points: [[-1000,2200],[-2600,3100],[-4000,4000],[-5400,4700]] },
    { id: 'quarry-road', kind: INDUSTRIAL, width: 3.0, points: [[1800,700],[3300,1500],[4300,2200],[5300,2800]] },
    { id: 'quarry-loop', kind: SECONDARY, width: 2.1, closed: true, points: [[4300,2200],[5200,1900],[6000,2300],[6200,3200],[5600,3700],[4700,3300]] },

    // Центральный транспортный узел.
    { id: 'central-ring', kind: MAIN, width: 2.6, closed: true, points: [[-850,0],[-600,-500],[0,-750],[600,-500],[850,0],[600,500],[0,750],[-600,500]] },

    // Лагерные дороги и более узкие тропы. Они не должны выглядеть как шоссе.
    { id: 'west-camps', kind: SECONDARY, width: 2.1, points: [[-3200,400],[-4200,-300],[-5200,-1200],[-6000,-2500]] },
    { id: 'east-camps', kind: SECONDARY, width: 2.1, points: [[3300,900],[4600,400],[5900,-300],[6500,-1700]] },
    { id: 'north-camp-trail', kind: TRAIL, width: 1.35, points: [[0,-3600],[-850,-4100],[-1600,-4550],[-2450,-4300]] },
    { id: 'north-east-trail', kind: TRAIL, width: 1.35, points: [[1500,-2300],[2100,-1400],[3000,-900],[3900,-650]] },
    { id: 'south-camp-trail', kind: TRAIL, width: 1.35, points: [[-350,3500],[-1200,3900],[-2100,4300],[-3000,4100]] },
    { id: 'south-east-trail', kind: TRAIL, width: 1.35, points: [[3300,1500],[4100,900],[5000,650],[5750,900]] },
]);

function distancePointToSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq <= Number.EPSILON) return { distance: Math.hypot(px-ax, py-ay), dx: 1, dy: 0 };
    const t = Math.max(0, Math.min(1, ((px-ax)*dx + (py-ay)*dy) / lenSq));
    const nx = ax + dx*t;
    const ny = ay + dy*t;
    return { distance: Math.hypot(px-nx, py-ny), dx, dy };
}

function priority(kind) {
    return kind === MAIN ? 4 : kind === INDUSTRIAL ? 3 : kind === SECONDARY ? 2 : 1;
}

// Возвращает один объект road для тайла, но внутри него есть все направления
// пересечения. Это позволяет рендереру отличать прямую дорогу от развилки.
export function getCircleOneRoadAt(worldX, worldY) {
    const hits = [];
    for (const road of CIRCLE_ONE_ROADS) {
        const pts = road.points;
        const count = road.closed ? pts.length : pts.length - 1;
        for (let i=0; i<count; i++) {
            const a=pts[i], b=pts[(i+1)%pts.length];
            const hit=distancePointToSegment(worldX,worldY,a[0],a[1],b[0],b[1]);
            if (hit.distance <= road.width/2) {
                const len=Math.hypot(hit.dx,hit.dy)||1;
                hits.push({ id:road.id, kind:road.kind, width:road.width, distance:hit.distance,
                    dx:hit.dx/len, dy:hit.dy/len, segment:i });
            }
        }
    }
    if (!hits.length) return null;
    hits.sort((a,b) => (priority(b.kind)-priority(a.kind)) || (b.width-a.width) || (a.distance-b.distance));
    const best=hits[0];
    const dirs=[];
    for (const hit of hits) {
        const variants=[[hit.dx,hit.dy],[-hit.dx,-hit.dy]];
        for (const [dx,dy] of variants) {
            if (!dirs.some(d => Math.abs(d.dx*dx+d.dy*dy) > 0.985)) dirs.push({dx,dy});
        }
    }
    best.connections=dirs;
    best.junction = dirs.length >= 3;
    best.junctionType = dirs.length >= 4 ? 'cross' : dirs.length === 3 ? 'tee' : dirs.length === 2 ? 'straight' : 'end';
    return best;
}

export function getCircleOneRoads() { return CIRCLE_ONE_ROADS; }
export default CIRCLE_ONE_ROADS;
