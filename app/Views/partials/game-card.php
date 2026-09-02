<?php
$minutes=(int)($game['total_minutes']??0); $week=(int)($game['week_minutes']??0);
$total=(int)($game['total_achievements']??0); $unlocked=(int)($game['unlocked_achievements']??0);
$progress=$total>0?min(100,(int)round($unlocked*100/$total)):0;
?>
<article class="game-card" draggable="true"
 data-game-id="<?= (int)$game['id'] ?>" data-title="<?= htmlspecialchars(mb_strtolower((string)$game['title'])) ?>"
 data-type="<?= htmlspecialchars($game['game_type']??'web') ?>" data-category="<?= htmlspecialchars($game['category']??'other') ?>"
 data-favorite="<?= !empty($game['is_favorite'])?'1':'0' ?>" data-time="<?= $minutes ?>" data-week="<?= $week ?>" data-last-played="<?= htmlspecialchars($game['last_played']??'') ?>">
 <a class="game-card-link" href="/game/<?= rawurlencode($game['slug']) ?>" aria-label="<?= htmlspecialchars($game['title']) ?>">
   <div class="game-cover"><img loading="lazy" src="<?= htmlspecialchars($game['image']??'/assets/images/games/default.jpg') ?>" alt="<?= htmlspecialchars($game['title']) ?>"></div>
   <div class="game-card-hover"><img class="game-mini-icon" src="<?= htmlspecialchars($game['icon']??$game['image']??'/assets/images/games/default.jpg') ?>" alt=""><div><strong><?= htmlspecialchars($game['title']) ?></strong><span>Всего <?= floor($minutes/60) ?> ч <?= $minutes%60 ?> мин · Неделя <?= floor($week/60) ?> ч <?= $week%60 ?> мин</span></div></div>
 </a>
 <div class="game-card-bottom">
   <div class="game-achievement-bar" title="<?= $unlocked ?> из <?= $total ?> достижений"><span style="width:<?= $progress ?>%" data-total="<?= $total ?>"></span></div>
   <div class="game-card-line"><span><?= $total>0 ? $unlocked.' / '.$total.' достижений' : 'Без достижений' ?></span><span><?= floor($minutes/60) ?>ч <?= $minutes%60 ?>м</span></div>
 </div>
 <button class="game-favorite <?= !empty($game['is_favorite'])?'active':'' ?>" type="button" data-game-id="<?= (int)$game['id'] ?>" aria-label="Избранное">★</button>
</article>
