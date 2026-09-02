document.addEventListener('DOMContentLoaded', () => {
  const app = document.getElementById('gamesApp');
  const grid = document.getElementById('gamesGrid');
  if (!app || !grid) return;

  const search = document.getElementById('gameSearch');
  const category = document.getElementById('categoryFilter');
  const achievementsOnly = document.getElementById('achievementsFilter');
  const sortSelect = document.getElementById('gameSort');
  const collectionList = document.getElementById('collectionList');
  const librarySnapshot = grid.innerHTML;
  let source = 'library';
  let activeCollection = null;
  let mode = 'all';
  let quick = 'all';
  let activeTab = 'library';
  let dragging = null;

  const post = async (url, data) => {
    const response = await fetch(url, {
      method: 'POST', credentials: 'same-origin',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams(data)
    });
    if (!response.ok) throw new Error('Ошибка запроса: ' + response.status);
    return response.json();
  };

  const cards = () => [...grid.querySelectorAll('.game-card')];
  const restoreLibrary = () => {
    if (source !== 'library') {
      grid.innerHTML = librarySnapshot;
      source = 'library';
    }
  };
  const updateSnapshot = () => { if (source === 'library') window.__navaLibrarySnapshot = grid.innerHTML; };
  const currentSnapshot = () => window.__navaLibrarySnapshot || librarySnapshot;

  const setTitle = () => {
    const title = document.getElementById('libraryTitle');
    const eyebrow = document.getElementById('libraryEyebrow');
    if (title) title.textContent = activeCollection ? activeCollection.name : (quick === 'favorites' ? 'Избранное' : quick === 'recent' ? 'Недавние' : 'Все игры');
    if (eyebrow) eyebrow.textContent = activeTab === 'collections' ? 'Коллекции' : 'Библиотека';
  };

  const apply = () => {
    const q = (search?.value || '').trim().toLocaleLowerCase('ru');
    cards().forEach(card => {
      const title = card.dataset.title || '';
      const type = card.dataset.type || 'web';
      const cat = card.dataset.category || '';
      const favorite = card.dataset.favorite === '1';
      const lastPlayed = !!card.dataset.lastPlayed;
      const progress = card.querySelector('.game-achievement-bar span');
      const hasAchievements = !!progress && progress.dataset.total !== '0';
      let ok = (!q || title.includes(q)) && (mode === 'all' || type === mode);
      ok = ok && (!category?.value || cat === category.value);
      ok = ok && (!achievementsOnly?.checked || hasAchievements);
      if (quick === 'favorites') ok = ok && favorite;
      if (quick === 'recent') ok = ok && lastPlayed;
      card.hidden = !ok;
    });
    sort();
  };

  const sort = () => {
    const value = sortSelect?.value || 'recent';
    cards().filter(card => !card.hidden).sort((a, b) => {
      if (value === 'title') return (a.dataset.title || '').localeCompare(b.dataset.title || '', 'ru');
      if (value === 'time') return Number(b.dataset.time || 0) - Number(a.dataset.time || 0);
      return String(b.dataset.lastPlayed || '').localeCompare(String(a.dataset.lastPlayed || ''));
    }).forEach(card => grid.appendChild(card));
  };

  const escapeText = value => String(value ?? '');
  const makeCard = game => {
    const card = document.createElement('article');
    card.className = 'game-card'; card.draggable = true;
    card.dataset.gameId = game.id; card.dataset.title = (game.title || '').toLocaleLowerCase('ru');
    card.dataset.type = game.game_type || 'web'; card.dataset.category = game.category || '';
    card.dataset.favorite = game.is_favorite ? '1' : '0'; card.dataset.time = game.total_minutes || 0;
    card.dataset.lastPlayed = game.last_played || '';
    const total = Number(game.total_achievements || 0), unlocked = Number(game.unlocked_achievements || 0);
    const pct = total ? Math.round(unlocked * 100 / total) : 0;
    const minutes = Number(game.total_minutes || 0), week = Number(game.week_minutes || 0);
    const link = document.createElement('a'); link.className = 'game-card-link'; link.href = '/game/' + encodeURIComponent(game.slug || '');
    const cover = document.createElement('div'); cover.className = 'game-cover';
    const image = document.createElement('img'); image.loading = 'lazy'; image.src = game.image || '/assets/images/games/default.jpg'; image.alt = escapeText(game.title); cover.appendChild(image);
    const hover = document.createElement('div'); hover.className = 'game-card-hover';
    const icon = document.createElement('img'); icon.className = 'game-mini-icon'; icon.src = game.icon || game.image || '/assets/images/games/default.jpg'; icon.alt = '';
    const info = document.createElement('div'); const strong = document.createElement('strong'); strong.textContent = escapeText(game.title);
    const span = document.createElement('span'); span.textContent = `Всего ${Math.floor(minutes/60)} ч ${minutes%60} мин · Неделя ${Math.floor(week/60)} ч ${week%60} мин`;
    info.append(strong, span); hover.append(icon, info); link.append(cover, hover);
    const bottom = document.createElement('div'); bottom.className = 'game-card-bottom';
    const bar = document.createElement('div'); bar.className = 'game-achievement-bar'; const fill = document.createElement('span'); fill.style.width = pct + '%'; fill.dataset.total = String(total); bar.appendChild(fill);
    const line = document.createElement('div'); line.className = 'game-card-line'; const a = document.createElement('span'); a.textContent = total ? `${unlocked} / ${total} достижений` : 'Без достижений'; const t = document.createElement('span'); t.textContent = `${Math.floor(minutes/60)}ч ${minutes%60}м`; line.append(a, t); bottom.append(bar, line);
    const favorite = document.createElement('button'); favorite.type = 'button'; favorite.className = 'game-favorite' + (game.is_favorite ? ' active' : ''); favorite.dataset.gameId = game.id; favorite.textContent = '★'; favorite.setAttribute('aria-label', 'Избранное');
    card.append(link, bottom, favorite); return card;
  };

  const showCollection = async row => {
    const button = row.querySelector('.collection-button');
    activeCollection = {id: row.dataset.collectionId, name: button.dataset.collectionName || button.querySelector('.collection-name')?.textContent || 'Коллекция'};
    const response = await fetch('/api/games/collection?collection_id=' + encodeURIComponent(activeCollection.id), {credentials:'same-origin'});
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'Не удалось открыть коллекцию');
    grid.innerHTML = ''; data.games.forEach(game => grid.appendChild(makeCard(game)));
    source = 'collection'; quick = 'all'; setTitle(); apply();
  };

  document.querySelectorAll('.mode-btn').forEach(button => button.addEventListener('click', () => {
    restoreLibrary(); if (source === 'library' && window.__navaLibrarySnapshot) grid.innerHTML = currentSnapshot();
    activeCollection = null; mode = button.dataset.type;
    document.querySelectorAll('.mode-btn').forEach(x => x.classList.toggle('active', x === button)); setTitle(); apply();
  }));
  document.querySelectorAll('.library-nav-item').forEach(button => button.addEventListener('click', () => {
    restoreLibrary(); if (window.__navaLibrarySnapshot) grid.innerHTML = currentSnapshot();
    activeCollection = null; quick = button.dataset.filter;
    document.querySelectorAll('.library-nav-item').forEach(x => x.classList.toggle('active', x === button)); setTitle(); apply();
  }));
  search?.addEventListener('input', () => { clearTimeout(search._timer); search._timer = setTimeout(apply, 160); });
  category?.addEventListener('change', apply); achievementsOnly?.addEventListener('change', apply); sortSelect?.addEventListener('change', sort);

  document.querySelectorAll('.library-tab').forEach(button => button.addEventListener('click', () => {
    activeTab = button.dataset.libraryTab;
    document.querySelectorAll('.library-tab').forEach(x => x.classList.toggle('active', x === button));
    if (activeTab === 'library') { restoreLibrary(); if (window.__navaLibrarySnapshot) grid.innerHTML = currentSnapshot(); activeCollection = null; quick = 'all'; }
    document.querySelectorAll('.collection-row').forEach(row => row.hidden = false);
    setTitle(); apply();
  }));

  document.getElementById('filterButton')?.addEventListener('click', () => { const panel = document.getElementById('filterPanel'); panel.hidden = !panel.hidden; });
  document.querySelectorAll('.compact-btn').forEach(button => button.addEventListener('click', () => {
    grid.classList.toggle('list-view', button.dataset.view === 'list');
    document.querySelectorAll('.compact-btn').forEach(x => x.classList.toggle('active', x === button));
  }));

  grid.addEventListener('click', async event => {
    const favorite = event.target.closest('.game-favorite'); if (!favorite) return;
    event.preventDefault();
    try { const data = await post('/api/games/favorite', {game_id: favorite.dataset.gameId}); if (data.success) { favorite.classList.toggle('active', !!data.is_favorite); const card = favorite.closest('.game-card'); card.dataset.favorite = data.is_favorite ? '1' : '0'; if (source === 'library') window.__navaLibrarySnapshot = grid.innerHTML; apply(); } } catch (error) { console.error(error); }
  });
  grid.addEventListener('dragstart', event => { dragging = event.target.closest('.game-card'); if (dragging) { event.dataTransfer.effectAllowed = 'copy'; dragging.classList.add('dragging'); } });
  grid.addEventListener('dragend', () => { dragging?.classList.remove('dragging'); dragging = null; });

  collectionList?.addEventListener('click', async event => {
    const remove = event.target.closest('.collection-delete'); const button = event.target.closest('.collection-button');
    if (remove) { const row = remove.closest('.collection-row'); if (confirm('Удалить коллекцию?')) { try { const data = await post('/api/games/collections/delete', {collection_id:row.dataset.collectionId}); if (data.success) { if (activeCollection?.id === row.dataset.collectionId) { activeCollection=null; restoreLibrary(); grid.innerHTML=currentSnapshot(); } row.remove(); setTitle(); apply(); } } catch(error){console.error(error);} } return; }
    if (button) { try { await showCollection(button.closest('.collection-row')); } catch(error) { console.error(error); alert(error.message); } }
  });
  collectionList?.addEventListener('dragover', event => { if (event.target.closest('.collection-row')) event.preventDefault(); });
  collectionList?.addEventListener('drop', async event => {
    const row = event.target.closest('.collection-row'); if (!row || !dragging) return; event.preventDefault();
    try { const data = await post('/api/games/collections/add', {collection_id:row.dataset.collectionId, game_id:dragging.dataset.gameId}); if (data.success) { const count = row.querySelector('.collection-count'); if (count) count.textContent = String(Number(count.textContent || 0) + 1); } } catch(error){console.error(error);}
  });

  const modal = document.getElementById('collectionModal');
  document.getElementById('createCollection')?.addEventListener('click', () => { modal.hidden=false; document.getElementById('collectionName').focus(); });
  document.getElementById('collectionCancel')?.addEventListener('click', () => modal.hidden=true);
  document.getElementById('collectionSave')?.addEventListener('click', async () => {
    const input = document.getElementById('collectionName'); const name = input.value.trim(); if (!name) return;
    try { const data = await post('/api/games/collections/create', {name}); if (!data.success) throw new Error(data.error || 'Не удалось создать коллекцию'); const row=document.createElement('div'); row.className='collection-row'; row.dataset.collectionId=data.collection.id; const button=document.createElement('button'); button.type='button'; button.className='collection-button'; button.dataset.collectionName=data.collection.name; const n=document.createElement('span'); n.className='collection-name'; n.textContent='⌄ '+data.collection.name; const count=document.createElement('span'); count.className='collection-count'; count.textContent='0'; button.append(n,count); const del=document.createElement('button'); del.type='button'; del.className='collection-delete'; del.title='Удалить'; del.textContent='×'; row.append(button,del); collectionList.appendChild(row); input.value=''; modal.hidden=true; } catch(error) { alert(error.message); }
  });

  // Поддержка прямых ссылок из левой панели и верхнего меню.
  const params = new URLSearchParams(window.location.search);
  const requestedCollection = params.get('collection');
  const requestedFilter = params.get('filter');
  const requestedTab = params.get('tab');
  if (requestedCollection) {
    const row = [...document.querySelectorAll('.collection-row')].find(item => String(item.dataset.collectionId) === String(requestedCollection));
    if (row) showCollection(row).catch(error => console.error(error));
  } else if (requestedFilter && ['favorites', 'recent'].includes(requestedFilter)) {
    quick = requestedFilter;
    document.querySelectorAll('.library-nav-item').forEach(item => item.classList.toggle('active', item.dataset.filter === quick));
    setTitle(); apply();
  } else if (requestedTab === 'collections') {
    document.querySelector('[data-library-tab="collections"]')?.click();
  } else {
    setTitle(); apply();
  }
});
