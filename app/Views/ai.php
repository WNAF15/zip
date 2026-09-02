<div class="community-page">
    <section class="community-hero">
        <div>
            <span class="community-overline">N-A-V-A LAB</span>
            <h1>ИИ-помощник</h1>
            <p>Пока это демо-режим: можно выбрать идею и получить заготовленный ответ.</p>
        </div>
        <div class="ai-status"><span></span> Демо-модель активна</div>
    </section>

    <section class="ai-layout">
        <div class="ai-chat community-panel" id="aiChat">
            <div class="ai-message ai-message-bot"><div class="ai-avatar">✦</div><div><strong>N-A-V-A AI</strong><p>Привет! Придумать игру, план вечера или пару идей для чата?</p></div></div>
        </div>
        <aside class="ai-suggestions community-panel">
            <span class="community-kicker">Быстрые идеи</span>
            <h2>С чего начать?</h2>
            <div class="ai-suggestion-list">
                <?php foreach ($suggestions as $suggestion): ?>
                    <button type="button" data-ai-prompt="<?= htmlspecialchars($suggestion) ?>"><?= htmlspecialchars($suggestion) ?> <span>→</span></button>
                <?php endforeach; ?>
            </div>
            <div class="ai-input-row"><input id="aiInput" type="text" maxlength="180" placeholder="Напишите запрос…"><button type="button" id="aiSend">➤</button></div>
        </aside>
    </section>
</div>
