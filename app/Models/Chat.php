<?php

namespace App\Models;

use App\Core\Database;
use App\Models\MessageAttachment;

class Chat
{
    public static function getGeneralChat()
    {
        static $localId = null;
        if ($localId !== null) return $localId;

        $cacheKey = 'nava.chat.general_id';
        if (function_exists('apcu_enabled') && apcu_enabled()) {
            $cached = apcu_fetch($cacheKey);
            if (is_numeric($cached) && (int)$cached > 0) {
                $localId = (int)$cached;
                return $localId;
            }
        }

        $stmt = Database::query(
            "SELECT id FROM chats WHERE type = 'general' ORDER BY id ASC LIMIT 1"
        );
        $chat = $stmt ? $stmt->fetch() : null;

        if ($chat) {
            $localId = (int)$chat['id'];
        } else {
            Database::query(
                "INSERT INTO chats (type, name) VALUES ('general', 'Общий чат')"
            );
            $localId = (int)Database::getPDO()->lastInsertId();
            self::ensureRevision($localId);
        }

        if (function_exists('apcu_enabled') && apcu_enabled()) {
            apcu_store($cacheKey, $localId, 3600);
        }
        return $localId;
    }

    public static function getUserChats($userId)
    {
        $sql = "SELECT c.*,
                       s.pinned_at,
                       s.muted_until,
                       s.updated_at AS settings_updated_at,
                       CASE WHEN s.pinned_at IS NULL THEN 0 ELSE 1 END AS is_pinned_chat,
                       CASE WHEN s.muted_until IS NULL OR s.muted_until <= NOW() THEN 0 ELSE 1 END AS is_muted,
                       lm.message AS last_message,
                       lm.created_at AS last_message_time,
                       mc.member_count,
                       u2.id AS other_user_id,
                       u2.nickname AS other_nickname,
                       u2.avatar_url AS other_avatar,
                       u2.status AS other_status,
                       u2.last_seen AS other_last_seen,
                       CASE
                         WHEN u2.id IS NULL OR u2.status = 'offline' OR u2.last_seen IS NULL
                              OR u2.last_seen < DATE_SUB(NOW(), INTERVAL 90 SECOND)
                           THEN 'offline'
                         WHEN u2.status = 'playing' THEN 'playing'
                         WHEN u2.status = 'away' THEN 'away'
                         ELSE 'online'
                       END AS other_presence_status,
                       CASE WHEN ub.id IS NULL THEN 0 ELSE 1 END AS other_blocked_by_me,
                       CASE WHEN ub2.id IS NULL THEN 0 ELSE 1 END AS other_blocked_me
                FROM chats c
                JOIN chat_members cm
                  ON c.id = cm.chat_id AND cm.user_id = ?
                LEFT JOIN chat_user_settings s
                  ON s.chat_id = c.id AND s.user_id = ?
                LEFT JOIN (
                    SELECT m.chat_id, m.message, m.created_at
                    FROM messages m
                    INNER JOIN (
                        SELECT chat_id, MAX(id) AS max_id
                        FROM messages
                        WHERE deleted_at IS NULL
                        GROUP BY chat_id
                    ) x ON x.chat_id = m.chat_id AND x.max_id = m.id
                ) lm ON lm.chat_id = c.id
                LEFT JOIN (
                    SELECT chat_id, COUNT(*) AS member_count
                    FROM chat_members
                    GROUP BY chat_id
                ) mc ON mc.chat_id = c.id
                LEFT JOIN chat_members cm2
                  ON cm2.chat_id = c.id AND cm2.user_id <> ? AND c.type = 'private'
                LEFT JOIN users u2 ON u2.id = cm2.user_id
                LEFT JOIN user_blocks ub
                  ON ub.blocker_id = ? AND ub.blocked_id = u2.id
                LEFT JOIN user_blocks ub2
                  ON ub2.blocker_id = u2.id AND ub2.blocked_id = ?
                WHERE s.deleted_at IS NULL
                ORDER BY
                    (c.type = 'general') DESC,
                    (s.pinned_at IS NULL) ASC,
                    s.pinned_at ASC,
                    lm.created_at IS NULL ASC,
                    lm.created_at DESC,
                    c.id DESC";

        $stmt = Database::query(
            $sql,
            [(int)$userId, (int)$userId, (int)$userId, (int)$userId, (int)$userId]
        );
        return $stmt ? $stmt->fetchAll() : [];
    }

