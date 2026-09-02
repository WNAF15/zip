<?php
use App\Models\Chat;

$currentUserId = (int)$userId;
$activeMembers = $members ?? [];
$activeName = 'Общий чат';
$activeSubtitle = 'Все участники сообщества';
$activeAvatar = '/assets/images/default-avatar.png';
if ($activeChat) {
    if ($activeChat['type'] === 'group') {
        $activeName = trim($activeChat['name'] ?? '') ?: 'Новая группа';
        $activeSubtitle = ((int)($activeChat['member_count'] ?? count($activeMembers))) . ' участников';
    } elseif ($activeChat['type'] === 'private') {
        foreach ($activeMembers as $member) {
            if ((int)$member['id'] !== $currentUserId) {
                $activeName = $member['nickname'] ?? 'Пользователь';
                $activeSubtitle = (($member['status'] ?? '') === 'online') ? 'в сети' : 'личный чат';
                $activeAvatar = ($member['avatar_url'] ?? '') ?: $activeAvatar;
                break;
            }
        }
    } else {
        $activeName = trim($activeChat['name'] ?? '') ?: 'Общий чат';
    }
}
$activeSettings = $activeSettings ?? [];
$isActiveMuted = !empty($activeSettings['muted_until']) && strtotime($activeSettings['muted_until']) > time();
$isActivePinned = !empty($activeSettings['pinned_at']);
$activeOtherUserId = (int)($activeOtherUserId ?? 0);
$blockedInPrivate = !empty($blockedInPrivate);
$blockedByOtherInPrivate = !empty($blockedByOtherInPrivate);
?>

