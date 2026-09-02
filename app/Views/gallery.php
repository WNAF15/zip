<div class="community-page">
    <section class="community-hero">
        <div>
            <span class="community-overline">СООБЩЕСТВО</span>
            <h1>Галерея</h1>
            <p>Небольшая лента моментов, которые хочется сохранить.</p>
        </div>
        <button class="community-hero-action" type="button" data-demo-toast="Загрузка фото появится здесь">＋ Добавить</button>
    </section>

    <section class="community-section">
        <div class="community-section-head">
            <div><span class="community-kicker">Последнее</span><h2>Моменты сообщества</h2></div>
            <span class="community-count"><?= count($galleryItems) ?> кадров</span>
        </div>
        <div class="gallery-grid">
            <?php foreach ($galleryItems as $item): ?>
                <article class="gallery-card">
                    <div class="gallery-art" aria-hidden="true"><span><?= htmlspecialchars($item['icon']) ?></span></div>
                    <div class="gallery-card-body">
                        <div><h3><?= htmlspecialchars($item['title']) ?></h3><p><?= htmlspecialchars($item['meta']) ?></p></div>
                        <button type="button" class="icon-action" data-demo-toast="Реакция поставлена">♡</button>
                    </div>
                </article>
            <?php endforeach; ?>
        </div>
    </section>
</div>
