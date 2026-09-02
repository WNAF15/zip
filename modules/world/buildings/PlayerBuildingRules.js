// Общие правила для будущего строительства игроками.
// Этот модуль пока не создаёт UI: он является единым серверо-независимым
// валидатором, который позже будет использовать режим строительства.
import { canPlayerBuildAt } from '../territories/TerritoryReservationSystem.js';

export const PLAYER_BUILDINGS = Object.freeze({
    wall:{ footprint:{w:1,h:1}, cost:{wood:2} },
    floor:{ footprint:{w:1,h:1}, cost:{wood:1} },
    door:{ footprint:{w:1,h:1}, cost:{wood:3} },
    window:{ footprint:{w:1,h:1}, cost:{wood:2} },
    small_shed:{ footprint:{w:4,h:4}, cost:{wood:30,stone:8} },
});

export function validatePlayerBuildingPlacement(type,x,y,{footprint}={}){
    const def=PLAYER_BUILDINGS[type];
    if(!def) return {ok:false,reason:'unknown-building'};
    const fp=footprint||def.footprint;
    const points=[[x,y],[x+fp.w-1,y],[x,y+fp.h-1],[x+fp.w-1,y+fp.h-1]];
    for(const [px,py] of points){const r=canPlayerBuildAt(px,py);if(!r.ok)return {...r,ok:false,type};}
    return {ok:true,type,footprint:fp};
}
