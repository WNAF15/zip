// Этап 7: окружение края Первого круга.
// Базовая геометрия карты остаётся статичной, а этот модуль добавляет
// обрывы, трещины и обломки только в пограничных чанках.
import { worldChunkToBlueprint, getOuterBoundaryDistance } from '../circles/CircleOneBlueprint.js';
import { isGenerationBlocked } from '../territories/TerritoryReservationSystem.js';

const CHUNK_SIZE = 15;
function hash32(a,b,c=0){let h=Math.imul(a|0,374761393)^Math.imul(b|0,668265263)^Math.imul(c|0,2147483647);h=Math.imul(h^(h>>>13),1274126177);return(h^(h>>>16))>>>0;}
function rand(cx,cy,i,s=0){return hash32(cx,cy,i*37+s)/4294967295;}
function push(out,type,x,y,extra={}){out.push({id:`${type}:${x.toFixed(2)}:${y.toFixed(2)}`,type,x,y,...extra});}

export function getEdgeEnvironmentForChunk(chunkX, chunkY, { getRoadAt } = {}) {
    const p = worldChunkToBlueprint(chunkX, chunkY);
    const distance = getOuterBoundaryDistance(p.x + 0.5, p.y + 0.5);
    // 0..1000 в blueprint-чанках. Эффект начинается примерно за 7 чанков до края.
    if (distance > 7.5) return [];

    const out=[];
    const baseX=chunkX*CHUNK_SIZE, baseY=chunkY*CHUNK_SIZE;
    const centerX=baseX+7.5, centerY=baseY+7.5;
    if (isGenerationBlocked(centerX,centerY)) return out;
    const edgeStrength=Math.max(0,1-distance/7.5);
    const count=2+Math.floor(edgeStrength*7);
    for(let i=0;i<count;i++){
        const x=baseX+0.8+rand(chunkX,chunkY,i,1701)*13.4;
        const y=baseY+0.8+rand(chunkX,chunkY,i,1717)*13.4;
        if (isGenerationBlocked(x,y) || (getRoadAt && getRoadAt(Math.round(x),Math.round(y)))) continue;
        const roll=rand(chunkX,chunkY,i,1733);
        const type=roll<0.22?'abyss_rift':roll<0.52?'edge_cliff':roll<0.78?'edge_debris':'edge_crack';
        push(out,type,x,y,{edgeStrength});
    }
    return out;
}
