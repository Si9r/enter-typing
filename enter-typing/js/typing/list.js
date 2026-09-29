const modal = document.getElementById('detail-modal');

// 페이지 로드 시 콘텐츠 불러오기
let allTypingContents = [];
let currentCategory = '전체'; // 필터 상태값 (화면 표시용 아님)
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
    if (!confirm(i18n.t('typing.are_you_sure_you_want_to_2'))) return;

    try {
        const response = await fetch(`/api/typing-contents/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            if (response.status === 401) throw new Error(i18n.t('common.login_is_required'));
            if (response.status === 403) throw new Error(i18n.t('common.you_do_not_have_permission_to'));
        }

        const data = await response.json();
        if (data.success) {
            alert(i18n.t('common.deleted_successfully'));
            allTypingContents = allTypingContents.filter(item => item.id !== id);
            renderCards();
        } else {
            alert(i18n.t('common.deletion_failed_2') + (i18n.server(data.message, 'common.unknown_error')));
        }
    } catch (err) {
        console.error('Failed to delete content', err);
        alert(i18n.server(err.message, 'common.deletion_failed_due_to_a_server'));
    }
}

document.addEventListener('i18n:change', () => renderCards());

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
            : (item.description || i18n.t('common.practice_typing_lyrics'));

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
        const timeStr = i18n.duration(totalSeconds);

        let thumbnailHTML = '';
        if (item.youtube_id) {
            thumbnailHTML = `<div style="margin: -25px -25px 15px -25px; border-radius: 20px 20px 0 0; overflow: hidden; height: 160px; position: relative;">
                <img src="https://img.youtube.com/vi/${escapeHtml(item.youtube_id)}/hqdefault.jpg" alt="${i18n.t('common.thumbnail')}" style="width: 100%; height: 100%; object-fit: cover; display: block;" class="card-thumb">
            </div>`;
        } else {
            thumbnailHTML = `<div style="margin: -25px -25px 15px -25px; border-radius: 20px 20px 0 0; overflow: hidden; height: 160px; background: linear-gradient(135deg, var(--color-pink), var(--color-blue)); display: flex; align-items: center; justify-content: center; color: white; font-size: 3rem;">

            </div>`;
        }

        const cardHTML = `
            <div class="card" onclick="openModal(${Number(item.id)})">
                ${thumbnailHTML}
                <div class="card-badge ${badgeColor}">${escapeHtml(i18n.genre(item.genre || 'JPOP'))}</div>
                <h3 class="card-title">${escapeHtml(item.title)}</h3>
                <p class="card-desc">${escapeHtml(descPreview)}</p>
                <div class="card-footer" style="display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-top: auto;">
                    <div>
                        <span class="difficulty">${diffStars}</span>
                        <span class="time" style="margin-left: 10px;"><i class="ph-bold ph-clock" style="vertical-align: middle; margin-right: 3px;"></i> ${timeStr}</span>
                        <span class="play-count" style="margin-left: 10px; font-size: 0.85rem; color: var(--theme-text-muted); font-weight: 600;"><i class="ph-bold ph-play-circle" style="vertical-align: middle; margin-right: 3px;"></i> ${item.play_count || 0}</span>
                    </div>
                    ${canManage(item) ? `<button class="btn" style="background: var(--color-pink); color: white; padding: 5px 12px; font-size: 0.8rem; border-radius: 20px; white-space: nowrap; flex-shrink: 0; min-width: fit-content; border: none; cursor: pointer; font-weight: 700;" onclick="event.stopPropagation(); deleteTypingContent(${Number(item.id)})">${i18n.t('nav.delete')}</button>` : ''}
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
            document.getElementById('modal-genre').innerText = i18n.genre(data.genre || 'JPOP');
            document.getElementById('modal-creator').innerText = data.creator_nickname || i18n.t('nav.enterping');

            const modalCover = document.getElementById('modal-cover');
            if (data.youtube_id) {
                modalCover.innerHTML = `<img src="https://img.youtube.com/vi/${escapeHtml(data.youtube_id)}/hqdefault.jpg" alt="${i18n.t('common.thumbnail')}" style="width: 100%; height: 100%; object-fit: cover;">`;
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
            document.getElementById('modal-play-count').innerHTML = `<i class=\"ph-bold ph-play-circle\" style=\"vertical-align: middle; margin-right:4px;\"></i> ${i18n.t('common.n_times', { count: data.play_count || 0 })}`;

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
            document.getElementById('modal-best-time').innerText = i18n.duration(mTotalSeconds);

            document.getElementById('modal-desc').innerText = data.description || i18n.t('typing.start_practice_with_song_short', { artist: data.artist || '', title: data.title || '' });

            document.getElementById('modal-start-btn').onclick = () => location.href = `/typing/${id}/play`;
            document.getElementById('modal-rank-btn').onclick = () => location.href = `ranking/songs?id=${id}`;
        }
    } catch (error) {
        console.error("Failed to fetch typing content details", error);
        document.getElementById('modal-desc').innerText = i18n.t('common.the_content_failed_to_load');
    }
}

function closeModal(e) {
    if (e && e.target !== modal && e.target.className !== 'modal-close-btn') return;
    modal.classList.remove('show');
    setTimeout(() => {
        if (!modal.classList.contains('show')) modal.style.display = 'none';
    }, 300);
}
