// Надёжная точка входа для сайта V-A-N-A.
window.Game = {
  container:null, instance:null, canvas:null, screen:null,
  _resizeObserver:null, _resizeHandler:null,

  async init(container, options={}) {
    this.destroy();
    this.container = container || document.getElementById('game-root');
    if (!this.container) throw new Error('Контейнер #game-root не найден');
    this.container.classList.add('game-shell');
    this.container.innerHTML='';
    this.options=options;
    this.userNickname=this._getSiteNickname(options);
    this._showLoading('Загрузка меню...');
    try {
      const { MainMenu } = await import('./modules/ui/MainMenu.js');
      this.container.innerHTML='';
      this.screen = new MainMenu(this.container, {
        userNickname:this.userNickname,
        onOffline:()=>this._showCharacters(),
        onOnline:()=>{}
      });
    } catch (error) { this._showError('Не удалось загрузить главное меню.', error); }
  },

  _getSiteNickname(o){return o.userNickname||window.VANA_GAME_CONTEXT?.userNickname||window.VANA_USER?.nickname||document.body?.dataset?.userNickname||document.querySelector('meta[name="vana-user-nickname"]')?.content||'Гость';},
  _characterKey(){ return `circleOfHellCharacters:${this.options?.userId || 'local'}`; },
  _loadCharacters(){ try { const raw=JSON.parse(localStorage.getItem(this._characterKey())||'[]'); return Array.isArray(raw)?raw.slice(0,5):[]; } catch { return []; } },
  _saveCharacter(c){ try { const list=this._loadCharacters(); if(list.length>=5) throw new Error('Достигнут лимит 5 персонажей'); list.push({...c,id:`char_${Date.now()}_${Math.random().toString(36).slice(2,7)}`}); localStorage.setItem(this._characterKey(),JSON.stringify(list)); return list[list.length-1]; } catch(e){console.warn('Не удалось сохранить персонажа',e); return null;} },

  async _showCharacters(){
    try { this.screen?.destroy?.(); this.container.innerHTML=''; this._showLoading('Загрузка персонажей...');
      const {CharacterSelect}=await import('./modules/ui/CharacterSelect.js'); this.container.innerHTML='';
      this.screen=new CharacterSelect(this.container,{characters:this._loadCharacters(),userNickname:this.userNickname,onCreate:()=>this._showCreation(),onPlay:c=>this._launchGame(c)});
    } catch(e){this._showError('Не удалось открыть выбор персонажа.',e)}
  },
  async _showCreation(){
    try {this.screen?.destroy?.(); this.container.innerHTML=''; this._showLoading('Создание персонажа...');
      const {CharacterCreation}=await import('./modules/ui/CharacterCreation.js'); this.container.innerHTML='';
      this.screen=new CharacterCreation(this.container,{onComplete:c=>{const saved=this._saveCharacter(c); if(saved)this._launchGame(saved); else this._showCharacters();}});
    } catch(e){this._showError('Не удалось открыть создание персонажа.',e)}
  },
  async _launchGame(character){
    try {
      this.screen?.destroy?.();
      this.container.innerHTML='';
      this.container.style.position=this.container.style.position||'relative';
      const {Game:Engine}=await import('./core/Game.js');
      this.canvas=document.createElement('canvas');
      this.canvas.id='game-canvas';
      this.canvas.style.visibility='hidden';
      this.container.appendChild(this.canvas);
      const loading=document.createElement('div');
      loading.className='game-loading game-loading-world';
      loading.innerHTML='<div class="spinner"></div><span>Загрузка мира...</span><small>Подготавливаем текстуры и стартовую область</small><div class="game-loading-progress"><i></i></div>';
      this.container.appendChild(loading);
      const setProgress=({stage,progress})=>{
        const label=loading.querySelector('span');
        const bar=loading.querySelector('.game-loading-progress i');
        if(label) label.textContent=stage||'Загрузка мира...';
        if(bar) bar.style.width=`${Math.round(Math.max(0,Math.min(1,progress||0))*100)}%`;
      };
      this._sizeCanvas();
      this.instance=new Engine(this.canvas,{circleId:1,playerClassId:character.classId,character,userId:this.options?.userId ?? null,userNickname:this.userNickname,playerNickname:character.name});
      await this.instance.prepareForStart(setProgress);
      if(!this.instance) return;
      this.canvas.style.visibility='visible';
      this.instance.start();
      this._bindResize();
      requestAnimationFrame(()=>loading.remove());
    } catch(e){this._showError('Мир не удалось запустить.',e)}
  },
  _sizeCanvas(){if(!this.canvas)return;const r=this.container.getBoundingClientRect();this.canvas.width=Math.max(320,Math.floor(r.width||800));this.canvas.height=Math.max(480,Math.floor(r.height||600));},
  _bindResize(){const resize=()=>{this._sizeCanvas();if(this.instance?.renderer)this.instance.renderer.updateSize(this.canvas.width,this.canvas.height,this.instance.camera?.getZoom?.()||1)};this._resizeHandler=resize;window.addEventListener('resize',resize);if(window.ResizeObserver){this._resizeObserver=new ResizeObserver(resize);this._resizeObserver.observe(this.container)}},
  _showLoading(text){this.container.innerHTML=`<div class="game-loading"><div class="spinner"></div><span>${text}</span></div>`;},
  _showError(message,error){console.error('[Круг Ада]',error);this.container.innerHTML=`<section class="game-error"><h2>Ошибка загрузки</h2><p>${message}</p><small>${String(error?.message||error||'Неизвестная ошибка')}</small><button>Повторить</button></section>`;this.container.querySelector('button').onclick=()=>this.init(this.container,this.options);},
  destroy(){this.instance?.destroy?.();this.instance=null;this.screen?.destroy?.();this.screen=null;this._resizeObserver?.disconnect?.();if(this._resizeHandler)window.removeEventListener('resize',this._resizeHandler);this._resizeObserver=this._resizeHandler=null;if(this.container)this.container.innerHTML='';this.canvas=null;}
};
window.initCircleOfHell=(container,options={})=>window.Game.init(container||document.getElementById('game-root'),options);
