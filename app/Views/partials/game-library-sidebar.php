<?php
/** @var array $games */
$sidebarGames = $sidebar_games ?? $games ?? [];
$currentSlug = $current_game_slug ?? '';
?>
<aside class="library-sidebar game-library-sidebar">
  <div class="library-tabs">
    <a class="library-tab<?= empty($collections_only) ? ' active' : '' ?>" href="/games">Библиотека</a>
    <a class="library-tab<?= !empty($collections_only) ? ' active' : '' ?>" href="/games?tab=collections">Коллекции</a>
  </div>

  <div class="library-mode">
    <button class="mode-btn active" data-type="all" type="button">Все</button>
    <button class="mode-btn" data-type="web" type="button">Игровые</button>
    <button class="mode-btn" data-type="live" type="button">Живые</button>
  </div>

  <div class="library-search">
    <input id="gameSearch" autocomplete="off" placeholder="Поиск игр">
    <button id="filterButton" type="button" aria-label="Фильтры">☷</button>
  </div>
  <div class="filter-panel" id="filterPanel" hidden>
    <strong>Фильтрация</strong>
    <label>Категория<select id="categoryFilter"><option value="">Все категории</option><?php foreach(($categories ?? []) as $category): ?><option value="<?= htmlspecialchars($category['category']) ?>"><?= htmlspecialchars($category['category']) ?></option><?php endforeach; ?></select></label>
    <label><input id="achievementsFilter" type="checkbox"> Есть достижения</label>
  </div>

  <div class="sidebar-heading">Быстрый доступ</div>
  <nav class="library-nav">
    <a class="library-nav-item active" data-filter="all" href="/games">▦ Все игры <span><?= (int)($totalGames ?? count($sidebarGames)) ?></span></a>
    <a class="library-nav-item" data-filter="favorites" href="/games?filter=favorites">★ Избранное <span><?= (int)($favoriteCount ?? 0) ?></span></a>
    <a class="library-nav-item" data-filter="recent" href="/games?filter=recent">◷ Недавние</a>
  </nav>

  <div class="collections-head"><span>МОИ КОЛЛЕКЦИИ</span><button id="createCollection" type="button" aria-label="Создать коллекцию">＋</button></div>
  <div class="collection-list" id="collectionList">
    <?php foreach(($collections ?? []) as $collection): ?>
      <div class="collection-row" data-collection-id="<?= (int)$collection['id'] ?>">
        <a class="collection-button" href="/games?collection=<?= (int)$collection['id'] ?>" data-filter="collection" data-collection-id="<?= (int)$collection['id'] ?>" data-collection-name="<?= htmlspecialchars($collection['name']) ?>"><span class="collection-name">⌄ <?= htmlspecialchars($collection['name']) ?></span><span class="collection-count"><?= (int)$collection['game_count'] ?></span></a>
        <button class="collection-delete" title="Удалить" type="button">×</button>
      </div>
    <?php endforeach; ?>
  </div>

  <div class="sidebar-heading game-list-heading">СПИСОК ИГР</div>
  <nav class="sidebar-game-list" id="sidebarGameList">
    <?php foreach($sidebarGames as $sidebarGame): ?>
      <a class="sidebar-game-link<?= ($currentSlug !== '' && ($sidebarGame['slug'] ?? '') === $currentSlug) ? ' active' : '' ?>" data-type="<?= htmlspecialchars($sidebarGame['game_type'] ?? 'web') ?>" data-title="<?= htmlspecialchars(mb_strtolower((string)($sidebarGame['title'] ?? ''))) ?>" href="/game/<?= rawurlencode($sidebarGame['slug']) ?>">
        <img src="<?= htmlspecialchars($sidebarGame['icon'] ?? $sidebarGame['image'] ?? '/assets/images/games/default.jpg') ?>" alt="">
        <span><?= htmlspecialchars($sidebarGame['title']) ?></span>
      </a>
    <?php endforeach; ?>
  </nav>
</aside>
