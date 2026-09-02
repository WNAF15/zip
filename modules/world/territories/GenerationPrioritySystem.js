import { getReservationAt, RESERVATION_PRIORITY } from './TerritoryReservationSystem.js';
export { RESERVATION_PRIORITY };
export function mayGenerate(priority,x,y){
  const reservation=getReservationAt(x,y);
  if(!reservation) return { ok:true, reservation:null };
  return { ok: priority >= reservation.priority, reservation };
}
export function generationPriority(kind){
  return RESERVATION_PRIORITY[kind] ?? RESERVATION_PRIORITY.decor;
}
