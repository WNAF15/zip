<?php

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Database;
use App\Core\View;
use App\Models\Chat;
use App\Models\Message;
use App\Models\MessageAttachment;
use App\Models\User;
use App\Models\UserBlock;

class ChatController
{
    private function requireAuthJson()
    {
        if (!Auth::isLoggedIn()) {
            $this->json(['error' => 'Unauthorized'], 401);
        }
    }

    private function json(array $data, $status = 200)
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    private function enrichMessages(array $messages, $currentUserId)
    {
        $ids = array_values(array_map(static fn($row) => (int)$row['id'], $messages));
        $attachments = MessageAttachment::getForMessages($ids);
        $byMessage = [];
        foreach ($attachments as $attachment) {
            $byMessage[(int)$attachment['message_id']][] = $attachment;
        }

        foreach ($messages as &$message) {
            $message['id'] = (int)$message['id'];
            $message['chat_id'] = (int)$message['chat_id'];
            $message['user_id'] = (int)$message['user_id'];
            $message['is_owner'] = ((int)$message['user_id'] === (int)$currentUserId);
            $message['nickname'] = $message['nickname'] ?: 'Пользователь';
            $message['avatar_url'] = $message['avatar_url'] ?: '/assets/images/default-avatar.png';
            $message['is_pinned'] = !empty($message['is_pinned']);
            $message['reply_to_message_id'] = $message['reply_to_message_id'] ? (int)$message['reply_to_message_id'] : null;
            $message['forwarded_message_id'] = $message['forwarded_message_id'] ? (int)$message['forwarded_message_id'] : null;
            $message['forwarded_from_user_id'] = $message['forwarded_from_user_id'] ? (int)$message['forwarded_from_user_id'] : null;
            $message['forwarded_hide_author'] = !empty($message['forwarded_hide_author']);
            $message['reply_nickname'] = $message['reply_nickname'] ?? '';
            $message['reply_message'] = $message['reply_message'] ?? '';
            $message['reply_edited_at'] = $message['reply_edited_at'] ?? null;
            $message['reply_deleted_at'] = $message['reply_deleted_at'] ?? null;
            $message['forwarded_nickname'] = $message['forwarded_nickname'] ?? '';
            $message['attachments'] = $byMessage[(int)$message['id']] ?? [];
        }
        unset($message);

        return $messages;
    }

    private function requireChatMember($chatId, $userId)
    {
        if (!$chatId || !Chat::isMember($chatId, $userId)) {
            $this->json(['error' => 'Доступ запрещён'], 403);
        }
    }

    private function getOwnedMessageOrFail($messageId, $userId, $chatId = 0)
    {
        $message = Message::getById($messageId);
        if (!$message || (int)$message['user_id'] !== (int)$userId) {
            $this->json(['error' => 'Доступ запрещён'], 403);
        }

        if ($chatId && (int)$message['chat_id'] !== (int)$chatId) {
            $this->json(['error' => 'Сообщение принадлежит другому чату'], 400);
        }

        $this->requireChatMember((int)$message['chat_id'], $userId);
        return $message;
    }

    private function getOtherPrivateUserIdOrFail($chatId, $userId)
    {
        $chat = Chat::getById($chatId);
        if (!$chat || $chat['type'] !== 'private') {
            $this->json(['error' => 'Это доступно только в личном чате'], 400);
        }

        $otherId = Chat::getOtherPrivateUserId($chatId, $userId);
        if (!$otherId) {
            $this->json(['error' => 'Собеседник не найден'], 404);
        }

        return $otherId;
    }

