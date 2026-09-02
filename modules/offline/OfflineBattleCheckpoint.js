export class OfflineBattleCheckpoint {
  constructor(circleId=1){this.key=`circleOfHellBattleCheckpoint:${circleId}`;}
  save(data){ try{localStorage.setItem(this.key,JSON.stringify({version:1,savedAt:Date.now(),...data}));}catch(_){} }
  load(){try{return JSON.parse(localStorage.getItem(this.key)||'null');}catch(_){return null;}}
  clear(){try{localStorage.removeItem(this.key);}catch(_){}}
}
