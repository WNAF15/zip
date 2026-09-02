<?php

namespace App\Models;

use App\Core\Database;

class User
{
    private static function presenceSql()
    {
        return "CASE
                    WHEN status = 'offline'
                         OR last_seen IS NULL
                         OR last_seen < DATE_SUB(NOW(), INTERVAL 90 SECOND)
                        THEN 'offline'
                    WHEN status = 'playing' THEN 'playing'
                    WHEN status = 'away' THEN 'away'
                    ELSE 'online'
                END";
    }

    public static function findByEmail($login)
    {
        $stmt = Database::query(
            "SELECT * FROM users WHERE email = ? LIMIT 1",
            [$login]
        );
        return $stmt ? $stmt->fetch() : null;
    }

    public static function findById($id)
    {
        $stmt = Database::query(
            "SELECT * FROM users WHERE id = ? LIMIT 1",
            [(int)$id]
        );
        return $stmt ? $stmt->fetch() : null;
    }

    public static function updateProfile($userId, $data)
    {
        $allowed = [
            'nickname', 'status', 'bio', 'avatar_frame',
            'active_badge', 'playing_text', 'showcases', 'profile_background', 'avatar_url'
        ];

        $fields = [];
        $params = [];
        foreach ($data as $key => $value) {
            if (!in_array($key, $allowed, true)) continue;
            $fields[] = "{$key} = ?";
            $params[] = $value;
        }

        if (!$fields) return false;
        $params[] = (int)$userId;

        return Database::query(
            "UPDATE users SET " . implode(', ', $fields) . " WHERE id = ?",
            $params
        );
    }

    public static function addComment($userId, $authorId, $text)
    {
        return Database::query(
            "INSERT INTO profile_comments (user_id, author_id, text) VALUES (?, ?, ?)",
            [(int)$userId, (int)$authorId, $text]
        );
    }

    public static function getComments($userId, $limit = 100)
    {
        $limit = max(1, min(200, (int)$limit));
        $stmt = Database::query(
            "SELECT c.*, u.nickname, u.avatar_url
             FROM profile_comments c
             JOIN users u ON c.author_id = u.id
             WHERE c.user_id = ?
             ORDER BY c.id DESC
             LIMIT {$limit}",
            [(int)$userId]
        );
        return $stmt ? $stmt->fetchAll() : [];
    }

    public static function exists($login)
    {
        $stmt = Database::query("SELECT id FROM users WHERE email = ? LIMIT 1", [$login]);
        return $stmt ? $stmt->fetch() !== false : false;
    }

    public static function create($email, $passwordHash, $nickname, $isAdmin = 0)
    {
        return Database::query(
            "INSERT INTO users (email, password_hash, nickname, is_admin, status, theme, created_at, last_seen)
             VALUES (?, ?, ?, ?, 'online', 'light', NOW(), NOW())",
            [$email, $passwordHash, $nickname, (int)$isAdmin]
        );
    }

    public static function getAll()
    {
        $stmt = Database::query(
            "SELECT id, email, nickname, is_admin, status, last_seen, created_at
             FROM users ORDER BY created_at DESC"
        );
        return $stmt ? $stmt->fetchAll() : [];
    }

    public static function getAllUsers($excludeId = null, $limit = 200)
    {
        $limit = max(1, min(500, (int)$limit));
        $presence = self::presenceSql();

        $sql = "SELECT id, nickname, avatar_url, status, last_seen,
                       {$presence} AS presence_status
                FROM users";
        $params = [];

        if ($excludeId !== null) {
            $sql .= " WHERE id <> ?";
            $params[] = (int)$excludeId;
        }

        $sql .= " ORDER BY
                    (presence_status <> 'offline') DESC,
                    CASE presence_status
                        WHEN 'online' THEN 1
                        WHEN 'playing' THEN 2
                        WHEN 'away' THEN 3
                        ELSE 4
                    END,
                    nickname ASC
                  LIMIT {$limit}";

        $stmt = Database::query($sql, $params);
        return $stmt ? $stmt->fetchAll() : [];
    }

    public static function getOnlineUsers($excludeId = null, $limit = 50)
    {
        $limit = max(1, min(100, (int)$limit));
        $presence = self::presenceSql();

        $sql = "SELECT id, nickname, avatar_url, status, last_seen,
                       {$presence} AS presence_status
                FROM users
                WHERE status <> 'offline'
                  AND last_seen IS NOT NULL
                  AND last_seen >= DATE_SUB(NOW(), INTERVAL 90 SECOND)";
        $params = [];

        if ($excludeId !== null) {
            $sql .= " AND id <> ?";
            $params[] = (int)$excludeId;
        }

        $sql .= " ORDER BY last_seen DESC, nickname ASC LIMIT {$limit}";
        $stmt = Database::query($sql, $params);
        return $stmt ? $stmt->fetchAll() : [];
    }

    public static function delete($id)
    {
        return Database::query("DELETE FROM users WHERE id = ?", [(int)$id]);
    }

    public static function updateStatus($userId, $status)
    {
        $allowed = ['online', 'away', 'playing', 'offline'];
        $status = in_array($status, $allowed, true) ? $status : 'online';
        return Database::query("UPDATE users SET status = ?, last_seen = NOW() WHERE id = ?", [$status, (int)$userId]);
    }

    public static function updateLastSeen($userId)
    {
        return Database::query("UPDATE users SET last_seen = NOW() WHERE id = ?", [(int)$userId]);
    }

    public static function search($query, $excludeId = null, $limit = 10)
    {
        $limit = max(1, min(25, (int)$limit));
        $sql = "SELECT id, nickname, avatar_url, status, last_seen,
                       " . self::presenceSql() . " AS presence_status
                FROM users
                WHERE nickname LIKE ?";
        $params = ['%' . $query . '%'];

        if ($excludeId !== null) {
            $sql .= " AND id <> ?";
            $params[] = (int)$excludeId;
        }

        $sql .= " ORDER BY nickname ASC LIMIT {$limit}";
        $stmt = Database::query($sql, $params);
        return $stmt ? $stmt->fetchAll() : [];
    }

    public static function getWithStats($id)
    {
        $stmt = Database::query(
            "SELECT u.*,
                    (SELECT COUNT(*) FROM user_games WHERE user_id = u.id) AS total_games,
                    (SELECT COUNT(*) FROM user_achievements WHERE user_id = u.id) AS total_achievements,
                    (SELECT COUNT(*) FROM profile_comments WHERE user_id = u.id) AS total_comments
             FROM users u
             WHERE u.id = ?
             LIMIT 1",
            [(int)$id]
        );
        return $stmt ? $stmt->fetch() : null;
    }

    public static function getFriends($userId)
    {
        return self::getAllUsers($userId);
    }

    public static function getTotalCount()
    {
        $stmt = Database::query("SELECT COUNT(*) AS total FROM users");
        $result = $stmt ? $stmt->fetch() : null;
        return $result ? (int)$result['total'] : 0;
    }

    public static function getOnlineCount()
    {
        $stmt = Database::query(
            "SELECT COUNT(*) AS total
             FROM users
             WHERE status <> 'offline'
               AND last_seen IS NOT NULL
               AND last_seen >= DATE_SUB(NOW(), INTERVAL 90 SECOND)"
        );
        $result = $stmt ? $stmt->fetch() : null;
        return $result ? (int)$result['total'] : 0;
    }
}
