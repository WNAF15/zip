<?php use App\Core\Auth; ?>
<?php use App\Core\Metrics; ?>
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= $title ?? 'N-A-V-A' ?></title>
    
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;14..32,500;14..32,600;14..32,700&display=swap" rel="stylesheet">
    
    <link rel="stylesheet" href="/assets/css/main.css">
    <link rel="stylesheet" href="/assets/css/themes/light-theme.css" id="theme-style">
    
    <?php if (isset($page_css)): ?>
    <?php
        $pageCssFile = __DIR__ . '/../../public/assets/css/pages/' . $page_css . '.css';
        $pageCssVersion = file_exists($pageCssFile) ? (string)filemtime($pageCssFile) : '1';
    ?>
    <link rel="stylesheet" href="/assets/css/pages/<?= htmlspecialchars($page_css) ?>.css?v=<?= $pageCssVersion ?>">
    <?php endif; ?>
</head>
<body data-authenticated="<?= Auth::isLoggedIn() ? '1' : '0' ?>">
    <div class="sakura-container" id="sakuraContainer"></div>
    <div class="stars-container" id="starsContainer" style="display: none;"></div>

    <header class="site-header">
        <nav class="site-nav">
            <div class="nav-left">
                <a href="/" class="logo">✦ N-A-V-A</a>
            </div>

            <?php
            $currentUri = $_SERVER['REQUEST_URI'];
            $isProfile = strpos($currentUri, '/profile') === 0;
            $isFriends = strpos($currentUri, '/friends') === 0;
            $isGames = strpos($currentUri, '/games') === 0;
            $isChat = strpos($currentUri, '/chat') === 0;
            $isGallery = strpos($currentUri, '/gallery') === 0;
            $isMusic = strpos($currentUri, '/music') === 0;
            $isAI = strpos($currentUri, '/ai') === 0;
            ?>

            <div class="nav-center" id="mainNav">
                <!-- Библиотека с динамическими играми -->
                <div class="dropdown">
                    <button class="dropbtn">Библиотека ▾</button>
                    <div class="dropdown-content" id="gamesDropdown">
                        <a href="/games">📚 Все игры</a>
                        <a href="/games?filter=favorites">⭐ Избранное</a>
                    </div>
                </div>

                <!-- Сообщество -->
                <div class="dropdown">
                    <button class="dropbtn">Сообщество ▾</button>
                    <div class="dropdown-content">
                        <a href="/chat" <?= $isChat ? 'class="active"' : '' ?>>💬 Каналы</a>
                        <a href="/gallery" <?= $isGallery ? 'class="active"' : '' ?>>🖼️ Галерея</a>
                        <a href="/music" <?= $isMusic ? 'class="active"' : '' ?>>🎵 Музыкальная комната</a>
                    </div>
                </div>

                <a href="/profile" class="nav-link <?= $isProfile ? 'active' : '' ?>">Профиль</a>
                <a href="/friends" class="nav-link <?= $isFriends ? 'active' : '' ?>">Друзья</a>
                <a href="/ai" class="nav-link <?= $isAI ? 'active' : '' ?>">ИИ</a>
            </div>

            <div class="nav-right">
                <div class="avatar-dropdown">
                    <?php if (Auth::isLoggedIn()): ?>
                        <?php
                        $user = \App\Models\User::findById(Auth::getUserId());
                        $avatarUrl = $user['avatar_url'] ?? '/assets/images/default-avatar.png';
                        $fresh = !empty($user['last_seen']) && strtotime($user['last_seen']) >= (time() - 90);
                        $navPresence = (!$fresh || ($user['status'] ?? 'offline') === 'offline')
                            ? 'offline'
                            : (($user['status'] ?? '') === 'away' ? 'away' : (($user['status'] ?? '') === 'playing' ? 'playing' : 'online'));
                        ?>
                        <img src="<?= htmlspecialchars($avatarUrl) ?>" alt="Аватар" class="avatar-img" id="avatarImg">
                    <?php else: ?>
                        <img src="/assets/images/default-avatar.png" alt="Аватар" class="avatar-img" id="avatarImg">
                        <?php $navPresence = 'offline'; ?>
                    <?php endif; ?>
                    <span class="status-dot <?= htmlspecialchars($navPresence) ?>" title="<?= htmlspecialchars($navPresence) ?>"></span>
                    <div class="avatar-menu" id="avatarMenu">
                        <a href="/profile" class="avatar-menu-item">
                            <span class="menu-icon">👤</span>
                            <span class="menu-text">Мой профиль</span>
                        </a>
                        <a href="/profile/edit" class="avatar-menu-item">
                            <span class="menu-icon">✎</span>
                            <span class="menu-text">Редактировать профиль</span>
                        </a>
                        <a href="/friends" class="avatar-menu-item">
                            <span class="menu-icon">👥</span>
                            <span class="menu-text">Друзья</span>
                        </a>
                        <a href="/games" class="avatar-menu-item">
                            <span class="menu-icon">🎮</span>
                            <span class="menu-text">Библиотека игр</span>
                        </a>
                        <div class="menu-divider"></div>
                        <a href="/logout" class="avatar-menu-item logout-item">
                            <span class="menu-icon">🚪</span>
                            <span class="menu-text">Выйти из профиля</span>
                        </a>
                    </div>
                </div>
                <button class="theme-toggle" id="themeToggle">🌙</button>
            </div>

            <button class="burger" id="burgerBtn">☰</button>
        </nav>

        <div class="mobile-menu" id="mobileMenu">
            <a href="/games">📚 Библиотека</a>
            <a href="/chat">💬 Каналы</a>
            <a href="/gallery">🖼️ Галерея</a>
            <a href="/music">🎵 Музыкальная комната</a>
            <a href="/profile">👤 Профиль</a>
            <a href="/friends">👥 Друзья</a>
            <a href="/ai">🤖 ИИ</a>
            <hr>
            <a href="/logout" class="logout-link">🚪 Выйти</a>
        </div>
    </header>

    <main class="site-content">
        <?= $content ?? '' ?>
    </main>

    <?php if (Auth::isLoggedIn() && Auth::isAdmin()): ?>
        <?= Metrics::render() ?>
    <?php endif; ?>

    <footer class="site-footer">
        <p>© 2026 N-A-V-A</p>
    </footer>

    <?php
        $appJsFile = __DIR__ . '/../../public/assets/js/app.js';
        $appJsVersion = file_exists($appJsFile) ? (string)filemtime($appJsFile) : '1';
    ?>
    <script src="/assets/js/app.js?v=<?= $appJsVersion ?>"></script>
    <?php if (isset($page_js)): ?>
    <?php
        $pageJsFile = __DIR__ . '/../../public/assets/js/pages/' . $page_js . '.js';
        $pageJsVersion = file_exists($pageJsFile) ? (string)filemtime($pageJsFile) : '1';
    ?>
    <script src="/assets/js/pages/<?= htmlspecialchars($page_js) ?>.js?v=<?= $pageJsVersion ?>"></script>
    <?php if ($page_js === 'chat'): ?>
        <?php $mediaJsFile = __DIR__ . '/../../public/assets/js/pages/chat-media.js'; $mediaJsVersion = file_exists($mediaJsFile) ? (string)filemtime($mediaJsFile) : '1'; ?>
        <script src="/assets/js/pages/chat-media.js?v=<?= $mediaJsVersion ?>"></script>
    <?php endif; ?>
    <?php endif; ?>
</body>
</html>