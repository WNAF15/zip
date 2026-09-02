<?php

namespace App\Controllers;

use App\Core\Auth;
use App\Models\Chat;
use App\Models\MediaObject;
use App\Models\MessageAttachment;
use App\Services\Storage;
use App\Storage\LocalStorage;
use Throwable;

class StorageController
{
    private function json(array $data, int $status = 200): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    private function auth(): int
    {
        if (!Auth::isLoggedIn()) $this->json(['error' => 'Unauthorized'], 401);
        return (int)Auth::getUserId();
    }

    private function storageConfig(): array
    {
        return require __DIR__ . '/../Config/storage.php';
    }

    private function limits(): array
    {
        $c = require __DIR__ . '/../Config/storage.php';
        return [
            'photo' => (int)$c['max_photo_bytes'],
            'video' => (int)$c['max_video_bytes'],
            'voice' => (int)$c['max_voice_bytes'],
            'video_note' => (int)$c['max_video_note_bytes'],
        ];
    }

    private function validateMime(string $mime, string $type): bool
    {
        $allowed = [
            'photo' => ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
            'video' => ['video/mp4', 'video/webm', 'video/quicktime'],
            'voice' => ['audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4'],
            'video_note' => ['video/mp4', 'video/webm', 'video/quicktime'],
        ];
        return isset($allowed[$type]) && in_array(strtolower($mime), $allowed[$type], true);
    }

    public function health(): void
    {
        $userId = $this->auth();
        if (!Auth::isAdmin()) $this->json(['error' => 'Access denied'], 403);
        try { $this->json(array_merge(Storage::disk()->health(), ['usage' => MediaObject::usage($userId)])); }
        catch (Throwable $e) { $this->json(['ok' => false, 'error' => 'Storage check failed'], 500); }
    }

    public function usage(): void
    {
        $userId = $this->auth();
        $this->json(['success' => true, 'usage' => MediaObject::usage($userId)]);
    }

    public function presign(): void
    {
        $userId = $this->auth();
        $chatId = (int)($_POST['chat_id'] ?? 0);
        $type = trim((string)($_POST['type'] ?? ''));
        $mime = strtolower(trim((string)($_POST['mime_type'] ?? '')));
        $size = (int)($_POST['size'] ?? 0);
        $sha256 = strtolower(trim((string)($_POST['sha256'] ?? '')));
        $originalName = trim((string)($_POST['name'] ?? 'file'));

        if (!$chatId || !Chat::isMember($chatId, $userId)) $this->json(['error' => 'Access denied'], 403);
        if (!array_key_exists($type, $this->limits())) $this->json(['error' => 'Unsupported attachment type'], 400);
        if (!$this->validateMime($mime, $type)) $this->json(['error' => 'Недопустимый тип файла'], 400);
        $limit = $this->limits()[$type];
        if ($size <= 0 || $size > $limit) $this->json(['error' => 'Файл превышает допустимый размер'], 400);
        if ($sha256 !== '' && !preg_match('/^[a-f0-9]{64}$/', $sha256)) $this->json(['error' => 'Invalid SHA-256'], 400);

        $uploadId = 0;
        try {
            $existing = $sha256 ? MediaObject::findByHash($sha256) : null;
            if ($existing) {
                // No storage upload necessary; the existing physical object will be reused.
                $uploadId = MessageAttachment::createUpload([
                    'user_id' => $userId, 'chat_id' => $chatId, 'kind' => $type, 'object_key' => $existing['storage_key'],
                    'mime_type' => $existing['mime_type'], 'client_size' => $size, 'sha256' => $sha256, 'original_name' => $originalName
                ]);
                MessageAttachment::markReady($uploadId, (int)$existing['id']);
                $this->json([
                    'success' => true, 'deduplicated' => true, 'upload_id' => $uploadId,
                    'attachment' => ['size' => (int)$existing['size_bytes'], 'mime_type' => $existing['mime_type']]
                ]);
            }

            $ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
            if (!preg_match('/^[a-z0-9]{1,8}$/i', $ext)) $ext = 'bin';
            $key = sprintf('chat/%d/%s/%s/%s.%s', $chatId, date('Y'), date('m'), bin2hex(random_bytes(20)), $ext);
            $uploadId = MessageAttachment::createUpload([
                'user_id' => $userId, 'chat_id' => $chatId, 'kind' => $type, 'object_key' => $key,
                'mime_type' => $mime, 'client_size' => $size, 'sha256' => $sha256 ?: null, 'original_name' => $originalName
            ]);
            $storage = Storage::disk();
            if ($storage instanceof LocalStorage) {
                $upload = $storage->createUploadUrl($key, $uploadId, $userId, (int)($this->storageConfig()['url_ttl'] ?? 600));
                $upload['headers'] = ['Content-Type' => $mime];
            } else {
                $upload = $storage->presignPut($key, $mime);
            }
            $this->json(['success' => true, 'deduplicated' => false, 'upload_id' => $uploadId, 'upload' => $upload, 'storage_driver' => $storage instanceof LocalStorage ? 'local' : 's3', 'max_bytes' => $limit]);
        } catch (Throwable $e) {
            if ($uploadId > 0) {
                try { MessageAttachment::markUploadDeleted($uploadId); } catch (Throwable $ignored) {}
            }
            error_log('NAVA storage presign #' . $uploadId . ': ' . $e->getMessage());
            $this->json(['error' => 'Не удалось подготовить загрузку.'], 503);
        }
    }

