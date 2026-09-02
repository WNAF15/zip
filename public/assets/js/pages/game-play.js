document.addEventListener('DOMContentLoaded', async () => {
  const app=document.getElementById('gamePlayApp'); const root=document.getElementById('game-root'); const state=document.getElementById('gameHostState');
  if(!app||!root||!window.NAVA_GAME_CONTEXT)return;
  const gameId=Number(app.dataset.gameId||0); let startedAt=Date.now(); let lastFlush=Date.now();
  const post=(url,data)=>fetch(url,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(data),keepalive:true}).catch(()=>null);
  const flush=()=>{const seconds=Math.floor((Date.now()-lastFlush)/1000); if(seconds>=60){lastFlush=Date.now(); return post('/api/games/playtime',{game_id:gameId,seconds});}};
  const presence=()=>post('/api/games/presence',{game_id:gameId,state:'active'});
  try {
    await presence(); state.textContent='Игра запущена';
    await window.NAVA_GAME_HOST.mount(root,window.NAVA_GAME_CONTEXT);
  } catch(error) { console.error(error); state.textContent='Ошибка загрузки'; root.innerHTML='<div class="game-error"><h2>Игра не запустилась</h2><p>'+String(error.message||error).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))+'</p></div>'; }
  const timer=setInterval(()=>{flush();presence();},60000);
  const stop=()=>{clearInterval(timer); flush(); post('/api/games/presence',{game_id:gameId,state:'stop'}); window.NAVA_GAME_HOST?.destroy?.();};
  window.addEventListener('pagehide',stop,{once:true});
  document.querySelector('.btn-invite-friends')?.addEventListener('click',()=>navigator.clipboard?.writeText(location.href));
  document.querySelector('.btn-create-room')?.addEventListener('click',()=>alert('Система комнат будет подключаться через единый API контейнера.'));
});