<div class="chat-page" id="chatPage"
     data-current-user-id="<?= $currentUserId ?>"
     data-active-chat-id="<?= (int)($activeChatId ?? 0) ?>"
     data-active-chat-type="<?= htmlspecialchars($activeChat['type'] ?? 'general') ?>"
     data-active-other-user-id="<?= $activeOtherUserId ?>"
     data-active-muted="<?= $isActiveMuted ? '1' : '0' ?>"
     data-active-blocked="<?= $blockedInPrivate ? '1' : '0' ?>"
     data-active-blocked-by-other="<?= $blockedByOtherInPrivate ? '1' : '0' ?>">

    <aside class="chat-sidebar">
        <div class="chat-sidebar-header">
            <div><span class="chat-overline">N-A-V-A</span><h2>Сообщения</h2></div>
            <button class="btn-new-chat" id="newChatBtn" type="button" aria-label="Создать чат">+</button>
        </div>
        <div class="chat-list" id="chatList">
            <?php if (!empty($chats)): ?>
                <?php foreach ($chats as $chat): ?>
                    <?php
                    $chatId = (int)$chat['id'];
                    $type = $chat['type'];
                    $name = trim($chat['name'] ?? '') ?: ($type === 'general' ? 'Общий чат' : 'Чат');
                    $avatar = '/assets/images/default-avatar.png';
                    $icon = $type === 'general' ? '✦' : ($type === 'group' ? '👥' : '💬');
                    $otherUserId = 0;
                    if ($type === 'private') {
                        $otherUserId = (int)($chat['other_user_id'] ?? 0);
                        $name = trim($chat['other_nickname'] ?? '') ?: 'Пользователь';
                        $avatar = trim($chat['other_avatar'] ?? '') ?: $avatar;
                    }
                    $preview = $chat['last_message'] ?: ($type === 'group' ? ((int)$chat['member_count'] . ' участников') : ($type === 'general' ? 'Все участники здесь' : 'Нет сообщений'));
                    $isPinned = !empty($chat['is_pinned_chat']);
                    $isMuted = !empty($chat['is_muted']);
                    $canDeleteChat = ($type === 'private') || ($type === 'group' && ((int)($chat['created_by'] ?? 0) === $currentUserId || \App\Core\Auth::isAdmin()));
                    ?>
                    <a href="/chat?chat=<?= $chatId ?>" class="chat-item <?= ($activeChat && (int)$activeChat['id'] === $chatId) ? 'active' : '' ?>" data-chat-id="<?= $chatId ?>" data-chat-type="<?= htmlspecialchars($type) ?>" data-chat-name="<?= htmlspecialchars($name) ?>" data-other-user-id="<?= $otherUserId ?>" data-pinned="<?= $isPinned ? '1' : '0' ?>" data-muted="<?= $isMuted ? '1' : '0' ?>" data-blocked-by-me="<?= !empty($chat['other_blocked_by_me']) ? '1' : '0' ?>" data-blocked-me="<?= !empty($chat['other_blocked_me']) ? '1' : '0' ?>" data-can-delete="<?= $canDeleteChat ? '1' : '0' ?>">
                        <div class="chat-item-avatar <?= $type === 'general' ? 'is-general' : '' ?>">
                            <?php if ($type === 'private' && $avatar !== '/assets/images/default-avatar.png'): ?><img src="<?= htmlspecialchars($avatar) ?>" alt=""><?php else: ?><span><?= $icon ?></span><?php endif; ?>
                        </div>
                        <div class="chat-info">
                            <div class="chat-name-row"><div class="chat-name"><span class="chat-name-text"><?= htmlspecialchars($name) ?></span><?php if ($isMuted): ?><span class="chat-muted-icon" title="Без звука">🔕</span><?php endif; ?><?php if ($isPinned && $type !== 'general'): ?><span class="chat-pinned-icon" title="Закреплено">📌</span><?php endif; ?></div><?php if (!empty($chat['last_message_time'])): ?><time class="chat-time"><?= date('H:i', strtotime($chat['last_message_time'])) ?></time><?php endif; ?></div>
                            <div class="chat-last-message"><?= htmlspecialchars($preview) ?></div>
                        </div>
                    </a>
                <?php endforeach; ?>
            <?php else: ?><div class="chat-empty">Чатов пока нет</div><?php endif; ?>
        </div>
    </aside>

    <section class="chat-main">
        <?php if ($activeChat): ?>
            <header class="chat-header">
                <div class="chat-header-main">
                    <div class="chat-header-avatar <?= $activeChat['type'] === 'general' ? 'is-general' : '' ?>">
                        <?php if ($activeChat['type'] === 'private' && $activeAvatar !== '/assets/images/default-avatar.png'): ?><img src="<?= htmlspecialchars($activeAvatar) ?>" alt=""><?php else: ?><span><?= $activeChat['type'] === 'group' ? '👥' : ($activeChat['type'] === 'general' ? '✦' : '💬') ?></span><?php endif; ?>
                    </div>
                    <div><div class="chat-header-name"><?= htmlspecialchars($activeName) ?></div><div class="chat-header-subtitle" id="chatHeaderSubtitle"><?= htmlspecialchars($activeSubtitle) ?></div></div>
                </div>
                <div class="chat-header-meta"><span class="chat-live-dot"></span><span>обновления включены</span></div>
            </header>

            <?php if ($activeChat['type'] !== 'private'): ?>
                <div class="chat-online" id="chatOnline"><div class="online-header">Сейчас в чате</div><div class="online-list" id="onlineList">
                    <?php foreach ($activeMembers as $member): ?><?php if (in_array($member['status'], ['online','away'], true)): ?><div class="online-item"><span class="online-dot <?= htmlspecialchars($member['status']) ?>"></span><img src="<?= htmlspecialchars($member['avatar_url'] ?: '/assets/images/default-avatar.png') ?>" alt=""><span><?= htmlspecialchars($member['nickname'] ?: 'Пользователь') ?></span></div><?php endif; ?><?php endforeach; ?>
                </div></div>
            <?php endif; ?>

            <div class="chat-pinned-bar" id="chatPinnedBar" hidden></div>
            <div class="chat-messages" id="chatMessages" aria-live="polite"></div>
            <div class="typing-status" id="typingStatus" aria-live="polite"></div>
            <?php if ($activeChat['type'] === 'private'): ?><div class="chat-blocked-banner" id="chatBlockedBanner" <?= ($blockedInPrivate || $blockedByOtherInPrivate) ? '' : 'hidden' ?>><?php if ($blockedInPrivate): ?>Пользователь заблокирован. <button type="button" id="unblockFromBanner">Разблокировать</button><?php elseif ($blockedByOtherInPrivate): ?>Пользователь ограничил возможность писать вам.<?php endif; ?></div><?php endif; ?>

            <form class="chat-input-area" id="chatForm" autocomplete="off">
                <div class="input-composer">
                    <div class="message-context-reply-bar" id="messageReplyBar" hidden><div class="message-reply-mark"></div><div class="message-reply-copy"><strong id="messageReplyTitle">Ответ</strong><span id="messageReplyText"></span></div><button type="button" class="message-reply-close" id="cancelMessageReply" aria-label="Отменить ответ">×</button></div>
                    <div class="message-edit-bar" id="messageEditBar" hidden><div class="message-edit-mark"></div><div class="message-edit-copy"><strong>Редактирование сообщения</strong><span id="messageEditText"></span></div><button type="button" class="message-edit-close" id="cancelMessageEdit" aria-label="Отменить редактирование">×</button></div>
                    <div class="input-shell">
                        <textarea id="messageInput" class="chat-input" rows="1" maxlength="4000" placeholder="Написать сообщение…" aria-label="Сообщение"></textarea>
                        <div class="chat-media-queue" id="chatMediaQueue" hidden></div>
                        <div class="input-hint" id="messageInputHint">Enter — отправить · Shift + Enter — новая строка</div>
                    </div>
                </div>
                <div class="composer-actions">
                    <button class="btn-attach" id="attachMediaBtn" type="button" aria-label="Прикрепить файл" title="Фото, видео или аудио">＋</button>
                    <input id="chatMediaInput" type="file" accept="image/*,video/*,audio/*" multiple hidden>
                    <button class="btn-send" id="sendBtn" type="submit" aria-label="Отправить"><span>➤</span></button>
                </div>
            </form>
        <?php else: ?><div class="chat-empty-state"><div class="empty-state-orb">✦</div><h3>Выберите чат</h3><p>Личные диалоги, группы и общий чат — всё в одном месте.</p></div><?php endif; ?>
    </section>
