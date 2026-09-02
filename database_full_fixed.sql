-- phpMyAdmin SQL Dump
-- version 5.2.1-1.el8
-- https://www.phpmyadmin.net/
--
-- Хост: localhost
-- Время создания: Авг 30 2026 г., 15:26
-- Версия сервера: 8.0.25-15
-- Версия PHP: 8.2.33

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- База данных: `u3602272_NAVA`
--

-- --------------------------------------------------------

--
-- Структура таблицы `achievements`
--

CREATE TABLE `achievements` (
  `id` int UNSIGNED NOT NULL,
  `game_id` int UNSIGNED NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `icon` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT '/assets/images/achievements/default.png'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Структура таблицы `chats`
--

CREATE TABLE `chats` (
  `id` int UNSIGNED NOT NULL,
  `type` enum('general','private','group') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'general',
  `name` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_by` int UNSIGNED DEFAULT NULL,
  `member_count` int UNSIGNED NOT NULL DEFAULT '0',
  `last_message_id` int UNSIGNED DEFAULT NULL,
  `last_message_preview` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_message_at` datetime DEFAULT NULL,
  `revision` bigint UNSIGNED NOT NULL DEFAULT '1',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Дамп данных таблицы `chats`
--

INSERT INTO `chats` (`id`, `type`, `name`, `created_by`, `member_count`, `last_message_id`, `last_message_preview`, `last_message_at`, `revision`, `updated_at`, `created_at`) VALUES
(1, 'general', 'Общий чат', NULL, 3, 32, '1', '2026-08-30 05:10:49', 2, '2026-08-30 08:10:49', '2026-08-29 11:35:24'),
(2, 'private', NULL, 1, 2, 33, '1', '2026-08-30 05:11:05', 4, '2026-08-30 08:11:05', '2026-08-29 11:45:31'),
(3, 'group', 'жопа', 1, 2, NULL, NULL, NULL, 1, '2026-08-29 22:19:55', '2026-08-29 16:02:41');

-- --------------------------------------------------------

--
-- Структура таблицы `chat_members`
--

CREATE TABLE `chat_members` (
  `id` int UNSIGNED NOT NULL,
  `chat_id` int UNSIGNED NOT NULL,
  `user_id` int UNSIGNED NOT NULL,
  `joined_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Дамп данных таблицы `chat_members`
--

INSERT INTO `chat_members` (`id`, `chat_id`, `user_id`, `joined_at`) VALUES
(1, 1, 1, '2026-08-29 11:35:24'),
(5, 1, 3, '2026-08-29 11:38:20'),
(9, 2, 1, '2026-08-29 11:45:31'),
(10, 2, 3, '2026-08-29 11:45:31'),
(74, 1, 4, '2026-08-29 12:29:59'),
(98, 3, 3, '2026-08-29 16:02:41'),
(99, 3, 1, '2026-08-29 16:02:41');

-- --------------------------------------------------------

--
-- Структура таблицы `chat_pins`
--

CREATE TABLE `chat_pins` (
  `id` bigint UNSIGNED NOT NULL,
  `chat_id` int UNSIGNED NOT NULL,
  `message_id` int UNSIGNED NOT NULL,
  `pinned_by` int UNSIGNED NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Структура таблицы `chat_typing`
--

CREATE TABLE `chat_typing` (
  `chat_id` int UNSIGNED NOT NULL,
  `user_id` int UNSIGNED NOT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Структура таблицы `chat_user_settings`
--

CREATE TABLE `chat_user_settings` (
  `chat_id` int UNSIGNED NOT NULL,
  `user_id` int UNSIGNED NOT NULL,
  `pinned_at` datetime DEFAULT NULL,
  `muted_until` datetime DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Дамп данных таблицы `chat_user_settings`
--

INSERT INTO `chat_user_settings` (`chat_id`, `user_id`, `pinned_at`, `muted_until`, `deleted_at`, `updated_at`) VALUES
(1, 1, NULL, NULL, NULL, '2026-08-29 22:19:55'),
(1, 3, NULL, NULL, NULL, '2026-08-29 22:19:55'),
(1, 4, NULL, NULL, NULL, '2026-08-29 22:19:55'),
(2, 1, NULL, NULL, NULL, '2026-08-29 22:19:55'),
(2, 3, NULL, NULL, NULL, '2026-08-30 07:07:24'),
(3, 1, NULL, NULL, NULL, '2026-08-29 22:19:55'),
(3, 3, NULL, NULL, NULL, '2026-08-29 22:19:55');

-- --------------------------------------------------------

--
-- Структура таблицы `games`
--

CREATE TABLE `games` (
  `id` int UNSIGNED NOT NULL,
  `slug` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `image` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT '/assets/images/games/default.jpg',
  `category` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'other',
  `players` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '1-4',
  `is_multiplayer` tinyint(1) NOT NULL DEFAULT '0',
  `path` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Дамп данных таблицы `games`
--

INSERT INTO `games` (`id`, `slug`, `title`, `description`, `image`, `category`, `players`, `is_multiplayer`, `path`, `created_at`) VALUES
(1, 'circle-of-hell', 'Круг ада', 'Пройди через все круги ада и выживи!', '/assets/images/games/default.jpg', 'logic', '1', 0, '/games/circle-of-hell/', '2026-08-24 07:45:50');

-- --------------------------------------------------------

--
-- Структура таблицы `invites`
--

CREATE TABLE `invites` (
  `id` int UNSIGNED NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `token_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `used` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Структура таблицы `media_objects`
--

CREATE TABLE `media_objects` (
  `id` bigint UNSIGNED NOT NULL,
  `sha256` char(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `owner_id` int UNSIGNED NOT NULL,
  `storage_key` varchar(512) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mime_type` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `size_bytes` bigint UNSIGNED NOT NULL DEFAULT '0',
  `width` int UNSIGNED DEFAULT NULL,
  `height` int UNSIGNED DEFAULT NULL,
  `duration` decimal(10,3) DEFAULT NULL,
  `ref_count` int UNSIGNED NOT NULL DEFAULT '0',
  `delete_after` datetime DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Дамп данных таблицы `media_objects`
--

INSERT INTO `media_objects` (`id`, `sha256`, `owner_id`, `storage_key`, `mime_type`, `size_bytes`, `width`, `height`, `duration`, `ref_count`, `delete_after`, `deleted_at`, `created_at`) VALUES
(1, 'ab20ab11714343e4b13844f5e9dd684501b393e2993317a9dceb9e2dee0aca53', 1, 'chat/1/2026/08/5fda489b5fa5fef0fd7f9cd4319fe32d7c8e96a4.webp', 'image/webp', 43786, 1920, 1080, NULL, 0, NULL, NULL, '2026-08-30 14:52:00'),
(2, 'b74eb9128abe459c96738c517ac6bcf272d396a98c730df4576e900f4b93dbcf', 1, 'chat/1/2026/08/e70a365c23f9318f8159d4d2718832acd09f6c2f.webp', 'image/webp', 86454, 1920, 1080, NULL, 0, NULL, NULL, '2026-08-30 15:09:26');

-- --------------------------------------------------------

--
-- Структура таблицы `media_uploads`
--

CREATE TABLE `media_uploads` (
  `id` bigint UNSIGNED NOT NULL,
  `user_id` int UNSIGNED NOT NULL,
  `chat_id` int NOT NULL,
  `kind` enum('photo','video','voice','video_note') COLLATE utf8mb4_unicode_ci NOT NULL,
  `object_key` varchar(512) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mime_type` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_size` bigint UNSIGNED NOT NULL DEFAULT '0',
  `sha256` char(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `original_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `media_object_id` bigint UNSIGNED DEFAULT NULL,
  `status` enum('pending','ready','attached','deleted') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_at` datetime DEFAULT NULL,
  `expires_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Дамп данных таблицы `media_uploads`
--

INSERT INTO `media_uploads` (`id`, `user_id`, `chat_id`, `kind`, `object_key`, `mime_type`, `client_size`, `sha256`, `original_name`, `media_object_id`, `status`, `created_at`, `completed_at`, `expires_at`) VALUES
(1, 1, 2, 'photo', 'chat/2/2026/08/379fb604b6242bfd1b3efe3090d05f514877e4cd.webp', 'image/webp', 86454, NULL, '31cf5-16713129188448-1920 (1).webp', NULL, 'deleted', '2026-08-30 13:56:07', '2026-08-30 13:56:07', '2026-08-31 13:56:07'),
(2, 1, 1, 'photo', 'chat/1/2026/08/32700a9aa2e003f3263ae0c3412f2bf35d8799a3.webp', 'image/webp', 86454, NULL, '31cf5-16713129188448-1920 (1).webp', NULL, 'pending', '2026-08-30 14:22:30', NULL, '2026-08-31 14:22:30'),
(3, 1, 1, 'photo', 'chat/1/2026/08/b070f65229244b13c919ffde3a9eb262ef89b714.webp', 'image/webp', 86454, NULL, '31cf5-16713129188448-1920 (1).webp', NULL, 'pending', '2026-08-30 14:25:30', NULL, '2026-08-31 14:25:30'),
(4, 1, 2, 'photo', 'chat/2/2026/08/e7b16fd9b62946b624680e63fa9f45d44821c70f.webp', 'image/webp', 164160, NULL, '730_20240820233341_2.webp', NULL, 'pending', '2026-08-30 14:25:41', NULL, '2026-08-31 14:25:41'),
(5, 1, 2, 'photo', 'chat/2/2026/08/7abdf0ef79c81ae190f18832981ebab48a3a306d.webp', 'image/webp', 164160, NULL, '730_20240820233341_2.webp', NULL, 'pending', '2026-08-30 14:26:19', NULL, '2026-08-31 14:26:19'),
(6, 1, 2, 'photo', 'chat/2/2026/08/df7101f2d81e93bba8725563d7b64932d7c86409.webp', 'image/webp', 86454, NULL, '31cf5-16713129188448-1920 (1).webp', NULL, 'pending', '2026-08-30 14:30:32', NULL, '2026-08-31 14:30:32'),
(7, 1, 2, 'photo', 'chat/2/2026/08/17f15ffc436fd1d6a6f3aeb94e6eea60f8c1cb53.webp', 'image/webp', 86454, NULL, '31cf5-16713129188448-1920 (1).webp', NULL, 'pending', '2026-08-30 14:30:39', NULL, '2026-08-31 14:30:39'),
(8, 1, 1, 'photo', 'chat/1/2026/08/5fda489b5fa5fef0fd7f9cd4319fe32d7c8e96a4.webp', 'image/webp', 43786, NULL, '480_20250312035811_1.webp', 1, 'ready', '2026-08-30 14:51:59', '2026-08-30 14:52:00', '2026-08-31 14:51:59'),
(9, 1, 1, 'photo', 'chat/1/2026/08/e70a365c23f9318f8159d4d2718832acd09f6c2f.webp', 'image/webp', 86454, NULL, '31cf5-16713129188448-1920 (1).webp', 2, 'ready', '2026-08-30 15:09:25', '2026-08-30 15:09:26', '2026-08-31 15:09:25');

-- --------------------------------------------------------

--
-- Структура таблицы `messages`
--

CREATE TABLE `messages` (
  `id` int UNSIGNED NOT NULL,
  `chat_id` int UNSIGNED NOT NULL,
  `user_id` int UNSIGNED NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `edited_at` datetime DEFAULT NULL,
  `reply_to_message_id` int UNSIGNED DEFAULT NULL,
  `reply_quote` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `forwarded_message_id` int UNSIGNED DEFAULT NULL,
  `forwarded_from_user_id` int UNSIGNED DEFAULT NULL,
  `forwarded_hide_author` tinyint(1) NOT NULL DEFAULT '0',
  `deleted_at` datetime DEFAULT NULL,
  `deleted_by` int UNSIGNED DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Дамп данных таблицы `messages`
--

INSERT INTO `messages` (`id`, `chat_id`, `user_id`, `message`, `edited_at`, `reply_to_message_id`, `reply_quote`, `forwarded_message_id`, `forwarded_from_user_id`, `forwarded_hide_author`, `deleted_at`, `deleted_by`, `created_at`) VALUES
(27, 2, 1, '123321', '2026-08-29 16:35:34', NULL, NULL, NULL, NULL, 0, NULL, NULL, '2026-08-29 16:34:44'),
(28, 2, 1, '123', NULL, 27, '123', NULL, NULL, 0, NULL, NULL, '2026-08-29 16:35:28'),
(29, 1, 1, '123', NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, '2026-08-29 16:35:44'),
(30, 1, 3, '123', NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, '2026-08-29 19:01:12'),
(31, 2, 3, '123', NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, '2026-08-29 19:01:36'),
(32, 1, 1, '1', NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, '2026-08-30 08:10:49'),
(33, 2, 1, '1', NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, '2026-08-30 08:11:05');

-- --------------------------------------------------------

--
-- Структура таблицы `message_media`
--

CREATE TABLE `message_media` (
  `id` bigint UNSIGNED NOT NULL,
  `message_id` bigint UNSIGNED NOT NULL,
  `media_object_id` bigint UNSIGNED NOT NULL,
  `type` enum('photo','video','voice','video_note') COLLATE utf8mb4_unicode_ci NOT NULL,
  `original_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mime_type` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `size_bytes` bigint UNSIGNED NOT NULL DEFAULT '0',
  `sort_order` smallint UNSIGNED NOT NULL DEFAULT '0',
  `deleted_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Структура таблицы `profile_comments`
--

CREATE TABLE `profile_comments` (
  `id` int UNSIGNED NOT NULL,
  `user_id` int UNSIGNED NOT NULL,
  `author_id` int UNSIGNED NOT NULL,
  `text` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Структура таблицы `stickers`
--

CREATE TABLE `stickers` (
  `id` int UNSIGNED NOT NULL,
  `name` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `image_url` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Дамп данных таблицы `stickers`
--

INSERT INTO `stickers` (`id`, `name`, `image_url`, `created_at`) VALUES
(1, 'Искра', '/assets/images/stickers/spark.png', '2026-08-30 05:06:41'),
(2, 'Сердце', '/assets/images/stickers/heart.png', '2026-08-30 05:06:41'),
(3, 'Сакура', '/assets/images/stickers/sakura.png', '2026-08-30 05:06:41');

-- --------------------------------------------------------

--
-- Структура таблицы `storage_global`
--

CREATE TABLE `storage_global` (
  `id` tinyint UNSIGNED NOT NULL,
  `bytes_used` bigint UNSIGNED NOT NULL DEFAULT '0',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Дамп данных таблицы `storage_global`
--

INSERT INTO `storage_global` (`id`, `bytes_used`, `updated_at`) VALUES
(1, 130240, '2026-08-30 15:09:26');

-- --------------------------------------------------------

--
-- Структура таблицы `storage_user_usage`
--

CREATE TABLE `storage_user_usage` (
  `user_id` int UNSIGNED NOT NULL,
  `bytes_used` bigint UNSIGNED NOT NULL DEFAULT '0',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Дамп данных таблицы `storage_user_usage`
--

INSERT INTO `storage_user_usage` (`user_id`, `bytes_used`, `updated_at`) VALUES
(1, 130240, '2026-08-30 15:09:26');

-- --------------------------------------------------------

--
-- Структура таблицы `users`
--

CREATE TABLE `users` (
  `id` int UNSIGNED NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nickname` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `avatar_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `theme` enum('dark','light') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'dark',
  `status` enum('online','away','playing','offline') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'offline',
  `is_admin` tinyint(1) NOT NULL DEFAULT '0',
  `last_seen` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `profile_background` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `avatar_frame` int DEFAULT '1',
  `bio` text COLLATE utf8mb4_unicode_ci,
  `level` int NOT NULL DEFAULT '1',
  `xp` int NOT NULL DEFAULT '0',
  `active_badge` int DEFAULT NULL,
  `playing_text` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `showcases` json DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Дамп данных таблицы `users`
--

INSERT INTO `users` (`id`, `email`, `password_hash`, `nickname`, `avatar_url`, `theme`, `status`, `is_admin`, `last_seen`, `created_at`, `profile_background`, `avatar_frame`, `bio`, `level`, `xp`, `active_badge`, `playing_text`, `showcases`) VALUES
(1, 'WNAF', '$2a$12$IKR2eflrJidHHLX6xchk7.KVcqpL5rzifSFEW2sgSx63HEwzTBxS6', 'Админ', '/assets/images/avatars/avatar_1.png', 'dark', 'online', 1, '2026-08-30 15:22:13', '2026-08-23 14:13:43', '/assets/images/backgrounds/bg_1.png', 2, '', 1, 0, NULL, '', '[1, 2]'),
(3, 'varia', '$2a$12$IKR2eflrJidHHLX6xchk7.KVcqpL5rzifSFEW2sgSx63HEwzTBxS6', 'Varia', '/assets/images/avatars/avatar_3.jpg', 'light', 'offline', 0, '2026-08-30 07:29:20', '2026-08-23 20:01:41', '/assets/images/backgrounds/bg_3.jpg', 1, '', 1, 0, NULL, '', '[1, 2, 3]'),
(4, 'Misha', '$2a$12$IKR2eflrJidHHLX6xchk7.KVcqpL5rzifSFEW2sgSx63HEwzTBxS6', 'Misha', NULL, 'light', 'away', 0, '2026-08-24 12:46:14', '2026-08-24 12:35:09', NULL, 1, NULL, 1, 0, NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Структура таблицы `user_achievements`
--

CREATE TABLE `user_achievements` (
  `id` int UNSIGNED NOT NULL,
  `user_id` int UNSIGNED NOT NULL,
  `achievement_id` int UNSIGNED NOT NULL,
  `unlocked_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Структура таблицы `user_blocks`
--

CREATE TABLE `user_blocks` (
  `id` int UNSIGNED NOT NULL,
  `blocker_id` int UNSIGNED NOT NULL,
  `blocked_id` int UNSIGNED NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Структура таблицы `user_games`
--

CREATE TABLE `user_games` (
  `id` int UNSIGNED NOT NULL,
  `user_id` int UNSIGNED NOT NULL,
  `game_id` int UNSIGNED NOT NULL,
  `is_favorite` tinyint(1) NOT NULL DEFAULT '0',
  `last_played` datetime DEFAULT NULL,
  `total_minutes` int UNSIGNED NOT NULL DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Дамп данных таблицы `user_games`
--

INSERT INTO `user_games` (`id`, `user_id`, `game_id`, `is_favorite`, `last_played`, `total_minutes`) VALUES
(1, 1, 1, 1, NULL, 0),
(9, 3, 1, 0, NULL, 0),
(15, 4, 1, 0, NULL, 0);

--
-- Индексы сохранённых таблиц
--

--
-- Индексы таблицы `achievements`
--
ALTER TABLE `achievements`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_achievements_game_id_id` (`game_id`,`id`);

--
-- Индексы таблицы `chats`
--
ALTER TABLE `chats`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_chats_type_id` (`type`,`id`),
  ADD KEY `idx_chats_created_by` (`created_by`),
  ADD KEY `idx_chats_updated` (`updated_at`,`id`);

--
-- Индексы таблицы `chat_members`
--
ALTER TABLE `chat_members`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_chat_members` (`chat_id`,`user_id`),
  ADD KEY `idx_chat_members_user_chat` (`user_id`,`chat_id`);

--
-- Индексы таблицы `chat_pins`
--
ALTER TABLE `chat_pins`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_chat_pins_message` (`chat_id`,`message_id`),
  ADD KEY `idx_chat_pins_message` (`message_id`),
  ADD KEY `fk_chat_pins_user` (`pinned_by`);

--
-- Индексы таблицы `chat_typing`
--
ALTER TABLE `chat_typing`
  ADD PRIMARY KEY (`chat_id`,`user_id`),
  ADD KEY `idx_chat_typing_updated` (`chat_id`,`updated_at`),
  ADD KEY `fk_chat_typing_user` (`user_id`);

--
-- Индексы таблицы `chat_user_settings`
--
ALTER TABLE `chat_user_settings`
  ADD PRIMARY KEY (`chat_id`,`user_id`),
  ADD KEY `idx_chat_settings_user_pin` (`user_id`,`pinned_at`,`chat_id`),
  ADD KEY `idx_chat_settings_user_mute` (`user_id`,`muted_until`,`chat_id`),
  ADD KEY `idx_chat_settings_user_deleted` (`user_id`,`deleted_at`,`chat_id`),
  ADD KEY `idx_chat_settings_user_updated` (`user_id`,`updated_at`,`chat_id`);

--
-- Индексы таблицы `games`
--
ALTER TABLE `games`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_games_slug` (`slug`),
  ADD KEY `idx_games_category_title` (`category`,`title`,`id`);

--
-- Индексы таблицы `invites`
--
ALTER TABLE `invites`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_invites_token_hash` (`token_hash`),
  ADD KEY `idx_invites_email_created` (`email`,`created_at`);

--
-- Индексы таблицы `media_objects`
--
ALTER TABLE `media_objects`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_media_objects_storage_key` (`storage_key`),
  ADD UNIQUE KEY `uq_media_objects_sha256` (`sha256`),
  ADD KEY `idx_media_objects_owner` (`owner_id`),
  ADD KEY `idx_media_objects_cleanup` (`ref_count`,`delete_after`),
  ADD KEY `idx_media_objects_deleted` (`deleted_at`),
  ADD KEY `idx_media_objects_sha256` (`sha256`);

--
-- Индексы таблицы `media_uploads`
--
ALTER TABLE `media_uploads`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_media_uploads_object_key` (`object_key`),
  ADD KEY `idx_media_uploads_user_status` (`user_id`,`status`),
  ADD KEY `idx_media_uploads_expiry` (`status`,`expires_at`),
  ADD KEY `idx_media_uploads_chat` (`chat_id`,`created_at`),
  ADD KEY `idx_media_uploads_media_object` (`media_object_id`),
  ADD KEY `idx_media_uploads_sha256` (`sha256`);

--
-- Индексы таблицы `messages`
--
ALTER TABLE `messages`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_messages_chat_deleted_id` (`chat_id`,`deleted_at`,`id`),
  ADD KEY `idx_messages_reply_to` (`reply_to_message_id`),
  ADD KEY `idx_messages_forwarded_from` (`forwarded_from_user_id`),
  ADD KEY `idx_messages_forwarded` (`forwarded_message_id`),
  ADD KEY `fk_messages_user` (`user_id`),
  ADD KEY `fk_messages_deleted_by` (`deleted_by`);

--
-- Индексы таблицы `message_media`
--
ALTER TABLE `message_media`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_message_media_message` (`message_id`,`deleted_at`,`sort_order`),
  ADD KEY `idx_message_media_object` (`media_object_id`,`deleted_at`);

--
-- Индексы таблицы `profile_comments`
--
ALTER TABLE `profile_comments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_profile_comments_user_id_id` (`user_id`,`id`),
  ADD KEY `idx_profile_comments_author_id_id` (`author_id`,`id`);

--
-- Индексы таблицы `stickers`
--
ALTER TABLE `stickers`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_stickers_id` (`id`);

--
-- Индексы таблицы `storage_global`
--
ALTER TABLE `storage_global`
  ADD PRIMARY KEY (`id`);

--
-- Индексы таблицы `storage_user_usage`
--
ALTER TABLE `storage_user_usage`
  ADD PRIMARY KEY (`user_id`);

--
-- Индексы таблицы `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_users_email` (`email`),
  ADD KEY `idx_users_presence` (`last_seen`,`status`,`id`),
  ADD KEY `idx_users_created` (`created_at`,`id`);

--
-- Индексы таблицы `user_achievements`
--
ALTER TABLE `user_achievements`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_user_achievements` (`user_id`,`achievement_id`),
  ADD KEY `idx_user_achievements_achievement` (`achievement_id`,`user_id`);

--
-- Индексы таблицы `user_blocks`
--
ALTER TABLE `user_blocks`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_user_blocks_pair` (`blocker_id`,`blocked_id`),
  ADD KEY `idx_user_blocks_blocked` (`blocked_id`,`blocker_id`);

--
-- Индексы таблицы `user_games`
--
ALTER TABLE `user_games`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_user_games` (`user_id`,`game_id`),
  ADD KEY `idx_user_games_game` (`game_id`,`user_id`),
  ADD KEY `idx_user_games_user_favorite` (`user_id`,`is_favorite`,`game_id`);

--
-- AUTO_INCREMENT для сохранённых таблиц
--

--
-- AUTO_INCREMENT для таблицы `achievements`
--
ALTER TABLE `achievements`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT для таблицы `chats`
--
ALTER TABLE `chats`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT для таблицы `chat_members`
--
ALTER TABLE `chat_members`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=155;

--
-- AUTO_INCREMENT для таблицы `chat_pins`
--
ALTER TABLE `chat_pins`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT для таблицы `games`
--
ALTER TABLE `games`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT для таблицы `invites`
--
ALTER TABLE `invites`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT для таблицы `media_objects`
--
ALTER TABLE `media_objects`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT для таблицы `media_uploads`
--
ALTER TABLE `media_uploads`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT для таблицы `messages`
--
ALTER TABLE `messages`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=34;

--
-- AUTO_INCREMENT для таблицы `message_media`
--
ALTER TABLE `message_media`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT для таблицы `profile_comments`
--
ALTER TABLE `profile_comments`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT для таблицы `stickers`
--
ALTER TABLE `stickers`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT для таблицы `users`
--
ALTER TABLE `users`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT для таблицы `user_achievements`
--
ALTER TABLE `user_achievements`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT для таблицы `user_blocks`
--
ALTER TABLE `user_blocks`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT для таблицы `user_games`
--
ALTER TABLE `user_games`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=44;

--
-- Ограничения внешнего ключа сохраненных таблиц
--

--
-- Ограничения внешнего ключа таблицы `achievements`
--
ALTER TABLE `achievements`
  ADD CONSTRAINT `fk_achievements_game` FOREIGN KEY (`game_id`) REFERENCES `games` (`id`) ON DELETE CASCADE;

--
-- Ограничения внешнего ключа таблицы `chats`
--
ALTER TABLE `chats`
  ADD CONSTRAINT `fk_chats_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Ограничения внешнего ключа таблицы `chat_members`
--
ALTER TABLE `chat_members`
  ADD CONSTRAINT `fk_chat_members_chat` FOREIGN KEY (`chat_id`) REFERENCES `chats` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_chat_members_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Ограничения внешнего ключа таблицы `chat_pins`
--
ALTER TABLE `chat_pins`
  ADD CONSTRAINT `fk_chat_pins_chat` FOREIGN KEY (`chat_id`) REFERENCES `chats` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_chat_pins_message` FOREIGN KEY (`message_id`) REFERENCES `messages` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_chat_pins_user` FOREIGN KEY (`pinned_by`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Ограничения внешнего ключа таблицы `chat_typing`
--
ALTER TABLE `chat_typing`
  ADD CONSTRAINT `fk_chat_typing_chat` FOREIGN KEY (`chat_id`) REFERENCES `chats` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_chat_typing_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Ограничения внешнего ключа таблицы `chat_user_settings`
--
ALTER TABLE `chat_user_settings`
  ADD CONSTRAINT `fk_chat_settings_chat` FOREIGN KEY (`chat_id`) REFERENCES `chats` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_chat_settings_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Ограничения внешнего ключа таблицы `messages`
--
ALTER TABLE `messages`
  ADD CONSTRAINT `fk_messages_chat` FOREIGN KEY (`chat_id`) REFERENCES `chats` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_messages_deleted_by` FOREIGN KEY (`deleted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_messages_forward` FOREIGN KEY (`forwarded_message_id`) REFERENCES `messages` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_messages_forward_user` FOREIGN KEY (`forwarded_from_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_messages_reply` FOREIGN KEY (`reply_to_message_id`) REFERENCES `messages` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_messages_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Ограничения внешнего ключа таблицы `profile_comments`
--
ALTER TABLE `profile_comments`
  ADD CONSTRAINT `fk_profile_comments_author` FOREIGN KEY (`author_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_profile_comments_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Ограничения внешнего ключа таблицы `user_achievements`
--
ALTER TABLE `user_achievements`
  ADD CONSTRAINT `fk_user_achievements_achievement` FOREIGN KEY (`achievement_id`) REFERENCES `achievements` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_user_achievements_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Ограничения внешнего ключа таблицы `user_blocks`
--
ALTER TABLE `user_blocks`
  ADD CONSTRAINT `fk_user_blocks_blocked` FOREIGN KEY (`blocked_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_user_blocks_blocker` FOREIGN KEY (`blocker_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Ограничения внешнего ключа таблицы `user_games`
--
ALTER TABLE `user_games`
  ADD CONSTRAINT `fk_user_games_game` FOREIGN KEY (`game_id`) REFERENCES `games` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_user_games_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;


-- ============================================================
-- POST-IMPORT N-A-V-A COMPATIBILITY REPAIR
-- ============================================================
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
