<?php

namespace App\Services;

use App\Contracts\StorageInterface;
use App\Storage\LocalStorage;

final class Storage
{
    public static function disk(): StorageInterface
    {
        $config = require __DIR__ . '/../Config/storage.php';
        $driver = strtolower((string)($config['driver'] ?? 'local'));
        if ($driver === 'local') return new LocalStorage($config);
        if ($driver === 's3' || $driver === 'r2' || $driver === 'reg_s3') {
            return new S3Storage($config);
        }
        throw new \RuntimeException('Неизвестный storage driver: ' . $driver);
    }
}
