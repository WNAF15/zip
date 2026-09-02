document.addEventListener('DOMContentLoaded', function() {
    // ===== РАЗВЁРТЫВАНИЕ ОПИСАНИЯ =====
    const bioToggle = document.querySelector('.bio-toggle');
    if (bioToggle) {
        bioToggle.addEventListener('click', function() {
            const short = document.querySelector('.bio-short');
            const full = document.querySelector('.bio-full');
            if (short.style.display !== 'none') {
                short.style.display = 'none';
                full.style.display = 'inline';
                this.textContent = 'Скрыть';
            } else {
                short.style.display = 'inline';
                full.style.display = 'none';
                this.textContent = 'Подробнее';
            }
        });
    }

    // ===== ОТПРАВКА КОММЕНТАРИЯ =====
    const commentSubmit = document.getElementById('commentSubmit');
    const commentInput = document.getElementById('commentInput');
    if (commentSubmit && commentInput) {
        commentSubmit.addEventListener('click', function() {
            const text = commentInput.value.trim();
            if (!text) return;
            
            const userId = this.dataset.userid;
            fetch('/profile/comment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `user_id=${userId}&text=${encodeURIComponent(text)}`
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    location.reload();
                } else {
                    alert('Ошибка отправки комментария');
                }
            });
        });
    }
});