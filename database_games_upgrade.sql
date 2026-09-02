-- N-A-V-A: one-time upgrade for the Steam-like games library.
-- Made for the current database dump supplied with the site.
-- Run this file ONCE in phpMyAdmin after the existing database has been imported.

ALTER TABLE games
  ADD COLUMN game_type ENUM('web','live') NOT NULL DEFAULT 'web' AFTER category,
  ADD COLUMN icon VARCHAR(255) NULL AFTER image,
  ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER path,
  ADD COLUMN entry_version VARCHAR(32) NOT NULL DEFAULT '1' AFTER is_active,
  ADD COLUMN updated_at DATETIME NULL AFTER created_at;

ALTER TABLE user_games
  ADD KEY idx_user_games_user_recent (user_id,last_played,game_id),
  ADD KEY idx_user_games_user_time (user_id,total_minutes,game_id);

CREATE TABLE game_collections (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  name VARCHAR(80) NOT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_game_collections_user_name (user_id,name),
  KEY idx_game_collections_user_sort (user_id,sort_order,id),
  CONSTRAINT fk_game_collections_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE game_collection_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  collection_id INT UNSIGNED NOT NULL,
  game_id INT UNSIGNED NOT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_game_collection_item (collection_id,game_id),
  KEY idx_game_collection_items_sort (collection_id,sort_order,id),
  KEY idx_game_collection_items_game (game_id),
  CONSTRAINT fk_game_collection_items_collection FOREIGN KEY (collection_id) REFERENCES game_collections(id) ON DELETE CASCADE,
  CONSTRAINT fk_game_collection_items_game FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE game_tags (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL,
  slug VARCHAR(50) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_game_tags_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE game_tag_map (
  game_id INT UNSIGNED NOT NULL,
  tag_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (game_id,tag_id),
  KEY idx_game_tag_map_tag (tag_id,game_id),
  CONSTRAINT fk_game_tag_map_game FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  CONSTRAINT fk_game_tag_map_tag FOREIGN KEY (tag_id) REFERENCES game_tags(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE game_reviews (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  game_id INT UNSIGNED NOT NULL,
  recommended TINYINT(1) NOT NULL,
  body TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_game_reviews_user_game (user_id,game_id),
  KEY idx_game_reviews_game_created (game_id,created_at,id),
  CONSTRAINT fk_game_reviews_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_game_reviews_game FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE game_activity (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  game_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  type VARCHAR(32) NOT NULL,
  body VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_game_activity_game_created (game_id,created_at,id),
  CONSTRAINT fk_game_activity_game FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  CONSTRAINT fk_game_activity_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_game_play_days (
  user_id INT UNSIGNED NOT NULL,
  game_id INT UNSIGNED NOT NULL,
  played_on DATE NOT NULL,
  minutes INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id,game_id,played_on),
  KEY idx_user_game_play_days_game_day (game_id,played_on),
  CONSTRAINT fk_user_game_play_days_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_game_play_days_game FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE game_presence (
  user_id INT UNSIGNED NOT NULL,
  game_id INT UNSIGNED NOT NULL,
  last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  PRIMARY KEY (user_id),
  KEY idx_game_presence_game_expiry (game_id,expires_at),
  KEY idx_game_presence_expiry (expires_at),
  CONSTRAINT fk_game_presence_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_game_presence_game FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Published screenshots only. Local screenshots are intentionally not stored here.
CREATE TABLE game_media (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  game_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  media_object_id BIGINT UNSIGNED NOT NULL,
  kind ENUM('screenshot','clip') NOT NULL DEFAULT 'screenshot',
  caption VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_game_media_game_created (game_id,created_at,id),
  CONSTRAINT fk_game_media_game FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  CONSTRAINT fk_game_media_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_game_media_object FOREIGN KEY (media_object_id) REFERENCES media_objects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Initial metadata for the current game.
UPDATE games SET game_type='web', icon=COALESCE(NULLIF(icon,''),image), is_active=1, entry_version='1' WHERE slug='circle-of-hell';
INSERT INTO game_tags (name,slug) VALUES ('Логическая','logic') ON DUPLICATE KEY UPDATE name=VALUES(name);
INSERT INTO game_tag_map (game_id,tag_id)
SELECT g.id,t.id FROM games g JOIN game_tags t ON t.slug='logic' WHERE g.slug='circle-of-hell'
ON DUPLICATE KEY UPDATE tag_id=VALUES(tag_id);
