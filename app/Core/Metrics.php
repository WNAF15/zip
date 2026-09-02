<?php

namespace App\Core;

class Metrics
{
    private static $startTime;
    private static $startCpuUser = 0.0;
    private static $startCpuSystem = 0.0;
    private static $dbQueries = 0;
    private static $dbTimeMs = 0.0;

    public static function start()
    {
        self::$startTime = microtime(true);
        $usage = function_exists('getrusage') ? getrusage() : [];
        self::$startCpuUser = (float)($usage['ru_utime.tv_sec'] ?? 0) + ((float)($usage['ru_utime.tv_usec'] ?? 0) / 1000000);
        self::$startCpuSystem = (float)($usage['ru_stime.tv_sec'] ?? 0) + ((float)($usage['ru_stime.tv_usec'] ?? 0) / 1000000);
    }

    public static function addDbQuery($elapsedMs = 0.0)
    {
        self::$dbQueries++;
        self::$dbTimeMs += (float)$elapsedMs;
    }

    public static function getDbQueries()
    {
        return self::$dbQueries;
    }

    public static function getDbTimeMs()
    {
        return round(self::$dbTimeMs, 2);
    }

    public static function getExecutionTime()
    {
        if (!self::$startTime) return 0.0;
        return round((microtime(true) - self::$startTime) * 1000, 2);
    }

    public static function getCpuTimeMs()
    {
        if (!function_exists('getrusage')) return 0.0;
        $usage = getrusage();
        $user = (float)($usage['ru_utime.tv_sec'] ?? 0) + ((float)($usage['ru_utime.tv_usec'] ?? 0) / 1000000);
        $system = (float)($usage['ru_stime.tv_sec'] ?? 0) + ((float)($usage['ru_stime.tv_usec'] ?? 0) / 1000000);
        return round(max(0, ($user + $system - self::$startCpuUser - self::$startCpuSystem) * 1000), 2);
    }

    public static function getMemoryUsage()
    {
        return round(memory_get_peak_usage(true) / 1024 / 1024, 2);
    }

    public static function getLoadAverage()
    {
        if (function_exists('sys_getloadavg')) {
            $load = sys_getloadavg();
            if (is_array($load) && isset($load[0])) return (float)$load[0];
        }
        return null;
    }

    public static function getCpuCores()
    {
        static $cores = null;
        if ($cores !== null) return $cores;

        $cores = 1;
        if (is_file('/proc/cpuinfo')) {
            $data = @file_get_contents('/proc/cpuinfo');
            if ($data !== false) {
                $count = preg_match_all('/^processor\s*:/m', $data, $matches);
                if ($count > 0) $cores = $count;
            }
        }
        return max(1, $cores);
    }

    public static function getHostCpuPercent()
    {
        $load = self::getLoadAverage();
        if ($load === null) return null;
        return round(min(999, ($load / self::getCpuCores()) * 100), 1);
    }

    private static function cacheKey($suffix)
    {
        return 'nava.metrics.' . $suffix;
    }

    private static function apcuEnabled()
    {
        if (!function_exists('apcu_enabled')) return false;
        try {
            return (bool)apcu_enabled();
        } catch (\Throwable $e) {
            return false;
        }
    }

    public static function finish()
    {
        if (!function_exists('apcu_inc') || !function_exists('apcu_fetch') || !function_exists('apcu_store') || !self::apcuEnabled()) {
            return;
        }

        $bucket = gmdate('YmdHi');
        $key = self::cacheKey('bucket.' . $bucket);
        $bucketData = apcu_fetch($key);
        if (!is_array($bucketData)) {
            $bucketData = ['requests' => 0, 'db_queries' => 0, 'db_time_ms' => 0.0];
        }
        $bucketData['requests']++;
        $bucketData['db_queries'] += self::$dbQueries;
        $bucketData['db_time_ms'] += self::$dbTimeMs;
        apcu_store($key, $bucketData, 120);

        apcu_store(self::cacheKey('last'), [
            'time' => date('H:i:s'),
            'requests' => 1,
            'db_queries' => self::$dbQueries,
            'db_time_ms' => round(self::$dbTimeMs, 2),
            'execution_ms' => self::getExecutionTime(),
            'cpu_ms' => self::getCpuTimeMs(),
            'memory_mb' => self::getMemoryUsage(),
        ], 120);
    }

    public static function live()
    {
        $apcuAvailable = function_exists('apcu_fetch')
            && self::apcuEnabled();

        $requests = 0;
        $dbQueries = 0;
        $dbTime = 0.0;
        $last = null;

        if ($apcuAvailable) {
            $bucket = gmdate('YmdHi');
            $current = apcu_fetch(self::cacheKey('bucket.' . $bucket));
            $previous = apcu_fetch(self::cacheKey('bucket.' . gmdate('YmdHi', time() - 60)));

            $requests = (int)($current['requests'] ?? 0) + (int)($previous['requests'] ?? 0);
            $dbQueries = (int)($current['db_queries'] ?? 0) + (int)($previous['db_queries'] ?? 0);
            $dbTime = (float)($current['db_time_ms'] ?? 0) + (float)($previous['db_time_ms'] ?? 0);
            $last = apcu_fetch(self::cacheKey('last'));
        }
        return [
            'success' => true,
            'updated_at' => date('H:i:s'),
            'cpu_load_percent' => self::getHostCpuPercent(),
            'load_average_1m' => self::getLoadAverage(),
            'cpu_cores' => self::getCpuCores(),
            'db_queries_last_minute' => $requests > 0 ? $dbQueries : null,
            'requests_last_minute' => $requests > 0 ? $requests : null,
            'db_time_last_minute_ms' => $requests > 0 ? round($dbTime, 2) : null,
            'last_request' => $last ?: null,
            'current_request' => [
                'db_queries' => self::$dbQueries,
                'db_time_ms' => self::getDbTimeMs(),
                'execution_ms' => self::getExecutionTime(),
                'cpu_ms' => self::getCpuTimeMs(),
                'memory_mb' => self::getMemoryUsage(),
            ],
            'apcu' => $apcuAvailable,
        ];
    }

    public static function render()
    {
        return <<<'HTML'
<div class="admin-metrics" id="adminMetrics" data-endpoint="/api/metrics">
    <div><span>⚡ DB</span><strong id="metricDb">—</strong></div>
    <div><span>🖥 CPU</span><strong id="metricCpu">—</strong></div>
    <div><span>⏱ PHP</span><strong id="metricTime">—</strong></div>
    <div><span>💾 RAM</span><strong id="metricMemory">—</strong></div>
    <div class="admin-metrics-wide"><span id="metricUpdated">мониторинг…</span></div>
</div>
HTML;
    }
}
