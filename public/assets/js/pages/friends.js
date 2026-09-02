document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('friendsSearch');
    const onlineGrid = document.getElementById('onlineUsersGrid');

    if (input) {
        input.addEventListener('input', () => {
            const query = input.value.trim().toLowerCase();
            document.querySelectorAll('.friend-card[data-name]').forEach(card => {
                card.hidden = query !== '' && !String(card.dataset.name || '').includes(query);
            });
        });
    }

    if (!onlineGrid) return;

    const esc = value => {
        const div = document.createElement('div');
        div.textContent = value ?? '';
        return div.innerHTML;
    };

    const refreshOnline = () => {
        if (document.hidden) return;
        fetch('/api/status/users?limit=50', {cache: 'no-store', credentials: 'same-origin'})
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (!data?.success) return;
                onlineGrid.innerHTML = (data.users || []).map(user => `
                    <a href="/profile/${Number(user.id)}" class="friend-card" data-name="${esc((user.nickname || '').toLowerCase())}">
                        <img src="${esc(user.avatar_url || '/assets/images/default-avatar.png')}" alt="" class="friend-card-avatar">
                        <div class="friend-card-info">
                            <div class="friend-card-name">${esc(user.nickname || 'Без имени')}</div>
                            <div class="friend-card-status ${esc(user.presence_status || 'online')}">${esc(({
                                online:'В сети', away:'Отошёл', playing:'Играет', offline:'Не в сети'
                            })[user.presence_status] || 'В сети')}</div>
                        </div>
                        <span class="friend-card-arrow">→</span>
                    </a>`).join('') || '<div class="friends-empty">Сейчас никого нет онлайн.</div>';
            })
            .catch(() => {});
    };

    refreshOnline();
    setInterval(refreshOnline, 15000);
});
