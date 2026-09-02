<?php

namespace App\Controllers;

use App\Core\Auth;
use App\Core\View;
use App\Models\User;

class FriendsController
{
    public function index()
    {
        if (!Auth::isLoggedIn()) {
            header('Location: /login');
            exit;
        }

        $userId = (int)Auth::getUserId();
        $allUsers = User::getAllUsers($userId, 300);

        $onlineUsers = array_values(array_filter(
            $allUsers,
            static fn($user) => ($user['presence_status'] ?? 'offline') !== 'offline'
        ));

        View::render('friends', [
            'title' => 'Друзья — N-A-V-A',
            'allUsers' => $allUsers,
            'onlineUsers' => $onlineUsers,
            'page_css' => 'friends',
            'page_js' => 'friends'
        ]);
    }
}
