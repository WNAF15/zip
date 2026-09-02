<div class="steam-library" id="gamesApp">
  <?php include __DIR__.'/partials/game-library-sidebar.php'; ?>
  <main class="library-main">
    <header class="library-main-head"><div><p id="libraryEyebrow">Библиотека</p><h1 id="libraryTitle">Все игры</h1></div><div class="library-head-actions"><select id="gameSort"><option value="recent">Недавно запущенные</option><option value="title">По алфавиту</option><option value="time">Больше времени</option></select><button class="compact-btn active" data-view="grid" type="button">▦</button><button class="compact-btn" data-view="list" type="button">☰</button></div></header>
    <section class="library-grid" id="gamesGrid"><?php if($games): foreach($games as $game) include __DIR__.'/partials/game-card.php'; else: ?><div class="library-empty">Игр пока нет.</div><?php endif; ?></section>
  </main>
</div>
<div class="collection-modal" id="collectionModal" hidden><div class="modal-card"><h2>Новая коллекция</h2><input id="collectionName" maxlength="80" placeholder="Например, Кооперативные"><div><button id="collectionCancel" type="button">Отмена</button><button id="collectionSave" type="button">Создать</button></div></div></div>
