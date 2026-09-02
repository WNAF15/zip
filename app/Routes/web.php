<?php

use App\Controllers\HomeController;
use App\Controllers\AuthController;
use App\Controllers\ProfileController;
use App\Controllers\FriendsController;
use App\Controllers\GamesController;
use App\Controllers\ChatController;
use App\Controllers\CommunityController;
use App\Controllers\SystemController;
use App\Core\Auth;

// ===== ПУБЛИЧНЫЕ/АВТОМАТИЧЕСКИЕ МАРШРУТЫ =====
$router->get('/login', [AuthController::class, 'showLogin']);
$router->post('/login', [AuthController::class, 'login']);
$router->post('/login/confirm', [AuthController::class, 'confirm']);
$router->get('/logout', [AuthController::class, 'logout']);

// ===== ПРОФИЛЬ =====
$router->get('/profile', [ProfileController::class, 'show']);
$router->get('/profile/edit', [ProfileController::class, 'edit']);
$router->post('/profile/update', [ProfileController::class, 'update']);
$router->post('/profile/comment', [ProfileController::class, 'comment']);
$router->get('/profile/{id}', [ProfileController::class, 'showUser']);

// ===== ДРУЗЬЯ =====
$router->get('/friends', [FriendsController::class, 'index']);

// ===== ГЛАВНАЯ =====
$router->get('/', function() {
    if (!Auth::isLoggedIn()) {
        header('Location: /login');
        exit;
    }
    return (new HomeController())->index();
});

// ===== ИГРЫ =====
$router->get('/games', [GamesController::class, 'index']);
// ВАЖНО: динамические страницы игры не используют /games/{slug}, потому что /public/games/{slug} — физическая папка с ресурсами игры.
// Иначе Apache может открыть физическую папку и вернуть 403 вместо маршрута приложения.
$router->get('/game/{slug}', [GamesController::class, 'show']);
$router->get('/game/{slug}/play', [GamesController::class, 'play']);
// Старые ссылки оставлены только для совместимости и перенаправляются контроллером.
$router->get('/games/play/{slug}', [GamesController::class, 'legacyPlay']);
$router->get('/api/games/library', [GamesController::class, 'library']);
$router->get('/api/games/collection', [GamesController::class, 'collectionGames']);
$router->post('/api/games/favorite', [GamesController::class, 'favorite']);
$router->post('/api/games/collections/create', [GamesController::class, 'createCollection']);
$router->post('/api/games/collections/delete', [GamesController::class, 'deleteCollection']);
$router->post('/api/games/collections/add', [GamesController::class, 'addToCollection']);
$router->post('/api/games/collections/remove', [GamesController::class, 'removeFromCollection']);
$router->post('/api/games/review', [GamesController::class, 'review']);
$router->get('/api/games/achievements', [GamesController::class, 'achievements']);
$router->post('/api/games/presence', [GamesController::class, 'presence']);
$router->post('/api/games/playtime', [GamesController::class, 'playtime']);

// ===== ЧАТЫ =====
$router->get('/chat', [ChatController::class, 'index']);
$router->get('/api/chat/messages', [ChatController::class, 'getMessages']);
$router->get('/api/chat/chats', [ChatController::class, 'getChats']);
$router->get('/api/chat/sidebar-state', [ChatController::class, 'sidebarState']);
$router->post('/api/chat/send', [ChatController::class, 'send']);
$router->post('/api/chat/edit', [ChatController::class, 'edit']);
$router->post('/api/chat/delete', [ChatController::class, 'delete']);
$router->get('/api/chat/reply-meta', [ChatController::class, 'replyMeta']);
$router->post('/api/chat/forward', [ChatController::class, 'forward']);
$router->post('/api/chat/pin', [ChatController::class, 'pin']);
$router->post('/api/chat/unpin', [ChatController::class, 'unpin']);
$router->post('/api/chat/create-private', [ChatController::class, 'createPrivate']);
$router->post('/api/chat/create-group', [ChatController::class, 'createGroup']);
$router->get('/api/chat/search', [ChatController::class, 'searchUsers']);
$router->post('/api/chat/typing', [ChatController::class, 'typing']);
$router->get('/api/chat/typing', [ChatController::class, 'getTyping']);
$router->get('/api/chat/online', [ChatController::class, 'getOnlineMembers']);
$router->post('/api/chat/chat-pin', [ChatController::class, 'chatPin']);
$router->post('/api/chat/chat-mute', [ChatController::class, 'chatMute']);
$router->post('/api/chat/delete-chat', [ChatController::class, 'deleteChat']);
$router->post('/api/chat/leave-group', [ChatController::class, 'leaveGroup']);
$router->post('/api/chat/block-user', [ChatController::class, 'blockUser']);
$router->post('/api/chat/unblock-user', [ChatController::class, 'unblockUser']);

// ===== СОЦИАЛЬНЫЕ СТРАНИЦЫ =====
$router->get('/gallery', [CommunityController::class, 'gallery']);
$router->get('/music', [CommunityController::class, 'music']);
$router->get('/ai', [CommunityController::class, 'ai']);
