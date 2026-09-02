<div class="welcome">
    <span class="home-kicker">N-A-V-A COMMUNITY</span>
    <h1>Добро пожаловать в <span class="highlight">N-A-V-A</span>!</h1>
    <p class="subtitle">Игры, друзья и общение в одном уютном месте.</p>
</div>

<div class="home-grid">
    <section class="home-card online-friends">
        <div class="home-card-head"><div><span class="card-kicker">ПРИСУТСТВИЕ</span><h2 class="section-title">🟢 Сейчас онлайн</h2></div><span class="mini-count"><?= count($onlineUsers) ?></span></div>
        <?php if (empty($onlineUsers)): ?>
            <p class="empty-message">Пока никого не видно — загляните позже.</p>
        <?php else: ?>
            <div class="friends-list" id="friendsList">
                <?php foreach ($onlineUsers as $user): ?>
                    <a class="friend-item" href="/profile/<?= (int)$user['id'] ?>">
                        <img src="<?= htmlspecialchars($user['avatar_url'] ?: '/assets/images/default-avatar.png') ?>" alt="" class="friend-avatar">
                        <span class="friend-name"><?= htmlspecialchars($user['nickname'] ?: 'Пользователь') ?></span>
                        <span class="friend-status <?= htmlspecialchars($user['presence_status'] ?? 'online') ?>"></span>
                    </a>
                <?php endforeach; ?>
            </div>
        <?php endif; ?>
    </section>

    <section class="home-card activity-feed">
        <div class="home-card-head"><div><span class="card-kicker">ЛЕНТА</span><h2 class="section-title">📋 Что происходит</h2></div></div>
        <div class="activity-list">
            <?php foreach ($activity as $item): ?>
                <div class="activity-item"><span class="activity-icon"><?= htmlspecialchars($item['icon']) ?></span><span class="activity-text"><?= htmlspecialchars($item['text']) ?></span><span class="activity-time"><?= htmlspecialchars($item['time']) ?></span></div>
            <?php endforeach; ?>
        </div>
    </section>

    <section class="home-card top-games">
        <div class="home-card-head"><div><span class="card-kicker">СТАТИСТИКА</span><h2 class="section-title">🎮 Топ недели</h2></div></div>
        <div class="top-games-list">
            <?php foreach ($topGames as $game): ?>
                <div class="top-game-item"><span class="top-game-rank"><?= htmlspecialchars($game['rank']) ?></span><span class="top-game-name"><?= htmlspecialchars($game['name']) ?></span><span class="top-game-count"><?= htmlspecialchars($game['count']) ?></span></div>
            <?php endforeach; ?>
        </div>
    </section>

    <section class="home-card game-events">
        <div class="home-card-head"><div><span class="card-kicker">СОБЫТИЯ</span><h2 class="section-title">📅 Ближайшие игровые вечера</h2></div></div>
        <div class="events-list">
            <?php foreach ($events as $event): ?>
                <div class="event-item"><span class="event-date"><?= htmlspecialchars($event['date']) ?></span><span class="event-name"><?= htmlspecialchars($event['name']) ?></span><span class="event-attendees">👥 <?= htmlspecialchars($event['attendees']) ?></span></div>
            <?php endforeach; ?>
        </div>
    </section>

    <section class="home-card active-chat">
        <div class="home-card-head"><div><span class="card-kicker">ОБЩИЙ ЧАТ</span><h2 class="section-title">💬 Последнее в чате</h2></div><a href="/chat" class="home-card-link">Открыть →</a></div>
        <?php if (empty($recentMessages)): ?>
            <p class="empty-message">Здесь пока тихо.</p>
        <?php else: ?>
            <div class="chat-messages">
                <?php foreach ($recentMessages as $message): ?>
                    <div class="chat-message">
                        <span class="chat-avatar">💬</span>
                        <div class="chat-content"><span class="chat-user"><?= htmlspecialchars($message['nickname'] ?: 'Пользователь') ?></span><span class="chat-text"><?= htmlspecialchars($message['message']) ?></span><span class="chat-time"><?= date('H:i', strtotime($message['created_at'])) ?></span></div>
                    </div>
                <?php endforeach; ?>
            </div>
        <?php endif; ?>
        <a href="/chat" class="chat-link">Перейти в общий чат →</a>
    </section>
</div>
