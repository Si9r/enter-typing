const modal = document.getElementById('detail-modal');

// 페이지 로드 시 콘텐츠 불러오기
let allQuizContents = [];
let isAdminMode = false;
let currentCategory = '전체';
let currentSort = 'recent';
let displayLimit = 30;

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
        if (btn.getAttribute('onclick').includes(currentCategory)) {
            btn.className = 'btn btn-pink';
        } else {
            btn.className = 'btn btn-outline';
        }
    });
}

function toggleAdminMode() {
    isAdminMode = !isAdminMode;
    const btn = document.getElementById('admin-mode-btn');
    btn.innerText = `관리자 모드: ${isAdminMode ? 'ON' : 'OFF'}`;
    btn.className = isAdminMode ? 'btn btn-blue-outline' : 'btn btn-outline';
    btn.style.color = isAdminMode ? 'var(--color-blue)' : '';
    btn.style.borderColor = isAdminMode ? 'var(--color-blue)' : '';
    renderCards();
}

async function deleteQuizContent(id) {
    if (!confirm('정말로 이 퀴즈 콘텐츠를 삭제하시겠습니까?')) return;

    try {
        const token = sessionStorage.getItem('ep_token');
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(`/api/quiz-contents/${id}`, {
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
            allQuizContents = allQuizContents.filter(item => item.id !== id);
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

    let filtered = [...allQuizContents];
    if (currentCategory !== '전체') {
        filtered = filtered.filter(item => item.genre === currentCategory || (currentCategory === 'ANIME' && item.genre === '애니메이션'));
    }

    if (currentSort === 'popular') {
        filtered.sort((a, b) => (b.play_count || 0) - (a.play_count || 0));
    } else {
        filtered.sort((a, b) => b.id - a.id);
    }

    const itemsToShow = filtered.slice(0, displayLimit);

    itemsToShow.forEach(item => {
        let badgeColor = 'pink';
        if (item.genre === '애니메이션' || item.genre === '팝송') badgeColor = 'blue';
        else if (item.genre === '문학' || item.genre === '기타') badgeColor = 'green';

        const descPreview = (item.description && item.description.length > 30)
            ? item.description.substring(0, 30) + '...'
            : (item.description || '새로운 퀴즈에 도전해보세요!');

        const diffStars = `<i class="ph-fill ph-star" style="color:var(--color-pink); vertical-align: middle;"></i> ${item.difficulty || 3}`;
        const bestScore = item.best_score || 0;

        let thumbnailHTML = '';
        if (item.thumbnail_url) {
            thumbnailHTML = `<div style="margin: -25px -25px 15px -25px; border-radius: 20px 20px 0 0; overflow: hidden; height: 160px; position: relative;">
                <img src="${item.thumbnail_url}" alt="썸네일" style="width: 100%; height: 100%; object-fit: cover; display: block;" class="card-thumb">
            </div>`;
        } else if (item.youtube_id) {
            thumbnailHTML = `<div style="margin: -25px -25px 15px -25px; border-radius: 20px 20px 0 0; overflow: hidden; height: 160px; position: relative;">
                <img src="https://img.youtube.com/vi/${item.youtube_id}/mqdefault.jpg" alt="썸네일" style="width: 100%; height: 100%; object-fit: cover; display: block;" class="card-thumb">
            </div>`;
        } else {
            thumbnailHTML = `<div style="margin: -25px -25px 15px -25px; border-radius: 20px 20px 0 0; overflow: hidden; height: 160px; position: relative; background: var(--theme-bg-hover); display:flex; align-items:center; justify-content:center;">
                <img src="/assets/logo_icon.png" alt="기본 썸네일" style="height: 60%; opacity: 0.5;">
            </div>`;
        }

        const cardHTML = `
            <div class="card" onclick="openModal(${item.id})">
                ${thumbnailHTML}
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                    <div class="card-badge ${badgeColor}" style="margin-bottom: 0;">${item.genre || 'JPOP'}</div>
                    <div style="font-size: 0.8rem; font-weight: 700; color: var(--theme-text-muted); background: var(--theme-bg-hover); padding: 4px 10px; border-radius: 12px; border: 1px solid var(--theme-border); display: flex; align-items: center; gap: 4px;">
                         ${item.quiz_count || 0}문제
                    </div>
                </div>
                <h3 class="card-title">${item.title}</h3>
                <p class="card-desc">${descPreview}</p>
                <div class="card-footer" style="display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-top: auto;">
                    <div>
                        <span class="difficulty">${diffStars}</span>
                        <span class="time" style="margin-left: 10px;"><i class="ph-bold ph-target" style="vertical-align: middle; margin-right: 3px; color: var(--color-blue);"></i> ${bestScore}점</span>
                    </div>
                    ${isAdminMode ? `<button class="btn" style="background: var(--color-pink); color: white; padding: 5px 12px; font-size: 0.8rem; border-radius: 20px; white-space: nowrap; flex-shrink: 0; min-width: fit-content; border: none; cursor: pointer; font-weight: 700;" onclick="event.stopPropagation(); deleteQuizContent(${item.id})">삭제</button>` : ''}
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

function loadMore() {
    displayLimit += 30;
    renderCards();
}

// 페이지 로드 시 콘텐츠 불러오기
window.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/api/quiz-contents');
        const data = await response.json();

        if (data.success) {
            allQuizContents = data.data;
        }

        renderCards();
    } catch (err) {
        console.error('Failed to load quiz contents', err);
    }
});

async function openModal(id) {
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('show'), 10);

    try {
        // 퀴즈 디테일 API가 있다면 사용
        const response = await fetch(`/api/quiz-content/${id}`);
        const data = await response.json();
        if (data.success) {
            document.getElementById('modal-title').innerText = data.title;
            document.getElementById('modal-artist').innerText = data.artist || '-';
            document.getElementById('modal-genre').innerText = data.genre || 'JPOP';
            document.getElementById('modal-creator').innerText = data.creator_nickname || '엔터핑';

            let badgeColor = 'pink';
            if (data.genre === '애니메이션' || data.genre === '팝송') badgeColor = 'blue';
            else if (data.genre === '문학' || data.genre === '기타') badgeColor = 'green';

            const genreBadge = document.getElementById('modal-genre');
            genreBadge.className = `card-badge ${badgeColor}`;
            genreBadge.style.marginBottom = '15px';

            const diffValue = data.difficulty || 3;
            document.getElementById('modal-difficulty').innerHTML = `<i class=\"ph-fill ph-star\" style=\"color:var(--color-pink); vertical-align: middle; margin-right:4px;\"></i> X ${diffValue}`;
            document.getElementById('modal-play-count').innerHTML = `<i class=\"ph-bold ph-play-circle\" style=\"vertical-align: middle; margin-right:4px;\"></i> ${(data.play_count || 0)}회`;
            document.getElementById('modal-best-score').innerHTML = `<i class=\"ph-bold ph-target\" style=\"color:var(--color-blue); vertical-align: middle; margin-right:4px;\"></i> ${(data.best_score || 0)}점`;

            document.getElementById('modal-desc').innerText = data.description || `${data.artist || ''}의 '${data.title}' 퀴즈를 시작해보세요!`;

            const detailCover = document.querySelector('.detail-cover');
            if (data.thumbnail_url) {
                detailCover.style.backgroundImage = `url('${data.thumbnail_url}')`;
                detailCover.style.backgroundSize = 'cover';
                detailCover.style.backgroundPosition = 'center';
                detailCover.innerText = '';
            } else if (data.youtube_id) {
                detailCover.style.backgroundImage = `url('https://img.youtube.com/vi/${data.youtube_id}/hqdefault.jpg')`;
                detailCover.style.backgroundSize = 'cover';
                detailCover.style.backgroundPosition = 'center';
                detailCover.innerText = '';
            } else {
                detailCover.style.backgroundImage = 'linear-gradient(135deg, var(--color-pink), var(--color-blue))';
                detailCover.innerHTML = '';
            }

            document.getElementById('modal-start-btn').onclick = () => location.href = `/quiz/${id}/play`;
        }
    } catch (error) {
        console.error("Failed to fetch quiz content details", error);
        document.getElementById('modal-desc').innerText = "콘텐츠를 불러오지 못했습니다. API가 연결되어 있지 않을 수 있습니다.";
        document.getElementById('modal-start-btn').onclick = () => location.href = `/quiz/${id}/play`;
    }
}

function closeModal(e) {
    if (e && e.target !== modal && e.target.className !== 'modal-close-btn') return;
    modal.classList.remove('show');
    setTimeout(() => {
        if (!modal.classList.contains('show')) modal.style.display = 'none';
    }, 300);
}
