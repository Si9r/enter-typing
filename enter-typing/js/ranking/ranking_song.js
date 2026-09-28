let currentContentId = null;

// 언어를 바꾸면 JS 로 그린 곡 목록과 랭킹을 다시 그린다
document.addEventListener('i18n:change', async () => {
    await loadSongList();
    if (currentContentId) selectSong(currentContentId);
});

window.addEventListener('DOMContentLoaded', async () => {
    await loadSongList();

    // 만약 URL에 ?id= 가 있다면 바로 해당 곡 랭킹 로드
    const urlParams = new URLSearchParams(window.location.search);
    const contentId = urlParams.get('id');
    if (contentId) {
        selectSong(parseInt(contentId));
    }
});

async function loadSongList() {
    try {
        const res = await fetch('/api/typing-contents?t=' + Date.now());
        const data = await res.json();
        const container = document.getElementById('song-list-container');

        if (data.success) {
            if (data.data.length === 0) {
                container.innerHTML = `<div style="text-align:center; color: var(--theme-text-muted); padding: 20px;">${i18n.t('ranking.no_songs_registered')}</div>`;
                return;
            }

            let html = '';
            data.data.forEach(item => {
                const thumbStyle = item.youtube_id
                    ? `background-image: url('https://img.youtube.com/vi/${item.youtube_id}/mqdefault.jpg'); background-size: cover; background-position: center;`
                    : `background: var(--theme-bg-hover, #f0f0f0);`;
                const thumbInner = item.youtube_id
                    ? ''
                    : `<img src="/assets/logo_icon.png" alt="${i18n.t('common.default_thumbnail')}" style="width: 60%; height: 60%; object-fit: contain; opacity: 0.5;">`;

                html += `
                    <div class="song-item" id="song-item-${Number(item.id)}" onclick="selectSong(${Number(item.id)})">
                        <div class="song-icon" style="${thumbStyle}">${thumbInner}</div>
                        <div class="song-info">
                            <div class="song-item-title">${escapeHtml(item.title)}</div>
                            <div class="song-item-artist">${escapeHtml(item.artist || i18n.t('common.unknown_artist'))}</div>
                        </div>
                    </div>
                `;
            });
            container.innerHTML = html;
        }
    } catch (err) {
        console.error("곡 리스트 로드 실패", err);
    }
}

async function selectSong(id) {
    // UI 변경
    document.querySelectorAll('.song-item').forEach(el => el.classList.remove('active'));
    const activeItem = document.getElementById('song-item-' + id);
    if (activeItem) {
        activeItem.classList.add('active');
        // 해당 위치로 스크롤
        activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    document.getElementById('select-prompt').style.display = 'none';
    document.getElementById('content-header-container').style.display = 'block';
    document.getElementById('ranking-list-container').innerHTML = `<div class="empty-state">${i18n.t('common.loading')}</div>`;

    currentContentId = id;

    // 데이터 로드
    try {
        const res = await fetch('/api/ranking/content/' + id + '?t=' + Date.now());
        const data = await res.json();

        if (data.success) {
            // 상단 헤더 업데이트
            if (data.content_info) {
                document.getElementById('header-title').innerText = data.content_info.title || i18n.t('common.no_title');
                document.getElementById('header-artist').innerText = data.content_info.artist || '-';
                document.getElementById('header-genre').innerText = data.content_info.genre || i18n.t('ranking.unknown_genre');

                const headerThumb = document.getElementById('header-thumb');
                if (data.content_info.youtube_id) {
                    headerThumb.style.backgroundImage = `url('https://img.youtube.com/vi/${data.content_info.youtube_id}/mqdefault.jpg')`;
                    headerThumb.innerHTML = '';
                } else {
                    headerThumb.style.backgroundImage = '';
                    headerThumb.innerHTML = `<img src="/assets/logo_icon.png" alt="${i18n.t('common.default_thumbnail')}" style="width: 60%; height: 60%; object-fit: contain; opacity: 0.7;">`;
                }
            }
            document.getElementById('play-now-btn').onclick = () => location.href = '/typing/' + id + '/play';

            // 랭킹 리스트 렌더링
            renderRanking(data.ranking);
        }
    } catch (err) {
        console.error("랭킹 데이터 로드 실패", err);
        document.getElementById('ranking-list-container').innerHTML = `<div class="empty-state" style="color:red;">${i18n.t('ranking.failed_to_load_data')}</div>`;
    }
}

function renderRanking(list) {
    const container = document.getElementById('ranking-list-container');
    if (!list || list.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div style="font-size: 3rem; margin-bottom: 10px;">🏆</div>
                ${i18n.t('ranking.no_song_records')}<br>
                ${i18n.t('ranking.be_the_first')}
            </div>
        `;
        return;
    }

    let html = '';
    list.forEach(item => {
        let rankClass = item.rank <= 3 ? `rank-${item.rank}` : '';
        let avatarColor = `hsl(${(item.nickname.length * 50) % 360}, 70%, 60%)`;

        // 날짜 포맷
        let dateStr = '';
        if (item.played_at) {
            const d = new Date(item.played_at);
            dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
        }

        html += `
            <div class="rank-item ${rankClass}">
                <div class="rank-number">${item.rank}</div>
                <div class="rank-avatar" style="background: ${avatarColor}">${escapeHtml(item.nickname.charAt(0))}</div>
                <div class="rank-info-main">
                    <div class="rank-name">${escapeHtml(item.nickname)}</div>
                    <div class="rank-stats">
                        <span>${i18n.t('ranking.best_wpm')} <strong>${item.wpm}WPM</strong></span>
                        <span>${i18n.t('ranking.accuracy')} <strong>${item.accuracy}%</strong></span>
                    </div>
                </div>
                <div class="rank-score">${i18n.t('common.n_points', { count: item.score.toLocaleString() })}</div>
                <div class="rank-date">${dateStr}</div>
            </div>
        `;
    });
    container.innerHTML = html;
}