    public function index()
    {
        if (!Auth::isLoggedIn()) {
            header('Location: /login');
            exit;
        }

        $userId = Auth::getUserId();
        $generalChatId = Chat::getGeneralChat();

        if (!Chat::isMember($generalChatId, $userId)) {
            Chat::addMember($generalChatId, $userId);
            Chat::ensureSettings($generalChatId, $userId);
        }

        $chats = Chat::getUserChats($userId);
        $activeChatId = (int)($_GET['chat'] ?? $generalChatId);
        $activeChat = Chat::getById($activeChatId);

        if (!$activeChat || !Chat::isMember($activeChatId, $userId)) {
            $activeChatId = $generalChatId;
            $activeChat = Chat::getById($generalChatId);
        }

        $messages = $this->enrichMessages(Message::getMessages($activeChatId), $userId);
        $members = Chat::getMembers($activeChatId);
        $pinnedMessages = $activeChat && $activeChat['type'] !== 'general'
            ? Message::getPinned($activeChatId)
            : [];

        // Sidebar already contains this user's per-chat settings and the other user
        // for private dialogs. Reuse that row instead of issuing extra queries.
        $activeListChat = null;
        foreach ($chats as $listChat) {
            if ((int)$listChat['id'] === $activeChatId) {
                $activeListChat = $listChat;
                break;
            }
        }

        $activeSettings = [
            'pinned_at' => $activeListChat['pinned_at'] ?? null,
            'muted_until' => $activeListChat['muted_until'] ?? null,
        ];

        $activeOtherUserId = ($activeChat['type'] ?? '') === 'private'
            ? (int)($activeListChat['other_user_id'] ?? 0)
            : 0;

        $blockedInPrivate = $activeOtherUserId
            ? UserBlock::isBlocked($userId, $activeOtherUserId)
            : false;

        $blockedByOtherInPrivate = $activeOtherUserId
            ? UserBlock::isBlocked($activeOtherUserId, $userId)
            : false;

        View::render('chat', [
            'title' => 'Сообщения — N-A-V-A',
            'chats' => $chats,
            'activeChat' => $activeChat,
            'activeChatId' => $activeChatId,
            'messages' => $messages,
            'members' => $members,
            'pinnedMessages' => $pinnedMessages,
            'userId' => $userId,
            'activeSettings' => $activeSettings,
            'activeOtherUserId' => $activeOtherUserId,
            'blockedInPrivate' => $blockedInPrivate,
            'blockedByOtherInPrivate' => $blockedByOtherInPrivate,
            'page_css' => 'chat',
            'page_js' => 'chat'
        ]);
    }

    public function getMessages()
    {
        $this->requireAuthJson();

        $chatId = (int)($_GET['chat_id'] ?? 0);
        $userId = (int)Auth::getUserId();
        if (!$chatId) $this->json(['error' => 'Invalid chat ID'], 400);

        $state = Chat::getMemberRevision($chatId, $userId);
        if (!$state) $this->json(['error' => 'Доступ запрещён'], 403);

        $clientVersion = (int)($_GET['version'] ?? 0);
        $serverVersion = (int)$state['version'];

        if ($clientVersion > 0 && $clientVersion === $serverVersion) {
            $this->json([
                'success' => true,
                'changed' => false,
                'version' => $serverVersion,
                'chat_type' => $state['type'],
                'server_time' => time()
            ]);
        }

        $messages = $this->enrichMessages(
            Message::getMessages($chatId),
            $userId
        );
        $pinned = $state['type'] !== 'general'
            ? Message::getPinned($chatId)
            : [];

        $this->json([
            'success' => true,
            'changed' => true,
            'messages' => $messages,
            'pinned_messages' => $pinned,
            'chat_type' => $state['type'],
            'version' => $serverVersion,
            'server_time' => time()
        ]);
    }

    public function getChats()
    {
        $this->requireAuthJson();
        $userId = (int)Auth::getUserId();
        $chats = Chat::getUserChats($userId);

        foreach ($chats as &$chat) {
            $chat['id'] = (int)$chat['id'];
            $chat['member_count'] = (int)($chat['member_count'] ?? 0);
            $chat['name'] = $chat['name'] ?? '';
            $chat['is_pinned_chat'] = !empty($chat['is_pinned_chat']);
            $chat['muted_until'] = $chat['muted_until'] ?? null;
            $chat['is_muted'] = !empty($chat['is_muted']);
            $chat['other_user_id'] = (int)($chat['other_user_id'] ?? 0);
            $chat['other_blocked_by_me'] = !empty($chat['other_blocked_by_me']);
            $chat['other_blocked_me'] = !empty($chat['other_blocked_me']);
            $chat['other_presence_status'] = $chat['other_presence_status'] ?? 'offline';
            $chat['can_delete_chat'] = $chat['type'] === 'private'
                || ($chat['type'] === 'group' &&
                    ((int)($chat['created_by'] ?? 0) === $userId || Auth::isAdmin()));
        }
        unset($chat);

        $this->json([
            'success' => true,
            'chats' => $chats,
            'server_time' => time()
        ]);
    }

    public function sidebarState()
    {
        $this->requireAuthJson();
        $this->json([
            'success' => true,
            'state' => Chat::getSidebarState((int)Auth::getUserId())
        ]);
    }

