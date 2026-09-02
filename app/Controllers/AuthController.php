<?php

namespace App\Controllers;

use App\Core\Auth;
use App\Core\View;
use App\Models\User;

class AuthController
{
    public function showLogin()
    {
        if (Auth::isLoggedIn()) {
            header('Location: /');
            exit;
        }

        View::renderStandalone('auth/login', [
            'title' => 'Вход — N-A-V-A',
            'page_css' => 'login',
            'page_js' => 'login'
        ]);
    }

    public function login()
    {
        $login = trim((string)($_POST['login'] ?? ''));
        $password = (string)($_POST['password'] ?? '');

        if ($login === '' || $password === '') {
            $this->json(['success' => false, 'message' => 'Заполните все поля'], 400);
        }

        $user = User::findByEmail($login);
        if (!$user || !password_verify($password, $user['password_hash'])) {
            $this->json(['success' => false, 'message' => 'Неверный логин или пароль'], 401);
        }

        $_SESSION['pending_user_id'] = (int)$user['id'];

        $this->json([
            'success' => true,
            'user' => [
                'nickname' => $user['nickname'] ?? $user['email'],
                'avatar' => $user['avatar_url'] ?? '/assets/images/default-avatar.png',
                'login' => $user['email']
            ]
        ]);
    }

    public function confirm()
    {
        $pendingId = (int)($_SESSION['pending_user_id'] ?? 0);
        if (!$pendingId) {
            header('Location: /login');
            exit;
        }

        $user = User::findById($pendingId);
        unset($_SESSION['pending_user_id']);

        if (!$user) {
            header('Location: /login');
            exit;
        }

        Auth::login($user);
        header('Location: /');
        exit;
    }

    public function logout()
    {
        Auth::logout();
    }

    private function json(array $data, $status = 200)
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }
}
