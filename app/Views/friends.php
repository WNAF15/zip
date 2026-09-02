<?php
$statusMap = [
    'online' => 'В сети',
    'away' => 'Отошёл',
    'playing' => 'Играет',
    'offline' => 'Не в сети',
];
?>
<div class="friends-page" data-friends-page>
    <div class="friends-header">
        <div><span class="friends-kicker">N-A-V-A COMMUNITY</span><h1>👥 Друзья</h1><p class="friends-subtitle">Люди, которые сейчас рядом с сообществом.</p></div>
        <div class="friends-summary"><strong><?= count($onlineUsers) ?></strong><span>сейчас онлайн</span></div>
    </div>

    <div class="friends-toolbar">
        <input type="search" id="friendsSearch" placeholder="Поиск по имени…" autocomplete="off">
    </div>

    <div class="friends-section">
        <h2 class="section-title">🟢 Онлайн сейчас</h2>
        <div class="friends-grid" id="onlineUsersGrid">
            <?php if (empty($onlineUsers)): ?><div class="friends-empty">Сейчас никого нет онлайн.</div>
            <?php else: foreach ($onlineUsers as $user): ?>
                <a href="/profile/<?= (int)$user['id'] ?>" class="friend-card" data-name="<?= htmlspecialchars(mb_strtolower($user['nickname'] ?? '')) ?>">
                    <img src="<?= htmlspecialchars($user['avatar_url'] ?: '/assets/images/default-avatar.png') ?>" alt="" class="friend-card-avatar">
                    <div class="friend-card-info"><div class="friend-card-name"><?= htmlspecialchars($user['nickname'] ?: 'Без имени') ?></div><div class="friend-card-status <?= htmlspecialchars($user['presence_status']) ?>"><?= htmlspecialchars($statusMap[$user['presence_status']] ?? 'В сети') ?></div></div>
                    <span class="friend-card-arrow">→</span>
                </a>
            <?php endforeach; endif; ?>
        </div>
    </div>

    <div class="friends-section">
        <h2 class="section-title">Все пользователи</h2>
        <div class="friends-grid" id="allUsersGrid">
            <?php if (empty($allUsers)): ?><div class="friends-empty">Пока никого нет.</div>
            <?php else: foreach ($allUsers as $user): ?>
                <a href="/profile/<?= (int)$user['id'] ?>" class="friend-card" data-name="<?= htmlspecialchars(mb_strtolower($user['nickname'] ?? '')) ?>">
                    <img src="<?= htmlspecialchars($user['avatar_url'] ?: '/assets/images/default-avatar.png') ?>" alt="" class="friend-card-avatar">
                    <div class="friend-card-info"><div class="friend-card-name"><?= htmlspecialchars($user['nickname'] ?: 'Без имени') ?></div><div class="friend-card-status <?= htmlspecialchars($user['presence_status']) ?>"><?= htmlspecialchars($statusMap[$user['presence_status']] ?? 'Не в сети') ?></div></div>
                    <span class="friend-card-arrow">→</span>
                </a>
            <?php endforeach; endif; ?>
        </div>
    </div>
</div>