    public function send()
    {
        $this->requireAuthJson();

        $chatId = (int)($_POST['chat_id'] ?? 0);
        $message = trim((string)($_POST['message'] ?? ''));
        $replyTo = (int)($_POST['reply_to_message_id'] ?? 0);
        $replyQuote = trim((string)($_POST['reply_quote'] ?? ''));
        $attachmentIds = $_POST['attachment_ids'] ?? [];
        $userId = (int)Auth::getUserId();

        if (!is_array($attachmentIds)) {
            $attachmentIds = preg_split('/\s*,\s*/', (string)$attachmentIds, -1, PREG_SPLIT_NO_EMPTY);
        }
        $attachmentIds = array_values(array_unique(array_filter(array_map('intval', $attachmentIds), static fn($id) => $id > 0)));

        $this->requireChatMember($chatId, $userId);

        $chat = Chat::getById($chatId);
        if (!$chat) $this->json(['error' => 'Чат не найден'], 404);

        if ($chat['type'] === 'private') {
            $otherId = Chat::getOtherPrivateUserId($chatId, $userId);
            if ($otherId && UserBlock::eitherBlocked($userId, $otherId)) {
                $this->json(['error' => 'Отправка сообщений заблокирована'], 403);
            }
        }

        if ($message === '' && !$attachmentIds) $this->json(['error' => 'Введите сообщение или добавьте файл'], 400);
        if (mb_strlen($message) > 4000) $message = mb_substr($message, 0, 4000);

        $readyAttachments = $attachmentIds
            ? MessageAttachment::getReadyForUser($attachmentIds, $userId, $chatId)
            : [];
        if (count($readyAttachments) !== count($attachmentIds)) {
            $this->json(['error' => 'Один или несколько файлов недоступны или истекли'], 400);
        }

        if ($replyTo) {
            $replyMessage = Message::getById($replyTo);
            if (!$replyMessage || (int)$replyMessage['chat_id'] !== $chatId) {
                $replyTo = 0;
                $replyQuote = '';
            }
        }

        if (mb_strlen($replyQuote) > 500) {
            $replyQuote = mb_substr($replyQuote, 0, 500);
        }

        $messageId = Message::send(
            $chatId,
            $userId,
            $message,
            $replyTo ?: null,
            $replyQuote ?: null
        );

        if ($readyAttachments) {
            MessageAttachment::attachToMessage($messageId, $readyAttachments);
        }

        $this->stopTypingForUser($chatId, $userId);

        $this->json([
            'success' => true,
            'message_id' => $messageId,
            'version' => Chat::getRevision($chatId)
        ]);
    }

    public function edit()
    {
        $this->requireAuthJson();

        $messageId = (int)($_POST['message_id'] ?? 0);
        $chatId = (int)($_POST['chat_id'] ?? 0);
        $newText = trim((string)($_POST['message'] ?? ''));
        $userId = (int)Auth::getUserId();

        if (!$messageId || !$chatId || $newText === '') {
            $this->json(['error' => 'Неверные данные'], 400);
        }

        if (mb_strlen($newText) > 4000) {
            $newText = mb_substr($newText, 0, 4000);
        }

        $this->getOwnedMessageOrFail($messageId, $userId, $chatId);
        $stmt = Message::update($messageId, $newText, $chatId);

        if ($stmt->rowCount() <= 0) {
            $this->json(['error' => 'Сообщение уже изменено или удалено'], 409);
        }

        $this->json([
            'success' => true,
            'version' => Chat::getRevision($chatId)
        ]);
    }

    public function delete()
    {
        $this->requireAuthJson();

        $messageId = (int)($_POST['message_id'] ?? 0);
        $chatId = (int)($_POST['chat_id'] ?? 0);
        $userId = (int)Auth::getUserId();

        if (!$messageId || !$chatId) {
            $this->json(['error' => 'Invalid message ID'], 400);
        }

        $this->requireChatMember($chatId, $userId);

        $message = Message::getById($messageId);
        if (!$message || (int)$message['chat_id'] !== $chatId) {
            $this->json(['error' => 'Сообщение не найдено'], 404);
        }

        $chat = Chat::getById($chatId);
        if (!$chat) $this->json(['error' => 'Чат не найден'], 404);

        $isOwner = (int)$message['user_id'] === $userId;
        $isAdmin = Auth::isAdmin();
        $canDelete = $isOwner
            || $chat['type'] === 'private'
            || $isAdmin
            || ($chat['type'] === 'group' && (int)($chat['created_by'] ?? 0) === $userId);

        if (!$canDelete) {
            $this->json(['error' => 'Удалять это сообщение может только автор или администратор'], 403);
        }

        if (!Message::delete($messageId, $chatId, $userId)) {
            $this->json(['error' => 'Не удалось удалить сообщение'], 500);
        }

        $this->json([
            'success' => true,
            'message_id' => $messageId,
            'version' => Chat::getRevision($chatId)
        ]);
    }

