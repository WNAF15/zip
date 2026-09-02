<?php

namespace App\Models;

use App\Core\Database;
use Throwable;

class MediaObject
{
    public static function findByHash(?string $sha256): ?array
    {
        $sha256 = $sha256 !== null ? trim(strtolower($sha256)) : '';
        if ($sha256 === '' || !preg_match('/^[a-f0-9]{64}$/', $sha256)) return null;
        $stmt = Database::query(
            "SELECT * FROM media_objects WHERE sha256 = ? AND deleted_at IS NULL LIMIT 1",
            [$sha256]
        );
        return $stmt ? ($stmt->fetch() ?: null) : null;
    }

    public static function createIfAbsent(array $data): array
    {
        $sha256 = isset($data['sha256']) && $data['sha256'] !== null
            ? trim(strtolower((string)$data['sha256']))
            : '';
        if ($sha256 !== '' && !preg_match('/^[a-f0-9]{64}$/', $sha256)) {
            throw new \InvalidArgumentException('Некорректный SHA-256.');
        }
        $ownerId = (int)($data['owner_id'] ?? 0);
        $storageKey = trim((string)($data['storage_key'] ?? ''));
        $mimeType = trim((string)($data['mime_type'] ?? 'application/octet-stream'));
        $sizeBytes = (int)($data['size_bytes'] ?? 0);
        if ($ownerId <= 0 || $storageKey === '' || $sizeBytes <= 0) {
            throw new \InvalidArgumentException('Недостаточно данных о медиафайле.');
        }

        // No hash is a valid state for large local/S3 uploads. Never pass null
        // to a strictly typed hash lookup.
        if ($sha256 !== '') {
            $existing = self::findByHash($sha256);
            if ($existing) return ['object' => $existing, 'created' => false];
        }

        $pdo = Database::getPDO();
        if (!$pdo) throw new \RuntimeException('Database is not initialized.');
        $startedTransaction = !$pdo->inTransaction();
        if ($startedTransaction) $pdo->beginTransaction();
        try {
            if ($sha256 !== '') {
                $existing = self::findByHash($sha256);
                if ($existing) {
                    if ($startedTransaction && $pdo->inTransaction()) $pdo->commit();
                    return ['object' => $existing, 'created' => false];
                }
            }

            // Make quota rows exist before locking them. This removes a race/empty-row case.
            Database::query(
                "INSERT INTO storage_global (id, bytes_used, updated_at) VALUES (1, 0, NOW()) ON DUPLICATE KEY UPDATE id = id",
                []
            );
            Database::query(
                "INSERT INTO storage_user_usage (user_id, bytes_used, updated_at) VALUES (?, 0, NOW()) ON DUPLICATE KEY UPDATE user_id = user_id",
                [$ownerId]
            );

            $usageRow = Database::query("SELECT bytes_used FROM storage_global WHERE id = 1 FOR UPDATE")->fetch();
            $userUsageRow = Database::query(
                "SELECT bytes_used FROM storage_user_usage WHERE user_id = ? FOR UPDATE",
                [$ownerId]
            )->fetch();
            $config = require __DIR__ . '/../Config/storage.php';
            if ((int)($usageRow['bytes_used'] ?? 0) + $sizeBytes > (int)$config['global_quota_bytes']) {
                throw new \RuntimeException('Общее хранилище N-A-V-A заполнено.');
            }
            if ((int)($userUsageRow['bytes_used'] ?? 0) + $sizeBytes > (int)$config['user_quota_bytes']) {
                throw new \RuntimeException('Лимит хранилища пользователя превышен.');
            }

            Database::query(
                "INSERT INTO media_objects
                    (sha256, owner_id, storage_key, mime_type, size_bytes, width, height, duration, ref_count, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NOW())",
                [
                    $sha256 !== '' ? $sha256 : null, $ownerId, $storageKey, $mimeType, $sizeBytes,
                    $data['width'] ?? null, $data['height'] ?? null, $data['duration'] ?? null
                ]
            );
            $id = (int)$pdo->lastInsertId();

            Database::query(
                "UPDATE storage_global SET bytes_used = bytes_used + ?, updated_at = NOW() WHERE id = 1",
                [$sizeBytes]
            );
            Database::query(
                "UPDATE storage_user_usage SET bytes_used = bytes_used + ?, updated_at = NOW() WHERE user_id = ?",
                [$sizeBytes, $ownerId]
            );

            if ($startedTransaction && $pdo->inTransaction()) $pdo->commit();
            $object = Database::query("SELECT * FROM media_objects WHERE id = ?", [$id])->fetch();
            return ['object' => $object, 'created' => true];
        } catch (Throwable $e) {
            if ($startedTransaction && $pdo->inTransaction()) $pdo->rollBack();
            // A duplicate SHA can happen under concurrent uploads. Recover by returning the winner.
            if ((string)$e->getCode() === '23000' && $sha256 !== '') {
                $existing = self::findByHash($sha256);
                if ($existing) return ['object' => $existing, 'created' => false];
            }
            throw $e;
        }
    }

    public static function incrementRef(int $mediaObjectId): void
    {
        Database::query("UPDATE media_objects SET ref_count = ref_count + 1 WHERE id = ?", [$mediaObjectId]);
    }

    public static function decrementRef(int $mediaObjectId): void
    {
        Database::query(
            "UPDATE media_objects SET ref_count = GREATEST(0, ref_count - 1),
                    delete_after = CASE WHEN ref_count <= 1 THEN DATE_ADD(NOW(), INTERVAL 30 DAY) ELSE delete_after END
             WHERE id = ?",
            [$mediaObjectId]
        );
    }

    public static function getById(int $id): ?array
    {
        $stmt = Database::query("SELECT * FROM media_objects WHERE id = ? LIMIT 1", [$id]);
        return $stmt ? ($stmt->fetch() ?: null) : null;
    }

    public static function releaseExpired(): array
    {
        $stmt = Database::query(
            "SELECT * FROM media_objects WHERE ref_count = 0 AND delete_after IS NOT NULL AND delete_after <= NOW() LIMIT 100"
        );
        return $stmt ? $stmt->fetchAll() : [];
    }

    public static function purge(int $id): bool
    {
        $pdo = Database::getPDO();
        if (!$pdo || $pdo->inTransaction()) return false;
        $pdo->beginTransaction();
        try {
            $row = self::getById($id);
            if (!$row || (int)$row['ref_count'] > 0) {
                $pdo->rollBack();
                return false;
            }
            Database::query("DELETE FROM media_objects WHERE id = ?", [$id]);
            Database::query("UPDATE storage_global SET bytes_used = GREATEST(0, bytes_used - ?), updated_at = NOW() WHERE id = 1", [(int)$row['size_bytes']]);
            Database::query("UPDATE storage_user_usage SET bytes_used = GREATEST(0, bytes_used - ?), updated_at = NOW() WHERE user_id = ?", [(int)$row['size_bytes'], (int)$row['owner_id']]);
            $pdo->commit();
            return true;
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            return false;
        }
    }

    public static function usage(int $userId): array
    {
        $global = Database::query("SELECT bytes_used FROM storage_global WHERE id = 1")->fetch();
        $user = Database::query("SELECT bytes_used FROM storage_user_usage WHERE user_id = ?", [$userId])->fetch();
        $config = require __DIR__ . '/../Config/storage.php';
        return [
            'user_bytes' => (int)($user['bytes_used'] ?? 0),
            'user_limit' => (int)$config['user_quota_bytes'],
            'global_bytes' => (int)($global['bytes_used'] ?? 0),
            'global_limit' => (int)$config['global_quota_bytes'],
        ];
    }
}
