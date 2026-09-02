// NPC simulation: groups/population are authoritative logical state; visual agents are local.
export class NPCWorld {
  constructor({map, player, maxVisualAgents=48}={}) {
    this.map=map; this.player=player; this.maxVisualAgents=maxVisualAgents;
    this.groups=new Map(); this.population=new Map(); this.visualAgents=[];
    this._aiAccumulator=0; this._visualDirty=true; this._nextId=1;
  }
  addPopulation(id, data={}) { this.population.set(id,{id,count:0,working:0,sleeping:0,wandering:0,absent:0,...data}); return this.population.get(id); }
  spawnGroup(data={}) {
    const count=Math.max(1,Math.floor(data.count||1)); const seed=(data.seed??((this._nextId*2654435761)>>>0));
    const group={id:data.id||`group_${this._nextId++}`,type:data.type||'crowd',count,x:data.x||0,y:data.y||0,targetX:data.targetX??data.x??0,targetY:data.targetY??data.y??0,state:data.state||'idle',speed:data.speed||0.8,seed,route:data.route||null};
    this.groups.set(group.id,group); this._visualDirty=true; return group;
  }
  update(dt) {
    this._aiAccumulator+=dt;
    // AI ticks at 5 Hz, rendering remains smooth via interpolation.
    while(this._aiAccumulator>=0.2){ this._aiAccumulator-=0.2; for(const g of this.groups.values()) this._stepGroup(g,0.2); }
    this._syncVisualAgents();
    for(const a of this.visualAgents){ a.phase+=dt*(2.2+a.speedJitter); a.x+=(a.tx-a.x)*Math.min(1,dt*5); a.y+=(a.ty-a.y)*Math.min(1,dt*5); }
  }
  _stepGroup(g,dt){ const dx=g.targetX-g.x,dy=g.targetY-g.y,d=Math.hypot(dx,dy); if(d>0.05&&g.state!=='idle'){ const s=Math.min(d,g.speed*dt); g.x+=dx/d*s; g.y+=dy/d*s; } }
  _rand(seed,i,n){ let x=(seed^(i*374761393)^(n*668265263))>>>0; x=Math.imul(x^(x>>>13),1274126177)>>>0; return (x^(x>>>16))/4294967296; }
  _syncVisualAgents(){
    if(!this.player) return;
    const candidates=[]; for(const g of this.groups.values()){ const d=Math.hypot(g.x-this.player.x,g.y-this.player.y); if(d<42) candidates.push([d,g]); }
    candidates.sort((a,b)=>a[0]-b[0]); const next=[];
    for(const [,g] of candidates){ const cap=Math.min(g.count, Math.max(4,Math.min(24,this.maxVisualAgents-next.length))); for(let i=0;i<cap&&next.length<this.maxVisualAgents;i++){
      const r1=this._rand(g.seed,i,1),r2=this._rand(g.seed,i,2); const ox=(r1-.5)*5,oy=(r2-.5)*5;
      const old=this.visualAgents.find(a=>a.groupId===g.id&&a.index===i);
      next.push(old||{groupId:g.id,index:i,x:g.x+ox,y:g.y+oy,phase:r1*6.28,speedJitter:r2,ox,oy});
      const a=next[next.length-1]; a.tx=g.x+a.ox; a.ty=g.y+a.oy;
    }
  }
  this.visualAgents=next;
  }
  getVisualAgents(){return this.visualAgents;}
  snapshot(){return {groups:[...this.groups.values()],population:[...this.population.values()]};}
  destroy(){this.groups.clear();this.population.clear();this.visualAgents.length=0;}
}
