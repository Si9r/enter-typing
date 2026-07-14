document.addEventListener('DOMContentLoaded', async () => {
    const pathMatch = window.location.pathname.match(/^\/typing\/(\d+)\/?$/);
    const contentId = pathMatch ? pathMatch[1] : 1;

    try {
        const response = await fetch(`/api/typing-content/${contentId}?t=${Date.now()}`);
        const data = await response.json();
        if (data.success) {
            document.querySelector('.detail-title').innerText = data.title;
            document.querySelector('.detail-artist').innerText = data.artist;
            document.querySelector('.card-badge').innerText = data.genre || 'JPOP';

            const diffValue = data.difficulty || 3;
            document.getElementById('detail-difficulty').innerHTML = ` X ${diffValue}`;
            document.getElementById('detail-play-count').innerText = (data.play_count || 0) + '회';
            document.getElementById('detail-best-time').innerText = (data.best_time || 0) + '초';

            if (data.description) {
                document.querySelector('.detail-desc').innerText = data.description;
            } else {
                document.querySelector('.detail-desc').innerText = `${data.artist}의 '${data.title}' 가사로 일본어 타자 연습을 시작해보세요!`;
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
