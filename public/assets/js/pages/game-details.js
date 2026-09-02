document.addEventListener('DOMContentLoaded', () => {
  const app = document.getElementById('gameDetailsApp');
  if (!app) return;

  const gameId = app.dataset.gameId;
  const post = (url, data) => fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams(data)
  }).then(async response => {
    const data = await response.json().catch(() => ({}));
    if (!response.ok && !data.success) throw new Error(data.error || 'Ошибка запроса');
    return data;
  });

  const open = id => {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('game-modal-open');
  };
  const close = id => {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    if (!document.querySelector('.game-modal:not([hidden])')) document.body.classList.remove('game-modal-open');
  };

  document.getElementById('toggleInfo')?.addEventListener('click', () => {
    const drawer = document.getElementById('infoDrawer');
    if (drawer) drawer.hidden = !drawer.hidden;
  });

  ['openAchievements', 'openAchievements2'].forEach(id =>
    document.getElementById(id)?.addEventListener('click', () => open('achievementsModal'))
  );
  document.getElementById('openReview')?.addEventListener('click', () => open('reviewModal'));

  document.querySelectorAll('[data-close]').forEach(button => {
    button.addEventListener('click', () => close(button.dataset.close));
  });

  document.querySelectorAll('.game-modal').forEach(modal => {
    modal.addEventListener('click', event => {
      if (event.target === modal) close(modal.id);
    });
  });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const active = document.querySelector('.game-modal:not([hidden])');
    if (active) close(active.id);
  });

  document.getElementById('toggleFavorite')?.addEventListener('click', async event => {
    try {
      const data = await post('/api/games/favorite', {game_id: gameId});
      if (!data.success) throw new Error(data.error || 'Не удалось изменить избранное');
      const button = event.currentTarget;
      button.classList.toggle('active', !!data.is_favorite);
      button.textContent = (data.is_favorite ? '★ ' : '☆ ') + 'Избранное';
    } catch (error) {
      console.error(error);
      alert(error.message || 'Не удалось изменить избранное');
    }
  });

  document.querySelectorAll('[data-achievement-view]').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-achievement-view]').forEach(item => item.classList.toggle('active', item === button));
      const global = button.dataset.achievementView === 'global';
      document.querySelectorAll('.mine-only').forEach(item => item.hidden = global);
      document.querySelectorAll('.global-only').forEach(item => item.hidden = !global);
    });
  });

  document.getElementById('reviewForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    try {
      const data = await post('/api/games/review', {
        game_id: gameId,
        recommended: fd.get('recommended'),
        body: fd.get('body')
      });
      if (!data.success) throw new Error(data.error || 'Не удалось отправить отзыв');
      location.reload();
    } catch (error) {
      alert(error.message || 'Не удалось отправить отзыв');
    }
  });

  // Поиск в постоянном левом списке игр на странице конкретной игры.
  const search = document.getElementById('gameSearch');
  const sidebarGames = [...document.querySelectorAll('#sidebarGameList .sidebar-game-link')];
  search?.addEventListener('input', () => {
    const query = search.value.trim().toLocaleLowerCase();
    sidebarGames.forEach(link => link.hidden = !!query && !(link.dataset.title || '').includes(query));
  });

  document.querySelectorAll('.mode-btn').forEach(button => {
    button.addEventListener('click', () => {
      const type = button.dataset.type || 'all';
      sidebarGames.forEach(link => link.hidden = type !== 'all' && link.dataset.type !== type);
      document.querySelectorAll('.mode-btn').forEach(item => item.classList.toggle('active', item === button));
    });
  });

  document.getElementById('filterButton')?.addEventListener('click', () => {
    const panel = document.getElementById('filterPanel');
    if (panel) panel.hidden = !panel.hidden;
  });

  // Достижения не опрашиваются каждые несколько минут без необходимости:
  // данные обновятся при следующем открытии страницы или после игрового события.
});