    public static function getSidebarState($userId)
    {
        $stmt = Database::query(
            "SELECT
                COUNT(*) AS chat_count,
                DATE_FORMAT(MAX(GREATEST(
                    COALESCE(cr.updated_at, '1970-01-01 00:00:00'),
                    COALESCE(s.updated_at, '1970-01-01 00:00:00')
                )), '%Y-%m-%d %H:%i:%s') AS changed_at,
                SUM(CASE
                    WHEN s.muted_until IS NOT NULL AND s.muted_until > NOW() THEN 1
                    ELSE 0
                END) AS active_mutes
             FROM chat_members cm
             JOIN chats c ON c.id = cm.chat_id
             LEFT JOIN chat_user_settings s
               ON s.chat_id = c.id AND s.user_id = cm.user_id
             LEFT JOIN chat_revisions cr
               ON cr.chat_id = c.id
             WHERE cm.user_id = ?
               AND s.deleted_at IS NULL",
            [(int)$userId]
        );
        $row = $stmt ? $stmt->fetch() : null;

        return [
            'count' => (int)($row['chat_count'] ?? 0),
            'stamp' => (string)($row['changed_at'] ?? '') . ':' . (int)($row['active_mutes'] ?? 0),
        ];
    }

    public static function getById($chatId)
    {
        $stmt = Database::query(
            "SELECT c.*, mc.member_count
             FROM chats c
             LEFT JOIN (
                 SELECT chat_id, COUNT(*) AS member_count
                 FROM chat_members
                 GROUP BY chat_id
             ) mc ON mc.chat_id = c.id
             WHERE c.id = ?
             LIMIT 1",
            [(int)$chatId]
        );
        return $stmt ? $stmt->fetch() : null;
    }

    public static function getMembers($chatId)
    {
        $stmt = Database::query(
            "SELECT u.id, u.nickname, u.avatar_url, u.status, u.last_seen,
                    CASE
                        WHEN u.status = 'offline' OR u.last_seen IS NULL
                             OR u.last_seen < DATE_SUB(NOW(), INTERVAL 90 SECOND) THEN 'offline'
                        WHEN u.status = 'playing' THEN 'playing'
                        WHEN u.status = 'away' THEN 'away'
                        ELSE 'online'
                    END AS presence_status
             FROM chat_members cm
             JOIN users u ON cm.user_id = u.id
             WHERE cm.chat_id = ?
             ORDER BY
                (presence_status <> 'offline') DESC,
                presence_status ASC,
                u.nickname ASC",
            [(int)$chatId]
        );
        return $stmt ? $stmt->fetchAll() : [];
    }

    public static function getOnlineMembers($chatId)
    {
        $stmt = Database::query(
            "SELECT u.id, u.nickname, u.avatar_url, u.status,
                    CASE
                        WHEN u.status = 'playing' THEN 'playing'
                        WHEN u.status = 'away' THEN 'away'
                        ELSE 'online'
                    END AS presence_status
             FROM chat_members cm
             JOIN users u ON cm.user_id = u.id
             WHERE cm.chat_id = ?
               AND u.status <> 'offline'
               AND u.last_seen IS NOT NULL
               AND u.last_seen >= DATE_SUB(NOW(), INTERVAL 90 SECOND)
             ORDER BY u.nickname ASC",
            [(int)$chatId]
        );
        return $stmt ? $stmt->fetchAll() : [];
    }

    public static function isMember($chatId, $userId)
    {
        $stmt = Database::query(
            "SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ? LIMIT 1",
            [(int)$chatId, (int)$userId]
        );
        return $stmt ? $stmt->fetch() !== false : false;
    }

    public static function addMember($chatId, $userId)
    {
        return Database::query(
            "INSERT IGNORE INTO chat_members (chat_id, user_id) VALUES (?, ?)",
            [(int)$chatId, (int)$userId]
        );
    }

    public static function addMembers($chatId, array $userIds)
    {
        $userIds = array_values(array_unique(array_map('intval', $userIds)));
        $userIds = array_values(array_filter($userIds, static fn($id) => $id > 0));
        if (!$userIds) return false;

        $values = [];
        $params = [];
        foreach ($userIds as $userId) {
            $values[] = '(?, ?)';
            $params[] = (int)$chatId;
            $params[] = $userId;
        }

        return Database::query(
            "INSERT IGNORE INTO chat_members (chat_id, user_id) VALUES " . implode(', ', $values),
            $params
        );
    }

