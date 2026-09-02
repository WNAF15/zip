document.addEventListener('DOMContentLoaded', () => {
    const friendsList = document.getElementById('friendsList');
    const countEl = document.querySelector('.online-friends .mini-count');
    if (!friendsList) return;

    const esc = value => {
        const div = document.createElement('div');
        div.textContent = value ?? '';
        return div.innerHTML;
    };

    const refresh = () => {
        if (document.hidden) return;
        fetch('/api/status/users?limit=8', {cache: 'no-store', credentials: 'same-origin'})
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (!data?.success) return;
                if (countEl) countEl.textContent = String(data.count || 0);
                friendsList.innerHTML = (data.users || []).map(user => `
                    <a class="friend-item" href="/profile/${Number(user.id)}">
                        <img src="${esc(user.avatar_url || '/assets/images/default-avatar.png')}" alt="" class="friend-avatar">
                        <span class="friend-name">${esc(user.nickname || 'Пользователь')}</span>
                        <span class="friend-status ${esc(user.presence_status || 'online')}"></span>
                    </a>`).join('') || '<span class="empty-message">Пока никого не видно.</span>';
            })
            .catch(() => {});
    };

    refresh();
    setInterval(refresh, 15000);
});
