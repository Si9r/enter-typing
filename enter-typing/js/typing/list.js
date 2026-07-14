const modal = document.getElementById('detail-modal');

// 페이지 로드 시 콘텐츠 불러오기
let allTypingContents = [];
let currentCategory = '전체';
let currentSort = 'recent';
let displayLimit = 30;

function canManage(item) {
    const user = window.NavAuth && window.NavAuth.getUser();
    if (!user) return false;
    return user.is_admin === true || user.id === item.creator_id;
}

function setCategory(cat) {
    currentCategory = cat;
    displayLimit = 30; // 카테고리 변경 시 표시 개수 초기화
    renderCards();
    updateCategoryButtons();
}

function setSort(sortType) {
    currentSort = sortType;
    displayLimit = 30; // 정렬 변경 시 표시 개수 초기화
    renderCards();
}

function updateCategoryButtons() {
    const container = document.getElementById('category-buttons');
    if (!container) return;
    const buttons = container.querySelectorAll('button');
    buttons.forEach(btn => {
        // 버튼의 텍스트와 현재 카테고리를 매칭. ANIME는 '애니메이션' 텍스트와 매칭될 수 있으므로 onclick 값 활용
        if (btn.getAttribute('onclick').includes(currentCategory)) {
            btn.className = 'btn btn-pink';
        } else {
            btn.className = 'btn btn-outline';
        }
    });
}

function loadMore() {
    displayLimit += 30;
    renderCards();
}

async function deleteTypingContent(id) {
    if (!confirm('정말로 이 타이핑 콘텐츠를 삭제하시겠습니까?')) return;

    try {
        const token = localStorage.getItem('ep_token');
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(`/api/typing-contents/${id}`, {
            method: 'DELETE',
            headers: headers
        });

        if (!response.ok) {
            if (response.status === 401) throw new Error('로그인이 필요합니다.');
            if (response.status === 403) throw new Error('삭제 권한이 없습니다.');
        }

        const data = await response.json();
        if (data.success) {
            alert('성공적으로 삭제되었습니다.');
            allTypingContents = allTypingContents.filter(item => item.id !== id);
            renderCards();
        } else {
            alert('삭제에 실패했습니다: ' + (data.message || '알 수 없는 오류'));
        }
    } catch (err) {
        console.error('Failed to delete content', err);
        alert(err.message || '서버 오류로 삭제에 실패했습니다.');
    }
}

function renderCards() {
    const grid = document.getElementById('card-grid');
    grid.innerHTML = '';

    let filtered = [...allTypingContents];
    if (currentCategory !== '전체') {
        filtered = filtered.filter(item => item.genre === currentCategory);
    }

    if (currentSort === 'popular') {
        filtered.sort((a, b) => (b.play_count || 0) - (a.play_count || 0));
    } else {
        filtered.sort((a, b) => b.id - a.id);
    }

    const itemsToShow = filtered.slice(0, displayLimit);

    itemsToShow.forEach(item => {
        let badgeColor = 'pink';
        if (item.genre === 'ANIME' || item.genre === '애니메이션' || item.genre === '팝송') badgeColor = 'blue';
        else if (item.genre === '문학' || item.genre === '기타') badgeColor = 'green';

        const descPreview = (item.description && item.description.length > 30)
            ? item.description.substring(0, 30) + '...'
            : (item.description || '가사 타이핑 연습하기');

        const diffStars = `<i class="ph-fill ph-star" style="color:var(--color-pink); vertical-align: middle;"></i> ${item.difficulty || 3}`;
        let totalSeconds = item.best_time || 0;
        if (totalSeconds === 0 && item.timestamps) {
            try {
                let tArr = [];
                if (item.timestamps.trim().startsWith('[')) {
                    tArr = JSON.parse(item.timestamps);
                } else {
                    tArr = item.timestamps.split('\n').map(s => s.trim()).filter(s => s !== '');
                }
                if (tArr && tArr.length > 0) {
                    totalSeconds = Math.round(parseFloat(tArr[tArr.length - 1]));
                }
            } catch (e) { }
        }
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        const timeStr = m > 0 ? `${m}분 ${s}초` : `${s}초`;

        let thumbnailHTML = '';
        if (item.youtube_id) {
            thumbnailHTML = `<div style="margin: -25px -25px 15px -25px; border-radius: 20px 20px 0 0; overflow: hidden; height: 160px; position: relative;">
                <img src="https://img.youtube.com/vi/${item.youtube_id}/hqdefault.jpg" alt="썸네일" style="width: 100%; height: 100%; object-fit: cover; display: block;" class="card-thumb">
            </div>`;
        } else {
            thumbnailHTML = `<div style="margin: -25px -25px 15px -25px; border-radius: 20px 20px 0 0; overflow: hidden; height: 160px; background: linear-gradient(135deg, var(--color-pink), var(--color-blue)); display: flex; align-items: center; justify-content: center; color: white; font-size: 3rem;">

            </div>`;
        }

        const cardHTML = `
            <div class="card" onclick="openModal(${item.id})">
                ${thumbnailHTML}
                <div class="card-badge ${badgeColor}">${item.genre || 'JPOP'}</div>
                <h3 class="card-title">${item.title}</h3>
                <p class="card-desc">${descPreview}</p>
                <div class="card-footer" style="display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-top: auto;">
                    <div>
                        <span class="difficulty">${diffStars}</span>
                        <span class="time" style="margin-left: 10px;"><i class="ph-bold ph-clock" style="vertical-align: middle; margin-right: 3px;"></i> ${timeStr}</span>
                        <span class="play-count" style="margin-left: 10px; font-size: 0.85rem; color: var(--theme-text-muted); font-weight: 600;"><i class="ph-bold ph-play-circle" style="vertical-align: middle; margin-right: 3px;"></i> ${item.play_count || 0}</span>
                    </div>
                    ${canManage(item) ? `<button class="btn" style="background: var(--color-pink); color: white; padding: 5px 12px; font-size: 0.8rem; border-radius: 20px; white-space: nowrap; flex-shrink: 0; min-width: fit-content; border: none; cursor: pointer; font-weight: 700;" onclick="event.stopPropagation(); deleteTypingContent(${item.id})">삭제</button>` : ''}
                </div>
            </div>
        `;
        grid.insertAdjacentHTML('beforeend', cardHTML);
    });

    // 더보기 버튼 표시 여부
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) {
        if (displayLimit >= filtered.length) {
            loadMoreBtn.style.display = 'none';
        } else {
            loadMoreBtn.style.display = 'inline-flex';
        }
    }
}