    public function replyMeta()
    {
        $this->requireAuthJson();

        $messageId = (int)($_GET['message_id'] ?? 0);
        $chatId = (int)($_GET['chat_id'] ?? 0);
        $userId = (int)Auth::getUserId();

        $this->requireChatMember($chatId, $userId);

        $message = Message::getById($messageId);
        if (!$message || (int)$message['chat_id'] !== $chatId) {
            $this->json(['error' => 'Сообщение не найдено'], 404);
        }

        $this->json([
            'success' => true,
            'message' => [
                'id' => (int)$message['id'],
                'user_id' => (int)$message['user_id'],
                'nickname' => $message['nickname'] ?: 'Пользователь',
                'message' => $message['message']
            ]
        ]);
    }

    public function forward()
    {
        $this->requireAuthJson();

        $sourceMessageId = (int)($_POST['message_id'] ?? 0);
        $targetChats = $_POST['target_chat_ids'] ?? [];
        $hideAuthor = !empty($_POST['hide_author']);
        $userId = (int)Auth::getUserId();

        if (!is_array($targetChats)) {
            $targetChats = preg_split('/\s*,\s*/', (string)$targetChats, -1, PREG_SPLIT_NO_EMPTY);
        }

        $targetChats = array_values(array_unique(array_map('intval', $targetChats)));
        if (!$sourceMessageId || !$targetChats) {
            $this->json(['error' => 'Выберите сообщение и хотя бы один чат'], 400);
        }

        $source = Message::getById($sourceMessageId);
        if (!$source || !Chat::isMember((int)$source['chat_id'], $userId)) {
            $this->json(['error' => 'Сообщение не найдено'], 404);
        }

        $created = [];
        foreach ($targetChats as $targetChatId) {
            if ($targetChatId <= 0 || !Chat::isMember($targetChatId, $userId)) continue;

            $targetChat = Chat::getById($targetChatId);
            if (!$targetChat || $targetChat['type'] === 'general') continue;

            if ($targetChat['type'] === 'private') {
                $otherId = Chat::getOtherPrivateUserId($targetChatId, $userId);
                if ($otherId && UserBlock::eitherBlocked($userId, $otherId)) continue;
            }

            $created[] = Message::forward(
                $targetChatId,
                $userId,
                $source['message'],
                $sourceMessageId,
                (int)$source['user_id'],
                $hideAuthor
            );
        }

        if (!$created) {
            $this->json(['error' => 'Нет доступных чатов для пересылки'], 403);
        }

        $this->json(['success' => true, 'created' => $created]);
    }

    public function pin()
    {
        $this->requireAuthJson();

        $chatId = (int)($_POST['chat_id'] ?? 0);
        $messageId = (int)($_POST['message_id'] ?? 0);
        $userId = (int)Auth::getUserId();

        $this->requireChatMember($chatId, $userId);

        $chat = Chat::getById($chatId);
        if (!$chat || $chat['type'] === 'general') {
            $this->json(['error' => 'В общем чате закрепление отключено'], 403);
        }

        $message = Message::getById($messageId);
        if (!$message || (int)$message['chat_id'] !== $chatId) {
            $this->json(['error' => 'Сообщение не найдено'], 404);
        }

        Message::pin($chatId, $messageId, $userId);
        $this->json([
            'success' => true,
            'version' => Chat::getRevision($chatId)
        ]);
    }

    public function unpin()
    {
        $this->requireAuthJson();

        $chatId = (int)($_POST['chat_id'] ?? 0);
        $messageId = (int)($_POST['message_id'] ?? 0);
        $userId = (int)Auth::getUserId();

        $this->requireChatMember($chatId, $userId);

        $chat = Chat::getById($chatId);
        if (!$chat || $chat['type'] === 'general') {
            $this->json(['error' => 'В общем чате закрепление отключено'], 403);
        }

        Message::unpin($chatId, $messageId);
        $this->json([
            'success' => true,
            'version' => Chat::getRevision($chatId)
        ]);
    }

