<?php

namespace App\Models;

use App\Core\Database;

class Sticker
{
    public static function getAll()
    {
        $sql = "SELECT * FROM stickers ORDER BY id ASC";
        $stmt = Database::query($sql);
        return $stmt ? $stmt->fetchAll() : [];
    }
}