window.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/api/typing-contents?t=' + Date.now());
        const data = await response.json();

        if (data.success) {
            allTypingContents = data.data;
            renderCards();
        }
    } catch (err) {
        console.error('Failed to load typing contents', err);
    }
});

async function openModal(id) {
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('show'), 10);

    try {
        const response = await fetch(`/api/typing-content/${id}?t=${Date.now()}`);
        const data = await response.json();
        if (data.success) {
            document.getElementById('modal-title').innerText = data.title;
            document.getElementById('modal-artist').innerText = data.artist || '-';
            document.getElementById('modal-genre').innerText = data.genre || 'JPOP';
            document.getElementById('modal-creator').innerText = data.creator_nickname || '엔터핑';

            const modalCover = document.getElementById('modal-cover');
            if (data.youtube_id) {
                modalCover.innerHTML = `<img src="https://img.youtube.com/vi/${data.youtube_id}/hqdefault.jpg" alt="썸네일" style="width: 100%; height: 100%; object-fit: cover;">`;
            } else {
                modalCover.innerHTML = '';
            }

            let badgeColor = 'pink';
            if (data.genre === '애니메이션' || data.genre === '팝송') badgeColor = 'blue';
            else if (data.genre === '문학' || data.genre === '기타') badgeColor = 'green';

            const genreBadge = document.getElementById('modal-genre');
            genreBadge.className = `card-badge ${badgeColor}`;
            genreBadge.style.marginBottom = '15px';

            const diffValue = data.difficulty || 3;
            document.getElementById('modal-difficulty').innerHTML = `<i class=\"ph-fill ph-star\" style=\"color:var(--color-pink); vertical-align: middle; margin-right:4px;\"></i> X ${diffValue}`;
            document.getElementById('modal-play-count').innerHTML = `<i class=\"ph-bold ph-play-circle\" style=\"vertical-align: middle; margin-right:4px;\"></i> ${(data.play_count || 0)}회`;

            let mTotalSeconds = data.best_time || 0;
            if (mTotalSeconds === 0 && data.timestamps) {
                try {
                    let mtArr = [];
                    if (data.timestamps.trim().startsWith('[')) {
                        mtArr = JSON.parse(data.timestamps);
                    } else {
                        mtArr = data.timestamps.split('\n').map(s => s.trim()).filter(s => s !== '');
                    }
                    if (mtArr && mtArr.length > 0) {
                        mTotalSeconds = Math.round(parseFloat(mtArr[mtArr.length - 1]));
                    }
                } catch (e) { }
            }
            const mm = Math.floor(mTotalSeconds / 60);
            const ms = mTotalSeconds % 60;
            document.getElementById('modal-best-time').innerText = mm > 0 ? `${mm}분 ${ms}초` : `${ms}초`;

            document.getElementById('modal-desc').innerText = data.description || `${data.artist || ''}의 '${data.title}' 가사로 타자 연습을 시작해보세요!`;

            document.getElementById('modal-start-btn').onclick = () => location.href = `/typing/${id}/play`;
            document.getElementById('modal-rank-btn').onclick = () => location.href = `ranking/songs?id=${id}`;
        }
    } catch (error) {
        console.error("Failed to fetch typing content details", error);
        document.getElementById('modal-desc').innerText = "콘텐츠를 불러오지 못했습니다.";
    }
}

function closeModal(e) {
    if (e && e.target !== modal && e.target.className !== 'modal-close-btn') return;
    modal.classList.remove('show');
    setTimeout(() => {
        if (!modal.classList.contains('show')) modal.style.display = 'none';
    }, 300);
}
