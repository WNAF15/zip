(function () {
    'use strict';

    const body = document.body;
    const authenticated = body && body.dataset.authenticated === '1';
    const isAdmin = document.body && document.querySelector('#adminMetrics') !== null;

    const themeLink = document.getElementById('theme-style');
    const toggleBtn = document.getElementById('themeToggle');
    const sakura = document.getElementById('sakuraContainer');
    const stars = document.getElementById('starsContainer');
    const savedTheme = localStorage.getItem('n-a-v-a-theme') || 'light';

    function setTheme(theme) {
        if (!themeLink || !toggleBtn) return;

        if (theme === 'dark') {
            themeLink.href = '/assets/css/themes/dark-theme.css';
            toggleBtn.textContent = '☀️';
            if (sakura) sakura.style.display = 'none';
            if (stars) stars.style.display = 'block';
            localStorage.setItem('n-a-v-a-theme', 'dark');
        } else {
            themeLink.href = '/assets/css/themes/light-theme.css';
            toggleBtn.textContent = '🌙';
            if (sakura) sakura.style.display = 'block';
            if (stars) stars.style.display = 'none';
            localStorage.setItem('n-a-v-a-theme', 'light');
        }
    }

    setTheme(savedTheme);

    if (toggleBtn) {
        toggleBtn.addEventListener('click', function () {
            const isDark = themeLink && themeLink.href.includes('dark-theme.css');
            setTheme(isDark ? 'light' : 'dark');
        });
    }

    const avatarImg = document.getElementById('avatarImg');
    const avatarMenu = document.getElementById('avatarMenu');
    if (avatarImg && avatarMenu) {
        avatarImg.addEventListener('click', function (e) {
            e.stopPropagation();
            avatarMenu.classList.toggle('show');
        });

        document.addEventListener('click', function () {
            avatarMenu.classList.remove('show');
        });
    }

    const burgerBtn = document.getElementById('burgerBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    if (burgerBtn && mobileMenu) {
        burgerBtn.addEventListener('click', function () {
            mobileMenu.classList.toggle('show');
        });
    }

    const dropbtns = document.querySelectorAll('.dropbtn');
    dropbtns.forEach(function (btn) {
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            const parent = this.parentElement;
            const isOpen = parent.classList.contains('open');
            document.querySelectorAll('.dropdown').forEach(function (d) {
                d.classList.remove('open');
            });
            if (!isOpen) parent.classList.add('open');
        });
    });

    document.addEventListener('click', function () {
        document.querySelectorAll('.dropdown').forEach(function (d) {
            d.classList.remove('open');
        });
    });

    function generateStars() {
        const container = document.getElementById('starsContainer');
        if (!container || container.children.length > 0) return;

        const fragment = document.createDocumentFragment();
        for (let i = 0; i < 150; i++) {
            const star = document.createElement('div');
            star.className = 'star';
            const size = Math.random() * 3 + 1;
            star.style.cssText = [
                'left:' + (Math.random() * 100) + '%',
                'top:' + (Math.random() * 100) + '%',
                'width:' + size + 'px',
                'height:' + size + 'px',
                'animation-duration:' + (3 + Math.random() * 4) + 's',
                'animation-delay:' + (Math.random() * 3) + 's'
            ].join(';');
            fragment.appendChild(star);
        }
        container.appendChild(fragment);
    }

    function generateSakura() {
        const container = document.getElementById('sakuraContainer');
        if (!container || container.children.length > 0) return;

        const fragment = document.createDocumentFragment();
        for (let i = 0; i < 35; i++) {
            const leaf = document.createElement('div');
            leaf.className = 'leaf';
            const size = Math.random() * 15 + 10;
            leaf.style.cssText = [
                'left:' + (Math.random() * 100) + '%',
                'width:' + size + 'px',
                'height:' + size + 'px',
                'animation-duration:' + (8 + Math.random() * 5) + 's',
                'animation-delay:' + (Math.random() * 5) + 's',
                'opacity:' + (0.5 + Math.random() * 0.4)
            ].join(';');
            fragment.appendChild(leaf);
        }
        container.appendChild(fragment);
    }

    generateStars();
    generateSakura();

    // Presence: one heartbeat for each open page every ~25 sec.
    // We intentionally do not send "offline" during beforeunload: a user may
    // have multiple tabs open, and closing one must not make the whole account offline.
    if (authenticated) {
        let lastPing = 0;
        const sendHeartbeat = function () {
            if (document.hidden) return;
            const now = Date.now();
            if (now - lastPing < 20000) return;
            lastPing = now;

            fetch('/api/status/ping', {
                method: 'POST',
                credentials: 'same-origin',
                keepalive: true,
                headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                body: ''
            }).catch(function () {});
        };

        sendHeartbeat();
        window.setInterval(sendHeartbeat, 25000);
        document.addEventListener('visibilitychange', function () {
            if (!document.hidden) sendHeartbeat();
        });
    }

    // Lightweight admin performance panel. The endpoint itself uses no DB query,
    // so refreshing it every 4 sec does not add database load.
    if (isAdmin) {
        const box = document.getElementById('adminMetrics');

        const setText = function (id, value) {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        };

        const refreshMetrics = function () {
            if (document.hidden) return;

            fetch('/api/metrics', {
                credentials: 'same-origin',
                cache: 'no-store'
            })
            .then(function (response) {
                if (!response.ok) throw new Error('metrics ' + response.status);
                return response.json();
            })
            .then(function (data) {
                if (!data || !data.success) return;

                const sample = data.last_request || data.current_request || {};
                const dbMinute = data.db_queries_last_minute;
                const cpu = data.cpu_load_percent;

                setText('metricDb',
                    dbMinute === null || dbMinute === undefined
                        ? (Number(sample.db_queries || 0) + ' / запрос')
                        : (dbMinute + ' / мин'));

                setText('metricCpu',
                    cpu === null || cpu === undefined
                        ? '—'
                        : Number(cpu).toFixed(1) + '%');

                setText('metricTime',
                    Number(sample.execution_ms || 0).toFixed(0) + ' ms');

                setText('metricMemory',
                    Number(sample.memory_mb || 0).toFixed(1) + ' MB');

                const updated = document.getElementById('metricUpdated');
                if (updated) {
                    const dbNote = data.apcu
                        ? 'DB: ' + Number(data.db_time_last_minute_ms || 0).toFixed(0) + ' ms/мин'
                        : 'APCu не включён';
                    updated.textContent = 'обновлено ' + (data.updated_at || '') + ' · ' + dbNote;
                }
            })
            .catch(function () {
                setText('metricUpdated', 'мониторинг временно недоступен');
            });
        };

        refreshMetrics();
        window.setInterval(refreshMetrics, 4000);
        if (box) box.setAttribute('aria-live', 'polite');
    }
})();
