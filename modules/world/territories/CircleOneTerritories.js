// Уникальные территории Первого круга: фиксированные, многочанковые, стримятся по границам чанков.
import { CIRCLE_ONE_LANDMARKS } from '../circles/CircleOneLandmarks.js';

const TERRITORIES = [
  { id:'great-quarry-zone', kind:'quarry', title:'Большая каменоломня', x:5300, y:2800, radius:420 },
  { id:'west-industrial-zone', kind:'industrial', title:'Западный промышленный район', x:-5700, y:750, radius:520 },
  { id:'north-east-industrial-zone', kind:'industrial', title:'Северо-восточный промышленный район', x:4300, y:-3200, radius:500 },
  { id:'south-west-industrial-zone', kind:'industrial', title:'Юго-западный промышленный район', x:-5400, y:4700, radius:500 },
  { id:'south-east-industrial-zone', kind:'industrial', title:'Юго-восточный промышленный район', x:6000, y:4200, radius:560 },
];

export const CIRCLE_ONE_TERRITORIES = Object.freeze(TERRITORIES);

export function getTerritoriesForChunk(chunkX, chunkY, chunkSize=15) {
  const minX=chunkX*chunkSize, minY=chunkY*chunkSize, maxX=minX+chunkSize, maxY=minY+chunkSize;
  return TERRITORIES.filter(t => {
    const nx=Math.max(minX, Math.min(t.x,maxX)), ny=Math.max(minY, Math.min(t.y,maxY));
    return (nx-t.x)**2+(ny-t.y)**2 <= t.radius**2;
  });
}
