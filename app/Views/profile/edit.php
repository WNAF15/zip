<div class="profile-edit-container">
    <div class="profile-edit-card">
        <h1>Редактирование профиля</h1>
        <a href="/profile" class="back-link">← Вернуться в профиль</a>

        <form action="/profile/update" method="POST" enctype="multipart/form-data" class="profile-edit-form">
            <!-- Аватар -->
            <div class="form-group">
                <label>Аватар</label>
                <div class="avatar-upload">
                    <img src="<?= $user['avatar_url'] ?? '/assets/images/default-avatar.png' ?>" 
                         alt="Аватар" class="current-avatar" id="avatarPreview">
                    <input type="file" name="avatar" id="avatarInput" accept="image/*">
                    <label for="avatarInput" class="upload-btn">Выбрать фото</label>
                </div>
            </div>

            <!-- Рамка аватара -->
            <div class="form-group">
                <label>Рамка аватара</label>
                <select name="avatar_frame">
                    <?php foreach ($frames as $id => $name): ?>
                    <option value="<?= $id ?>" <?= ($user['avatar_frame'] ?? 1) == $id ? 'selected' : '' ?>><?= $name ?></option>
                    <?php endforeach; ?>
                </select>
            </div>

            <!-- Фон профиля -->
            <div class="form-group">
                <label>Фон профиля</label>
                <input type="file" name="profile_background" accept="image/*">
            </div>

            <!-- Никнейм -->
            <div class="form-group">
                <label for="nickname">Никнейм</label>
                <input type="text" name="nickname" id="nickname" 
                       value="<?= htmlspecialchars($user['nickname'] ?? 'Игрок') ?>" 
                       maxlength="30" required>
            </div>

            <!-- Статус -->
            <div class="form-group">
                <label for="status">Статус</label>
                <select name="status" id="status">
                    <option value="online" <?= ($user['status'] ?? 'online') === 'online' ? 'selected' : '' ?>>В сети</option>
                    <option value="away" <?= ($user['status'] ?? 'online') === 'away' ? 'selected' : '' ?>>Не беспокоить</option>
                    <option value="playing" <?= ($user['status'] ?? 'online') === 'playing' ? 'selected' : '' ?>>Играю</option>
                    <option value="offline" <?= ($user['status'] ?? 'online') === 'offline' ? 'selected' : '' ?>>Отошёл</option>
                </select>
            </div>

            <!-- Описание -->
            <div class="form-group">
                <label for="bio">О себе</label>
                <textarea name="bio" id="bio" rows="4" maxlength="500"><?= htmlspecialchars($user['bio'] ?? '') ?></textarea>
            </div>

            <!-- Текст "Что делает игрок" -->
            <div class="form-group">
                <label for="playing_text">Что делает игрок</label>
                <input type="text" name="playing_text" id="playing_text" 
                       value="<?= htmlspecialchars($user['playing_text'] ?? '') ?>" 
                       maxlength="100" placeholder="Например: Изучает джунгли">
            </div>

            <!-- Активный значок -->
            <div class="form-group">
                <label for="active_badge">Активный значок (ID от 1 до 5)</label>
                <input type="number" name="active_badge" id="active_badge" 
                       value="<?= $user['active_badge'] ?? '' ?>" min="1" max="5">
            </div>

            <!-- Витрины (выбор до 3) -->
            <div class="form-group">
                <label>Витрины (выберите до 3)</label>
                <?php
                $selected = json_decode($user['showcases'] ?? '[]', true);
                if (!is_array($selected)) $selected = [];
                ?>
                <div class="showcase-checkboxes">
                    <?php foreach ($showcasesList as $id => $name): ?>
                    <label>
                        <input type="checkbox" name="showcases[]" value="<?= $id ?>" 
                               <?= in_array($id, $selected) ? 'checked' : '' ?>>
                        <?= $name ?>
                    </label>
                    <?php endforeach; ?>
                </div>
                <small>Выберите до 3 витрин для отображения на вашем профиле.</small>
            </div>

            <button type="submit" class="save-btn">Сохранить изменения</button>
        </form>
    </div>
</div>