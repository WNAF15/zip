<?php
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('CLI only');
}

spl_autoload_register(function ($class) {
    $prefix = 'App\\';
    $baseDir = __DIR__ . '/../app/';
    if (strncmp($prefix, $class, strlen($prefix)) !== 0) return;
    $relative = substr($class, strlen($prefix));
    $file = $baseDir . str_replace('\\', '/', $relative) . '.php';
    if (is_file($file)) require $file;
});

use App\Core\Database;
use App\Models\MediaObject;
use App\Models\MessageAttachment;
use App\Services\Storage;

$config = require __DIR__ . '/../app/Config/database.php';
Database::init($config['host'], $config['dbname'], $config['user'], $config['password']);

$storage = Storage::disk();
$deletedUploads = 0;
$deletedObjects = 0;

foreach (MessageAttachment::expirePending(200) as $upload) {
    try {
        if ($storage->isConfigured() && !$storage->delete($upload['object_key'])) continue;
        MessageAttachment::markUploadDeleted((int)$upload['id']);
        $deletedUploads++;
    } catch (Throwable $e) {
        error_log('NAVA cleanup upload #' . (int)$upload['id'] . ': ' . $e->getMessage());
    }
}

foreach (MediaObject::releaseExpired() as $object) {
    try {
        if (!$storage->isConfigured()) continue;
        if (!$storage->delete($object['storage_key'])) continue;
        if (MediaObject::purge((int)$object['id'])) $deletedObjects++;
    } catch (Throwable $e) {
        error_log('NAVA cleanup media #' . (int)$object['id'] . ': ' . $e->getMessage());
    }
}

echo "uploads_deleted={$deletedUploads} objects_deleted={$deletedObjects}\n";
