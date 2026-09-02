// Генератор уникальных территорий. Никакого глобального массива объектов.
import { getTerritoriesForChunk } from './CircleOneTerritories.js';
import { isInsideStructureBuilding } from '../structures/StructureGenerator.js';
const SIZE=15;
const hash=(a,b,c=0)=>{let h=Math.imul(a|0,374761393)^Math.imul(b|0,668265263)^Math.imul(c|0,2147483647);h=Math.imul(h^(h>>>13),1274126177);return(h^(h>>>16))>>>0;};
const push=(out,t,type,x,y,extra={})=>out.push({id:`${t.id}:${type}:${x.toFixed(1)}:${y.toFixed(1)}`,type,x,y,territoryId:t.id,...extra});
export function getTerritoryObjectsForChunk(cx,cy) {
 const out=[], minX=cx*SIZE,minY=cy*SIZE;
 for(const t of getTerritoriesForChunk(cx,cy,SIZE)) {
   for(let ly=1;ly<SIZE;ly+=3) for(let lx=1;lx<SIZE;lx+=3) {
     const x=minX+lx+.5,y=minY+ly+.5,d=Math.hypot(x-t.x,y-t.y);
     if(d>t.radius) continue;
     if(isInsideStructureBuilding(x,y)) continue;
     const h=hash(cx*17+lx,cy*19+ly,t.kind==='quarry'?51:61)%100;
     if(t.kind==='quarry') {
       if(d>t.radius*.72 && h<45) push(out,t,'cliff_rock',x,y,{blocks:true,collisionRadius:.42});
       else if(h<22) push(out,t,'ore',x,y,{blocks:false});
       else if(h<34) push(out,t,'boulder',x,y,{blocks:true,collisionRadius:.46});
       else if(h<42) push(out,t,'quarry_marker',x,y,{blocks:false});
     } else {
       if(h<16) push(out,t,'industrial_pipe',x,y,{blocks:true,collisionRadius:.24});
       else if(h<30) push(out,t,'machinery',x,y,{blocks:true,collisionRadius:.46});
       else if(h<44) push(out,t,'crate',x,y,{blocks:true,collisionRadius:.28});
       else if(h<50) push(out,t,'industrial_lamp',x,y,{blocks:false});
     }
   }
   if(Math.floor(t.x/SIZE)===cx && Math.floor(t.y/SIZE)===cy) push(out,t,'territory_marker',t.x,t.y,{title:t.title,showLabel:true,blocks:false});
 }
 return out;
}
