// Единая карта приоритетов и резервирования мира.
// Базовая карта статична, а генераторы обязаны спрашивать этот слой,
// прежде чем ставить лагерь, природу, декор или будущую постройку игрока.
import { CIRCLE_ONE_LANDMARKS } from '../circles/CircleOneLandmarks.js';
import { CIRCLE_ONE_TERRITORIES } from './CircleOneTerritories.js';

const FACTORY_HALF = { x: 48, y: 41 };
const FIXED = [
  ...CIRCLE_ONE_LANDMARKS.map(v => {
    if (v.type === 'factory') return { id:v.id, kind:'factory-complex', x:v.x, y:v.y, halfX:FACTORY_HALF.x, halfY:FACTORY_HALF.y, priority:100, buildBuffer:24, blocksGeneration:true };
    if (v.type === 'shop') return { id:v.id, kind:'shop', x:v.x, y:v.y, halfX:18, halfY:16, priority:95, buildBuffer:10, blocksGeneration:true };
    if (v.type === 'pharmacy') return { id:v.id, kind:'pharmacy', x:v.x, y:v.y, halfX:16, halfY:16, priority:95, buildBuffer:10, blocksGeneration:true };
    if (v.type === 'gate') return { id:v.id, kind:'gate', x:v.x, y:v.y, halfX:28, halfY:28, priority:90, buildBuffer:16, blocksGeneration:true };
    if (v.type === 'hub') return { id:v.id, kind:'hub', x:v.x, y:v.y, halfX:35, halfY:35, priority:90, buildBuffer:18, blocksGeneration:true };
    return null;
  }).filter(Boolean),
  ...CIRCLE_ONE_TERRITORIES.map(t => ({ id:t.id, kind:t.kind, x:t.x, y:t.y, radius:t.radius, priority:t.kind==='industrial'?92:88, buildBuffer:t.kind==='industrial'?30:20, blocksGeneration:true })),
];

export const RESERVATION_PRIORITY = Object.freeze({ unique:100, building:90, road:70, settlement:60, nature:40, decor:20 });
export const WORLD_RESERVATIONS = Object.freeze(FIXED);

function distanceToRect(x,y,r){
  const dx=Math.max(Math.abs(x-r.x)-r.halfX,0), dy=Math.max(Math.abs(y-r.y)-r.halfY,0);
  return Math.hypot(dx,dy);
}
function contains(r,x,y,buffer=0){
  if (r.radius != null) return Math.hypot(x-r.x,y-r.y) <= r.radius + buffer;
  return distanceToRect(x,y,r) <= buffer;
}
export function getReservationAt(x,y,{buffer=0}={}){
  let winner=null;
  for(const r of FIXED){
    if(!contains(r,x,y,buffer)) continue;
    if(!winner || r.priority>winner.priority) winner=r;
  }
  return winner;
}
export function isGenerationBlocked(x,y){ return Boolean(getReservationAt(x,y)); }
export function canPlaceGenerated(type,x,y){
  const r=getReservationAt(x,y);
  if(!r) return true;
  // Только структурные генераторы могут создавать части собственной территории.
  if(type==='structure' || type==='territory') return true;
  return false;
}
export function canPlayerBuildAt(x,y){
  for(const r of FIXED){
    if(contains(r,x,y,r.buildBuffer||0)) return { ok:false, reason:`protected:${r.kind}`, reservation:r };
  }
  return { ok:true, reason:null, reservation:null };
}
export function getChunkReservations(cx,cy,chunkSize=15){
  const minX=cx*chunkSize,minY=cy*chunkSize,maxX=minX+chunkSize,maxY=minY+chunkSize;
  return FIXED.filter(r=>{
    if(r.radius!=null){const nx=Math.max(minX,Math.min(r.x,maxX)),ny=Math.max(minY,Math.min(r.y,maxY));return (nx-r.x)**2+(ny-r.y)**2<=r.radius**2;}
    return !(r.x+r.halfX<minX||r.x-r.halfX>maxX||r.y+r.halfY<minY||r.y-r.halfY>maxY);
  });
}
