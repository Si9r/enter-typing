let currentContentId = null;

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
                container.innerHTML = '<div style="text-align:center; color: var(--theme-text-muted); padding: 20px;">등록된 곡이 없습니다.</div>';
                return;
            }

            let html = '';
            data.data.forEach(item => {
                let iconChar = '';
                if (item.genre === '애니메이션' || item.genre === 'ANIME') iconChar = '';
                if (item.genre === '문학') iconChar = '';

                html += `
                    <div class="song-item" id="song-item-${item.id}" onclick="selectSong(${item.id})">
                        <div class="song-icon">${iconChar}</div>
                        <div class="song-info">
                            <div class="song-item-title">${item.title}</div>
                            <div class="song-item-artist">${item.artist || '아티스트 미상'}</div>
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
    document.getElementById('ranking-list-container').innerHTML = '<div class="empty-state">로딩 중...</div>';

    currentContentId = id;

    // 데이터 로드
    try {
        const res = await fetch('/api/ranking/content/' + id + '?t=' + Date.now());
        const data = await res.json();

        if (data.success) {
            // 상단 헤더 업데이트
            if (data.content_info) {
                document.getElementById('header-title').innerText = data.content_info.title || '제목 없음';
                document.getElementById('header-artist').innerText = data.content_info.artist || '-';
                document.getElementById('header-genre').innerText = data.content_info.genre || '장르 미상';
            }
            document.getElementById('play-now-btn').onclick = () => location.href = '/typing/' + id + '/play';

            // 랭킹 리스트 렌더링
            renderRanking(data.ranking);
        }
    } catch (err) {
        console.error("랭킹 데이터 로드 실패", err);
        document.getElementById('ranking-list-container').innerHTML = '<div class="empty-state" style="color:red;">데이터를 불러오는 데 실패했습니다.</div>';
    }
}

function renderRanking(list) {
    const container = document.getElementById('ranking-list-container');
    if (!list || list.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div style="font-size: 3rem; margin-bottom: 10px;"></div>
                아직 이 곡을 플레이한 기록이 없습니다.<br>
                지금 바로 첫 번째 기록의 주인공이 되어보세요!
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
                <div class="rank-avatar" style="background: ${avatarColor}">${item.nickname.charAt(0)}</div>
                <div class="rank-info-main">
                    <div class="rank-name">${item.nickname}</div>
                    <div class="rank-stats">
                        <span>최고 타수: <strong>${item.wpm}WPM</strong></span>
                        <span>정확도: <strong>${item.accuracy}%</strong></span>
                    </div>
                </div>
                <div class="rank-score">${item.score.toLocaleString()} 점</div>
                <div class="rank-date">${dateStr}</div>
            </div>
        `;
    });
    container.innerHTML = html;
}
