<?php

return [
    'driver' => (string)(getenv('STORAGE_DRIVER') ?: 'local'),
    'enabled' => getenv('S3_ENABLED') === '1',
    'local_enabled' => getenv('LOCAL_STORAGE_ENABLED') !== '0',
    'local_root' => __DIR__ . '/../../storage/media',
    // Replace this with a long random value before production use. It is only
    // used to sign temporary local upload/download URLs.
    'local_secret' => (string)(getenv('NAVA_STORAGE_LOCAL_SECRET') ?: 'CHANGE-ME-TO-A-RANDOM-64-CHARACTER-SECRET'),
    'endpoint' => rtrim((string)(getenv('S3_ENDPOINT') ?: ''), '/'),
    'region' => (string)(getenv('S3_REGION') ?: 'auto'),
    'bucket' => (string)(getenv('S3_BUCKET') ?: ''),
    'access_key' => (string)(getenv('S3_ACCESS_KEY') ?: ''),
    'secret_key' => (string)(getenv('S3_SECRET_KEY') ?: ''),
    'use_path_style' => getenv('S3_PATH_STYLE') !== '0',
    'url_ttl' => max(60, min(3600, (int)(getenv('S3_URL_TTL') ?: 600))),
    'max_upload_bytes' => 250 * 1024 * 1024,
    'max_photo_bytes' => 15 * 1024 * 1024,
    'max_video_bytes' => 250 * 1024 * 1024,
    'max_voice_bytes' => 25 * 1024 * 1024,
    'max_video_note_bytes' => 60 * 1024 * 1024,
    'user_quota_bytes' => 500 * 1024 * 1024,
    'global_quota_bytes' => 25 * 1024 * 1024 * 1024,
    'pending_ttl_seconds' => 86400,
    'orphan_grace_seconds' => 30 * 86400,
];
