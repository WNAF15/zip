<div class="community-page">
    <section class="community-hero">
        <div>
            <span class="community-overline">СООБЩЕСТВО</span>
            <h1>Музыкальная комната</h1>
            <p>Спокойный фон для общения, игр и поздних разговоров.</p>
        </div>
        <div class="music-now-playing"><span class="equalizer"><i></i><i></i><i></i></span><div><small>Сейчас играет</small><strong id="nowPlayingTitle"><?= htmlspecialchars($tracks[0]['title']) ?></strong></div></div>
    </section>

    <section class="music-layout">
        <div class="music-player community-panel">
            <div class="player-art">🎧</div>
            <div class="player-copy"><span>Community Radio</span><h2 id="playerTitle"><?= htmlspecialchars($tracks[0]['title']) ?></h2><p id="playerArtist"><?= htmlspecialchars($tracks[0]['artist']) ?></p></div>
            <div class="player-progress"><span></span></div>
            <div class="player-controls">
                <button type="button" data-music-action="prev">◀</button>
                <button type="button" class="player-main" data-music-action="toggle">▶</button>
                <button type="button" data-music-action="next">▶</button>
            </div>
        </div>
        <div class="music-playlist community-panel">
            <div class="community-section-head compact"><div><span class="community-kicker">Плейлист</span><h2>Вечерний микс</h2></div><span class="community-count"><?= count($tracks) ?> треков</span></div>
            <div id="musicTracks">
                <?php foreach ($tracks as $i => $track): ?>
                    <button type="button" class="music-track <?= $i === 0 ? 'is-active' : '' ?>" data-track-index="<?= $i ?>" data-title="<?= htmlspecialchars($track['title']) ?>" data-artist="<?= htmlspecialchars($track['artist']) ?>">
                        <span class="music-track-icon"><?= htmlspecialchars($track['icon']) ?></span><span class="music-track-copy"><strong><?= htmlspecialchars($track['title']) ?></strong><small><?= htmlspecialchars($track['artist']) ?></small></span><span class="music-track-duration"><?= htmlspecialchars($track['duration']) ?></span>
                    </button>
                <?php endforeach; ?>
            </div>
        </div>
    </section>
</div>
