<?php
$ug=$game['user_game']??[];
$mins=(int)($ug['total_minutes']??0); $week=(int)($ug['week_minutes']??0);
$ach=$game['achievements']??[];
$unlocked=count(array_filter($ach,fn($a)=>!empty($a['unlocked_at'])));
$total=count($ach); $progress=$total?(int)round($unlocked*100/$total):0;
?>
<div class="steam-library game-details-library" id="gameDetailsApp" data-game-id="<?= (int)$game['id'] ?>">
  <?php include __DIR__.'/partials/game-library-sidebar.php'; ?>

  <main class="game-detail-main">
    <div class="game-page">
      <a href="/games" class="game-back">← Библиотека</a>
      <section class="game-hero" style="--game-cover:url('<?= htmlspecialchars($game['image']??'') ?>')">
        <div class="game-hero-art"><img src="<?= htmlspecialchars($game['image']??'/assets/images/games/default.jpg') ?>" alt="<?= htmlspecialchars($game['title']) ?>"></div>
        <div class="game-hero-content">
          <div class="game-kicker"><?= htmlspecialchars(($game['game_type']??'web')==='live'?'Живая игра':'Игра сайта') ?></div>
          <h1><?= htmlspecialchars($game['title']) ?></h1>
          <div class="game-hero-actions"><a href="/game/<?= rawurlencode($game['slug']) ?>/play" class="play-button">▶ Играть</a><div class="playing-now">● <span id="onlinePlayers"><?= (int)($game['online_players']??0) ?></span> играют сейчас</div></div>
          <div class="play-stat-row"><div><small>В последней сессии</small><strong><?= $ug['last_played']?htmlspecialchars(date('d.m.Y H:i',strtotime($ug['last_played']))):'—' ?></strong></div><div><small>Всего сыграно</small><strong><?= floor($mins/60) ?> ч <?= $mins%60 ?> мин</strong></div><div><small>За неделю</small><strong><?= floor($week/60) ?> ч <?= $week%60 ?> мин</strong></div></div>
          <div class="game-mini-actions"><button id="toggleInfo" type="button">ⓘ Информация</button><button id="openAchievements" type="button">🏆 <?= $unlocked ?>/<?= $total ?></button><button id="toggleFavorite" type="button" class="<?= !empty($ug['is_favorite'])?'active':'' ?>">★ Избранное</button></div>
        </div>
      </section>

      <section class="game-info-drawer" id="infoDrawer" hidden><div><h2>Об игре</h2><p><?= nl2br(htmlspecialchars($game['description']??'Описание появится позже.')) ?></p></div><div><h3>Теги</h3><div class="tag-list"><?php foreach(($game['tags']??[]) as $tag): ?><span><?= htmlspecialchars($tag['name']) ?></span><?php endforeach; ?><?php if(empty($game['tags'])): ?><span><?= htmlspecialchars($game['category']??'Игра') ?></span><?php endif; ?></div><p class="game-meta">👥 <?= htmlspecialchars($game['players']??'1') ?> · <?= !empty($game['is_multiplayer'])?'Мультиплеер':'Одиночная' ?></p></div></section>

      <div class="game-content-columns"><section class="game-feed"><div class="section-heading"><div><p>СООБЩЕСТВО</p><h2>Последняя активность</h2></div></div><div class="activity-list"><?php foreach(($activity??[]) as $item): ?><article class="activity-item"><img src="<?= htmlspecialchars($item['avatar_url']??'/assets/images/default-avatar.png') ?>" alt=""><div><strong><?= htmlspecialchars($item['nickname']??'Игрок') ?></strong><p><?= htmlspecialchars($item['body']??$item['type']??'Новое событие') ?></p></div></article><?php endforeach; if(empty($activity)): ?><div class="empty-panel">Здесь будут достижения друзей, отзывы и опубликованные скриншоты.</div><?php endif; ?></div><div class="screenshots-panel"><div class="section-heading"><div><p>МЕДИА</p><h2>Записи и скриншоты</h2></div></div><div class="empty-panel">Скриншоты по умолчанию остаются на устройстве игрока. На сервер отправляются только после ручной публикации.</div></div></section>
      <aside class="game-side"><section class="side-card"><h2>Достижения</h2><button id="openAchievements2" type="button" class="achievement-summary"><span><?= $progress ?>%</span><div><strong><?= $unlocked ?> из <?= $total ?></strong><small>получено</small></div></button></section><section class="side-card"><h2>Коллекционные значки</h2><div class="placeholder-badges">Заглушка для будущей системы значков и карточек.</div></section><section class="side-card"><h2>Отзывы</h2><button id="openReview" type="button" class="review-open">Написать отзыв</button><div class="review-list"><?php foreach(($game['reviews']??[]) as $review): ?><article><strong><?= htmlspecialchars($review['nickname']) ?> · <?= $review['recommended']?'👍 Рекомендует':'👎 Не рекомендует' ?></strong><small>Наиграно <?= floor((int)$review['total_minutes']/60) ?> ч</small><p><?= nl2br(htmlspecialchars($review['body'])) ?></p></article><?php endforeach; ?></div></section></aside></div>
    </div>
  </main>
</div>

<div class="game-modal" id="achievementsModal" hidden aria-hidden="true"><div class="modal-large" role="dialog" aria-modal="true" aria-labelledby="achievementsTitle"><button class="modal-close" data-close="achievementsModal" type="button" aria-label="Закрыть">×</button><div class="achievement-modal-head"><div><p><?= htmlspecialchars($game['title']) ?></p><h2 id="achievementsTitle">Достижения</h2></div><div class="achievement-tabs"><button class="active" data-achievement-view="mine" type="button">Мои достижения</button><button data-achievement-view="global" type="button">Глобальные</button></div></div><div id="achievementsList"><?php foreach($ach as $a): $percent=(int)($a['total_players']??0)>0?round(((int)$a['unlocked_users']/(int)$a['total_players'])*100,1):0; ?><article class="achievement-row <?= !empty($a['unlocked_at'])?'unlocked':'locked' ?>"><img src="<?= htmlspecialchars($a['icon']??'/assets/images/achievements/default.png') ?>" alt=""><div><h3><?= htmlspecialchars($a['name']??'Достижение') ?></h3><p><?= htmlspecialchars($a['description']??'') ?></p><small class="mine-only"><?= !empty($a['unlocked_at'])?'Получено '.htmlspecialchars($a['unlocked_at']):'Ещё не получено' ?></small><small class="global-only" hidden><?= $percent ?>% игроков получили</small></div></article><?php endforeach; if(!$ach): ?><div class="empty-panel">Достижения пока не добавлены.</div><?php endif; ?></div></div></div>
<div class="game-modal" id="reviewModal" hidden aria-hidden="true"><form class="modal-review" id="reviewForm" role="dialog" aria-modal="true"><button type="button" class="modal-close" data-close="reviewModal" aria-label="Закрыть">×</button><h2>Ваш отзыв</h2><div class="recommend-choice"><label><input type="radio" name="recommended" value="1" checked> 👍 Рекомендую</label><label><input type="radio" name="recommended" value="0"> 👎 Не рекомендую</label></div><textarea name="body" maxlength="5000" placeholder="Расскажите, что вам понравилось или не понравилось"></textarea><button class="review-submit" type="submit">Отправить</button></form></div>
