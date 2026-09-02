<?php

namespace App\Core;

class Auth
{
    private static $sessionConfigured = false;

    public static function init()
    {
        if (session_status() === PHP_SESSION_NONE) {
            self::configureSession();
            session_start();
        }

        if (self::isLoggedIn() && Database::getPDO()) {
            self::heartbeat();
        }
    }

    private static function configureSession()
    {
        if (self::$sessionConfigured) return;
        self::$sessionConfigured = true;

        $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
            || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');

        session_set_cookie_params([
            'lifetime' => 0,
            'path' => '/',
            'secure' => $secure,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
    }

    public static function login($user)
    {
        if (session_status() === PHP_SESSION_NONE) {
            self::configureSession();
            session_start();
        }

        session_regenerate_id(true);
        $_SESSION['user_id'] = (int)$user['id'];
        $_SESSION['is_admin'] = (int)($user['is_admin'] ?? 0);
        $_SESSION['last_activity'] = time();
        $_SESSION['last_presence_ping'] = 0;

        Database::query(
            "UPDATE users SET last_seen = NOW(), status = CASE WHEN status = 'offline' THEN 'online' ELSE status END WHERE id = ?",
            [(int)$user['id']]
        );
    }

    public static function logout()
    {
        $userId = self::getUserId();
        if ($userId && Database::getPDO()) {
            Database::query("UPDATE users SET last_seen = NOW(), status = 'offline' WHERE id = ?", [$userId]);
        }

        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'] ?? '', $params['secure'], $params['httponly']);
        }
        if (session_status() !== PHP_SESSION_NONE) session_destroy();

        header('Location: /login');
        exit;
    }

    public static function isLoggedIn()
    {
        if (session_status() === PHP_SESSION_NONE) {
            self::configureSession();
            session_start();
        }
        return isset($_SESSION['user_id']);
    }

    public static function isAdmin()
    {
        if (session_status() === PHP_SESSION_NONE) {
            self::configureSession();
            session_start();
        }
        return !empty($_SESSION['is_admin']);
    }

    public static function getUserId()
    {
        if (session_status() === PHP_SESSION_NONE) {
            self::configureSession();
            session_start();
        }
        return isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : null;
    }

    public static function heartbeat($force = false)
    {
        $userId = self::getUserId();
        if (!$userId || !Database::getPDO()) return;

        $now = time();
        $lastPing = (int)($_SESSION['last_presence_ping'] ?? 0);
        if (!$force && ($now - $lastPing) < 20) return;

        // Online state is derived from last_seen + the user's selected state.
        // We do not mark users offline on beforeunload because one person may have multiple tabs.
        Database::query(
            "UPDATE users
             SET last_seen = NOW()
             WHERE id = ?
               AND (last_seen IS NULL OR last_seen < NOW() - INTERVAL 20 SECOND)",
            [$userId]
        );

        $_SESSION['last_presence_ping'] = $now;
        $_SESSION['last_activity'] = $now;
    }
}
