// Tile World Architecture: deterministic occupancy helpers.
export function tileKey(x,y){ return `${Math.floor(x)},${Math.floor(y)}`; }
export function footprintFree(occupied,x,y,w=1,h=1){ for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++)if(occupied.has(tileKey(x+xx,y+yy)))return false; return true; }
export function occupy(occupied,x,y,w=1,h=1){ for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++)occupied.add(tileKey(x+xx,y+yy)); }
export function occupyObject(occupied,o){ const w=o.tileWidth||1,h=o.tileHeight||1; occupy(occupied,Math.floor(o.x),Math.floor(o.y),w,h); }
