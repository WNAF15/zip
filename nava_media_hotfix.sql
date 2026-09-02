-- N-A-V-A media storage repair
-- No schema changes are required for the null SHA-256 fix.
-- This script only recalculates usage counters from actual media_objects.
START TRANSACTION;

UPDATE storage_global
SET bytes_used = (
    SELECT COALESCE(SUM(size_bytes), 0)
    FROM media_objects
    WHERE deleted_at IS NULL
), updated_at = NOW()
WHERE id = 1;

INSERT INTO storage_global (id, bytes_used, updated_at)
SELECT 1, COALESCE(SUM(size_bytes), 0), NOW()
FROM media_objects
WHERE deleted_at IS NULL
ON DUPLICATE KEY UPDATE
    bytes_used = VALUES(bytes_used),
    updated_at = VALUES(updated_at);

DELETE FROM storage_user_usage;

INSERT INTO storage_user_usage (user_id, bytes_used, updated_at)
SELECT owner_id, COALESCE(SUM(size_bytes), 0), NOW()
FROM media_objects
WHERE deleted_at IS NULL
GROUP BY owner_id
ON DUPLICATE KEY UPDATE
    bytes_used = VALUES(bytes_used),
    updated_at = VALUES(updated_at);

COMMIT;
