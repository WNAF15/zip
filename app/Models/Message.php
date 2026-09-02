<?php

namespace App\Models;

use App\Core\Database;
use App\Models\MessageAttachment;

class Message
{
    public static function getMessages($chatId, $limit = 100)
    {
        $limit = max(1, min(100, (int)$limit));

        $sql = "SELECT m.id, m.chat_id, m.user_id, m.message, m.created_at, m.edited_at, m.deleted_at,
                       m.reply_to_message_id, m.reply_quote,
                       m.forwarded_message_id, m.forwarded_from_user_id, m.forwarded_hide_author,
                       u.nickname, u.avatar_url,
                       ru.nickname AS reply_nickname,
                       rm.message AS reply_message,
                       rm.edited_at AS reply_edited_at,
                       rm.deleted_at AS reply_deleted_at,
                       fu.nickname AS forwarded_nickname,
                       CASE WHEN cp.id IS NULL THEN 0 ELSE 1 END AS is_pinned
                FROM messages m
                JOIN users u ON m.user_id = u.id
                LEFT JOIN messages rm ON rm.id = m.reply_to_message_id
                LEFT JOIN users ru ON ru.id = rm.user_id
                LEFT JOIN users fu ON fu.id = m.forwarded_from_user_id
                LEFT JOIN chat_pins cp ON cp.chat_id = m.chat_id AND cp.message_id = m.id
                WHERE m.chat_id = ? AND m.deleted_at IS NULL
                ORDER BY m.id DESC
                LIMIT {$limit}";

        $stmt = Database::query($sql, [(int)$chatId]);
        $messages = $stmt ? $stmt->fetchAll() : [];
        return array_reverse($messages);
    }

    public static function send($chatId, $userId, $message, $replyToMessageId = null, $replyQuote = null)
    {
        Database::query(
            "INSERT INTO messages
             (chat_id, user_id, message, reply_to_message_id, reply_quote)
             VALUES (?, ?, ?, ?, ?)",
            [
                (int)$chatId,
                (int)$userId,
                $message,
                $replyToMessageId ? (int)$replyToMessageId : null,
                $replyQuote !== null && $replyQuote !== '' ? $replyQuote : null
            ]
        );

        $id = (int)Database::getPDO()->lastInsertId();
        Chat::touch($chatId);
        return $id;
    }

    public static function forward($chatId, $userId, $message, $sourceMessageId, $sourceAuthorId = null, $hideAuthor = false)
    {
        Database::query(
            "INSERT INTO messages
             (chat_id, user_id, message, forwarded_message_id, forwarded_from_user_id, forwarded_hide_author)
             VALUES (?, ?, ?, ?, ?, ?)",
            [
                (int)$chatId,
                (int)$userId,
                $message,
                $sourceMessageId ? (int)$sourceMessageId : null,
                $hideAuthor ? null : ($sourceAuthorId ? (int)$sourceAuthorId : null),
                $hideAuthor ? 1 : 0
            ]
        );

        $id = (int)Database::getPDO()->lastInsertId();
        Chat::touch($chatId);
        return $id;
    }

    public static function update($messageId, $newText, $chatId = 0)
    {
        $sql = "UPDATE messages
                SET message = ?, edited_at = NOW()
                WHERE id = ? AND deleted_at IS NULL";
        $params = [$newText, (int)$messageId];

        if ($chatId) {
            $sql .= " AND chat_id = ?";
            $params[] = (int)$chatId;
        }

        $stmt = Database::query($sql, $params);
        if ($stmt->rowCount() > 0 && $chatId) {
            Chat::touch($chatId);
        }
        return $stmt;
    }

    public static function delete($messageId, $chatId = 0, $deletedBy = 0)
    {
        $sql = "UPDATE messages
                SET deleted_at = NOW(), deleted_by = ?
                WHERE id = ? AND deleted_at IS NULL";
        $params = [$deletedBy ? (int)$deletedBy : null, (int)$messageId];

        if ($chatId) {
            $sql .= " AND chat_id = ?";
            $params[] = (int)$chatId;
        }

        $stmt = Database::query($sql, $params);
        if ($stmt->rowCount() <= 0) return false;

        try {
            MessageAttachment::releaseForMessage((int)$messageId);
        } catch (\Throwable $e) {
        }

        try {
            Database::query(
                "DELETE FROM chat_pins WHERE message_id = ?" . ($chatId ? " AND chat_id = ?" : ''),
                $chatId ? [(int)$messageId, (int)$chatId] : [(int)$messageId]
            );
        } catch (\Throwable $e) {
            // chat_pins may be absent on an old installation; deletion still succeeds.
        }

        $resolvedChatId = (int)$chatId;
        if (!$resolvedChatId) {
            $row = self::getByIdIncludingDeleted($messageId);
            $resolvedChatId = (int)($row['chat_id'] ?? 0);
        }
        if ($resolvedChatId) Chat::touch($resolvedChatId);

        return true;
    }

    public static function getById($messageId)
    {
        $stmt = Database::query(
            "SELECT m.*, u.nickname, u.avatar_url
             FROM messages m
             JOIN users u ON m.user_id = u.id
             WHERE m.id = ?
               AND m.deleted_at IS NULL
             LIMIT 1",
            [(int)$messageId]
        );
        return $stmt ? $stmt->fetch() : null;
    }

    public static function getByIdIncludingDeleted($messageId)
    {
        $stmt = Database::query(
            "SELECT m.*, u.nickname, u.avatar_url
             FROM messages m
             JOIN users u ON m.user_id = u.id
             WHERE m.id = ?
             LIMIT 1",
            [(int)$messageId]
        );
        return $stmt ? $stmt->fetch() : null;
    }

    public static function pin($chatId, $messageId, $userId)
    {
        $result = Database::query(
            "INSERT IGNORE INTO chat_pins (chat_id, message_id, pinned_by)
             SELECT ?, ?, ?
             WHERE EXISTS (
                 SELECT 1 FROM messages
                 WHERE id = ? AND chat_id = ? AND deleted_at IS NULL
             )",
            [(int)$chatId, (int)$messageId, (int)$userId, (int)$messageId, (int)$chatId]
        );

        if ($result->rowCount() > 0) Chat::touch($chatId);
        return $result;
    }

    public static function unpin($chatId, $messageId)
    {
        $result = Database::query(
            "DELETE FROM chat_pins WHERE chat_id = ? AND message_id = ?",
            [(int)$chatId, (int)$messageId]
        );
        if ($result->rowCount() > 0) Chat::touch($chatId);
        return $result;
    }

    public static function getPinned($chatId, $limit = 10)
    {
        $limit = max(1, min(20, (int)$limit));

        $stmt = Database::query(
            "SELECT cp.id AS pin_id, cp.created_at AS pinned_at,
                    m.id, m.chat_id, m.user_id, m.message, m.edited_at, m.created_at, m.deleted_at,
                    m.reply_to_message_id, m.reply_quote,
                    m.forwarded_message_id, m.forwarded_from_user_id, m.forwarded_hide_author,
                    u.nickname, u.avatar_url
             FROM chat_pins cp
             JOIN messages m ON m.id = cp.message_id
             JOIN users u ON u.id = m.user_id
             WHERE cp.chat_id = ? AND m.deleted_at IS NULL
             ORDER BY cp.id DESC
             LIMIT {$limit}",
            [(int)$chatId]
        );

        return $stmt ? $stmt->fetchAll() : [];
    }
}
