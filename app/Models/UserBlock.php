<?php

namespace App\Models;

use App\Core\Database;

class UserBlock
{
    public static function isBlocked($blockerId, $blockedId)
    {
        if (!$blockerId || !$blockedId || (int)$blockerId === (int)$blockedId) return false;
        $stmt = Database::query("SELECT id FROM user_blocks WHERE blocker_id = ? AND blocked_id = ? LIMIT 1", [$blockerId, $blockedId]);
        return $stmt ? $stmt->fetch() !== false : false;
    }

    public static function eitherBlocked($userA, $userB)
    {
        return self::isBlocked($userA, $userB) || self::isBlocked($userB, $userA);
    }

    public static function block($blockerId, $blockedId)
    {
        return Database::query("INSERT IGNORE INTO user_blocks (blocker_id, blocked_id, created_at) VALUES (?, ?, NOW())", [$blockerId, $blockedId]);
    }

    public static function unblock($blockerId, $blockedId)
    {
        return Database::query("DELETE FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?", [$blockerId, $blockedId]);
    }
}
