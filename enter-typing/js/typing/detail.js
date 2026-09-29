document.addEventListener('DOMContentLoaded', async () => {
    const pathMatch = window.location.pathname.match(/^\/typing\/(\d+)\/?$/);
    const contentId = pathMatch ? pathMatch[1] : 1;

    try {
        const response = await fetch(`/api/typing-content/${contentId}?t=${Date.now()}`);
        const data = await response.json();
        if (data.success) {
            document.querySelector('.detail-title').innerText = data.title;
            document.querySelector('.detail-artist').innerText = data.artist;
            document.querySelector('.card-badge').innerText = i18n.genre(data.genre || 'JPOP');

            const diffValue = data.difficulty || 3;
            document.getElementById('detail-difficulty').innerHTML = ` X ${diffValue}`;
            i18n.setText(document.getElementById('detail-play-count'), 'common.n_times', { count: data.play_count || 0 });
            i18n.setText(document.getElementById('detail-best-time'), 'common.n_seconds', { count: data.best_time || 0 });

            if (data.description) {
                document.querySelector('.detail-desc').innerText = data.description;
            } else {
                i18n.setText(document.querySelector('.detail-desc'), 'typing.start_practice_with_song', { artist: data.artist || '', title: data.title || '' });
            }

            if (data.youtube_id) {
                const cover = document.querySelector('.detail-cover');
                cover.style.backgroundImage = `url('https://img.youtube.com/vi/${data.youtube_id}/maxresdefault.jpg')`;
                cover.style.backgroundSize = 'cover';
                cover.style.backgroundPosition = 'center';
                cover.innerHTML = ''; //  이모지 제거
            }

            document.getElementById('btn-start-typing').setAttribute('onclick', `location.href='/typing/${contentId}/play'`);
        }
    } catch (error) {
        console.error("Failed to fetch typing content details", error);
    }
});
