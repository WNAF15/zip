<?php

namespace App\Models;

use App\Core\Database;

class Game
{
    public static function getLibrary(int $userId): array
    {
        $sql = "SELECT g.*,\n                       COALESCE(ug.is_favorite, 0) AS is_favorite,\n                       ug.last_played,\n                       COALESCE(ug.total_minutes, 0) AS total_minutes,\n                       COALESCE(wa.week_minutes, 0) AS week_minutes,\n                       COALESCE(ac.unlocked_achievements, 0) AS unlocked_achievements,\n                       COALESCE(ac.total_achievements, 0) AS total_achievements\n                FROM games g\n                LEFT JOIN user_games ug ON ug.game_id = g.id AND ug.user_id = ?\n                LEFT JOIN (\n                    SELECT user_id, game_id, SUM(minutes) AS week_minutes\n                    FROM user_game_play_days\n                    WHERE user_id = ? AND played_on >= CURDATE() - INTERVAL 6 DAY\n                    GROUP BY user_id, game_id\n                ) wa ON wa.game_id = g.id AND wa.user_id = ?\n                LEFT JOIN (\n                    SELECT a.game_id,\n                           COUNT(*) AS total_achievements,\n                           SUM(CASE WHEN ua.user_id IS NOT NULL THEN 1 ELSE 0 END) AS unlocked_achievements\n                    FROM achievements a\n                    LEFT JOIN user_achievements ua ON ua.achievement_id = a.id AND ua.user_id = ?\n                    GROUP BY a.game_id\n                ) ac ON ac.game_id = g.id\n                WHERE COALESCE(g.is_active, 1) = 1\n                ORDER BY g.title ASC";
        $stmt = Database::query($sql, [$userId, $userId, $userId, $userId]);
        return $stmt ? $stmt->fetchAll() : [];
    }

    public static function getAllWithUserData($userId): array { return self::getLibrary((int)$userId); }

    public static function getBySlug(string $slug): ?array
    {
        $stmt = Database::query("SELECT * FROM games WHERE slug = ? AND COALESCE(is_active, 1) = 1", [$slug]);
        return $stmt ? ($stmt->fetch() ?: null) : null;
    }

    public static function getById(int $id): ?array
    {
        $stmt = Database::query("SELECT * FROM games WHERE id = ? AND COALESCE(is_active, 1) = 1", [$id]);
        return $stmt ? ($stmt->fetch() ?: null) : null;
    }

    public static function getUserGame(int $userId, int $gameId): array
    {
        self::addToLibrary($userId, $gameId);
        $stmt = Database::query("SELECT ug.*, COALESCE(w.week_minutes,0) AS week_minutes\n            FROM user_games ug\n            LEFT JOIN (\n                SELECT game_id, SUM(minutes) week_minutes FROM user_game_play_days\n                WHERE user_id=? AND played_on >= CURDATE() - INTERVAL 6 DAY GROUP BY game_id\n            ) w ON w.game_id=ug.game_id\n            WHERE ug.user_id=? AND ug.game_id=?", [$userId, $userId, $gameId]);
        return $stmt ? ($stmt->fetch() ?: []) : [];
    }

    public static function addToLibrary(int $userId, int $gameId)
    {
        return Database::query("INSERT IGNORE INTO user_games (user_id, game_id) VALUES (?, ?)", [$userId, $gameId]);
    }

    public static function toggleFavorite(int $userId, int $gameId): bool
    {
        self::addToLibrary($userId, $gameId);
        $stmt = Database::query("UPDATE user_games SET is_favorite = 1 - is_favorite WHERE user_id=? AND game_id=?", [$userId, $gameId]);
        return $stmt->rowCount() > 0;
    }

    public static function getCollections(int $userId): array
    {
        $stmt = Database::query("SELECT c.*, COUNT(i.game_id) AS game_count\n            FROM game_collections c\n            LEFT JOIN game_collection_items i ON i.collection_id=c.id\n            WHERE c.user_id=?\n            GROUP BY c.id\n            ORDER BY c.sort_order, c.id", [$userId]);
        return $stmt ? $stmt->fetchAll() : [];
    }

    public static function createCollection(int $userId, string $name): ?array
    {
        $name = trim(mb_substr($name, 0, 80));
        if ($name === '') return null;
        Database::query("INSERT INTO game_collections (user_id,name,sort_order)\n            VALUES (?, ?, COALESCE((SELECT max_sort + 1 FROM (SELECT COALESCE(MAX(sort_order),0) AS max_sort FROM game_collections WHERE user_id=?) x),1))", [$userId, $name, $userId]);
        $id = (int)Database::getPDO()->lastInsertId();
        return ['id'=>$id, 'name'=>$name, 'sort_order'=>0, 'game_count'=>0];
    }