    public function localUpload(): void
    {
        $userId = $this->auth();
        $uploadId = (int)($_GET['upload_id'] ?? 0);
        $key = (string)($_GET['key'] ?? '');
        $exp = (int)($_GET['exp'] ?? 0);
        $token = (string)($_GET['token'] ?? '');
        $upload = MessageAttachment::getPendingForUser($uploadId, $userId);
        if (!$upload || !$key || !hash_equals((string)$upload['object_key'], $key)) {
            $this->json(['error' => 'Загрузка не найдена'], 404);
        }
        $storage = Storage::disk();
        if (!($storage instanceof LocalStorage) || !$storage->validateUploadToken($key, $uploadId, $userId, $exp, $token)) {
            $this->json(['error' => 'Недействительная ссылка загрузки'], 403);
        }
        $size = (int)$upload['client_size'];
        if ($size <= 0 || $size > ($this->limits()[$upload['kind']] ?? 0)) {
            $this->json(['error' => 'Некорректный размер файла'], 400);
        }
        $input = fopen('php://input', 'rb');
        if (!$input) $this->json(['error' => 'Не удалось прочитать загружаемый файл'], 500);

        try {
            $storage->putFromStream($key, $input, $size, (string)$upload['mime_type']);
        } catch (Throwable $e) {
            error_log('NAVA local upload #' . $uploadId . ': ' . $e->getMessage());
            $this->json(['error' => 'Не удалось сохранить файл на сервере'], 500);
        } finally {
            if (is_resource($input)) fclose($input);
        }

        $this->json(['success' => true]);
    }

    public function localDownload(): void
    {
        $userId = $this->auth();
        $key = (string)($_GET['key'] ?? '');
        $exp = (int)($_GET['exp'] ?? 0);
        $token = (string)($_GET['token'] ?? '');
        if (!$key) $this->json(['error' => 'Файл не найден'], 404);
        $storage = Storage::disk();
        if (!($storage instanceof LocalStorage) || !$storage->validateDownloadToken($key, $exp, $token)) {
            $this->json(['error' => 'Недействительная ссылка'], 403);
        }
        $attachment = MessageAttachment::getAccessibleReadyByStorageKey($key, $userId);
        if (!$attachment) $this->json(['error' => 'Файл недоступен'], 404);
        try {
            $file = $storage->stream($key);
            $downloadName = preg_replace('/[^A-Za-z0-9._-]+/u', '_', (string)($attachment['original_name'] ?? 'file'));
            header('Content-Type: ' . ($file['content_type'] ?: 'application/octet-stream'));
            header('Content-Length: ' . (int)$file['size']);
            header('Content-Disposition: inline; filename="' . ($downloadName ?: 'file') . '"');
            header('X-Content-Type-Options: nosniff');
            readfile($file['path']);
            exit;
        } catch (Throwable $e) {
            $this->json(['error' => 'Не удалось открыть файл'], 500);
        }
    }

