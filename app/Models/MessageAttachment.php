<?php

namespace App\Models;

use App\Core\Database;

class MessageAttachment
{
    public static function createUpload(array $data): int
    {
        Database::query(
            "INSERT INTO media_uploads
                (user_id, chat_id, kind, object_key, mime_type, client_size, sha256, original_name, status, expires_at, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', DATE_ADD(NOW(), INTERVAL 24 HOUR), NOW())",
            [
                (int)$data['user_id'], (int)$data['chat_id'], $data['kind'], $data['object_key'], $data['mime_type'],
                (int)$data['client_size'], $data['sha256'] ?: null, $data['original_name'] ?: 'file'
            ]
        );
        return (int)Database::getPDO()->lastInsertId();
    }

    public static function getPendingForUser(int $uploadId, int $userId): ?array
    {
        $stmt = Database::query(
            "SELECT * FROM media_uploads
             WHERE id = ? AND user_id = ? AND status = 'pending' AND expires_at > NOW() LIMIT 1",
            [$uploadId, $userId]
        );
        return $stmt ? ($stmt->fetch() ?: null) : null;
    }

    public static function markReady(int $uploadId, int $mediaObjectId): bool
    {
        $stmt = Database::query(
            "UPDATE media_uploads
             SET status = 'ready', media_object_id = ?, completed_at = NOW()
             WHERE id = ? AND status = 'pending'",
            [$mediaObjectId, $uploadId]
        );
        return $stmt->rowCount() > 0;
    }

    public static function getReadyForUser(array $uploadIds, int $userId, int $chatId): array
    {
        $ids = array_values(array_unique(array_filter(array_map('intval', $uploadIds), static fn($id) => $id > 0)));
        if (!$ids) return [];
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $params = array_merge($ids, [$userId, $chatId]);
        $stmt = Database::query(
            "SELECT mu.*, mo.storage_key, mo.size_bytes, mo.mime_type AS stored_mime_type, mo.sha256 AS stored_sha256,
                    mo.width, mo.height, mo.duration, mo.id AS media_object_id
             FROM media_uploads mu
             JOIN media_objects mo ON mo.id = mu.media_object_id AND mo.deleted_at IS NULL
             WHERE mu.id IN ($placeholders)
               AND mu.user_id = ? AND mu.chat_id = ? AND mu.status = 'ready'",
            $params
        );
        return $stmt ? $stmt->fetchAll() : [];
    }

    public static function attachToMessage(int $messageId, array $rows): void
    {
        $sort = 0;
        foreach ($rows as $row) {
            Database::query(
                "INSERT INTO message_media
                    (message_id, media_object_id, type, original_name, mime_type, size_bytes, sort_order, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, NOW())",
                [
                    $messageId, (int)$row['media_object_id'], $row['kind'], $row['original_name'] ?: 'file',
                    $row['stored_mime_type'] ?: $row['mime_type'], (int)$row['size_bytes'], $sort++
                ]
            );
            MediaObject::incrementRef((int)$row['media_object_id']);
        }
        if ($rows) {
            $ids = array_values(array_unique(array_map('intval', array_column($rows, 'id'))));
            if ($ids) {
                $ph = implode(',', array_fill(0, count($ids), '?'));
                Database::query("UPDATE media_uploads SET status = 'attached' WHERE id IN ($ph)", $ids);
            }
        }
    }

    public static function getForMessages(array $messageIds): array
    {
        $ids = array_values(array_unique(array_filter(array_map('intval', $messageIds), static fn($id) => $id > 0)));
        if (!$ids) return [];
        $ph = implode(',', array_fill(0, count($ids), '?'));
        try {
            $stmt = Database::query(
            "SELECT ma.id, ma.message_id, ma.media_object_id, ma.type, ma.original_name, ma.mime_type,
                    ma.size_bytes, mo.width, mo.height, mo.duration, mo.storage_key
             FROM message_media ma
             JOIN media_objects mo ON mo.id = ma.media_object_id
             WHERE ma.message_id IN ($ph) AND ma.deleted_at IS NULL
             ORDER BY ma.message_id ASC, ma.sort_order ASC",
            $ids
            );
            return $stmt ? $stmt->fetchAll() : [];
        } catch (\Throwable $e) {
            return [];
        }
    }

    public static function releaseForMessage(int $messageId): void
    {
        $stmt = Database::query(
            "SELECT media_object_id FROM message_media WHERE message_id = ? AND deleted_at IS NULL",
            [$messageId]
        );
        $rows = $stmt ? $stmt->fetchAll() : [];
        if (!$rows) return;
        Database::query(
            "UPDATE message_media SET deleted_at = NOW() WHERE message_id = ? AND deleted_at IS NULL",
            [$messageId]
        );
        foreach ($rows as $row) MediaObject::decrementRef((int)$row['media_object_id']);
    }

    public static function releaseForChat(int $chatId): void
    {
        $stmt = Database::query(
            "SELECT ma.media_object_id
             FROM message_media ma
             JOIN messages m ON m.id = ma.message_id
             WHERE m.chat_id = ? AND ma.deleted_at IS NULL",
            [$chatId]
        );
        $rows = $stmt ? $stmt->fetchAll() : [];
        if (!$rows) return;
        Database::query(
            "UPDATE message_media ma
             JOIN messages m ON m.id = ma.message_id
             SET ma.deleted_at = NOW()
             WHERE m.chat_id = ? AND ma.deleted_at IS NULL",
            [$chatId]
        );
        foreach ($rows as $row) MediaObject::decrementRef((int)$row['media_object_id']);
    }

    public static function getAccessibleReady(int $attachmentId, int $userId): ?array
    {
        $stmt = Database::query(
            "SELECT ma.*, mo.storage_key, mo.mime_type AS stored_mime_type
             FROM message_media ma
             JOIN messages m ON m.id = ma.message_id AND m.deleted_at IS NULL
             JOIN chat_members cm ON cm.chat_id = m.chat_id AND cm.user_id = ?
             JOIN media_objects mo ON mo.id = ma.media_object_id AND mo.deleted_at IS NULL
             WHERE ma.id = ? AND ma.deleted_at IS NULL LIMIT 1",
            [$userId, $attachmentId]
        );
        return $stmt ? ($stmt->fetch() ?: null) : null;
    }

    public static function getAccessibleReadyByStorageKey(string $storageKey, int $userId): ?array
    {
        $stmt = Database::query(
            "SELECT ma.*, mo.storage_key
             FROM message_media ma
             JOIN messages m ON m.id = ma.message_id AND m.deleted_at IS NULL
             JOIN chat_members cm ON cm.chat_id = m.chat_id AND cm.user_id = ?
             JOIN media_objects mo ON mo.id = ma.media_object_id AND mo.deleted_at IS NULL
             WHERE mo.storage_key = ? AND ma.deleted_at IS NULL
             LIMIT 1",
            [$userId, $storageKey]
        );
        return $stmt ? ($stmt->fetch() ?: null) : null;
    }

    public static function getAttachmentForUpload(int $uploadId, int $userId): ?array
    {
        $stmt = Database::query(
            "SELECT mu.*, mo.id AS media_object_id, mo.storage_key, mo.size_bytes, mo.mime_type AS stored_mime_type
             FROM media_uploads mu
             LEFT JOIN media_objects mo ON mo.id = mu.media_object_id
             WHERE mu.id = ? AND mu.user_id = ? LIMIT 1",
            [$uploadId, $userId]
        );
        return $stmt ? ($stmt->fetch() ?: null) : null;
    }

    public static function expirePending(int $limit = 100): array
    {
        $limit = max(1, min(500, $limit));
        $stmt = Database::query("SELECT * FROM media_uploads WHERE status = 'pending' AND expires_at <= NOW() LIMIT {$limit}");
        return $stmt ? $stmt->fetchAll() : [];
    }

    public static function markUploadDeleted(int $uploadId): void
    {
        Database::query("UPDATE media_uploads SET status = 'deleted', completed_at = NOW() WHERE id = ?", [$uploadId]);
    }
}
