<?php
namespace App\Controllers;

use App\Core\Auth;
use App\Core\View;
use App\Models\Game;
use App\Models\User;

class GamesController
{
    private function requireAuth(): int
    {
        if (!Auth::isLoggedIn()) { header('Location: /login'); exit; }
        return (int)Auth::getUserId();
    }
    private function requireAuthJson(): int
    {
        if (!Auth::isLoggedIn()) $this->json(['success'=>false,'error'=>'Требуется авторизация'],401);
        return (int)Auth::getUserId();
    }
    private function json(array $data,int $status=200): void
    {
        http_response_code($status); header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES); exit;
    }
    private function post(string $key,$default='') { return $_POST[$key] ?? $default; }

    public function index(): void
    {
        $userId=$this->requireAuth();
        $games=Game::getLibrary($userId);
        View::render('games',[
            'title'=>'Библиотека игр — N-A-V-A','games'=>$games,'sidebar_games'=>$games,
            'categories'=>Game::getCategoriesWithCount(),'collections'=>Game::getCollections($userId),
            'totalGames'=>count($games),'favoriteCount'=>Game::getFavoriteCount($userId),
            'page_css'=>'games','page_js'=>'games'
        ]);
    }

    public function show($slug): void
    {
        $userId=$this->requireAuth(); $game=Game::getBySlug((string)$slug);
        if(!$game){http_response_code(404); echo 'Игра не найдена'; return;}
        $details=Game::getGameDetails($userId,(int)$game['id']);
        $activity=Game::getRecentActivity((int)$game['id'],12);
        $library = Game::getLibrary($userId);
        $categories = Game::getCategoriesWithCount();
        $collections = Game::getCollections($userId);
        View::render('game-details',[
            'title'=>$game['title'].' — N-A-V-A',
            'game'=>$details,
            'activity'=>$activity,
            'sidebar_games'=>$library,
            'categories'=>$categories,
            'collections'=>$collections,
            'totalGames'=>count($library),
            'favoriteCount'=>Game::getFavoriteCount($userId),
            'current_game_slug'=>(string)$game['slug'],
            'page_css'=>'game-details','page_js'=>'game-details'
        ]);
    }

    public function play($slug): void
    {
        $userId=$this->requireAuth(); $game=Game::getBySlug((string)$slug);
        if(!$game){http_response_code(404); echo 'Игра не найдена'; return;}
        Game::addToLibrary($userId,(int)$game['id']);
        $user=User::findById($userId);
        View::render('game-play',[
            'title'=>$game['title'].' — N-A-V-A','game'=>$game,'user'=>$user,
            'game_context'=>['userId'=>$userId,'userNickname'=>(string)($user['nickname']??'')],
            'page_css'=>'game-play','page_js'=>'game-play'
        ]);
    }


    /** Совместимость со старыми ссылками. Новый URL намеренно не пересекается с /public/games. */
    public function legacyPlay($slug): void
    {
        $this->requireAuth();
        header('Location: /game/' . rawurlencode((string)$slug) . '/play', true, 302);
        exit;
    }

    public function library(): void
    {
        $userId=$this->requireAuthJson();
        $this->json(['success'=>true,'games'=>Game::getLibrary($userId),'collections'=>Game::getCollections($userId),'categories'=>Game::getCategoriesWithCount()]);
    }

    public function collectionGames(): void
    {
        $userId=$this->requireAuthJson(); $id=(int)($_GET['collection_id']??0);
        if($id<1)$this->json(['success'=>false,'error'=>'Некорректная коллекция'],400);
        $this->json(['success'=>true,'games'=>Game::getCollectionGames($userId,$id)]);
    }

    public function favorite(): void
    {
        $userId=$this->requireAuthJson(); $gameId=(int)$this->post('game_id',0);
        if(!$gameId || !Game::getById($gameId))$this->json(['success'=>false,'error'=>'Игра не найдена'],404);
        Game::toggleFavorite($userId,$gameId); $state=Game::getUserGame($userId,$gameId);
        $this->json(['success'=>true,'is_favorite'=>(bool)($state['is_favorite']??false)]);
    }

    public function createCollection(): void
    {
        $userId=$this->requireAuthJson(); $collection=Game::createCollection($userId,(string)$this->post('name',''));
        if(!$collection)$this->json(['success'=>false,'error'=>'Введите название коллекции'],422);
        $this->json(['success'=>true,'collection'=>$collection]);
    }
    public function deleteCollection(): void
    {
        $userId=$this->requireAuthJson(); $id=(int)$this->post('collection_id',0);
        if(!Game::deleteCollection($userId,$id))$this->json(['success'=>false,'error'=>'Коллекция не найдена'],404);
        $this->json(['success'=>true]);
    }
    public function addToCollection(): void
    {
        $userId=$this->requireAuthJson(); $collection=(int)$this->post('collection_id',0); $game=(int)$this->post('game_id',0);
        if(!$collection||!$game||!Game::getById($game))$this->json(['success'=>false,'error'=>'Некорректные данные'],422);
        if(!Game::addToCollection($userId,$collection,$game))$this->json(['success'=>false,'error'=>'Коллекция не найдена'],404);
        $this->json(['success'=>true]);
    }
    public function removeFromCollection(): void
    {
        $userId=$this->requireAuthJson(); $collection=(int)$this->post('collection_id',0); $game=(int)$this->post('game_id',0);
        $this->json(['success'=>Game::removeFromCollection($userId,$collection,$game)]);
    }
    public function review(): void
    {
        $userId=$this->requireAuthJson(); $gameId=(int)$this->post('game_id',0); $text=(string)$this->post('body',''); $recommended=(string)$this->post('recommended','1')==='1';
        if(!$gameId||!Game::getById($gameId))$this->json(['success'=>false,'error'=>'Игра не найдена'],404);
        if(!Game::saveReview($userId,$gameId,$recommended,$text))$this->json(['success'=>false,'error'=>'Напишите отзыв'],422);
        $this->json(['success'=>true]);
    }
    public function achievements(): void
    {
        $userId=$this->requireAuthJson(); $gameId=(int)($_GET['game_id']??0);
        $this->json(['success'=>true,'achievements'=>Game::getAchievementStats($gameId,$userId)]);
    }
    public function presence(): void
    {
        $userId=$this->requireAuthJson(); $gameId=(int)$this->post('game_id',0); $game=Game::getById($gameId);
        if(!$game)$this->json(['success'=>false,'error'=>'Игра не найдена'],404);
        if((string)$this->post('state','active')==='stop') Game::stopPresence($userId,$gameId); else Game::heartbeat($userId,$gameId,(string)$game['title']);
        $this->json(['success'=>true,'online_players'=>Game::getOnlinePlayers($gameId)]);
    }
    public function playtime(): void
    {
        $userId=$this->requireAuthJson(); $gameId=(int)$this->post('game_id',0); $seconds=(int)$this->post('seconds',0);
        if(!$gameId||!Game::getById($gameId))$this->json(['success'=>false,'error'=>'Игра не найдена'],404);
        $this->json(['success'=>true,'stats'=>Game::addPlayMinutes($userId,$gameId,$seconds)]);
    }
}