    public function complete(): void
    {
        $userId = $this->auth();
        $uploadId = (int)($_POST['upload_id'] ?? 0);
        $size = (int)($_POST['size'] ?? 0);
        $width = isset($_POST['width']) ? max(0, (int)$_POST['width']) : null;
        $height = isset($_POST['height']) ? max(0, (int)$_POST['height']) : null;
        $duration = isset($_POST['duration']) ? max(0, (float)$_POST['duration']) : null;
        $sha256 = strtolower(trim((string)($_POST['sha256'] ?? '')));
        if ($sha256 !== '' && !preg_match('/^[a-f0-9]{64}$/', $sha256)) {
            $this->json(['error' => 'Некорректный SHA-256'], 400);
        }

        $upload = MessageAttachment::getPendingForUser($uploadId, $userId);
        if (!$upload) $this->json(['error' => 'Сессия загрузки не найдена или истекла'], 404);
        $limit = $this->limits()[$upload['kind']] ?? 0;
        if ($size <= 0 || $size > $limit) $this->json(['error' => 'Файл превышает допустимый размер'], 400);

        try {
            $storage = Storage::disk();
            $head = $storage->head($upload['object_key']);
            $realSize = (int)($head['size'] ?? 0);
            if ($realSize <= 0 || $realSize !== $size || $realSize > $limit) {
                $storage->delete($upload['object_key']);
                MessageAttachment::markUploadDeleted($uploadId);
                $this->json(['error' => 'Проверка загруженного файла не пройдена'], 400);
            }

            $actualMime = strtolower(trim((string)($head['content_type'] ?? '')));
            if ($actualMime !== '' && $actualMime !== 'application/octet-stream' && !$this->validateMime($actualMime, $upload['kind'])) {
                $storage->delete($upload['object_key']);
                MessageAttachment::markUploadDeleted($uploadId);
                $this->json(['error' => 'Содержимое файла не соответствует заявленному типу'], 400);
            }

            if ($sha256 && !empty($upload['sha256']) && !hash_equals((string)$upload['sha256'], $sha256)) {
                $storage->delete($upload['object_key']);
                MessageAttachment::markUploadDeleted($uploadId);
                $this->json(['error' => 'Хэш файла не совпадает'], 400);
            }

            // На локальном storage SHA-256 считаем на сервере потоково/из файла,
            // поэтому отсутствие WebCrypto в браузере больше не приводит к
            // null в MediaObject. Для S3 используем только подтверждённый
            // checksum, если провайдер его вернул.
            $sha = $sha256 ?: (string)($upload['sha256'] ?? '');
            if ($sha === '') {
                $headSha = strtolower((string)($head['sha256'] ?? ''));
                if (preg_match('/^[a-f0-9]{64}$/', $headSha)) {
                    $sha = $headSha;
                } elseif ($storage instanceof LocalStorage) {
                    // Local mode can hash the stored file without routing its
                    // contents through PHP request memory. Large files are
                    // intentionally left unhashed to protect CPU on Host-0.
                    $localSha = $storage->checksum($upload['object_key'], 50 * 1024 * 1024);
                    if ($localSha !== '') $sha = $localSha;
                }
            }

            $existing = $sha !== '' ? MediaObject::findByHash($sha) : null;
            if ($existing) {
                $storage->delete($upload['object_key']);
                MessageAttachment::markReady($uploadId, (int)$existing['id']);
                $this->json(['success' => true, 'deduplicated' => true, 'media_object_id' => (int)$existing['id']]);
            }

            $created = MediaObject::createIfAbsent([
                'sha256' => $sha !== '' ? $sha : null,
                'owner_id' => $userId,
                'storage_key' => $upload['object_key'],
                'mime_type' => $actualMime ?: $upload['mime_type'],
                'size_bytes' => $realSize,
                'width' => $width,
                'height' => $height,
                'duration' => $duration,
            ]);
            if (!$created['created']) {
                $storage->delete($upload['object_key']);
            }
            $mediaId = (int)$created['object']['id'];
            MessageAttachment::markReady($uploadId, $mediaId);
            $this->json(['success' => true, 'deduplicated' => !$created['created'], 'media_object_id' => $mediaId]);
        } catch (Throwable $e) {
            error_log('NAVA storage complete #' . $uploadId . ': ' . $e->getMessage());
            $this->json(['error' => 'Не удалось завершить загрузку.'], 500);
        }
    }

    public function url(): void
    {
        $userId = $this->auth();
        $attachmentId = (int)($_GET['attachment_id'] ?? 0);
        $attachment = MessageAttachment::getAccessibleReady($attachmentId, $userId);
        if (!$attachment) $this->json(['error' => 'Attachment not found'], 404);
        try {
            $url = Storage::disk()->presignGet($attachment['storage_key']);
            $this->json(['success' => true, 'url' => $url, 'expires_in' => 600]);
        } catch (Throwable $e) { $this->json(['error' => 'Storage is unavailable'], 503); }
    }
}
