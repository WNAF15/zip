import { generateCamp } from './CampGenerator.js';
import { isGenerationBlocked } from '../territories/TerritoryReservationSystem.js';

// Бедные районы содержат редкие дворы и одиночные палатки.
// Палаточный пояс — плотные, но не сплошные поселения.
export function getCircleOneSettlementObjects(chunkX, chunkY, district){
 if(district!=='poor' && district!=='tent') return [];
 const cx=chunkX*15+7.5, cy=chunkY*15+7.5;
 if(isGenerationBlocked(cx,cy)) return [];
 return generateCamp(chunkX,chunkY,{size:15, district});
}
