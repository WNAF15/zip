// Структурированный генератор лагерей. Координаты всегда детерминированы.
function hash(a,b,c=0){let h=Math.imul(a|0,374761393)^Math.imul(b|0,668265263)^Math.imul(c|0,2147483647);h=Math.imul(h^(h>>>13),1274126177);return (h^(h>>>16))>>>0;}
function push(a,type,x,y,extra={}){a.push({id:`settlement:${type}:${x.toFixed(2)}:${y.toFixed(2)}`,type,x,y,...extra});}
function canPlace(used,x,y,w=1,h=1){for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++)if(used.has(`${Math.floor(x)+xx},${Math.floor(y)+yy}`))return false;return true;}
function mark(used,x,y,w=1,h=1){for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++)used.add(`${Math.floor(x)+xx},${Math.floor(y)+yy}`);}
function linePath(a,x1,y1,x2,y2,step=.72,extra={}){const n=Math.max(1,Math.ceil(Math.hypot(x2-x1,y2-y1)/step));for(let i=0;i<=n;i++){const t=i/n;push(a,'camp_path',x1+(x2-x1)*t,y1+(y2-y1)*t,extra);}}
export function generateCamp(chunkX,chunkY,options={}){
 const size=options.size||15, objects=[], district=options.district||'tent', level=hash(chunkX,chunkY,1200)%3;
 const divisor=district==='poor' ? (level===2?10:level===1?8:6) : (level===2?5:level===1?4:3);
 const active=hash(chunkX,chunkY,1201)%divisor===0;
 if(!active)return objects;
 const bx=chunkX*size, by=chunkY*size, cx=bx+7.5, cy=by+7.5;
 const density=district==='poor' ? .58 : 1;
 const radius=(level===0?3.2:level===1?5.0:6.2), tents=Math.max(2,Math.round((level===0?5:level===1?9:16)*density));
 const campId=`camp:${chunkX}:${chunkY}`, used=new Set();
 push(objects,'campfire',cx,cy,{settlement:true,campId,size:level,zone:'center'});
 // Главная тропа через лагерь и короткие ответвления к жилым зонам.
 linePath(objects,bx+.6,cy,bx+size-.6,cy,.65,{settlement:true,campId,zone:'road'});
 for(let i=0;i<tents;i++){
   const a=(Math.PI*2*i/tents)+(hash(chunkX,chunkY,i)%100)/500;
   const r=radius*(.58+((hash(chunkX,chunkY,i+30)%35)/100));
   const x=Math.max(bx+1,Math.min(bx+size-3,Math.floor(cx+Math.cos(a)*r))), y=Math.max(by+1,Math.min(by+size-3,Math.floor(cy+Math.sin(a)*r)));
   if(!canPlace(used,x,y,2,2)) continue; mark(used,x,y,2,2);
   push(objects,'tent',x+1,y+1,{settlement:true,campId,size:level,zone:'residential',tileWidth:2,tileHeight:2,footprint:{x,y,w:2,h:2}});
   if(i%2===0) linePath(objects,cx+Math.cos(a)*1.1,cy+Math.sin(a)*1.1,x,y,.7,{settlement:true,campId,zone:'path'});
 }
 // Складская зона расположена отдельно, чтобы лагерь читался как поселение.
 if(level>=1){
   const sx=cx+radius*.62, sy=cy-radius*.48;
   push(objects,'crate',sx,sy,{settlement:true,campId,zone:'storage'});
   push(objects,'crate',sx+.65,sy+.45,{settlement:true,campId,zone:'storage'});
   linePath(objects,cx,cy,sx,sy,.65,{settlement:true,campId,zone:'storage-path'});
 }
 if(level===2){
   // Большой лагерь получает второй жилой кластер и входной ориентир.
   const ex=cx-radius*.78, ey=cy+radius*.62;
   const tx=Math.floor(ex), ty=Math.floor(ey); if(canPlace(used,tx,ty,2,2)){mark(used,tx,ty,2,2);push(objects,'tent',tx+1,ty+1,{settlement:true,campId,size:level,zone:'residential',tileWidth:2,tileHeight:2,footprint:{x:tx,y:ty,w:2,h:2}});}
   push(objects,'bush',cx-radius*.95,cy,{settlement:true,campId,zone:'edge'});
   push(objects,'bush',cx+radius*.95,cy,{settlement:true,campId,zone:'edge'});
   push(objects,'camp_marker',bx+1.1,cy,{settlement:true,campId,size:level,zone:'entrance'});
 }
 return objects;
}
