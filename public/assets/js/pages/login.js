// ===== СТРАНИЦА ВХОДА =====
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('loginForm');
    const errorMsg = document.getElementById('errorMessage');
    const step2 = document.getElementById('step2');

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            errorMsg.textContent = '';

            const formData = new FormData(form);
            const response = await fetch('/login', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    document.getElementById('avatar').src = data.user.avatar;
                    document.getElementById('username').textContent = data.user.nickname;
                    document.getElementById('userLoginText').textContent = data.user.login;

                    step2.classList.add('show');
                } else {
                    errorMsg.textContent = data.message || 'Ошибка входа';
                }
            } else {
                const error = await response.json();
                errorMsg.textContent = error.message || 'Ошибка сервера';
            }
        });
    }
});