<?php

namespace App\Storage;

use App\Contracts\StorageInterface;
use RuntimeException;

/**
 * Local storage fallback for deployments where an external S3 account is not
 * available yet. The directory is outside public/ so files are never directly
 * executable or publicly guessable. Large production media should be moved to
 * an S3-compatible driver later.
 */
final class LocalStorage implements StorageInterface
{
    private array $config;
    private string $root;

    public function __construct(?array $config = null)
    {
        $this->config = $config ?? require __DIR__ . '/../Config/storage.php';
        $this->root = rtrim((string)($this->config['local_root'] ?? (__DIR__ . '/../../storage/media')), DIRECTORY_SEPARATOR);
    }

    public function isConfigured(): bool
    {
        return !empty($this->config['local_enabled']) && is_dir($this->root) && is_writable($this->root);
    }

    public function presignPut(string $objectKey, string $contentType, ?int $expires = null): array
    {
        throw new RuntimeException('Local storage upload URL must be generated with an upload id.');
    }

    public function presignGet(string $objectKey, ?int $expires = null): string
    {
        $expires = max(60, min(3600, (int)($expires ?? 600)));
        $exp = time() + $expires;
        $key = $this->normalizeKey($objectKey);
        $token = $this->signDownload($key, $exp);
        return '/api/chat/media/local-download?key=' . rawurlencode($key) . '&exp=' . $exp . '&token=' . rawurlencode($token);
    }

    public function createUploadUrl(string $objectKey, int $uploadId, int $userId, ?int $expires = null): array
    {
        $expires = max(60, min(3600, (int)($expires ?? 600)));
        $key = $this->normalizeKey($objectKey);
        $exp = time() + $expires;
        $token = $this->signUpload($key, $uploadId, $userId, $exp);
        return [
            'url' => '/api/chat/media/local-upload?upload_id=' . $uploadId . '&key=' . rawurlencode($key) . '&exp=' . $exp . '&token=' . rawurlencode($token),
            // Router supports GET/POST; keep the local fallback upload as POST.
            'method' => 'POST',
            'headers' => ['Content-Type' => 'application/octet-stream'],
            'object_key' => $key,
            'expires_in' => $expires,
        ];
    }

    public function putFromStream(string $objectKey, $stream, int $expectedSize, string $contentType): bool
    {
        if (!$this->isConfigured()) throw new RuntimeException('Local storage is not configured.');
        $key = $this->normalizeKey($objectKey);
        $path = $this->pathFor($key);
        $dir = dirname($path);
        if (!is_dir($dir) && !mkdir($dir, 0750, true) && !is_dir($dir)) {
            throw new RuntimeException('Не удалось создать каталог хранения.');
        }

        $tmp = $path . '.upload-' . bin2hex(random_bytes(8));
        $out = fopen($tmp, 'wb');
        if (!$out) throw new RuntimeException('Не удалось открыть временный файл.');
        $written = 0;
        try {
            while (!feof($stream)) {
                $chunk = fread($stream, 1024 * 1024);
                if ($chunk === false) throw new RuntimeException('Ошибка чтения загрузки.');
                if ($chunk === '') break;
                $written += strlen($chunk);
                if ($written > $expectedSize) throw new RuntimeException('Файл больше заявленного размера.');
                if (fwrite($out, $chunk) === false) throw new RuntimeException('Ошибка записи файла.');
            }
        } finally {
            fclose($out);
        }

        if ($written !== $expectedSize) {
            @unlink($tmp);
            throw new RuntimeException('Размер загруженного файла не совпадает.');
        }
        if (!rename($tmp, $path)) {
            @unlink($tmp);
            throw new RuntimeException('Не удалось завершить сохранение файла.');
        }
        @chmod($path, 0640);
        return true;
    }

    public function head(string $objectKey): array
    {
        $path = $this->pathFor($this->normalizeKey($objectKey));
        if (!is_file($path)) throw new RuntimeException('Файл не найден.');
        $size = filesize($path);
        if ($size === false) throw new RuntimeException('Не удалось определить размер файла.');
        $mime = 'application/octet-stream';
        if (function_exists('finfo_open')) {
            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            if ($finfo) {
                $detected = finfo_file($finfo, $path);
                finfo_close($finfo);
                if ($detected) $mime = $detected;
            }
        }
        return ['size' => (int)$size, 'content_type' => $mime, 'etag' => '', 'sha256' => ''];
    }

    public function checksum(string $objectKey, int $maxBytes = 50 * 1024 * 1024): string
    {
        $path = $this->pathFor($this->normalizeKey($objectKey));
        if (!is_file($path)) throw new RuntimeException('Файл не найден.');
        $size = filesize($path);
        if ($size === false) throw new RuntimeException('Не удалось определить размер файла.');
        if ($size > $maxBytes) return '';
        $hash = hash_file('sha256', $path);
        if ($hash === false) throw new RuntimeException('Не удалось вычислить SHA-256.');
        return $hash;
    }

    public function delete(string $objectKey): bool
    {
        $path = $this->pathFor($this->normalizeKey($objectKey));
        return !is_file($path) || @unlink($path);
    }

    public function health(): array
    {
        $ok = $this->isConfigured();
        return [
            'ok' => $ok,
            'configured' => $ok,
            'driver' => 'local',
            'message' => $ok ? 'Local storage ready' : 'Local storage directory is missing or not writable',
        ];
    }

    public function validateUploadToken(string $key, int $uploadId, int $userId, int $exp, string $token): bool
    {
        return $exp >= time() && hash_equals($this->signUpload($this->normalizeKey($key), $uploadId, $userId, $exp), $token);
    }

    public function validateDownloadToken(string $key, int $exp, string $token): bool
    {
        return $exp >= time() && hash_equals($this->signDownload($this->normalizeKey($key), $exp), $token);
    }

    public function stream(string $objectKey): array
    {
        $path = $this->pathFor($this->normalizeKey($objectKey));
        if (!is_file($path)) throw new RuntimeException('Файл не найден.');
        $head = $this->head($objectKey);
        return ['path' => $path, 'size' => $head['size'], 'content_type' => $head['content_type']];
    }

    private function pathFor(string $key): string
    {
        return $this->root . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $key);
    }

    private function normalizeKey(string $key): string
    {
        $key = ltrim(str_replace('\\', '/', trim($key)), '/');
        if ($key === '' || str_contains($key, "\0") || preg_match('#(^|/)\.\.(/|$)#', $key)) {
            throw new RuntimeException('Invalid storage key.');
        }
        return $key;
    }

    private function secret(): string
    {
        $secret = (string)($this->config['local_secret'] ?? '');
        if ($secret === '') throw new RuntimeException('Local storage secret is not configured.');
        return $secret;
    }

    private function signUpload(string $key, int $uploadId, int $userId, int $exp): string
    {
        return hash_hmac('sha256', $key . '|' . $uploadId . '|' . $userId . '|' . $exp, $this->secret());
    }

    private function signDownload(string $key, int $exp): string
    {
        return hash_hmac('sha256', $key . '|' . $exp, $this->secret());
    }
}
