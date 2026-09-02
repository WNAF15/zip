import { getAvailableClasses } from '../../creation/ClassRegistry.js';

const PAIRS = [
  ['health','speed'], ['luck','charisma'], ['tactics','strategy']
];
const META = {
 health:['Здоровье','Максимальный запас здоровья.'],
 luck:['Удача','Влияет на шанс критического удара.'],
 tactics:['Тактика','Определяет регенерацию маны за ход.'],
 speed:['Скорость','Влияет на передвижение по карте и клеткам в бою.'],
 charisma:['Харизма','Влияет на шансы захвата и подчинения врагов.'],
 strategy:['Стратегия','Определяет максимальный запас маны.']
};

export class CharacterCreation {
  constructor(container,{onComplete}={}) {
    this.container=container; this.onComplete=onComplete;
    this.classes=getAvailableClasses(); this.selected=this.classes[0]||null;
    this.selectedTotems=[]; this.name=''; this._resize=()=>this._drawChart();
    this._render();
  }
  _stats(){
    const s={...this.selected.stats};
    for(const t of this.selectedTotems) Object.entries(t.modifiers||{}).forEach(([k,v])=>s[k]=(s[k]??0)+v);
    for(const [a,b] of PAIRS){
      s[a]=Math.max(0,Math.min(10,s[a]??5));
      s[b]=Math.max(0,Math.min(10,10-s[a])); // strict opposite pair
    }
    return s;
  }
  _render(){
    const c=this.selected;
    this.root=document.createElement('section');
    this.root.className='character-creation-screen';
    this.root.innerHTML=`<header class="creation-header"><div><span class="eyebrow">КРУГ АДА</span><h1>Создание персонажа</h1></div><div class="creation-name"><label>Имя персонажа</label><input maxlength="18" placeholder="Введи имя" /></div></header>
      <div class="creation-layout">
        <aside class="creation-panel class-panel"><h2>Класс</h2><div class="class-list"></div><div class="totem"><span class="panel-label">Тотемы — выбери до 2</span><div class="totem-list"></div></div></aside>
        <main class="creation-center"><div class="character-core"><canvas class="polar-chart"></canvas><div class="character-preview"><span></span></div></div><div class="selection-name"><h2>${c.name}</h2><p>${c.description}</p></div></main>
        <aside class="creation-panel ability-panel"><h2>Способности</h2><div class="ability-scroll"></div><button type="button" class="start-game">Начать играть</button></aside>
      </div><div class="creation-tooltip" hidden></div>`;
    this.container.appendChild(this.root); this._bind(); this._renderClasses(); this._renderTotems(); this._renderAbilities();
    requestAnimationFrame(()=>this._drawChart(true));
  }
  _renderClasses(){
    const list=this.root.querySelector('.class-list');
    this.classes.forEach(c=>{const b=document.createElement('button');b.type='button';b.className='class-card'+(c.id===this.selected.id?' active':'');b.textContent=c.name;
      b.onclick=()=>{this.name=this.root.querySelector('input').value.trim();this.selected=c;this.selectedTotems=[];this.root.remove();this._render();};list.appendChild(b);});
  }
  _renderTotems(){
    const list=this.root.querySelector('.totem-list');
    this.selected.totems.forEach(t=>{const b=document.createElement('button');b.type='button';b.className='totem-card'+(this.selectedTotems.some(x=>x.id===t.id)?' active':'');b.disabled=!t.implemented;
      b.innerHTML=`<span>${t.symbol}</span><span><b>${t.name}</b><small>${t.implemented?'': 'Скоро'}</small></span>`;
      b.title=t.description;b.onclick=()=>{const i=this.selectedTotems.findIndex(x=>x.id===t.id);if(i>=0)this.selectedTotems.splice(i,1);else if(this.selectedTotems.length<2)this.selectedTotems.push(t);this._renderTotems();this._drawChart();};list.appendChild(b);});
  }
  _renderAbilities(){
    const box=this.root.querySelector('.ability-scroll');
    [['Активные',this.selected.abilities],['Пассивные',[...this.selected.passives,...this.selectedTotems.map(t=>t.passive).filter(Boolean)]]].forEach(([title,items])=>{
      const h=document.createElement('h3');h.textContent=title;box.appendChild(h);
      items.forEach(a=>{const b=document.createElement('button');b.type='button';b.className='ability-item';b.textContent=a.name;b.onmouseenter=e=>this._tip(e,a.name,a.description);b.onmouseleave=()=>this._hideTip();box.appendChild(b);});
    });
  }
  _bind(){
    const input=this.root.querySelector('input');input.value=this.name;
    const paint=()=>this.root.querySelector('.character-preview span').textContent=(input.value.trim()||this.selected.name||'?')[0].toUpperCase();
    input.addEventListener('input',paint);paint();
    this.root.querySelector('.start-game').onclick=()=>this.onComplete?.({name:input.value.trim()||'Безымянный',classId:this.selected.id,className:this.selected.name,totemIds:this.selectedTotems.map(t=>t.id),stats:this._stats()});
    window.addEventListener('resize',this._resize);
  }
  _tip(e,title,text){const t=this.root.querySelector('.creation-tooltip'),r=e.target.getBoundingClientRect(),cr=this.root.getBoundingClientRect();t.innerHTML=`<b>${title}</b><span>${text}</span>`;t.hidden=false;t.style.left=`${Math.max(8,Math.min(r.left-cr.left+8,cr.width-280))}px`;t.style.top=`${Math.max(8,r.bottom-cr.top+8)}px`;}
  _hideTip(){this.root.querySelector('.creation-tooltip').hidden=true;}
  _drawChart(animated=false){
    const canvas=this.root?.querySelector('.polar-chart'); if(!canvas)return;
    const box=canvas.parentElement.getBoundingClientRect(),dpr=devicePixelRatio||1,size=Math.floor(Math.min(box.width,box.height));
    if(size<10)return; canvas.width=size*dpr;canvas.height=size*dpr;canvas.style.width=canvas.style.height=size+'px';
    const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);
    const C=size/2,outer=size*.47,inner=size*.235,stats=this._stats();
    const sectors=[
      ['health',-112.5,-67.5],['strength',-67.5,-22.5],['luck',-22.5,22.5],['tactics',22.5,67.5],
      ['strategy',67.5,112.5],['agility',112.5,157.5],['speed',157.5,202.5],['charisma',202.5,247.5]
    ];
    const strength=(stats.health+stats.luck+stats.tactics)/3, agility=(stats.speed+stats.charisma+stats.strategy)/3;
    const value=id=>id==='strength'?strength:id==='agility'?agility:stats[id];
    const draw=p=>{
      ctx.clearRect(0,0,size,size);
      sectors.forEach(([id,a,b],i)=>{
        const start=a*Math.PI/180,end=b*Math.PI/180, mid=(start+end)/2, isCat=id==='strength'||id==='agility';
        ctx.beginPath();ctx.arc(C,C,outer,start,end);ctx.arc(C,C,inner,end,start,true);ctx.closePath();
        ctx.fillStyle='rgba(255,255,255,.025)';ctx.fill();ctx.strokeStyle=isCat?(id==='strength'?'rgba(205,72,72,.65)':'rgba(82,181,110,.65)'):'rgba(230,220,200,.17)';ctx.lineWidth=isCat?2:1;ctx.stroke();
        const blocks=10, v=Math.round(value(id)*p);
        for(let n=1;n<=blocks;n++){const rr=inner+(outer-inner)*(n/(blocks+1));const x=C+Math.cos(mid)*rr,y=C+Math.sin(mid)*rr;
          ctx.fillStyle=n<=v?(isCat?(id==='strength'?'#b84b4b':'#58a866'):'#d9c3a2'):'rgba(255,255,255,.07)';
          ctx.fillRect(x-size*.014,y-size*.014,size*.028,size*.028);
        }
      });
      ctx.beginPath();ctx.arc(C,C,inner,0,Math.PI*2);ctx.strokeStyle='rgba(230,220,200,.25)';ctx.stroke();
    };
    if(animated){const t0=performance.now(),tick=t=>{const p=Math.min(1,(t-t0)/700);draw(p);if(p<1)requestAnimationFrame(tick)};requestAnimationFrame(tick)}else draw(1);
    canvas.onmousemove=e=>{const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)*size/r.width-C,y=(e.clientY-r.top)*size/r.height-C,rad=Math.hypot(x,y);if(rad<inner||rad>outer){this._hideTip();return}let deg=Math.atan2(y,x)*180/Math.PI;if(deg<-112.5)deg+=360;let hit=null;for(const s of sectors){let a=s[1],b=s[2];if(a<=deg&&deg<b){hit=s[0];break}}if(hit){const title=hit==='strength'?'Сила':hit==='agility'?'Ловкость':META[hit][0];const text=hit==='strength'?'Общая категория: здоровье, удача и тактика.':hit==='agility'?'Общая категория: скорость, харизма и стратегия.':META[hit][1];this._tip(e,title,text);}};
    canvas.onmouseleave=()=>this._hideTip();
  }
  destroy(){window.removeEventListener('resize',this._resize);this.root?.remove();}
}