    public static function createPrivateChat($user1Id, $user2Id)
    {
        $stmt = Database::query(
            "SELECT c.id
             FROM chats c
             JOIN chat_members cm1 ON c.id = cm1.chat_id AND cm1.user_id = ?
             JOIN chat_members cm2 ON c.id = cm2.chat_id AND cm2.user_id = ?
             WHERE c.type = 'private'
             GROUP BY c.id
             HAVING COUNT(*) = 2
             LIMIT 1",
            [(int)$user1Id, (int)$user2Id]
        );
        $existing = $stmt ? $stmt->fetch() : null;

        if ($existing) {
            $chatId = (int)$existing['id'];
            Database::query(
                "INSERT IGNORE INTO chat_user_settings (chat_id, user_id)
                 VALUES (?, ?), (?, ?)",
                [$chatId, (int)$user1Id, $chatId, (int)$user2Id]
            );
            Database::query(
                "UPDATE chat_user_settings
                 SET deleted_at = NULL, updated_at = NOW()
                 WHERE chat_id = ? AND user_id IN (?, ?)",
                [$chatId, (int)$user1Id, (int)$user2Id]
            );
            self::ensureRevision($chatId);
            return $chatId;
        }

        Database::query(
            "INSERT INTO chats (type, created_by) VALUES ('private', ?)",
            [(int)$user1Id]
        );
        $chatId = (int)Database::getPDO()->lastInsertId();
        self::addMembers($chatId, [$user1Id, $user2Id]);

        Database::query(
            "INSERT IGNORE INTO chat_user_settings (chat_id, user_id)
             VALUES (?, ?), (?, ?)",
            [$chatId, (int)$user1Id, $chatId, (int)$user2Id]
        );

        self::ensureRevision($chatId);
        return $chatId;
    }

    public static function createGroup($creatorId, $name, array $memberIds)
    {
        $name = trim($name);
        if ($name === '') throw new \InvalidArgumentException('Введите название группы.');
        if (mb_strlen($name) > 80) $name = mb_substr($name, 0, 80);

        Database::query(
            "INSERT INTO chats (type, name, created_by) VALUES ('group', ?, ?)",
            [$name, (int)$creatorId]
        );
        $chatId = (int)Database::getPDO()->lastInsertId();

        $memberIds[] = (int)$creatorId;
        self::addMembers($chatId, $memberIds);

        $uniqueMembers = array_values(array_unique(array_map('intval', $memberIds)));
        if ($uniqueMembers) {
            $values = [];
            $params = [];
            foreach ($uniqueMembers as $memberId) {
                if ($memberId <= 0) continue;
                $values[] = '(?, ?)';
                $params[] = $chatId;
                $params[] = $memberId;
            }
            if ($values) {
                Database::query(
                    "INSERT IGNORE INTO chat_user_settings (chat_id, user_id) VALUES " . implode(', ', $values),
                    $params
                );
            }
        }

        self::ensureRevision($chatId);
        return $chatId;
    }

    public static function getSettings($chatId, $userId)
    {
        $stmt = Database::query(
            "SELECT * FROM chat_user_settings WHERE chat_id = ? AND user_id = ? LIMIT 1",
            [(int)$chatId, (int)$userId]
        );
        return $stmt ? ($stmt->fetch() ?: null) : null;
    }

    public static function ensureSettings($chatId, $userId)
    {
        return Database::query(
            "INSERT IGNORE INTO chat_user_settings (chat_id, user_id) VALUES (?, ?)",
            [(int)$chatId, (int)$userId]
        );
    }

    public static function setPinned($chatId, $userId, $pinned)
    {
        if ($pinned) {
            return Database::query(
                "INSERT INTO chat_user_settings (chat_id, user_id, pinned_at, updated_at, deleted_at)
                 VALUES (?, ?, NOW(), NOW(), NULL)
                 ON DUPLICATE KEY UPDATE
                    pinned_at = COALESCE(pinned_at, NOW()),
                    updated_at = NOW(),
                    deleted_at = NULL",
                [(int)$chatId, (int)$userId]
            );
        }

        return Database::query(
            "UPDATE chat_user_settings
             SET pinned_at = NULL, updated_at = NOW()
             WHERE chat_id = ? AND user_id = ?",
            [(int)$chatId, (int)$userId]
        );
    }

