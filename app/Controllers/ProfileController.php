<?php

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Database;
use App\Core\View;
use App\Models\User;

class ProfileController
{
    private const SHOWCASES = [
        1 => ['title' => 'Недавние игры', 'icon' => '🎮'],
        2 => ['title' => 'Достижения', 'icon' => '🏆'],
        3 => ['title' => 'Друзья', 'icon' => '👥'],
        4 => ['title' => 'Статистика', 'icon' => '📊'],
        5 => ['title' => 'Медиа', 'icon' => '🖼️'],
    ];

    private const FRAMES = [
        1 => 'border: 4px solid #6c63ff;',
        2 => 'border: 4px solid #ff6b6b; border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%;',
        3 => 'border: 4px solid #feca57; border-radius: 50% 50% 50% 0;',
        4 => 'border: 4px solid #48dbfb; border-radius: 30% 70% 50% 50% / 50% 40% 60% 50%;',
        5 => 'border: 4px solid #ff9ff3; border-radius: 50% 50% 0 50%;',
    ];

    public function show()
    {
        return $this->renderUser((int)Auth::getUserId());
    }

    public function edit()
    {
        if (!Auth::isLoggedIn()) {
            header('Location: /login');
            exit;
        }

        $user = User::findById(Auth::getUserId());
        if (!$user) {
            Auth::logout();
        }

        $frames = [
            1 => 'Стандартная',
            2 => 'Волна',
            3 => 'Золотая',
            4 => 'Ледяная',
            5 => 'Розовая',
        ];

        View::render('profile/edit', [
            'title' => 'Редактирование профиля — N-A-V-A',
            'user' => $user,
            'frames' => $frames,
            'showcasesList' => array_map(
                static fn($row) => $row['title'],
                self::SHOWCASES
            ),
            'page_css' => 'profile-edit',
            'page_js' => 'profile-edit'
        ]);
    }

    public function update()
    {
        if (!Auth::isLoggedIn()) {
            header('Location: /login');
            exit;
        }

        $userId = (int)Auth::getUserId();
        $nickname = trim((string)($_POST['nickname'] ?? 'Игрок'));
        $status = (string)($_POST['status'] ?? 'online');
        $bio = trim((string)($_POST['bio'] ?? ''));
        $avatarFrame = (int)($_POST['avatar_frame'] ?? 1);
        $activeBadge = isset($_POST['active_badge']) && $_POST['active_badge'] !== ''
            ? (int)$_POST['active_badge']
            : null;
        $playingText = trim((string)($_POST['playing_text'] ?? ''));

        if ($nickname === '') $nickname = 'Игрок';
        $nickname = mb_substr($nickname, 0, 30);
        $bio = mb_substr($bio, 0, 500);
        $playingText = mb_substr($playingText, 0, 100);

        $allowedStatuses = ['online', 'away', 'playing', 'offline'];
        if (!in_array($status, $allowedStatuses, true)) $status = 'online';
        if ($avatarFrame < 1 || $avatarFrame > 5) $avatarFrame = 1;
        if ($activeBadge !== null && ($activeBadge < 1 || $activeBadge > 5)) $activeBadge = null;

        $showcases = $_POST['showcases'] ?? [1, 2, 3];
        if (!is_array($showcases)) $showcases = [1, 2, 3];
        $showcases = array_values(array_unique(array_filter(array_map('intval', $showcases), static function($id) {
            return isset(self::SHOWCASES[$id]);
        })));
        $showcases = array_slice($showcases, 0, 3);
        if (!$showcases) $showcases = [1, 2, 3];

        User::updateProfile($userId, [
            'nickname' => $nickname,
            'status' => $status,
            'bio' => $bio,
            'avatar_frame' => $avatarFrame,
            'active_badge' => $activeBadge,
            'playing_text' => $playingText,
            'showcases' => json_encode($showcases, JSON_UNESCAPED_UNICODE),
        ]);

        $this->handleImageUpload(
            'profile_background',
            $userId,
            'backgrounds',
            ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
            6,
            'profile_background'
        );
        $this->handleImageUpload(
            'avatar',
            $userId,
            'avatars',
            ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
            4,
            'avatar_url'
        );

        header('Location: /profile');
        exit;
    }

    public function comment()
    {
        if (!Auth::isLoggedIn()) {
            $this->json(['error' => 'Unauthorized'], 401);
        }

        $userId = (int)($_POST['user_id'] ?? 0);
        $text = trim((string)($_POST['text'] ?? ''));

        if (!$userId || !User::findById($userId)) {
            $this->json(['error' => 'Пользователь не найден'], 404);
        }
        if ($text === '') $this->json(['error' => 'Введите комментарий'], 400);

        User::addComment($userId, (int)Auth::getUserId(), mb_substr($text, 0, 1000));
        $this->json(['success' => true]);
    }

    public function showUser($id)
    {
        return $this->renderUser((int)$id);
    }

    private function renderUser($userId)
    {
        if (!Auth::isLoggedIn()) {
            header('Location: /login');
            exit;
        }

        $user = User::findById($userId);
        if (!$user) {
            http_response_code(404);
            exit('Пользователь не найден');
        }

        $comments = User::getComments($userId);
        $userFrame = self::FRAMES[$user['avatar_frame'] ?? 1] ?? self::FRAMES[1];

        $userShowcases = json_decode($user['showcases'] ?? '[]', true);
        if (!is_array($userShowcases) || count($userShowcases) < 3) {
            $userShowcases = [1, 2, 3];
        }

        $selectedShowcases = [];
        foreach ($userShowcases as $id) {
            if (isset(self::SHOWCASES[$id])) $selectedShowcases[] = self::SHOWCASES[$id];
        }

        View::render('profile', [
            'title' => 'Профиль — N-A-V-A',
            'user' => $user,
            'comments' => $comments,
            'userFrame' => $userFrame,
            'selectedShowcases' => $selectedShowcases,
            'page_css' => 'profile',
            'page_js' => 'profile'
        ]);
    }

    private function handleImageUpload($field, $userId, $folder, array $allowedMimeTypes, $maxMb, $dbField)
    {
        if (empty($_FILES[$field]) || $_FILES[$field]['error'] === UPLOAD_ERR_NO_FILE) return;
        if ($_FILES[$field]['error'] !== UPLOAD_ERR_OK) return;

        $file = $_FILES[$field];
        $maxBytes = $maxMb * 1024 * 1024;

        if ((int)$file['size'] <= 0 || (int)$file['size'] > $maxBytes) return;

        $finfo = new \finfo(FILEINFO_MIME_TYPE);
        $mime = $finfo->file($file['tmp_name']);
        if (!in_array($mime, $allowedMimeTypes, true)) return;

        $extensions = [
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
            'image/gif' => 'gif',
        ];
        $ext = $extensions[$mime] ?? 'bin';

        $dir = __DIR__ . "/../../public/assets/images/{$folder}/";
        if (!is_dir($dir)) @mkdir($dir, 0755, true);
        if (!is_dir($dir)) return;

        $filename = $field . '_' . $userId . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
        $target = $dir . $filename;

        if (!move_uploaded_file($file['tmp_name'], $target)) return;

        $url = "/assets/images/{$folder}/{$filename}";
        User::updateProfile($userId, [$dbField => $url]);
    }

    private function json(array $data, $status = 200)
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }
}