    public function chatPin()
    {
        $this->requireAuthJson();

        $chatId = (int)($_POST['chat_id'] ?? 0);
        $userId = (int)Auth::getUserId();

        $this->requireChatMember($chatId, $userId);

        $chat = Chat::getById($chatId);
        if (!$chat || $chat['type'] === 'general') {
            $this->json(['error' => 'Общий чат всегда находится сверху'], 403);
        }

        $settings = Chat::getSettings($chatId, $userId);
        $pin = isset($_POST['pin'])
            ? (int)$_POST['pin']
            : (!empty($settings['pinned_at']) ? 0 : 1);

        Chat::setPinned($chatId, $userId, $pin === 1);

        $this->json([
            'success' => true,
            'pinned' => $pin === 1
        ]);
    }

    public function chatMute()
    {
        $this->requireAuthJson();

        $chatId = (int)($_POST['chat_id'] ?? 0);
        $mode = (string)($_POST['mode'] ?? 'off');
        $userId = (int)Auth::getUserId();

        $this->requireChatMember($chatId, $userId);

        $until = null;
        if ($mode === '1h') $until = date('Y-m-d H:i:s', time() + 3600);
        elseif ($mode === '8h') $until = date('Y-m-d H:i:s', time() + 8 * 3600);
        elseif ($mode === '24h') $until = date('Y-m-d H:i:s', time() + 24 * 3600);
        elseif ($mode === 'forever') $until = '2099-12-31 23:59:59';
        elseif ($mode !== 'off') $this->json(['error' => 'Неизвестный режим тишины'], 400);

        Chat::setMute($chatId, $userId, $until);

        $this->json([
            'success' => true,
            'muted_until' => $until,
            'mode' => $mode
        ]);
    }

    public function deleteChat()
    {
        $this->requireAuthJson();

        $chatId = (int)($_POST['chat_id'] ?? 0);
        $userId = (int)Auth::getUserId();

        $this->requireChatMember($chatId, $userId);

        $chat = Chat::getById($chatId);
        if (!$chat) $this->json(['error' => 'Чат не найден'], 404);

        if ($chat['type'] === 'general') {
            $this->json(['error' => 'Общий чат удалить нельзя'], 403);
        }

        // Personal chat: remove from both participants; group: only owner/admin.
        if ($chat['type'] === 'group'
            && (int)($chat['created_by'] ?? 0) !== $userId
            && !Auth::isAdmin()) {
            $this->json(['error' => 'Группу может удалить только создатель или администратор'], 403);
        }

        if (!Chat::deleteWholeChat($chatId)) {
            $this->json(['error' => 'Не удалось удалить чат'], 500);
        }

        $this->json(['success' => true, 'chat_id' => $chatId]);
    }

    public function leaveGroup()
    {
        $this->requireAuthJson();

        $chatId = (int)($_POST['chat_id'] ?? 0);
        $userId = (int)Auth::getUserId();

        $this->requireChatMember($chatId, $userId);

        $chat = Chat::getById($chatId);
        if (!$chat || $chat['type'] !== 'group') {
            $this->json(['error' => 'Это не группа'], 400);
        }

        if ((int)($chat['created_by'] ?? 0) === $userId) {
            $this->json(['error' => 'Создателю группы доступно удаление группы'], 403);
        }

        if (!Chat::leaveGroup($chatId, $userId)) {
            $this->json(['error' => 'Не удалось выйти из группы'], 500);
        }

        $this->json(['success' => true, 'chat_id' => $chatId]);
    }

    public function blockUser()
    {
        $this->requireAuthJson();

        $chatId = (int)($_POST['chat_id'] ?? 0);
        $userId = (int)Auth::getUserId();

        $this->requireChatMember($chatId, $userId);
        $otherId = $this->getOtherPrivateUserIdOrFail($chatId, $userId);

        UserBlock::block($userId, $otherId);

        $this->json([
            'success' => true,
            'blocked' => true,
            'user_id' => $otherId
        ]);
    }

    public function unblockUser()
    {
        $this->requireAuthJson();

        $chatId = (int)($_POST['chat_id'] ?? 0);
        $userId = (int)Auth::getUserId();

        $this->requireChatMember($chatId, $userId);
        $otherId = $this->getOtherPrivateUserIdOrFail($chatId, $userId);

        UserBlock::unblock($userId, $otherId);

        $this->json([
            'success' => true,
            'blocked' => false,
            'user_id' => $otherId
        ]);
    }

