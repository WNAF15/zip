export class CharacterSelect{
  constructor(container,{characters=[],onCreate,onPlay,userNickname='Гость'}={}){Object.assign(this,{container,characters,index:0,onCreate,onPlay,userNickname});this._render();}
  _render(){
    this.root=document.createElement('section');this.root.className='character-select-screen';
    this.root.innerHTML=`<div class="select-card wide"><span class="eyebrow">КРУГ АДА</span><h1>Выбор персонажа</h1><p>Аккаунт: <b>${this._e(this.userNickname)}</b></p><div class="character-carousel"><button type="button" class="carousel-arrow prev">‹</button><div class="film-track"></div><button type="button" class="carousel-arrow next">›</button></div><div class="carousel-info"></div><div class="select-actions"></div></div>`;
    this.container.appendChild(this.root);this.root.querySelector('.prev').onclick=()=>this._move(-1);this.root.querySelector('.next').onclick=()=>this._move(1);this._paint();
  }
  _move(dir){if(!this.characters.length)return;this.index=(this.index+dir+this.characters.length)%this.characters.length;this._paint(true);}
  _paint(){
    const track=this.root.querySelector('.film-track'),info=this.root.querySelector('.carousel-info'),actions=this.root.querySelector('.select-actions');track.innerHTML='';actions.innerHTML='';
    if(!this.characters.length){track.innerHTML='<div class="empty-character">Персонажей пока нет</div>';info.textContent='Создай первую оболочку.';this._createButton(actions);return;}
    this.characters.forEach((c,i)=>{let d=i-this.index;if(d>this.characters.length/2)d-=this.characters.length;if(d<-this.characters.length/2)d+=this.characters.length;const card=document.createElement('button');card.type='button';card.className='film-character'+(i===this.index?' active':'');card.style.setProperty('--offset',d);card.innerHTML=`<span>${this._e((c.name||'?')[0].toUpperCase())}</span><small>${this._e(c.name)}</small>`;card.onclick=()=>{this.index=i;this._paint();};track.appendChild(card);});
    const c=this.characters[this.index];info.innerHTML=`<h2>${this._e(c.name)}</h2><p>${this._e(c.className||c.classId)}</p><small>${this.index+1} / ${this.characters.length}</small>`;
    const play=document.createElement('button');play.type='button';play.className='menu-action';play.textContent='Играть этим персонажем';play.onclick=()=>this.onPlay?.(c);actions.appendChild(play);
    if(this.characters.length<5)this._createButton(actions);
  }
  _createButton(parent){const b=document.createElement('button');b.type='button';b.className='menu-action secondary';b.textContent='Создать персонажа';b.onclick=()=>this.onCreate?.();parent.appendChild(b);}
  _e(v){return String(v??'').replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[s]));}
  destroy(){this.root?.remove();}
}