document.addEventListener('DOMContentLoaded', () => {
    const page = document.getElementById('chatPage');
    if (!page) return;

    const currentUserId = Number(page.dataset.currentUserId || 0);
    const activeChatId = Number(page.dataset.activeChatId || 0);
    const activeChatType = page.dataset.activeChatType || 'general';

    const messagesEl = document.getElementById('chatMessages');
    const messageInput = document.getElementById('messageInput');
    const chatForm = document.getElementById('chatForm');
    const sendBtn = document.getElementById('sendBtn');
    const typingStatus = document.getElementById('typingStatus');
    const chatList = document.getElementById('chatList');
    const pinnedBar = document.getElementById('chatPinnedBar');
    const chatHeaderSubtitle = document.getElementById('chatHeaderSubtitle');
    const blockedBanner = document.getElementById('chatBlockedBanner');
    const unblockFromBanner = document.getElementById('unblockFromBanner');

    const replyBar = document.getElementById('messageReplyBar');
    const replyTitle = document.getElementById('messageReplyTitle');
    const replyText = document.getElementById('messageReplyText');
    const cancelReplyBtn = document.getElementById('cancelMessageReply');
    const editBar = document.getElementById('messageEditBar');
    const editBarText = document.getElementById('messageEditText');
    const cancelEditBtn = document.getElementById('cancelMessageEdit');

    const messageContextMenu = document.getElementById('messageContextMenu');

    const chatContextMenu = document.getElementById('chatContextMenu');
    const chatPinAction = document.getElementById('chatPinAction');
    const chatMuteAction = document.getElementById('chatMuteAction');
    const chatBlockAction = document.getElementById('chatBlockAction');
    const chatLeaveAction = document.getElementById('chatLeaveAction');
    const chatDeleteAction = document.getElementById('chatDeleteAction');
    const chatMuteSubmenu = document.getElementById('chatMuteSubmenu');

    const forwardModal = document.getElementById('forwardModal');
    const forwardClose = document.getElementById('forwardClose');
    const forwardCancel = document.getElementById('forwardCancel');
    const forwardSubmit = document.getElementById('forwardSubmit');
    const forwardChatList = document.getElementById('forwardChatList');
    const forwardError = document.getElementById('forwardError');
    const hideForwardAuthor = document.getElementById('hideForwardAuthor');

    const newChatBtn = document.getElementById('newChatBtn');
    const newChatModal = document.getElementById('newChatModal');
    const newChatClose = document.getElementById('newChatClose');
    const newChatCancel = document.getElementById('newChatCancel');
    const newChatError = document.getElementById('newChatError');
    const createChatBtn = document.getElementById('createChatBtn');
    const privatePanel = document.getElementById('privatePanel');
    const groupPanel = document.getElementById('groupPanel');
    const privateUserSearch = document.getElementById('privateUserSearch');
    const privateUserResults = document.getElementById('privateUserResults');
    const groupUserSearch = document.getElementById('groupUserSearch');
    const groupUserResults = document.getElementById('groupUserResults');
    const groupName = document.getElementById('groupName');
    const selectedMembersEl = document.getElementById('selectedMembers');
    const chatModeCards = document.querySelectorAll('.chat-mode-card');
    const toast = document.getElementById('chatToast');

    let mode = 'private';
    let messageVersion = 0;
    let messageSignature = '';
    let editingMessageId = 0;
    let replyTarget = null;
    let contextMessage = null;
    let contextChat = null;
    let lastSelectedText = null;
    let currentMessagesById = new Map();
    let typingStopTimer = null;
    let lastTypingPulse = 0;
    let toastTimer = null;
    let sidebarBusy = false;
    let sidebarStamp = '';
    let messagesBusy = false;
    let typingBusy = false;
    let onlineBusy = false;
    const selectedGroupMembers = new Map();

    const escapeHtml = (value) => {
        const div = document.createElement('div');
        div.textContent = value ?? '';
        return div.innerHTML;
    };

    const formatTime = (value) => {
        const date = new Date(String(value || '').replace(' ', 'T'));
        return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
    };

    const formatMute = (until) => {
        if (!until) return 'Без звука';
        const timestamp = new Date(String(until).replace(' ', 'T')).getTime();
        if (!Number.isFinite(timestamp) || timestamp <= Date.now()) return 'Без звука';
        return `Без звука до ${new Date(timestamp).toLocaleString([], {hour:'2-digit', minute:'2-digit', day:'2-digit', month:'2-digit'})}`;
    };

    const jsonFetch = async (url, options = {}) => {
        const response = await fetch(url, {cache: 'no-store', ...options});
        let data = null;
        try { data = await response.json(); } catch (_) {}
        if (!response.ok) throw new Error(data?.error || `Ошибка ${response.status}`);
        return data;
    };

    const showToast = (message) => {
        if (!toast) return;
        toast.textContent = message;
        toast.classList.add('is-visible');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 1900);
    };

    window.showNavaToast = showToast;

    const isNearBottom = () => !messagesEl || (messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 150);
    const scrollToBottom = (force = false) => {
        if (messagesEl && (force || isNearBottom())) messagesEl.scrollTop = messagesEl.scrollHeight;
    };

    const getMessageElement = (id) => {
        if (!messagesEl) return null;
        const wanted = String(Number(id));
        return [...messagesEl.querySelectorAll('.message')].find(el => String(Number(el.dataset.messageId)) === wanted) || null;
    };

    const scrollToMessage = (id) => {
        const target = getMessageElement(id);
        if (!target) return;
        target.scrollIntoView({behavior: 'smooth', block: 'center'});
        target.classList.add('message-jump-highlight');
        setTimeout(() => target.classList.remove('message-jump-highlight'), 1100);
    };

    const getText = (msg) => String(msg?.message || '');

    const renderReplyQuote = (msg) => {
        const replyId = Number(msg.reply_to_message_id || 0);
        if (!replyId) return '';
        const source = currentMessagesById.get(replyId) || null;
        const sourceDeleted = Boolean(msg.reply_deleted_at);
        const sourceText = source ? getText(source).trim() : '';
        const sourceAuthor = source?.nickname || msg.reply_nickname || 'Пользователь';
        let quote = 'Сообщение удалено';
        if (!sourceDeleted && sourceText) quote = sourceText;
        if (!source && !sourceDeleted && String(msg.reply_message || '').trim()) quote = String(msg.reply_message).trim();
        const storedQuote = String(msg.reply_quote || '').trim();
        if (source && storedQuote && sourceText.includes(storedQuote)) quote = storedQuote;
        return `<button class="message-reply-quote" type="button" data-reply-jump="${replyId}">
            <span class="reply-line"></span>
            <span class="reply-copy"><strong>${escapeHtml(sourceAuthor)}</strong><span>${escapeHtml(quote)}</span></span>
        </button>`;
    };

    const renderForwarded = (msg) => {
        if (!msg.forwarded_message_id) return '';
        const title = msg.forwarded_hide_author || !msg.forwarded_nickname ? 'Пересланное сообщение' : `Переслано от ${msg.forwarded_nickname}`;
        return `<div class="message-forwarded"><span class="forward-icon">➜</span><span>${escapeHtml(title)}</span></div>`;
    };

    const renderAttachments = (attachments) => {
        if (!Array.isArray(attachments) || !attachments.length) return '';
        return `<div class="message-media-list">${attachments.map(item => {
            const id = Number(item.id || 0);
            const type = String(item.type || 'file');
            if (!id) return '';
            if (type === 'photo') {
                return `<button class="message-media-photo" type="button" data-media-open="${id}"><span class="media-loading">Загрузка фото…</span></button>`;
            }
            const label = type === 'video' ? '▶ Видео' : type === 'voice' ? '◖ Голосовое' : '◉ Видео-кружок';
            const size = item.size_bytes ? ` · ${Math.round(Number(item.size_bytes)/1024/1024*10)/10} МБ` : '';
            return `<button class="message-media-file" type="button" data-media-open="${id}"><strong>${label}</strong><span>${escapeHtml(item.original_name || 'Файл')}${size}</span></button>`;
        }).join('')}</div>`;
    };

    const syncReplyTargetWithMessages = (messages) => {
        if (!replyTarget) return;
        const updated = messages.find(msg => Number(msg.id) === Number(replyTarget.id));
        if (!updated || updated.deleted_at) {
            resetComposer(false);
            return;
        }
        const updatedText = getText(updated);
        const previousQuote = String(replyTarget.quote || '').trim();
        const explicitQuote = Boolean(replyTarget.hasSelection);
        replyTarget.text = updatedText;
        replyTarget.author = updated.nickname || replyTarget.author || 'Пользователь';
        if (explicitQuote && previousQuote && updatedText.includes(previousQuote)) {
            replyTarget.quote = previousQuote;
        } else {
            replyTarget.quote = '';
            replyTarget.hasSelection = false;
        }
        if (replyTitle) replyTitle.textContent = `Ответ ${replyTarget.author}`;
        if (replyText) replyText.textContent = replyTarget.quote || replyTarget.text || 'Сообщение';
    };

    const renderMessages = (messages, forceBottom = false) => {
        if (!messagesEl) return;
        currentMessagesById = new Map(messages.map(msg => [Number(msg.id), msg]));
        syncReplyTargetWithMessages(messages);
        const signature = messages.map(msg => [
            msg.id, msg.message, msg.edited_at, msg.is_pinned, msg.reply_to_message_id,
            msg.reply_quote, msg.reply_deleted_at, msg.forwarded_message_id, msg.forwarded_hide_author, JSON.stringify(msg.attachments || [])
        ].join(':')).join('|');
        const changed = signature !== messageSignature;
        if (!changed && !forceBottom) return;
        const stick = forceBottom || isNearBottom();
        messageSignature = signature;
        messagesEl.innerHTML = '';
        if (!messages.length) {
            messagesEl.innerHTML = '<div class="chat-empty-messages"><div class="empty-chat-icon">✦</div><strong>Здесь пока тихо</strong><span>Напишите первым — сообщения появятся у всех участников сразу.</span></div>';
            return;
        }
        const fragment = document.createDocumentFragment();
        messages.forEach(msg => {
            const isSelf = Boolean(msg.is_owner) || Number(msg.user_id) === currentUserId;
            const article = document.createElement('article');
            article.className = `message ${isSelf ? 'message-self' : 'message-other'}${msg.is_pinned ? ' is-pinned' : ''}`;
            article.dataset.messageId = String(msg.id);
            article.dataset.messageOwner = isSelf ? '1' : '0';
            article.dataset.messagePinned = msg.is_pinned ? '1' : '0';
            article.dataset.messageChatId = String(msg.chat_id || activeChatId);
            article.dataset.rawText = getText(msg);
            article.dataset.author = msg.nickname || 'Пользователь';
            const avatar = !isSelf ? `<img class="message-avatar" src="${escapeHtml(msg.avatar_url || '/assets/images/default-avatar.png')}" alt="">` : '';
            const author = !isSelf && activeChatType !== 'private' ? `<div class="message-author">${escapeHtml(msg.nickname || 'Пользователь')}</div>` : '';
            const edited = msg.edited_at ? '<span class="message-edited">изменено</span>' : '';
            const pinMark = msg.is_pinned ? '<span class="message-pinned-mark" title="Закреплено">📌</span>' : '';
            article.innerHTML = `${avatar}<div class="message-stack">${author}<div class="message-row"><div class="message-content">${renderForwarded(msg)}${renderReplyQuote(msg)}${renderAttachments(msg.attachments)}<div class="message-text">${escapeHtml(getText(msg)).replace(/\n/g, '<br>')}</div><div class="message-meta"><time>${formatTime(msg.created_at)}</time>${edited}${pinMark}</div></div></div></div>`;
            fragment.appendChild(article);
        });
        messagesEl.appendChild(fragment);
        if (stick) scrollToBottom(true);
    };

    const renderPinnedBar = (pins) => {
        if (!pinnedBar) return;
        if (!pins?.length || activeChatType === 'general') {
            pinnedBar.hidden = true;
            pinnedBar.innerHTML = '';
            return;
        }
        const latest = pins[0];
        const countText = pins.length > 1 ? ` · ещё ${pins.length - 1}` : '';
        pinnedBar.hidden = false;
        pinnedBar.innerHTML = `<button type="button" class="pinned-bar-button" data-jump-pinned="${latest.id}"><span class="pinned-bar-icon">📌</span><span class="pinned-bar-copy"><strong>Закреплённое сообщение${countText}</strong><span>${escapeHtml(latest.message || 'Сообщение')}</span></span><span class="pinned-bar-arrow">›</span></button>`;
    };

    const loadMessages = async (force = false) => {
        if (!activeChatId || !messagesEl || messagesBusy) return;
        messagesBusy = true;
        try {
            const url = `/api/chat/messages?chat_id=${activeChatId}&version=${force ? 0 : messageVersion}`;
            const data = await jsonFetch(url);
            if (data.changed === false) {
                messageVersion = Number(data.version || messageVersion);
                return;
            }
            messageVersion = Number(data.version || 0);
            renderMessages(data.messages || []);
            renderPinnedBar(data.pinned_messages || []);
        } catch (error) {
            console.debug('Messages:', error);
        } finally {
            messagesBusy = false;
        }
    };

    const closeMessageContextMenu = () => {
        if (messageContextMenu) messageContextMenu.hidden = true;
        contextMessage = null;
    };

    const closeChatContextMenu = () => {
        if (chatContextMenu) chatContextMenu.hidden = true;
        if (chatMuteSubmenu) chatMuteSubmenu.hidden = true;
        contextChat = null;
    };

    const placeMenu = (menu, x, y) => {
        if (!menu) return;
        menu.hidden = false;
        menu.style.left = '0px';
        menu.style.top = '0px';
        const rect = menu.getBoundingClientRect();
        const pad = 10;
        menu.style.left = `${Math.max(pad, Math.min(x, window.innerWidth - rect.width - pad))}px`;
        menu.style.top = `${Math.max(pad, Math.min(y, window.innerHeight - rect.height - pad))}px`;
    };

    const readSelectionInMessage = (messageEl) => {
        const selection = window.getSelection?.();
        if (!selection || selection.isCollapsed || !selection.rangeCount) return '';
        const range = selection.getRangeAt(0);
        if (!messageEl.contains(selection.anchorNode) || !messageEl.contains(selection.focusNode) || !messageEl.contains(range.commonAncestorContainer)) return '';
        return selection.toString().trim().slice(0, 500);
    };

    const openMessageContextMenu = (messageEl, x, y) => {
        if (!messageContextMenu || !messageEl) return;
        const id = Number(messageEl.dataset.messageId);
        const msg = currentMessagesById.get(id);
        if (!msg) return;

        // Capture selected text before opening the menu. Only a selection
        // fully contained inside this exact message is accepted.
        const selectedText = readSelectionInMessage(messageEl);
        if (selectedText) lastSelectedText = {messageId: id, text: selectedText};

        // IMPORTANT: determine ownership strictly from numeric user_id.
        // Do not use Boolean(msg.is_owner): Boolean('0') is true and was the
        // reason the edit action could appear for somebody else's message.
        const isOwner = Number(msg.user_id) === Number(currentUserId);
        const isGeneral = String(activeChatType) === 'general';
        const isPinned = Boolean(Number(msg.is_pinned) === 1 || msg.is_pinned === true);

        contextMessage = {
            id,
            text: getText(msg),
            owner: isOwner,
            pinned: isPinned,
            author: msg.nickname || 'Пользователь'
        };

        // Build the menu from scratch instead of hiding individual buttons.
        // This makes the permissions impossible to leak through a stale DOM
        // state or a cached hidden attribute.
        const items = [
            '<button type="button" data-action="reply"><span>↩</span>Ответить</button>',
            '<button type="button" data-action="copy"><span>⧉</span>Копировать</button>',
            '<button type="button" data-action="forward"><span>➜</span>Переслать</button>'
        ];

        if (!isGeneral) {
            items.push(`<button type="button" data-action="pin"><span>${isPinned ? '📍' : '📌'}</span>${isPinned ? 'Открепить' : 'Закрепить'}</button>`);
        }

        if (isOwner) {
            items.push('<button type="button" data-action="edit"><span>✎</span>Изменить</button>');
        }

        items.push('<button type="button" data-action="delete"><span>⌫</span>Удалить</button>');
        messageContextMenu.innerHTML = items.join('');
        placeMenu(messageContextMenu, x, y);
    };

    const resetComposer = (focus = false) => {
        editingMessageId = 0;
        replyTarget = null;
        lastSelectedText = null;
        document.body.classList.remove('chat-editing', 'chat-replying');
        if (editBar) editBar.hidden = true;
        if (replyBar) replyBar.hidden = true;
        if (sendBtn) sendBtn.innerHTML = '<span>➤</span>';
        if (messageInput) {
            messageInput.placeholder = 'Написать сообщение…';
            messageInput.setAttribute('aria-label', 'Сообщение');
            if (!messageInput.value.trim()) messageInput.value = '';
        }
        const hint = document.getElementById('messageInputHint');
        if (hint) hint.textContent = 'Enter — отправить · Shift + Enter — новая строка';
        if (focus) messageInput?.focus();
        resizeTextarea();
    };

    const beginEdit = (message) => {
        if (!message?.owner) return;
        closeMessageContextMenu();
        closeChatContextMenu();
        editingMessageId = Number(message.id);
        replyTarget = null;
        document.body.classList.add('chat-editing');
        document.body.classList.remove('chat-replying');
        if (replyBar) replyBar.hidden = true;
        if (editBar) editBar.hidden = false;
        if (editBarText) editBarText.textContent = message.text || '';
        messageInput.value = message.text || '';
        messageInput.placeholder = 'Изменить сообщение…';
        if (sendBtn) sendBtn.innerHTML = '<span>✓</span>';
        const hint = document.getElementById('messageInputHint');
        if (hint) hint.textContent = 'Enter — сохранить · Escape — отменить';
        resizeTextarea();
        messageInput.focus();
        messageInput.setSelectionRange(messageInput.value.length, messageInput.value.length);
    };

    const beginReply = (message, selectionOverride = null) => {
        if (!message) return;
        closeMessageContextMenu();
        const quote = String(selectionOverride || (lastSelectedText?.messageId === message.id ? lastSelectedText.text : '') || '').trim().slice(0, 500);
        lastSelectedText = null;
        replyTarget = {
            id: Number(message.id),
            quote,
            hasSelection: Boolean(quote),
            author: message.author || 'Пользователь',
            text: message.text || ''
        };
        editingMessageId = 0;
        document.body.classList.add('chat-replying');
        document.body.classList.remove('chat-editing');
        if (editBar) editBar.hidden = true;
        if (replyBar) replyBar.hidden = false;
        if (replyTitle) replyTitle.textContent = `Ответ ${replyTarget.author}`;
        if (replyText) replyText.textContent = quote || replyTarget.text || 'Сообщение';
        if (sendBtn) sendBtn.innerHTML = '<span>➤</span>';
        messageInput.placeholder = 'Написать ответ…';
        messageInput.focus();
        scrollToMessage(message.id);
    };

    const sendMessage = async () => {
        if (page.dataset.activeBlocked === '1') return showToast('Сначала разблокируйте пользователя');
        const text = messageInput?.value.trim() || '';
        const hasFiles = Boolean(window.NAVAMedia?.hasFiles?.());
        if (!activeChatId || (!text && !hasFiles) || sendBtn?.disabled) return;
        sendBtn.disabled = true;
        try {
            let attachmentIds = [];
            if (!editingMessageId && hasFiles && window.NAVAMedia) {
                attachmentIds = await window.NAVAMedia.uploadPending();
            }
            const body = new FormData();
            body.append('chat_id', String(activeChatId));
            body.append('message', text);
            if (editingMessageId) {
                body.append('message_id', String(editingMessageId));
                await jsonFetch('/api/chat/edit', {method: 'POST', body});
            } else {
                if (replyTarget) {
                    body.append('reply_to_message_id', String(replyTarget.id));
                    body.append('reply_quote', String(replyTarget.quote || replyTarget.text).slice(0, 500));
                }
                attachmentIds.forEach(id => body.append('attachment_ids[]', String(id)));
                await jsonFetch('/api/chat/send', {method: 'POST', body});
            }
            messageInput.value = '';
            await stopTyping();
            resetComposer(true);
            await loadMessages(true);
        } catch (error) {
            showToast(error.message || 'Не удалось выполнить действие');
        } finally {
            sendBtn.disabled = false;
        }
    };

    const deleteMessage = async (message) => {
        if (!message) return;
        closeMessageContextMenu();
        if (!window.confirm('Удалить сообщение? Оно исчезнет у всех участников этого чата.')) return;
        try {
            const body = new FormData();
            body.append('message_id', String(message.id));
            body.append('chat_id', String(activeChatId));
            await jsonFetch('/api/chat/delete', {method: 'POST', body});
            if (replyTarget?.id === message.id) resetComposer(true);
            currentMessagesById.delete(Number(message.id));
            const element = getMessageElement(message.id);
            element?.remove();
            messageVersion = 0;
            await loadMessages(true);
            showToast('Сообщение удалено');
        } catch (error) {
            showToast(error.message || 'Не удалось удалить сообщение');
            await loadMessages(true);
        }
    };

    const copyMessage = async (message) => {
        closeMessageContextMenu();
        try {
            if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(message.text || '');
            else {
                const area = document.createElement('textarea');
                area.value = message.text || '';
                document.body.appendChild(area);
                area.select();
                document.execCommand('copy');
                area.remove();
            }
            showToast('Скопировано');
        } catch (_) { showToast('Не удалось скопировать'); }
    };

    const pinMessage = async (message) => {
        if (activeChatType === 'general') return showToast('В общем чате закрепление недоступно');
        closeMessageContextMenu();
        try {
            const body = new FormData();
            body.append('chat_id', String(activeChatId));
            body.append('message_id', String(message.id));
            await jsonFetch(message.pinned ? '/api/chat/unpin' : '/api/chat/pin', {method: 'POST', body});
            messageVersion = 0;
            await loadMessages(true);
            showToast(message.pinned ? 'Сообщение откреплено' : 'Сообщение закреплено');
        } catch (error) { showToast(error.message || 'Не удалось изменить закрепление'); }
    };

    const openForwardModal = async (message) => {
        closeMessageContextMenu();
        contextMessage = message;
        if (!forwardModal) return;
        forwardError.textContent = '';
        hideForwardAuthor.checked = false;
        forwardChatList.innerHTML = '<div class="forward-loading">Загрузка чатов…</div>';
        forwardModal.hidden = false;
        try {
            const data = await jsonFetch('/api/chat/chats');
            const chats = (data.chats || []).filter(chat => chat.type !== 'general' && Number(chat.id) !== activeChatId);
            if (!chats.length) {
                forwardChatList.innerHTML = '<div class="forward-empty">Нет других чатов, куда можно переслать сообщение.</div>';
                return;
            }
            forwardChatList.innerHTML = chats.map(chat => {
                const name = chat.type === 'private' ? (chat.other_nickname || 'Пользователь') : (chat.name || 'Группа');
                const avatar = chat.type === 'private' ? (chat.other_avatar || '/assets/images/default-avatar.png') : '';
                const icon = chat.type === 'group' ? '👥' : '💬';
                return `<label class="forward-chat-item"><input type="checkbox" value="${chat.id}"><span class="forward-chat-avatar">${avatar ? `<img src="${escapeHtml(avatar)}" alt="">` : icon}</span><span class="forward-chat-copy"><strong>${escapeHtml(name)}</strong><small>${chat.type === 'group' ? `${Number(chat.member_count || 0)} участников` : 'личный чат'}</small></span><span class="forward-check">✓</span></label>`;
            }).join('');
        } catch (error) { forwardError.textContent = error.message || 'Не удалось загрузить чаты'; }
    };

    const closeForwardModal = () => { if (forwardModal) forwardModal.hidden = true; };

    const updateChatBlockedUI = (chat) => {
        if (activeChatType !== 'private' || Number(chat?.id) !== activeChatId) return;
        const blockedByMe = Boolean(chat.other_blocked_by_me);
        const blockedMe = Boolean(chat.other_blocked_me);
        page.dataset.activeBlocked = blockedByMe ? '1' : '0';
        if (blockedBanner) {
            if (blockedByMe) {
                blockedBanner.hidden = false;
                blockedBanner.innerHTML = 'Пользователь заблокирован. <button type="button" id="unblockFromBanner">Разблокировать</button>';
                document.getElementById('unblockFromBanner')?.addEventListener('click', () => toggleBlock(true));
            } else if (blockedMe) {
                blockedBanner.hidden = false;
                blockedBanner.innerHTML = 'Пользователь ограничил возможность писать вам.';
            } else {
                blockedBanner.hidden = true;
            }
        }
        if (chatBlockAction) {
            chatBlockAction.hidden = false;
            const b = chatBlockAction.querySelector('b');
            if (b) b.textContent = blockedByMe ? 'Разблокировать' : 'Заблокировать';
            const icon = chatBlockAction.querySelector('span');
            if (icon) icon.textContent = blockedByMe ? '✅' : '🚫';
        }
        if (messageInput) {
            messageInput.disabled = blockedByMe || blockedMe;
            messageInput.placeholder = blockedByMe ? 'Пользователь заблокирован' : (blockedMe ? 'Вы не можете написать этому пользователю' : 'Написать сообщение…');
        }
    };

    const openChatContextMenu = (chatEl, x, y) => {
        if (!chatContextMenu || !chatEl) return;
        const chatId = Number(chatEl.dataset.chatId);
        const type = chatEl.dataset.chatType || 'private';
        const item = [...document.querySelectorAll('.chat-item')].find(el => Number(el.dataset.chatId) === chatId);
        const chatData = {
            id: chatId,
            type,
            name: chatEl.dataset.chatName || chatEl.querySelector('.chat-name-text')?.textContent || 'Чат',
            otherUserId: Number(chatEl.dataset.otherUserId || 0),
            pinned: chatEl.dataset.pinned === '1',
            muted: chatEl.dataset.muted === '1',
            blockedByMe: chatEl.dataset.blockedByMe === '1',
            blockedMe: chatEl.dataset.blockedMe === '1',
            canDelete: chatEl.dataset.canDelete === '1',
            element: item || chatEl
        };
        contextChat = chatData;
        closeMessageContextMenu();
        if (type === 'general') {
            chatPinAction.hidden = true;
            chatBlockAction.hidden = true;
            chatLeaveAction.hidden = true;
            chatDeleteAction.hidden = true;
            chatMuteAction.hidden = false;
            const muteText = chatMuteAction.querySelector('b');
            if (muteText) muteText.textContent = chatData.muted ? 'Включить звук' : 'Без звука';
            chatPinAction.hidden = true;
        } else {
            chatPinAction.hidden = false;
            const pinText = chatPinAction.querySelector('b');
            if (pinText) pinText.textContent = chatData.pinned ? 'Открепить' : 'Закрепить';
            chatMuteAction.hidden = false;
            const muteText = chatMuteAction.querySelector('b');
            if (muteText) muteText.textContent = chatData.muted ? 'Включить звук' : 'Без звука';
            chatLeaveAction.hidden = !(type === 'group' && !chatData.canDelete);
            chatDeleteAction.hidden = type === 'general' || (type === 'group' && !chatData.canDelete);
            chatBlockAction.hidden = type !== 'private';
            if (type === 'private') {
                const b = chatBlockAction.querySelector('b');
                if (b) b.textContent = chatData.blockedByMe ? 'Разблокировать' : 'Заблокировать';
                const icon = chatBlockAction.querySelector('span');
                if (icon) icon.textContent = chatData.blockedByMe ? '✅' : '🚫';
            }
        }
        if (chatMuteSubmenu) chatMuteSubmenu.hidden = true;
        placeMenu(chatContextMenu, x, y);
    };

    const setChatPin = async () => {
        if (!contextChat || contextChat.type === 'general') return;
        try {
            const body = new FormData();
            body.append('chat_id', String(contextChat.id));
            body.append('pin', contextChat.pinned ? '0' : '1');
            await jsonFetch('/api/chat/chat-pin', {method: 'POST', body});
            const wasPinned = Boolean(contextChat.pinned);
            closeChatContextMenu();
            await loadSidebar(true);
            showToast(wasPinned ? 'Чат откреплён' : 'Чат закреплён');
        } catch (error) { showToast(error.message || 'Не удалось закрепить чат'); }
    };

    const setChatMute = async (muteMode) => {
        if (!contextChat) return;
        try {
            const body = new FormData();
            body.append('chat_id', String(contextChat.id));
            body.append('mode', muteMode);
            const chatId = contextChat.id;
            const data = await jsonFetch('/api/chat/chat-mute', {method: 'POST', body});
            const muted = muteMode !== 'off';
            closeChatContextMenu();
            await loadSidebar(true);
            if (activeChatId === chatId && chatHeaderSubtitle) {
                chatHeaderSubtitle.dataset.muteText = muted ? formatMute(data.muted_until) : '';
            }
            showToast(muted ? formatMute(data.muted_until) : 'Звук снова включён');
        } catch (error) { showToast(error.message || 'Не удалось изменить звук'); }
    };

    const deleteChat = async () => {
        if (!contextChat) return;
        if (contextChat.type === 'general') return showToast('Общий чат удалить нельзя');
        const question = contextChat.type === 'group'
            ? `Удалить группу «${contextChat.name}» полностью? Все сообщения и участники будут удалены.`
            : `Удалить чат «${contextChat.name}» полностью? Переписка исчезнет для обоих участников.`;
        const chatToDelete = {...contextChat};
        closeChatContextMenu();
        if (!window.confirm(question)) return;
        try {
            const body = new FormData();
            body.append('chat_id', String(chatToDelete.id));
            await jsonFetch('/api/chat/delete-chat', {method: 'POST', body});
            showToast('Чат удалён');
            if (Number(chatToDelete.id) === activeChatId) window.location.href = '/chat';
            else await loadSidebar(true);
        } catch (error) { showToast(error.message || 'Не удалось удалить чат'); }
    };

    const leaveGroup = async () => {
        if (!contextChat || contextChat.type !== 'group') return;
        const groupToLeave = {...contextChat};
        closeChatContextMenu();
        if (!window.confirm(`Выйти из группы «${groupToLeave.name}»?`)) return;
        try {
            const body = new FormData();
            body.append('chat_id', String(groupToLeave.id));
            await jsonFetch('/api/chat/leave-group', {method: 'POST', body});
            if (Number(groupToLeave.id) === activeChatId) window.location.href = '/chat';
            else await loadSidebar(true);
            showToast('Вы вышли из группы');
        } catch (error) { showToast(error.message || 'Не удалось выйти из группы'); }
    };

    const toggleBlock = async (unblock = false) => {
        if (!contextChat && activeChatType !== 'private') return;
        const chatId = contextChat?.id || activeChatId;
        closeChatContextMenu();
        try {
            const body = new FormData();
            body.append('chat_id', String(chatId));
            await jsonFetch(unblock ? '/api/chat/unblock-user' : '/api/chat/block-user', {method:'POST', body});
            page.dataset.activeBlocked = unblock ? '0' : '1';
            if (activeChatId === chatId) updateChatBlockedUI({id: chatId, other_blocked_by_me: !unblock, other_blocked_me: false});
            await loadSidebar(true);
            showToast(unblock ? 'Пользователь разблокирован' : 'Пользователь заблокирован');
        } catch (error) { showToast(error.message || 'Не удалось изменить блокировку'); }
    };

    const loadSidebar = async (force = false) => {
        if (sidebarBusy) return;
        sidebarBusy = true;
        try {
            if (!force) {
                const state = await jsonFetch('/api/chat/sidebar-state');
                const nextStamp = `${state.count || 0}:${state.stamp || ''}`;
                if (sidebarStamp && nextStamp === sidebarStamp) return;
                sidebarStamp = nextStamp;
            }

            const data = await jsonFetch('/api/chat/chats');
            renderSidebar(data.chats || []);
            const active = (data.chats || []).find(chat => Number(chat.id) === activeChatId);
            if (active) updateChatBlockedUI(active);

            if (force) {
                const state = await jsonFetch('/api/chat/sidebar-state');
                sidebarStamp = `${state.count || 0}:${state.stamp || ''}`;
            }
        } catch (_) {
            // A temporary network error must not disturb the open chat.
        } finally {
            sidebarBusy = false;
        }
    };

    const renderSidebar = (chats) => {
        if (!chatList) return;
        const scroll = chatList.scrollTop;
        chatList.innerHTML = chats.map(chat => {
            const type = chat.type;
            const active = Number(chat.id) === activeChatId;
            const name = type === 'private' ? (chat.other_nickname || 'Пользователь') : (chat.name || (type === 'general' ? 'Общий чат' : 'Группа'));
            const icon = type === 'general' ? '✦' : (type === 'group' ? '👥' : '💬');
            const avatar = type === 'private' && chat.other_avatar ? `<img src="${escapeHtml(chat.other_avatar)}" alt="">` : `<span>${icon}</span>`;
            const preview = chat.last_message || (type === 'group' ? `${Number(chat.member_count || 0)} участников` : (type === 'general' ? 'Все участники здесь' : 'Нет сообщений'));
            const pinned = Boolean(chat.is_pinned_chat) && type !== 'general';
            const muted = Boolean(chat.is_muted);
            return `<a href="/chat?chat=${chat.id}" class="chat-item ${active ? 'active' : ''}" data-chat-id="${chat.id}" data-chat-type="${escapeHtml(type)}" data-chat-name="${escapeHtml(name)}" data-other-user-id="${Number(chat.other_user_id || 0)}" data-pinned="${pinned ? '1' : '0'}" data-muted="${muted ? '1' : '0'}" data-blocked-by-me="${Number(chat.other_blocked_by_me || 0) ? '1' : '0'}" data-blocked-me="${Number(chat.other_blocked_me || 0) ? '1' : '0'}" data-can-delete="${type === 'private' || (type === 'group' && Number(chat.created_by || 0) === currentUserId) ? '1' : '0'}">
                <div class="chat-item-avatar ${type === 'general' ? 'is-general' : ''}">${avatar}</div>
                <div class="chat-info"><div class="chat-name-row"><div class="chat-name"><span class="chat-name-text">${escapeHtml(name)}</span>${muted ? '<span class="chat-muted-icon" title="Без звука">🔕</span>' : ''}${pinned ? '<span class="chat-pinned-icon" title="Закреплено">📌</span>' : ''}</div>${chat.last_message_time ? `<time class="chat-time">${formatTime(chat.last_message_time)}</time>` : ''}</div><div class="chat-last-message">${escapeHtml(preview)}</div></div>
            </a>`;
        }).join('') || '<div class="chat-empty">Чатов пока нет</div>';
        chatList.scrollTop = scroll;
    };

    // Context menu for chats: right mouse button only.
    chatList?.addEventListener('contextmenu', (event) => {
        const item = event.target.closest('.chat-item');
        if (!item) return;
        event.preventDefault();
        event.stopPropagation();
        openChatContextMenu(item, event.clientX, event.clientY);
    });

    chatList?.addEventListener('click', (event) => {
        // Keep normal left-click navigation. The context menu is not opened here.
    });

    // Message menu: right mouse button only.
    messagesEl?.addEventListener('contextmenu', (event) => {
        const messageEl = event.target.closest('.message');
        if (!messageEl) return;
        event.preventDefault();
        event.stopPropagation();
        openMessageContextMenu(messageEl, event.clientX, event.clientY);
    });

    messageContextMenu?.addEventListener('click', (event) => {
        const item = event.target.closest('button[data-action]');
        if (!item || !contextMessage) return;
        const action = item.dataset.action;
        if (action === 'reply') beginReply(contextMessage);
        else if (action === 'copy') copyMessage(contextMessage);
        else if (action === 'forward') openForwardModal(contextMessage);
        else if (action === 'pin') pinMessage(contextMessage);
        else if (action === 'edit') beginEdit(contextMessage);
        else if (action === 'delete') deleteMessage(contextMessage);
    });

    chatContextMenu?.addEventListener('click', (event) => {
        const item = event.target.closest('button[data-action]');
        if (!item || !contextChat) return;
        const action = item.dataset.action;
        if (action === 'chat-pin') setChatPin();
        else if (action === 'chat-mute') {
            if (chatMuteSubmenu) {
                const rect = item.getBoundingClientRect();
                chatMuteSubmenu.hidden = false;
                const w = chatMuteSubmenu.getBoundingClientRect().width;
                const left = Math.max(10, Math.min(rect.right - w, window.innerWidth - w - 10));
                const top = Math.max(10, Math.min(rect.top, window.innerHeight - chatMuteSubmenu.getBoundingClientRect().height - 10));
                chatMuteSubmenu.style.left = `${left}px`;
                chatMuteSubmenu.style.top = `${top}px`;
            }
        } else if (action === 'chat-block') toggleBlock(Boolean(contextChat.blockedByMe));
        else if (action === 'chat-leave') leaveGroup();
        else if (action === 'chat-delete') deleteChat();
    });

    chatMuteSubmenu?.addEventListener('click', (event) => {
        const item = event.target.closest('[data-mute]');
        if (item) setChatMute(item.dataset.mute);
    });

    messagesEl?.addEventListener('click', (event) => {
        const replyJump = event.target.closest('[data-reply-jump]');
        if (replyJump) {
            event.preventDefault();
            event.stopPropagation();
            const id = Number(replyJump.dataset.replyJump);
            if (id) scrollToMessage(id);
        }
    });

    pinnedBar?.addEventListener('click', (event) => {
        const button = event.target.closest('[data-jump-pinned]');
        if (button) scrollToMessage(Number(button.dataset.jumpPinned));
    });

    document.addEventListener('selectionchange', () => {
        const selection = window.getSelection?.();
        if (!selection || selection.isCollapsed || !selection.rangeCount) return;
        const text = selection.toString().trim();
        if (!text) return;
        const anchor = selection.anchorNode?.nodeType === Node.ELEMENT_NODE ? selection.anchorNode : selection.anchorNode?.parentElement;
        const focus = selection.focusNode?.nodeType === Node.ELEMENT_NODE ? selection.focusNode : selection.focusNode?.parentElement;
        const a = anchor?.closest?.('.message') || null;
        const f = focus?.closest?.('.message') || null;
        if (a && a === f) lastSelectedText = {messageId: Number(a.dataset.messageId), text: text.slice(0, 500)};
    });

    document.addEventListener('click', (event) => {
        if (messageContextMenu && !messageContextMenu.hidden && !messageContextMenu.contains(event.target) && !event.target.closest('.message')) closeMessageContextMenu();
        if (chatContextMenu && !chatContextMenu.hidden && !chatContextMenu.contains(event.target) && !event.target.closest('.chat-item')) closeChatContextMenu();
        if (chatMuteSubmenu && !chatMuteSubmenu.hidden && !chatMuteSubmenu.contains(event.target) && !event.target.closest('#chatMuteAction')) chatMuteSubmenu.hidden = true;
    });

    cancelReplyBtn?.addEventListener('click', () => resetComposer(true));
    cancelEditBtn?.addEventListener('click', () => resetComposer(true));

    forwardSubmit?.addEventListener('click', async () => {
        const targets = [...forwardChatList.querySelectorAll('input[type="checkbox"]:checked')].map(input => input.value);
        forwardError.textContent = '';
        if (!contextMessage || !targets.length) { forwardError.textContent = 'Выберите хотя бы один чат'; return; }
        forwardSubmit.disabled = true;
        try {
            const body = new FormData();
            body.append('message_id', String(contextMessage.id));
            targets.forEach(id => body.append('target_chat_ids[]', String(id)));
            if (hideForwardAuthor.checked) body.append('hide_author', '1');
            const data = await jsonFetch('/api/chat/forward', {method: 'POST', body});
            closeForwardModal();
            showToast(`Переслано: ${data.created?.length || 0}`);
            await loadSidebar(true);
        } catch (error) { forwardError.textContent = error.message || 'Не удалось переслать'; }
        finally { forwardSubmit.disabled = false; }
    });

    forwardClose?.addEventListener('click', closeForwardModal);
    forwardCancel?.addEventListener('click', closeForwardModal);
    forwardModal?.addEventListener('click', (e) => { if (e.target === forwardModal) closeForwardModal(); });

    const sendTypingState = async (state) => {
        if (!activeChatId) return;
        try {
            const body = new FormData();
            body.append('chat_id', String(activeChatId));
            body.append('state', state);
            await jsonFetch('/api/chat/typing', {method: 'POST', body});
        } catch (_) {}
    };
    const stopTyping = async () => {
        clearTimeout(typingStopTimer);
        await sendTypingState('stop');
    };
    const markTyping = () => {
        if (editingMessageId || page.dataset.activeBlocked === '1' || !messageInput?.value.trim()) { stopTyping(); return; }
        const now = Date.now();
        if (now - lastTypingPulse > 1200) { lastTypingPulse = now; sendTypingState('typing'); }
        clearTimeout(typingStopTimer);
        typingStopTimer = setTimeout(stopTyping, 3200);
    };
    const loadTyping = async () => {
        if (!activeChatId || !typingStatus || typingBusy) return;
        typingBusy = true;
        try {
            const data = await jsonFetch(`/api/chat/typing?chat_id=${activeChatId}`);
            const names = data.users || [];
            if (!names.length) { typingStatus.textContent = ''; typingStatus.classList.remove('is-visible'); return; }
            const text = names.length === 1 ? `${names[0]} печатает…` : names.length === 2 ? `${names[0]} и ${names[1]} печатают…` : `${names.join(', ')}${data.hidden ? ` и ещё ${data.hidden}` : ''} печатают…`;
            typingStatus.textContent = text;
            typingStatus.classList.add('is-visible');
        } catch (_) {} finally { typingBusy = false; }
    };

    const loadOnline = async () => {
        const onlineList = document.getElementById('onlineList');
        if (!onlineList || !activeChatId || onlineBusy) return;
        onlineBusy = true;
        try {
            const members = await jsonFetch(`/api/chat/online?chat_id=${activeChatId}`);
            onlineList.innerHTML = members.map(member => `<div class="online-item"><span class="online-dot ${escapeHtml(member.status || 'online')}"></span><img src="${escapeHtml(member.avatar_url || '/assets/images/default-avatar.png')}" alt=""><span>${escapeHtml(member.nickname || 'Пользователь')}</span></div>`).join('');
        } catch (_) {} finally { onlineBusy = false; }
    };

    // New chat modal
    const setMode = (next) => {
        mode = next;
        chatModeCards.forEach(card => card.classList.toggle('is-active', card.dataset.mode === mode));
        privatePanel.hidden = mode !== 'private';
        groupPanel.hidden = mode !== 'group';
        createChatBtn.textContent = mode === 'private' ? 'Открыть чат' : 'Создать группу';
        newChatError.textContent = '';
    };
    const searchUsers = async query => query.trim().length < 2 ? [] : (await jsonFetch(`/api/chat/search?q=${encodeURIComponent(query.trim())}`)).users || [];
    const renderUserResults = (container, users, onClick) => {
        if (!container) return;
        container.innerHTML = users.length ? users.map(user => `<button type="button" class="user-search-item" data-user-id="${user.id}"><img src="${escapeHtml(user.avatar_url || '/assets/images/default-avatar.png')}" alt=""><span><strong>${escapeHtml(user.nickname || 'Пользователь')}</strong><small>${user.status === 'online' ? 'в сети' : 'не в сети'}</small></span></button>`).join('') : '<div class="search-empty">Никого не найдено</div>';
        container.querySelectorAll('.user-search-item').forEach(item => item.addEventListener('click', () => onClick(item.dataset.userId)));
    };
    const renderSelectedMembers = () => {
        selectedMembersEl.innerHTML = [...selectedGroupMembers.values()].map(user => `<button type="button" class="selected-member" data-user-id="${user.id}"><img src="${escapeHtml(user.avatar_url || '/assets/images/default-avatar.png')}" alt=""><span>${escapeHtml(user.nickname || 'Пользователь')}</span><span class="selected-remove">×</span></button>`).join('');
        selectedMembersEl.querySelectorAll('.selected-member').forEach(button => button.addEventListener('click', () => { selectedGroupMembers.delete(Number(button.dataset.userId)); renderSelectedMembers(); }));
    };
    privateUserSearch?.addEventListener('input', async () => {
        const q = privateUserSearch.value.trim();
        if (q.length < 2) { privateUserResults.innerHTML = ''; return; }
        try { renderUserResults(privateUserResults, await searchUsers(q), async id => { try { const body = new FormData(); body.append('user_id', String(id)); const data = await jsonFetch('/api/chat/create-private', {method:'POST', body}); window.location.href = `/chat?chat=${data.chat_id}`; } catch(e) { newChatError.textContent = e.message; } }); }
        catch(e) { privateUserResults.innerHTML = `<div class="search-empty">${escapeHtml(e.message)}</div>`; }
    });
    groupUserSearch?.addEventListener('input', async () => {
        const q = groupUserSearch.value.trim();
        if (q.length < 2) { groupUserResults.innerHTML = ''; return; }
        try {
            const users = (await searchUsers(q)).filter(u => !selectedGroupMembers.has(Number(u.id)));
            renderUserResults(groupUserResults, users, id => {
                const u = users.find(x => Number(x.id) === Number(id));
                if (u) selectedGroupMembers.set(Number(u.id), u);
                groupUserSearch.value = '';
                groupUserResults.innerHTML = '';
                renderSelectedMembers();
            });
        } catch(e) { groupUserResults.innerHTML = `<div class="search-empty">${escapeHtml(e.message)}</div>`; }
    });
    const closeNewChatModal = () => { if (newChatModal) newChatModal.hidden = true; };
    newChatBtn?.addEventListener('click', () => {
        newChatModal.hidden = false;
        newChatError.textContent = '';
        setMode('private');
        privateUserSearch.value = '';
        groupUserSearch.value = '';
        groupName.value = '';
        privateUserResults.innerHTML = '';
        groupUserResults.innerHTML = '';
        selectedGroupMembers.clear();
        renderSelectedMembers();
        setTimeout(() => privateUserSearch.focus(), 50);
    });
    newChatClose?.addEventListener('click', closeNewChatModal);
    newChatCancel?.addEventListener('click', closeNewChatModal);
    newChatModal?.addEventListener('click', e => { if (e.target === newChatModal) closeNewChatModal(); });
    chatModeCards.forEach(card => card.addEventListener('click', () => setMode(card.dataset.mode)));
    createChatBtn?.addEventListener('click', async () => {
        newChatError.textContent = '';
        if (mode === 'private') return;
        if (!groupName.value.trim()) { newChatError.textContent = 'Введите название группы'; return; }
        const members = [...selectedGroupMembers.keys()];
        if (!members.length) { newChatError.textContent = 'Добавьте хотя бы одного участника'; return; }
        createChatBtn.disabled = true;
        try {
            const body = new FormData();
            body.append('name', groupName.value.trim());
            members.forEach(id => body.append('members[]', String(id)));
            const data = await jsonFetch('/api/chat/create-group', {method:'POST', body});
            window.location.href = `/chat?chat=${data.chat_id}`;
        } catch(e) { newChatError.textContent = e.message; }
        finally { createChatBtn.disabled = false; }
    });

    const resizeTextarea = () => {
        if (messageInput) {
            messageInput.style.height = 'auto';
            messageInput.style.height = `${Math.min(messageInput.scrollHeight, 150)}px`;
        }
    };
    messageInput?.addEventListener('input', () => { resizeTextarea(); markTyping(); if (editingMessageId && editBarText) editBarText.textContent = messageInput.value; });
    messageInput?.addEventListener('blur', stopTyping);
    messageInput?.addEventListener('keydown', event => {
        if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); }
    });
    chatForm?.addEventListener('submit', event => { event.preventDefault(); sendMessage(); });

    unblockFromBanner?.addEventListener('click', () => toggleBlock(true));

    document.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        if (forwardModal && !forwardModal.hidden) closeForwardModal();
        else if (newChatModal && !newChatModal.hidden) closeNewChatModal();
        else if (messageContextMenu && !messageContextMenu.hidden) closeMessageContextMenu();
        else if (chatContextMenu && !chatContextMenu.hidden) closeChatContextMenu();
        else if (editingMessageId || replyTarget) resetComposer(true);
    });

    // Initial load + lightweight polling. Message rows are only queried when the chat revision changes.
    loadMessages(true).then(() => scrollToBottom(true));
    loadTyping();
    loadOnline();
    loadSidebar();
    setInterval(() => { if (!document.hidden) loadMessages(); }, 2000);
    setInterval(() => { if (!document.hidden) loadTyping(); }, 2500);
    setInterval(() => { if (!document.hidden) loadOnline(); }, 10000);
    setInterval(() => { if (!document.hidden) loadSidebar(); }, 7000);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            loadMessages(true);
            loadTyping();
            loadOnline();
            loadSidebar(true);
        }
    });
});