    public static function setMute($chatId, $userId, $until)
    {
        return Database::query(
            "INSERT INTO chat_user_settings (chat_id, user_id, muted_until, updated_at, deleted_at)
             VALUES (?, ?, ?, NOW(), NULL)
             ON DUPLICATE KEY UPDATE
                muted_until = VALUES(muted_until),
                updated_at = NOW(),
                deleted_at = NULL",
            [(int)$chatId, (int)$userId, $until]
        );
    }

    public static function markDeletedForUser($chatId, $userId)
    {
        return Database::query(
            "INSERT INTO chat_user_settings (chat_id, user_id, deleted_at, pinned_at, updated_at)
             VALUES (?, ?, NOW(), NULL, NOW())
             ON DUPLICATE KEY UPDATE
                deleted_at = NOW(),
                pinned_at = NULL,
                updated_at = NOW()",
            [(int)$chatId, (int)$userId]
        );
    }

    public static function touch($chatId)
    {
        $result = Database::query(
            "UPDATE chat_revisions
             SET version = version + 1, updated_at = NOW()
             WHERE chat_id = ?",
            [(int)$chatId]
        );

        if ($result->rowCount() === 0) {
            self::ensureRevision($chatId);
        }
    }

    public static function ensureRevision($chatId)
    {
        return Database::query(
            "INSERT IGNORE INTO chat_revisions (chat_id, version, updated_at) VALUES (?, 1, NOW())",
            [(int)$chatId]
        );
    }

    public static function getRevision($chatId)
    {
        $stmt = Database::query(
            "SELECT version FROM chat_revisions WHERE chat_id = ? LIMIT 1",
            [(int)$chatId]
        );
        return $stmt ? (int)$stmt->fetchColumn() : 0;
    }

    public static function getMemberRevision($chatId, $userId)
    {
        $stmt = Database::query(
            "SELECT COALESCE(cr.version, 0) AS version, c.type
             FROM chat_members cm
             JOIN chats c ON c.id = cm.chat_id
             LEFT JOIN chat_revisions cr ON cr.chat_id = c.id
             WHERE cm.chat_id = ? AND cm.user_id = ?
             LIMIT 1",
            [(int)$chatId, (int)$userId]
        );
        $row = $stmt ? $stmt->fetch() : null;
        return $row ? ['version' => (int)$row['version'], 'type' => $row['type']] : null;
    }

    public static function getOtherPrivateUserId($chatId, $currentUserId)
    {
        $stmt = Database::query(
            "SELECT user_id
             FROM chat_members
             WHERE chat_id = ? AND user_id <> ?
             LIMIT 1",
            [(int)$chatId, (int)$currentUserId]
        );
        $row = $stmt ? $stmt->fetch() : null;
        return $row ? (int)$row['user_id'] : 0;
    }

    public static function deleteWholeChat($chatId)
    {
        $pdo = Database::getPDO();
        if (!$pdo) return false;

        try {
            $pdo->beginTransaction();

            Database::query("DELETE FROM chat_user_settings WHERE chat_id = ?", [(int)$chatId]);
            Database::query("DELETE FROM chat_typing WHERE chat_id = ?", [(int)$chatId]);
            MessageAttachment::releaseForChat((int)$chatId);
            Database::query("DELETE FROM chat_pins WHERE chat_id = ?", [(int)$chatId]);
            Database::query("DELETE FROM chat_revisions WHERE chat_id = ?", [(int)$chatId]);
            Database::query("DELETE FROM messages WHERE chat_id = ?", [(int)$chatId]);
            Database::query("DELETE FROM chat_members WHERE chat_id = ?", [(int)$chatId]);
            $stmt = Database::query("DELETE FROM chats WHERE id = ?", [(int)$chatId]);

            $pdo->commit();
            return $stmt->rowCount() > 0;
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            error_log('NAVA delete chat error: ' . $e->getMessage());
            return false;
        }
    }

    public static function leaveGroup($chatId, $userId)
    {
        $stmt = Database::query(
            "DELETE FROM chat_members WHERE chat_id = ? AND user_id = ?",
            [(int)$chatId, (int)$userId]
        );
        Database::query(
            "DELETE FROM chat_user_settings WHERE chat_id = ? AND user_id = ?",
            [(int)$chatId, (int)$userId]
        );
        return $stmt->rowCount() > 0;
    }
}