    public static function deleteCollection(int $userId, int $collectionId): bool
    {
        return Database::query("DELETE FROM game_collections WHERE id=? AND user_id=?", [$collectionId, $userId])->rowCount() > 0;
    }

    public static function addToCollection(int $userId, int $collectionId, int $gameId): bool
    {
        $owned = Database::query("SELECT id FROM game_collections WHERE id=? AND user_id=?", [$collectionId,$userId])->fetch();
        if (!$owned) return false;
        self::addToLibrary($userId,$gameId);
        Database::query("INSERT IGNORE INTO game_collection_items (collection_id,game_id,sort_order)\n            VALUES (?, ?, COALESCE((SELECT max_sort + 1 FROM (SELECT COALESCE(MAX(sort_order),0) AS max_sort FROM game_collection_items WHERE collection_id=?) x),1))", [$collectionId,$gameId,$collectionId]);
        return true;
    }

    public static function removeFromCollection(int $userId, int $collectionId, int $gameId): bool
    {
        return Database::query("DELETE i FROM game_collection_items i JOIN game_collections c ON c.id=i.collection_id\n            WHERE i.collection_id=? AND i.game_id=? AND c.user_id=?", [$collectionId,$gameId,$userId])->rowCount() > 0;
    }

    public static function getCollectionGames(int $userId, int $collectionId): array
    {
        $sql = "SELECT g.*, COALESCE(ug.is_favorite,0) is_favorite, COALESCE(ug.total_minutes,0) total_minutes, ug.last_played,\n                COALESCE(w.week_minutes,0) week_minutes, COALESCE(ac.unlocked_achievements,0) unlocked_achievements, COALESCE(ac.total_achievements,0) total_achievements\n            FROM game_collections c\n            JOIN game_collection_items i ON i.collection_id=c.id\n            JOIN games g ON g.id=i.game_id\n            LEFT JOIN user_games ug ON ug.game_id=g.id AND ug.user_id=c.user_id\n            LEFT JOIN (SELECT game_id,SUM(minutes) week_minutes FROM user_game_play_days WHERE user_id=? AND played_on>=CURDATE()-INTERVAL 6 DAY GROUP BY game_id) w ON w.game_id=g.id\n            LEFT JOIN (SELECT a.game_id,COUNT(*) total_achievements,SUM(ua.user_id IS NOT NULL) unlocked_achievements FROM achievements a LEFT JOIN user_achievements ua ON ua.achievement_id=a.id AND ua.user_id=? GROUP BY a.game_id) ac ON ac.game_id=g.id\n            WHERE c.id=? AND c.user_id=? ORDER BY i.sort_order,i.id";
        $stmt=Database::query($sql,[$userId,$userId,$collectionId,$userId]);
        return $stmt ? $stmt->fetchAll() : [];
    }

    public static function getAchievements(int $gameId): array
    {
        $stmt = Database::query("SELECT * FROM achievements WHERE game_id=? ORDER BY id", [$gameId]);
        return $stmt ? $stmt->fetchAll() : [];
    }

    public static function getAchievementStats(int $gameId, int $userId): array
    {
        $sql="SELECT a.*, ua.unlocked_at, COALESCE(s.unlocked_users,0) unlocked_users, COALESCE(p.total_players,0) total_players\n              FROM achievements a\n              LEFT JOIN user_achievements ua ON ua.achievement_id=a.id AND ua.user_id=?\n              LEFT JOIN (SELECT achievement_id,COUNT(*) unlocked_users FROM user_achievements GROUP BY achievement_id) s ON s.achievement_id=a.id\n              LEFT JOIN (SELECT game_id,COUNT(*) total_players FROM user_games GROUP BY game_id) p ON p.game_id=a.game_id\n              WHERE a.game_id=? ORDER BY a.id";
        $stmt=Database::query($sql,[$userId,$gameId]);
        return $stmt ? $stmt->fetchAll() : [];
    }

    public static function getUserAchievements(int $userId, int $gameId): array { return self::getAchievementStats($gameId,$userId); }

    public static function getOnlinePlayers(int $gameId): int
    {
        $stmt=Database::query("SELECT COUNT(*) c FROM game_presence WHERE game_id=? AND expires_at>NOW()",[$gameId]);
        $row=$stmt->fetch(); return (int)($row['c']??0);
    }

    public static function getGameDetails(int $userId, int $gameId): array
    {
        $game=self::getById($gameId); if(!$game) return [];
        $userGame=self::getUserGame($userId,$gameId);
        $game['user_game']=$userGame;
        $game['online_players']=self::getOnlinePlayers($gameId);
        $game['achievements']=self::getAchievementStats($gameId,$userId);
        $game['tags']=self::getTags($gameId);
        $game['reviews']=self::getReviews($gameId,10);
        return $game;
    }

