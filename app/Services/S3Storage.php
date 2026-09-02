<?php

namespace App\Services;

use App\Contracts\StorageInterface;
use RuntimeException;

/**
 * S3-compatible client used only for short control-plane requests and
 * SigV4 presigned URLs. Large files never pass through PHP.
 */
class S3Storage implements StorageInterface
{
    private array $config;

    public function __construct(?array $config = null)
    {
        $this->config = $config ?? require __DIR__ . '/../Config/storage.php';
    }

    public function isConfigured(): bool
    {
        foreach (['endpoint', 'region', 'bucket', 'access_key', 'secret_key'] as $key) {
            if (trim((string)($this->config[$key] ?? '')) === '') return false;
        }
        return !empty($this->config['enabled']);
    }

    public function presignPut(string $objectKey, string $contentType, ?int $expires = null): array
    {
        $this->assertConfigured();
        $objectKey = $this->normalizeKey($objectKey);
        $expires = $expires ?? (int)$this->config['url_ttl'];
        return [
            'url' => $this->buildPresignedUrl('PUT', $objectKey, ['content-type' => $contentType], $expires),
            'method' => 'PUT',
            'headers' => ['Content-Type' => $contentType],
            'object_key' => $objectKey,
            'expires_in' => $expires,
        ];
    }

    public function presignGet(string $objectKey, ?int $expires = null): string
    {
        $this->assertConfigured();
        return $this->buildPresignedUrl('GET', $this->normalizeKey($objectKey), [], $expires ?? (int)$this->config['url_ttl']);
    }

    public function head(string $objectKey): array
    {
        $this->assertConfigured();
        $response = $this->request('HEAD', $this->normalizeKey($objectKey));
        if ($response['status'] < 200 || $response['status'] >= 300) {
            throw new RuntimeException('S3 HEAD failed: HTTP ' . $response['status']);
        }
        $headers = $this->normalizeHeaders($response['headers']);
        $checksum = (string)($headers['x-amz-checksum-sha256'] ?? '');
        if (!preg_match('/^[a-f0-9]{64}$/i', $checksum)) $checksum = '';
        return [
            'size' => isset($headers['content-length']) ? (int)$headers['content-length'] : null,
            'content_type' => $headers['content-type'] ?? null,
            'etag' => trim((string)($headers['etag'] ?? ''), '"'),
            'sha256' => $checksum,
        ];
    }

    public function delete(string $objectKey): bool
    {
        $this->assertConfigured();
        $response = $this->request('DELETE', $this->normalizeKey($objectKey));
        return $response['status'] >= 200 && $response['status'] < 300;
    }

    public function health(): array
    {
        if (!$this->isConfigured()) {
            return ['ok' => false, 'configured' => false, 'message' => 'S3 storage is not configured'];
        }
        $response = $this->request('HEAD', '');
        return [
            'ok' => $response['status'] >= 200 && $response['status'] < 400,
            'configured' => true,
            'status' => $response['status'],
            'bucket' => $this->config['bucket'],
            'endpoint' => $this->config['endpoint'],
        ];
    }

    private function assertConfigured(): void
    {
        if (!$this->isConfigured()) throw new RuntimeException('Внешнее хранилище пока не настроено.');
    }

    private function normalizeKey(string $key): string
    {
        $key = ltrim(str_replace('\\', '/', trim($key)), '/');
        if ($key === '' || str_contains($key, "\0") || str_contains($key, '..')) {
            throw new RuntimeException('Invalid object key.');
        }
        return $key;
    }

    private function buildUrl(string $objectKey): string
    {
        $base = rtrim((string)$this->config['endpoint'], '/');
        $bucket = rawurlencode((string)$this->config['bucket']);
        $encodedKey = $this->encodePath($objectKey);
        if (!empty($this->config['use_path_style'])) {
            return $base . '/' . $bucket . ($encodedKey !== '' ? '/' . $encodedKey : '');
        }
        $scheme = parse_url($base, PHP_URL_SCHEME) ?: 'https';
        $host = parse_url($base, PHP_URL_HOST);
        $port = parse_url($base, PHP_URL_PORT);
        $authority = $host . ($port ? ':' . $port : '');
        return $scheme . '://' . rawurlencode((string)$this->config['bucket']) . '.' . $authority . ($encodedKey !== '' ? '/' . $encodedKey : '');
    }