</div>

<!-- Меню сообщений. Состав меню формируется JS каждый раз при ПКМ:
     для чужого сообщения кнопки "Изменить" физически не создаётся,
     а в общем чате "Закрепить" также физически отсутствует. -->
<div class="chat-context-menu message-context-menu" id="messageContextMenu" hidden role="menu" aria-label="Действия сообщения"></div>

<!-- Меню чатов -->
<div class="chat-context-menu chat-list-context-menu" id="chatContextMenu" hidden role="menu">
    <button type="button" data-action="chat-pin" id="chatPinAction"><span>📌</span><b>Закрепить</b></button>
    <button type="button" data-action="chat-mute" id="chatMuteAction"><span>🔕</span><b>Без звука</b></button>
    <button type="button" data-action="chat-block" id="chatBlockAction" hidden><span>🚫</span><b>Заблокировать</b></button>
    <button type="button" data-action="chat-leave" id="chatLeaveAction" hidden><span>↪</span>Выйти из группы</button>
    <button type="button" data-action="chat-delete" id="chatDeleteAction"><span>⌫</span>Удалить чат</button>
</div>
<div class="chat-mute-submenu" id="chatMuteSubmenu" hidden>
    <button type="button" data-mute="1h">1 час</button>
    <button type="button" data-mute="8h">8 часов</button>
    <button type="button" data-mute="24h">24 часа</button>
    <button type="button" data-mute="forever">Навсегда</button>
    <button type="button" data-mute="off" class="is-off">Включить звук</button>
</div>

<div class="modal-overlay" id="forwardModal" hidden>
    <div class="modal-content modal-wide" role="dialog" aria-modal="true" aria-labelledby="forwardTitle">
        <div class="modal-header"><div><span class="modal-overline">ПЕРЕСЫЛКА</span><h3 id="forwardTitle">Переслать сообщение</h3></div><button class="modal-close" id="forwardClose" type="button" aria-label="Закрыть">×</button></div>
        <label class="forward-author-toggle"><input type="checkbox" id="hideForwardAuthor"><span>Скрыть автора</span><small>получатели увидят сообщение без подписи «Переслано от…»</small></label>
        <div class="forward-chat-list" id="forwardChatList"></div>
        <div class="modal-footer"><span class="modal-error" id="forwardError"></span><button class="btn-cancel" id="forwardCancel" type="button">Отмена</button><button class="btn-modal-primary" id="forwardSubmit" type="button">Переслать</button></div>
    </div>
</div>

<div class="modal-overlay" id="newChatModal" hidden>
    <div class="modal-content modal-wide" role="dialog" aria-modal="true" aria-labelledby="newChatTitle">
        <div class="modal-header"><div><span class="modal-overline">СОЗДАНИЕ</span><h3 id="newChatTitle">Новое общение</h3></div><button class="modal-close" id="newChatClose" type="button" aria-label="Закрыть">×</button></div>
        <div class="chat-mode-switch" id="chatModeSwitch"><button type="button" class="chat-mode-card is-active" data-mode="private"><span class="mode-icon">💬</span><span><strong>Личный чат</strong><small>Один на один</small></span></button><button type="button" class="chat-mode-card" data-mode="group"><span class="mode-icon">👥</span><span><strong>Группа</strong><small>Несколько участников</small></span></button></div>
        <div class="new-chat-panel" id="privatePanel"><label class="field-label" for="privateUserSearch">Кому написать</label><input type="text" id="privateUserSearch" class="form-control" placeholder="Начните вводить имя…" autocomplete="off"><div class="user-search-results" id="privateUserResults"></div></div>
        <div class="new-chat-panel" id="groupPanel" hidden><label class="field-label" for="groupName">Название группы</label><input type="text" id="groupName" class="form-control" maxlength="80" placeholder="Например, Наши друзья"><div class="selected-members" id="selectedMembers"></div><label class="field-label" for="groupUserSearch">Добавить участников</label><input type="text" id="groupUserSearch" class="form-control" placeholder="Поиск по имени…" autocomplete="off"><div class="user-search-results" id="groupUserResults"></div></div>
        <div class="modal-footer"><span class="modal-error" id="newChatError"></span><button class="btn-cancel" id="newChatCancel" type="button">Отмена</button><button class="btn-modal-primary" id="createChatBtn" type="button">Создать</button></div>
    </div>
</div>

<div class="chat-toast" id="chatToast" aria-live="polite"></div>