    public static function getTags(int $gameId): array
    {
        $stmt=Database::query("SELECT t.* FROM game_tags t JOIN game_tag_map m ON m.tag_id=t.id WHERE m.game_id=? ORDER BY t.name",[$gameId]);
        return $stmt ? $stmt->fetchAll() : [];
    }

    public static function getReviews(int $gameId,int $limit=20): array
    {
        $limit=max(1,min(50,$limit));
        $stmt=Database::query("SELECT r.*,u.nickname,u.avatar_url,ug.total_minutes FROM game_reviews r JOIN users u ON u.id=r.user_id LEFT JOIN user_games ug ON ug.user_id=r.user_id AND ug.game_id=r.game_id WHERE r.game_id=? ORDER BY r.created_at DESC LIMIT {$limit}",[$gameId]);
        return $stmt ? $stmt->fetchAll() : [];
    }

    public static function saveReview(int $userId,int $gameId,bool $recommended,string $text): bool
    {
        self::addToLibrary($userId,$gameId);
        $text=trim(mb_substr($text,0,5000));
        if($text==='') return false;
        Database::query("INSERT INTO game_reviews (user_id,game_id,recommended,body) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE recommended=VALUES(recommended),body=VALUES(body),updated_at=NOW()",[$userId,$gameId,$recommended?1:0,$text]);
        Database::query("INSERT INTO game_activity (game_id,user_id,type,body) VALUES (?,?, 'review', ?)", [$gameId,$userId,$recommended ? 'Оставил положительный отзыв.' : 'Оставил отрицательный отзыв.']);
        return true;
    }

    public static function getRecentActivity(int $gameId,int $limit=20): array
    {
        $limit=max(1,min(50,$limit));
        $stmt=Database::query("SELECT a.*,u.nickname,u.avatar_url FROM game_activity a JOIN users u ON u.id=a.user_id WHERE a.game_id=? ORDER BY a.created_at DESC LIMIT {$limit}",[$gameId]);
        return $stmt ? $stmt->fetchAll() : [];
    }

    public static function heartbeat(int $userId,int $gameId,string $title): void
    {
        Database::query("INSERT INTO game_presence (user_id,game_id,last_seen_at,expires_at) VALUES (?,?,NOW(),DATE_ADD(NOW(),INTERVAL 2 MINUTE)) ON DUPLICATE KEY UPDATE game_id=VALUES(game_id),last_seen_at=NOW(),expires_at=VALUES(expires_at)",[$userId,$gameId]);
        Database::query("UPDATE users SET status='playing',playing_text=? WHERE id=?",[mb_substr($title,0,100),$userId]);
    }

    public static function stopPresence(int $userId,int $gameId): void
    {
        Database::query("DELETE FROM game_presence WHERE user_id=? AND game_id=?",[$userId,$gameId]);
        Database::query("UPDATE users SET status='online',playing_text=NULL WHERE id=? AND status='playing'",[$userId]);
    }

    public static function addPlayMinutes(int $userId,int $gameId,int $seconds): array
    {
        $seconds=max(0,min($seconds,3600));
        $minutes=(int)floor($seconds/60);
        if($minutes<1) return self::getUserGame($userId,$gameId);
        self::addToLibrary($userId,$gameId);
        Database::query("UPDATE user_games SET total_minutes=total_minutes+?,last_played=NOW() WHERE user_id=? AND game_id=?",[$minutes,$userId,$gameId]);
        Database::query("INSERT INTO user_game_play_days (user_id,game_id,played_on,minutes) VALUES (?,?,CURDATE(),?) ON DUPLICATE KEY UPDATE minutes=minutes+VALUES(minutes)",[$userId,$gameId,$minutes]);
        return self::getUserGame($userId,$gameId);
    }

    public static function getCategoriesWithCount(): array
    {
        $stmt=Database::query("SELECT category,COUNT(*) count FROM games WHERE COALESCE(is_active,1)=1 GROUP BY category ORDER BY category");
        return $stmt ? $stmt->fetchAll() : [];
    }

    public static function getTotalGames(): int { $r=Database::query("SELECT COUNT(*) total FROM games WHERE COALESCE(is_active,1)=1")->fetch(); return (int)($r['total']??0); }
    public static function getFavoriteCount(int $userId): int { $r=Database::query("SELECT COUNT(*) total FROM user_games WHERE user_id=? AND is_favorite=1",[$userId])->fetch(); return (int)($r['total']??0); }
}
