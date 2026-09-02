<?php

use App\Controllers\SystemController;

$router->post('/api/status/ping', [SystemController::class, 'ping']);
$router->get('/api/status/users', [SystemController::class, 'users']);
$router->get('/api/metrics', [SystemController::class, 'metrics']);

$router->post('/api/chat/media/presign', [\App\Controllers\StorageController::class, 'presign']);
$router->post('/api/chat/media/local-upload', [\App\Controllers\StorageController::class, 'localUpload']);
$router->get('/api/chat/media/local-download', [\App\Controllers\StorageController::class, 'localDownload']);
$router->post('/api/chat/media/complete', [\App\Controllers\StorageController::class, 'complete']);
$router->get('/api/chat/media/url', [\App\Controllers\StorageController::class, 'url']);
$router->get('/api/storage/usage', [\App\Controllers\StorageController::class, 'usage']);
$router->get('/api/storage/health', [\App\Controllers\StorageController::class, 'health']);
