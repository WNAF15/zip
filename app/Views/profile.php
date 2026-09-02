<?php use App\Core\Auth; ?>
<div class="profile-page">
    <!-- Шапка профиля с фоном -->
    <div class="profile-header" style="background-image: url('<?= $user['profile_background'] ?? '/assets/images/default-bg.jpg' ?>');">
        <div class="profile-header-content">
            <div class="profile-avatar-wrapper">
                <img src="<?= $user['avatar_url'] ?? '/assets/images/default-avatar.png' ?>" 
                     alt="Аватар" class="profile-avatar" style="<?= $userFrame ?>">
                <span class="profile-status <?= $user['status'] ?? 'online' ?>"></span>
            </div>
            <div class="profile-info">
                <h1 class="profile-name"><?= htmlspecialchars($user['nickname'] ?? 'Игрок') ?></h1>
                <div class="profile-bio">
                    <?php if (!empty($user['bio'])): ?>
                        <?php if (strlen($user['bio']) > 150): ?>
                            <span class="bio-short"><?= htmlspecialchars(substr($user['bio'], 0, 150)) ?>...</span>
                            <span class="bio-full" style="display:none;"><?= htmlspecialchars($user['bio']) ?></span>
                            <button class="bio-toggle">Подробнее</button>
                        <?php else: ?>
                            <span><?= htmlspecialchars($user['bio']) ?></span>
                        <?php endif; ?>
                    <?php else: ?>
                        <span class="bio-empty">Пользователь пока ничего не рассказал о себе</span>
                    <?php endif; ?>
                </div>
            </div>
        </div>
    </div>

    <!-- Основной контент профиля -->
    <div class="profile-body">
        <!-- Левая часть: витрины -->
        <div class="profile-main">
            <?php foreach ($selectedShowcases as $showcase): ?>
            <div class="showcase-block">
                <h2 class="showcase-title"><?= $showcase['icon'] ?? '📦' ?> <?= htmlspecialchars($showcase['title'] ?? 'Витрина') ?></h2>
                <div class="showcase-content">
                    <?php if ($showcase['title'] === 'Недавние игры'): ?>
                        <div class="recent-games-list">
                            <div class="recent-game">🎮 Викторина <span class="game-time">сегодня</span></div>
                            <div class="recent-game">🎮 Крокодил <span class="game-time">вчера</span></div>
                            <div class="recent-game">🎮 Мемори <span class="game-time">3 дня назад</span></div>
                        </div>
                    <?php elseif ($showcase['title'] === 'Достижения'): ?>
                        <div class="achievements-grid">
                            <?php for ($i=0; $i<6; $i++): ?>
                            <div class="achievement-item <?= $i < 3 ? '' : 'locked' ?>">
                                <div class="achievement-icon">🏆</div>
                                <div class="achievement-name">Достижение #<?= $i+1 ?></div>
                            </div>
                            <?php endfor; ?>
                        </div>
                    <?php elseif ($showcase['title'] === 'Друзья'): ?>
                        <div class="friends-list">
                            <div class="friend-item"><img src="/assets/images/default-avatar.png" class="friend-avatar"><span>Аня</span></div>
                            <div class="friend-item"><img src="/assets/images/default-avatar.png" class="friend-avatar"><span>Дима</span></div>
                            <div class="friend-item"><img src="/assets/images/default-avatar.png" class="friend-avatar"><span>Катя</span></div>
                        </div>
                    <?php elseif ($showcase['title'] === 'Статистика'): ?>
                        <div class="stats-grid">
                            <div class="stat-item"><span class="stat-number">12</span><span class="stat-label">Игр</span></div>
                            <div class="stat-item"><span class="stat-number">8</span><span class="stat-label">Побед</span></div>
                        </div>
                    <?php elseif ($showcase['title'] === 'Медиа'): ?>
                        <div class="media-grid">
                            <div class="media-item">🖼️ Скриншот 1</div>
                            <div class="media-item">🖼️ Скриншот 2</div>
                            <div class="media-item">🖼️ Скриншот 3</div>
                        </div>
                    <?php endif; ?>
                </div>
            </div>
            <?php endforeach; ?>
        </div>

        <!-- Правая часть: уровень, значки, статус -->
        <div class="profile-sidebar">
            <!-- Уровень -->
            <div class="sidebar-block level-block">
                <div class="level-header">
                    <span class="level-number">Уровень <?= $user['level'] ?? 1 ?></span>
                    <span class="level-xp"><?= $user['xp'] ?? 0 ?> / <?= ($user['level'] ?? 1) * 100 ?></span>
                </div>
                <div class="level-bar">
                    <div class="level-bar-fill" style="width: <?= (($user['xp'] ?? 0) / (($user['level'] ?? 1) * 100)) * 100 ?>%;"></div>
                </div>
            </div>

            <!-- Активный значок -->
            <div class="sidebar-block badge-block">
                <h3>Активный значок</h3>
                <?php if ($user['active_badge']): ?>
                    <div class="badge-display">🏅 Значок #<?= $user['active_badge'] ?></div>
                <?php else: ?>
                    <div class="badge-empty">Не выбран</div>
                <?php endif; ?>
            </div>

            <!-- Что делает игрок -->
            <div class="sidebar-block playing-block">
                <h3>Сейчас</h3>
                <div class="playing-text">
                    <?= !empty($user['playing_text']) ? htmlspecialchars($user['playing_text']) : 'Ожидает...' ?>
                </div>
            </div>
        </div>
    </div>

    <!-- Комментарии -->
    <div class="profile-comments">
        <h2>Комментарии</h2>
        <div class="comment-form">
            <textarea id="commentInput" placeholder="Напишите комментарий..."></textarea>
            <button id="commentSubmit" data-userid="<?= $user['id'] ?>">Отправить</button>
        </div>
        <div class="comments-list">
            <?php foreach ($comments as $comment): ?>
            <div class="comment-item">
                <img src="<?= $comment['avatar_url'] ?? '/assets/images/default-avatar.png' ?>" class="comment-avatar">
                <div class="comment-body">
                    <div class="comment-author"><?= htmlspecialchars($comment['nickname']) ?></div>
                    <div class="comment-text"><?= htmlspecialchars($comment['text']) ?></div>
                    <div class="comment-time"><?= date('d.m.Y H:i', strtotime($comment['created_at'])) ?></div>
                </div>
            </div>
            <?php endforeach; ?>
        </div>
    </div>
</div>