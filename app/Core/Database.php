<?php

namespace App\Core;

use PDO;
use PDOException;

class Database
{
    private static $pdo;
    private static $queryCount = 0;

    public static function init($host, $dbname, $user, $password)
    {
        try {
            $dsn = "mysql:host={$host};dbname={$dbname};charset=utf8mb4";
            self::$pdo = new PDO($dsn, $user, $password, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]);
        } catch (PDOException $e) {
            http_response_code(500);
            error_log('NAVA database connection error: ' . $e->getMessage());
            exit('Ошибка подключения к базе данных.');
        }
    }

    public static function getPDO()
    {
        return self::$pdo;
    }

    public static function query($sql, $params = [])
    {
        if (!self::$pdo) {
            throw new \RuntimeException('Database is not initialized.');
        }

        $started = microtime(true);
        self::$queryCount++;

        try {
            $stmt = self::$pdo->prepare($sql);
            $stmt->execute($params);
            Metrics::addDbQuery((microtime(true) - $started) * 1000);
            return $stmt;
        } catch (\Throwable $e) {
            Metrics::addDbQuery((microtime(true) - $started) * 1000);
            throw $e;
        }
    }

    public static function getQueryCount()
    {
        return self::$queryCount;
    }
}
