<?php

namespace App\Controllers;

use App\Core\Auth;
use App\Core\View;
use App\Models\Chat;
use App\Models\Message;
use App\Models\User;

class HomeController
{
    public function index()
    {
        if (!Auth::isLoggedIn()) {
            header('Location: /login');
            exit;
        }

        $userId = (int)Auth::getUserId();
        $onlineUsers = User::getOnlineUsers($userId, 8);

        $generalChatId = Chat::getGeneralChat();
        $recentMessages = Message::getMessages($generalChatId, 5);
        $recentMessages = array_reverse($recentMessages);

        $activity = [
            ['icon' => '🎮', 'text' => 'Ночная катка начинается в 20:00', 'time' => 'сегодня'],
            ['icon' => '🏆', 'text' => 'Новая неделя достижений уже началась', 'time' => 'сегодня'],
            ['icon' => '💬', 'text' => 'В общем чате появились новые сообщения', 'time' => 'сейчас'],
            ['icon' => '🌸', 'text' => 'В галерее появился новый вечерний микс', 'time' => 'вчера'],
        ];

        $topGames = [
            ['rank' => '🥇', 'name' => 'Викторина', 'count' => '12 партий'],
            ['rank' => '🥈', 'name' => 'Крокодил', 'count' => '9 партий'],
            ['rank' => '🥉', 'name' => 'Мемори', 'count' => '5 партий'],
        ];

        $events = [
            ['date' => 'Сегодня, 20:00', 'name' => '🎮 Стрим по Викторине', 'attendees' => '3 человека'],
            ['date' => 'Завтра, 19:00', 'name' => '🎲 Крокодил — вечер мемов', 'attendees' => '2 человека'],
            ['date' => 'Пятница, 21:00', 'name' => '🔥 Турнир по Мемори', 'attendees' => '5 человек'],
        ];

        View::render('home', [
            'title' => 'Главная — N-A-V-A',
            'onlineUsers' => $onlineUsers,
            'activity' => $activity,
            'topGames' => $topGames,
            'events' => $events,
            'recentMessages' => $recentMessages,
            'page_css' => 'home',
            'page_js' => 'home'
        ]);
    }
}
