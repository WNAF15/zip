<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Вход – N-A-V-A</title>
    
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;14..32,500;14..32,600;14..32,700&display=swap" rel="stylesheet">
    
    <link rel="stylesheet" href="/assets/css/main.css">
    <link rel="stylesheet" href="/assets/css/themes/light-theme.css" id="theme-style">
    <link rel="stylesheet" href="/assets/css/pages/login.css">
</head>
<body>
    <div class="sakura-container" id="sakuraContainer"></div>
    <div class="stars-container" id="starsContainer" style="display: none;"></div>

    <div class="login-wrapper">
        <div class="login-container">
            <div class="login-box step1" id="step1">
                <h1>N-A-V-A</h1>
                <form id="loginForm">
                    <input type="text" name="login" placeholder="Логин" required>
                    <input type="password" name="password" placeholder="Пароль" required>
                    <button type="submit">Войти</button>
                    <div class="error-message" id="errorMessage"></div>
                </form>
            </div>
            <div class="login-box step2" id="step2">
                <div class="user-info">
                    <img src="" alt="Аватар" id="avatar" class="avatar">
                    <div class="user-details">
                        <h2 id="username">Имя пользователя</h2>
                        <p id="userLogin">Логин: <span id="userLoginText">—</span></p>
                    </div>
                </div>
                <form action="/login/confirm" method="POST" id="confirmForm">
                    <button type="submit" class="confirm-btn">Войти на сайт</button>
                </form>
            </div>
        </div>
    </div>

    <script src="/assets/js/app.js"></script>
    <script src="/assets/js/pages/login.js"></script>
</body>
</html>