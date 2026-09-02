export class MainMenu {
  constructor(container,{onOffline,onOnline,userNickname="Гость"}={}) {
    this.container=container; this.onOffline=onOffline; this.onOnline=onOnline; this.userNickname=userNickname; this._onClick=this._onClick.bind(this); this._render();
  }
  _render(){
    this.root=document.createElement('section');
    this.root.className='main-menu-screen';
    this.root.setAttribute('aria-label','Главное меню игры');
    this.root.innerHTML=`<div class="menu-card"><span class="eyebrow">КРУГ АДА</span><h1>Выбери путь</h1><p class="menu-user">Аккаунт сайта: <b>${this._esc(this.userNickname)}</b></p><button type="button" class="menu-action offline" data-action="offline">Офлайн</button><button type="button" class="menu-action online" data-action="online">Онлайн <small>скоро</small></button><p class="menu-note">В офлайн-режиме можно создать или выбрать локального персонажа.</p></div><div class="menu-modal" hidden></div>`;
    this.root.addEventListener('click',this._onClick);
    this.container.appendChild(this.root);
  }
  _onClick(e){
    const button=e.target.closest('button[data-action], .menu-modal button'); if(!button || !this.root.contains(button)) return;
    e.preventDefault(); e.stopPropagation();
    if(button.matches('.menu-modal button')) { const m=this.root.querySelector('.menu-modal'); m.hidden=true; return; }
    const action=button.dataset.action;
    if(action==='offline') { try { this.onOffline?.(); } catch(err){ console.error('[MainMenu offline]',err); } }
    if(action==='online') this._stub();
  }
  _stub(){const m=this.root.querySelector('.menu-modal');m.hidden=false;m.innerHTML='<div><h2>Онлайн-режим</h2><p>Скоро...</p><button type="button">Понятно</button></div>';}
  _esc(v){return String(v??'Гость').replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[s]));}
  destroy(){this.root?.removeEventListener('click',this._onClick);this.root?.remove();}
}
