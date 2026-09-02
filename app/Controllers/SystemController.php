<?php

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Database;
use App\Core\Metrics;
use App\Models\User;

class SystemController
{
    private function requireAuthJson()
    {
        if (!Auth::isLoggedIn()) {
            http_response_code(401);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['error' => 'Unauthorized'], JSON_UNESCAPED_UNICODE);
            exit;
        }
    }

    public function ping()
    {
        $this->requireAuthJson();
        Auth::heartbeat(true);
        $this->json(['success' => true, 'server_time' => time()]);
    }


    public function users()
    {
        $this->requireAuthJson();
        $limit = (int)($_GET['limit'] ?? 8);
        $limit = max(1, min(50, $limit));
        $users = User::getOnlineUsers(Auth::getUserId(), $limit);
        $this->json(['success' => true, 'users' => $users, 'count' => count($users)]);
    }

    public function metrics()
    {
        $this->requireAuthJson();
        if (!Auth::isAdmin()) {
            $this->json(['error' => 'Forbidden'], 403);
        }
        $this->json(Metrics::live());
    }

    private function json(array $data, $status = 200)
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }
}
