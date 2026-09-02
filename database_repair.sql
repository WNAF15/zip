-- N-A-V-A database compatibility repair
-- Generated for the supplied dump created on 2026-08-30.
-- MySQL 8.0 compatible; intentionally does NOT use ADD COLUMN IF NOT EXISTS.

SET NAMES utf8mb4;

START TRANSACTION;

-- ============================================================
-- 1. CRITICAL: the current PHP code uses chat_revisions, but
--    this table is absent from the supplied database dump.
-- ============================================================

CREATE TABLE IF NOT EXISTS `chat_revisions` (
  `chat_id` int UNSIGNED NOT NULL,
  `version` bigint UNSIGNED NOT NULL DEFAULT 1,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`chat_id`),
  CONSTRAINT `fk_chat_revisions_chat`
    FOREIGN KEY (`chat_id`) REFERENCES `chats` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create one revision row for every existing chat.
INSERT IGNORE INTO `chat_revisions` (`chat_id`, `version`, `updated_at`)
SELECT `id`, 1, NOW()
FROM `chats`;

-- ============================================================
-- 2. Synchronise media reference counters with actual attachments.
--    This is safe and fixes counters left inconsistent by old tests.
-- ============================================================

UPDATE `media_objects` mo
LEFT JOIN (
    SELECT `media_object_id`, COUNT(*) AS `cnt`
    FROM `message_media`
    WHERE `deleted_at` IS NULL
    GROUP BY `media_object_id`
) mm ON mm.`media_object_id` = mo.`id`
SET mo.`ref_count` = COALESCE(mm.`cnt`, 0),
    mo.`delete_after` = CASE
        WHEN COALESCE(mm.`cnt`, 0) = 0 AND mo.`deleted_at` IS NULL
            THEN COALESCE(mo.`delete_after`, DATE_ADD(NOW(), INTERVAL 30 DAY))
        WHEN COALESCE(mm.`cnt`, 0) > 0
            THEN NULL
        ELSE mo.`delete_after`
    END;

-- ============================================================
-- 3. Synchronise storage counters.
-- ============================================================

INSERT IGNORE INTO `storage_global` (`id`, `bytes_used`)
VALUES (1, 0);

UPDATE `storage_global`
SET `bytes_used` = (
    SELECT COALESCE(SUM(`size_bytes`), 0)
    FROM `media_objects`
    WHERE `deleted_at` IS NULL
);

INSERT IGNORE INTO `storage_user_usage` (`user_id`, `bytes_used`)
SELECT `owner_id`, 0
FROM `media_objects`
GROUP BY `owner_id`;

UPDATE `storage_user_usage` suu
LEFT JOIN (
    SELECT `owner_id`, COALESCE(SUM(`size_bytes`), 0) AS `used_bytes`
    FROM `media_objects`
    WHERE `deleted_at` IS NULL
    GROUP BY `owner_id`
) x ON x.`owner_id` = suu.`user_id`
SET suu.`bytes_used` = COALESCE(x.`used_bytes`, 0);

-- ============================================================
-- 4. Expired pending uploads.
--    Mark them deleted. Do not DELETE rows here: the PHP cleanup
--    logic may still need their object_key to remove physical files.
-- ============================================================

UPDATE `media_uploads`
SET `status` = 'deleted',
    `completed_at` = COALESCE(`completed_at`, NOW())
WHERE `status` = 'pending'
  AND `expires_at` <= NOW();

-- ============================================================
-- 5. Remove orphaned chat pins/settings only if previous imports
--    left inconsistent rows. These deletes are safe.
-- ============================================================

DELETE cp
FROM `chat_pins` cp
LEFT JOIN `messages` m ON m.`id` = cp.`message_id`
WHERE m.`id` IS NULL OR m.`chat_id` <> cp.`chat_id`;

DELETE cs
FROM `chat_user_settings` cs
LEFT JOIN `chats` c ON c.`id` = cs.`chat_id`
LEFT JOIN `users` u ON u.`id` = cs.`user_id`
WHERE c.`id` IS NULL OR u.`id` IS NULL;

COMMIT;

-- ============================================================
-- Verification queries (run separately if desired):
--
-- SELECT COUNT(*) AS chats_without_revision
-- FROM chats c LEFT JOIN chat_revisions cr ON cr.chat_id=c.id
-- WHERE cr.chat_id IS NULL;
--
-- SELECT COUNT(*) AS expired_pending_uploads
-- FROM media_uploads WHERE status='pending' AND expires_at<=NOW();
-- ============================================================
