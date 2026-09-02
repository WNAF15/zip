<div class="game-play-page" id="gamePlayApp" data-game-id="<?= (int)$game['id'] ?>" data-game-slug="<?= htmlspecialchars($game['slug']) ?>" data-game-path="<?= htmlspecialchars(rtrim($game['path'],'/').'/') ?>">
 <div class="game-play-header"><a href="/game/<?= rawurlencode($game['slug']) ?>" class="back-link">← Назад к игре</a><div class="game-play-title"><h1><?= htmlspecialchars($game['title']) ?></h1><span id="gameHostState">Подготовка контейнера…</span></div><div class="game-play-actions"><button class="btn-create-room" type="button">Комнаты</button><button class="btn-invite-friends" type="button">Пригласить</button></div></div>
 <div class="game-play-container" id="gameContainer"><div id="game-root" class="nava-game-root" aria-live="polite"><div class="game-loading"><div class="spinner"></div><span>Загрузка игры…</span></div></div></div>
</div>
<script>
window.NAVA_GAME_CONTEXT = <?= json_encode(['gameId'=>(int)$game['id'],'slug'=>$game['slug'],'title'=>$game['title'],'path'=>rtrim($game['path'],'/').'/','user'=>$game_context], JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES) ?>;
</script>
<script src="/assets/js/game-host.js"></script>
