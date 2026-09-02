<?php

namespace App\Controllers;

use App\Core\Auth;
use App\Core\View;

class CommunityController
{
    private function requireAuth()
    {
        if (!Auth::isLoggedIn()) {
            header('Location: /login');
            exit;
        }
    }

    public function gallery()
    {
        $this->requireAuth();

        $captions = [
            ['title' => 'Вечер в N-A-V-A', 'meta' => 'Сегодня · 12 реакций', 'icon' => '🌙'],
            ['title' => 'Перед игрой', 'meta' => 'Вчера · 8 реакций', 'icon' => '🎮'],
            ['title' => 'Наш мем дня', 'meta' => '2 дня назад · 21 реакция', 'icon' => '😂'],
            ['title' => 'Случайный скрин', 'meta' => '3 дня назад · 5 реакций', 'icon' => '✨'],
            ['title' => 'Командный момент', 'meta' => '5 дней назад · 14 реакций', 'icon' => '🏆'],
            ['title' => 'Красивый закат', 'meta' => 'Неделю назад · 17 реакций', 'icon' => '🌅'],
        ];
        shuffle($captions);

        View::render('gallery', [
            'title' => 'Галерея — N-A-V-A',
            'galleryItems' => array_slice($captions, 0, 6),
            'page_css' => 'community',
            'page_js' => 'community'
        ]);
    }

    public function music()
    {
        $this->requireAuth();

        $tracks = [
            ['title' => 'Midnight Sakura', 'artist' => 'N-A-V-A Radio', 'duration' => '3:42', 'icon' => '🌸'],
            ['title' => 'Afterglow', 'artist' => 'Community Mix', 'duration' => '4:18', 'icon' => '🌌'],
            ['title' => 'Pixel Hearts', 'artist' => 'Game Night', 'duration' => '2:56', 'icon' => '💜'],
            ['title' => 'Quiet Lobby', 'artist' => 'Late Evening', 'duration' => '5:01', 'icon' => '☕'],
            ['title' => 'Boss Fight', 'artist' => 'Arcade Pulse', 'duration' => '3:12', 'icon' => '⚡'],
        ];
        shuffle($tracks);

        View::render('music', [
            'title' => 'Музыкальная комната — N-A-V-A',
            'tracks' => $tracks,
            'page_css' => 'community',
            'page_js' => 'community'
        ]);
    }

    public function ai()
    {
        $this->requireAuth();

        $suggestions = [
            'Придумай игру на 10 минут для компании',
            'Подбери смешное название для нашей группы',
            'Составь вечерний план без скуки',
            'Придумай 5 вопросов для викторины',
        ];
        shuffle($suggestions);

        View::render('ai', [
            'title' => 'ИИ — N-A-V-A',
            'suggestions' => array_slice($suggestions, 0, 4),
            'page_css' => 'community',
            'page_js' => 'community'
        ]);
    }
}
