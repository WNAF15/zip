// Универсальный генератор построек. Никакой полной карты в памяти:
// элементы blueprint'а материализуются только для запрошенного чанка.
const CHUNK_SIZE = 15;
const inChunk = (x,y,cx,cy) => Math.floor(x/CHUNK_SIZE)===cx && Math.floor(y/CHUNK_SIZE)===cy;

function push(out, structure, type, x, y, cx, cy, extra={}) {
    if (!inChunk(x,y,cx,cy)) return;
    out.push({ id:`${structure.id}:${type}:${x}:${y}`, type, x, y, structureId:structure.id,
        structureKind:structure.kind, ...extra });
}

function addRoom(out,s,r,cx,cy) {
    const x0=s.x+r.x, y0=s.y+r.y;
    const doorX=x0+(r.doorOffset ?? Math.floor(r.w/2));
    const doorY=y0+(r.doorOffsetY ?? Math.floor(r.h/2));
    // Пол — полноценная поверхность тайла. Стены живут НА ГРАНЯХ тайлов.
    // north/south: сегмент вдоль оси X; west/east: сегмент вдоль оси Y.
    for(let x=x0;x<x0+r.w;x++) {
        const windowNorth=r.windows && x>x0+1 && x<x0+r.w-2 && ((x-x0)%4===0);
        const northType=x===doorX ? 'door' : (windowNorth ? 'window' : 'building_wall');
        push(out,s,northType,x,y0-.5,cx,cy,{roomId:r.id,orientation:'north',edge:true,edgeAxis:'x',wallLength:1,blocks:northType==='building_wall'||northType==='window',collisionThickness:.075});
        const windowSouth=r.windows && x>x0+1 && x<x0+r.w-2 && ((x-x0)%4===0);
        const southType=windowSouth?'window':'building_wall';
        push(out,s,southType,x,y0+r.h-.5,cx,cy,{roomId:r.id,orientation:'south',edge:true,edgeAxis:'x',wallLength:1,blocks:true,collisionThickness:.075});
    }
    for(let y=y0;y<y0+r.h;y++) {
        const windowWest=r.windows && y>y0+1 && y<y0+r.h-2 && ((y-y0)%5===0);
        const westType=windowWest?'window':'building_wall';
        push(out,s,westType,x0-.5,y,cx,cy,{roomId:r.id,orientation:'west',edge:true,edgeAxis:'y',wallLength:1,blocks:true,collisionThickness:.075});
        const eastType='building_wall';
        push(out,s,eastType,x0+r.w-.5,y,cx,cy,{roomId:r.id,orientation:'east',edge:true,edgeAxis:'y',wallLength:1,blocks:true,collisionThickness:.075});
    }
    for(const it of r.interior||[]) push(out,s,it.type,x0+it.x,y0+it.y,cx,cy,{
        roomId:r.id, interior:true, blocks:it.blocks??true, collisionRadius:it.collisionRadius??.42
    });
    const rx=x0+(r.w-1)/2, ry=y0+(r.h-1)/2;
    push(out,s,'building_roof',rx,ry,cx,cy,{w:r.w,h:r.h,roomId:r.id,roofStyle:r.roofStyle||'flat',blocks:false});
}
function addFactoryYard(out,s,cx,cy) {
    if (!s.yard) return;
    const L=s.x-s.yard.halfX,R=s.x+s.yard.halfX,T=s.y-s.yard.halfY,B=s.y+s.yard.halfY;
    for(let x=L;x<=R;x+=2){ if(Math.abs(x-s.x)>7){push(out,s,'fence',x,T,cx,cy,{blocks:true,collisionRadius:.30});push(out,s,'fence',x,B,cx,cy,{blocks:true,collisionRadius:.30});}}
    for(let y=T;y<=B;y+=2){push(out,s,'fence',L,y,cx,cy,{blocks:true,collisionRadius:.30});push(out,s,'fence',R,y,cx,cy,{blocks:true,collisionRadius:.30});}
    push(out,s,'factory_gate',s.x,B,cx,cy,{blocks:false});
    for(let i=0;i<12;i++){const type=i%4===0?'machinery':i%4===1?'industrial_pipe':'crate';push(out,s,type,s.x-32+(i%6)*11,s.y+31+Math.floor(i/6)*6,cx,cy,{blocks:true,collisionRadius:type==='crate'?.28:.42,yard:true});}
}

export function getBuildingsForChunk(cx,cy,blueprints) {
    const out=[];
    for(const structure of blueprints){
        for(const room of structure.rooms) addRoom(out,structure,room,cx,cy);
        addFactoryYard(out,structure,cx,cy);
        // Маркер один раз, в чанке центра.
        push(out,structure,'structure_marker',structure.x,structure.y-2,cx,cy,{title:structure.title,showLabel:true,blocks:false});
    }
    return out;
}


// Возвращает полноценную поверхность для конкретного игрового тайла.
// Координаты тайла — его центр в мировой сетке, поэтому x/y здесь целые.
export function getBuildingFloorAt(x, y, blueprints) {
    for (const structure of blueprints) {
        for (const room of structure.rooms) {
            const x0 = structure.x + room.x;
            const y0 = structure.y + room.y;
            if (x >= x0 && x < x0 + room.w && y >= y0 && y < y0 + room.h) {
                const floorStyle = room.floorStyle || (
                    structure.kind === 'shop' ? 'store' :
                    structure.kind === 'pharmacy' ? 'tile' :
                    'industrial'
                );
                return { floorStyle, structureId: structure.id, structureKind: structure.kind, roomId: room.id };
            }
        }
    }
    return null;
}

export function isInsideBlueprintBuilding(x,y,blueprints){
    return blueprints.some(s => s.rooms.some(r => {
        const rx=s.x+r.x, ry=s.y+r.y;
        return x>=rx && x<=rx+r.w && y>=ry && y<=ry+r.h;
    }));
}

export function getBlueprintAt(x,y,blueprints){
    return blueprints.find(s => s.rooms.some(r => x>=s.x+r.x && x<=s.x+r.x+r.w && y>=s.y+r.y && y<=s.y+r.y+r.h)) || null;
}