    private function buildPresignedUrl(string $method, string $objectKey, array $headers, int $expires): string
    {
        $url = $this->buildUrl($objectKey);
        $parsed = parse_url($url);
        $host = $parsed['host'] . (isset($parsed['port']) ? ':' . $parsed['port'] : '');
        $region = (string)$this->config['region'];
        $service = 's3';
        $amzDate = gmdate('Ymd\\THis\\Z');
        $dateStamp = gmdate('Ymd');
        $scope = $dateStamp . '/' . $region . '/' . $service . '/aws4_request';

        $query = [
            'X-Amz-Algorithm' => 'AWS4-HMAC-SHA256',
            'X-Amz-Credential' => $this->config['access_key'] . '/' . $scope,
            'X-Amz-Date' => $amzDate,
            'X-Amz-Expires' => (string)$expires,
        ];
        $signedHeaders = ['host'];
        $canonicalHeaders = 'host:' . $host . "\n";
        if (isset($headers['content-type'])) {
            $canonicalHeaders = 'content-type:' . trim($headers['content-type']) . "\n" . $canonicalHeaders;
            $signedHeaders = ['content-type', 'host'];
        }
        $query['X-Amz-SignedHeaders'] = implode(';', $signedHeaders);

        $queryString = $this->canonicalQuery($query);
        $canonicalRequest = $method . "\n" . ($parsed['path'] ?? '/') . "\n" . $queryString . "\n" . $canonicalHeaders . "\n" . implode(';', $signedHeaders) . "\nUNSIGNED-PAYLOAD";
        $stringToSign = "AWS4-HMAC-SHA256\n" . $amzDate . "\n" . $scope . "\n" . hash('sha256', $canonicalRequest);
        $signingKey = $this->getSignatureKey((string)$this->config['secret_key'], $dateStamp, $region, $service);
        $signature = hash_hmac('sha256', $stringToSign, $signingKey);
        return $url . '?' . $queryString . '&X-Amz-Signature=' . $signature;
    }

    private function request(string $method, string $objectKey): array
    {
        $url = $this->buildPresignedUrl($method, $objectKey, [], (int)$this->config['url_ttl']);
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HEADER => true,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_TIMEOUT => 15,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
        ]);
        $raw = curl_exec($ch);
        if ($raw === false) {
            $err = curl_error($ch);
            curl_close($ch);
            throw new RuntimeException('S3 request failed: ' . $err);
        }
        $headerSize = (int)curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $headers = substr($raw, 0, $headerSize);
        $body = substr($raw, $headerSize);
        curl_close($ch);
        return ['status' => $status, 'headers' => $this->parseHeaders($headers), 'body' => $body];
    }

    private function parseHeaders(string $raw): array
    {
        $headers = [];
        foreach (preg_split('/\r?\n/', trim($raw)) as $line) {
            if (strpos($line, ':') === false) continue;
            [$name, $value] = explode(':', $line, 2);
            $headers[trim($name)] = trim($value);
        }
        return $headers;
    }

    private function normalizeHeaders(array $headers): array
    {
        $out = [];
        foreach ($headers as $key => $value) $out[strtolower($key)] = $value;
        return $out;
    }

    private function canonicalQuery(array $query): string
    {
        uksort($query, 'strcmp');
        $pairs = [];
        foreach ($query as $key => $value) {
            $pairs[] = rawurlencode((string)$key) . '=' . rawurlencode((string)$value);
        }
        return implode('&', $pairs);
    }

    private function encodePath(string $path): string
    {
        return implode('/', array_map('rawurlencode', explode('/', $path)));
    }

    private function getSignatureKey(string $key, string $date, string $region, string $service): string
    {
        $kDate = hash_hmac('sha256', $date, 'AWS4' . $key, true);
        $kRegion = hash_hmac('sha256', $region, $kDate, true);
        $kService = hash_hmac('sha256', $service, $kRegion, true);
        return hash_hmac('sha256', 'aws4_request', $kService, true);
    }
}