    public function createPrivate()
    {
        $this->requireAuthJson();

        $targetUserId = (int)($_POST['user_id'] ?? 0);
        $currentUserId = (int)Auth::getUserId();

        if (!$targetUserId
            || $targetUserId === $currentUserId
            || !User::findById($targetUserId)) {
            $this->json(['error' => 'Пользователь не найден'], 400);
        }

        $chatId = Chat::createPrivateChat($currentUserId, $targetUserId);
        $this->json(['success' => true, 'chat_id' => $chatId]);
    }

    public function createGroup()
    {
        $this->requireAuthJson();

        $name = trim((string)($_POST['name'] ?? ''));
        $membersRaw = $_POST['members'] ?? '';
        $currentUserId = (int)Auth::getUserId();

        if ($name === '') {
            $this->json(['error' => 'Введите название группы'], 400);
        }

        $memberIds = is_array($membersRaw)
            ? $membersRaw
            : preg_split('/\s*,\s*/', (string)$membersRaw, -1, PREG_SPLIT_NO_EMPTY);

        $memberIds = array_values(array_unique(array_map('intval', $memberIds)));
        $memberIds = array_values(array_filter(
            $memberIds,
            static fn($id) => $id > 0 && $id !== $currentUserId
        ));

        if (!$memberIds) {
            $this->json(['error' => 'Добавьте хотя бы одного участника'], 400);
        }

        foreach ($memberIds as $memberId) {
            if (!User::findById($memberId)) {
                $this->json(['error' => 'Один или несколько участников не найдены'], 400);
            }
        }

        try {
            $chatId = Chat::createGroup($currentUserId, $name, $memberIds);
        } catch (\Throwable $e) {
            error_log('NAVA create group error: ' . $e->getMessage());
            $this->json(['error' => 'Не удалось создать группу'], 500);
        }

        $this->json(['success' => true, 'chat_id' => $chatId]);
    }

    public function searchUsers()
    {
        $this->requireAuthJson();

        $query = trim((string)($_GET['q'] ?? ''));
        if (mb_strlen($query) < 2) {
            $this->json(['success' => true, 'users' => []]);
        }

        $this->json([
            'success' => true,
            'users' => User::search($query, Auth::getUserId())
        ]);
    }

    public function typing()
    {
        $this->requireAuthJson();

        $chatId = (int)($_POST['chat_id'] ?? 0);
        $state = ($_POST['state'] ?? 'typing') === 'stop' ? 'stop' : 'typing';
        $userId = (int)Auth::getUserId();

        $this->requireChatMember($chatId, $userId);

        if ($state === 'stop') {
            $this->stopTypingForUser($chatId, $userId);
        } else {
            Database::query(
                "INSERT INTO chat_typing (chat_id, user_id, updated_at)
                 VALUES (?, ?, NOW())
                 ON DUPLICATE KEY UPDATE updated_at = NOW()",
                [$chatId, $userId]
            );
        }

        $this->json(['success' => true]);
    }

    public function getTyping()
    {
        $this->requireAuthJson();

        $chatId = (int)($_GET['chat_id'] ?? 0);
        $userId = (int)Auth::getUserId();
        $this->requireChatMember($chatId, $userId);

        $stmt = Database::query(
            "SELECT u.id, u.nickname
             FROM chat_typing ct
             JOIN users u ON u.id = ct.user_id
             WHERE ct.chat_id = ?
               AND ct.user_id <> ?
               AND ct.updated_at >= DATE_SUB(NOW(), INTERVAL 4 SECOND)
             ORDER BY ct.updated_at DESC",
            [$chatId, $userId]
        );

        $rows = $stmt ? $stmt->fetchAll() : [];
        $names = array_values(array_map(
            static fn($row) => $row['nickname'] ?: 'Пользователь',
            $rows
        ));

        $visible = array_slice($names, 0, 3);

        $this->json([
            'success' => true,
            'users' => $visible,
            'total' => count($names),
            'hidden' => max(0, count($names) - count($visible))
        ]);
    }

    public function getOnlineMembers()
    {
        $this->requireAuthJson();

        $chatId = (int)($_GET['chat_id'] ?? 0);
        $this->requireChatMember($chatId, Auth::getUserId());

        $this->json(Chat::getOnlineMembers($chatId));
    }

    private function stopTypingForUser($chatId, $userId)
    {
        Database::query(
            "DELETE FROM chat_typing WHERE chat_id = ? AND user_id = ?",
            [(int)$chatId, (int)$userId]
        );
    }
}
