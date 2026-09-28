const modal = document.getElementById('detail-modal');

function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

window.addEventListener('DOMContentLoaded', async () => {
    const query = getQueryParam('q');
    const queryTextEl = document.getElementById('query-text');
    const searchInputField = document.querySelector('.search-bar input');

    if (!query || query.trim() === '') {
        // 검색어가 없을 경우
        document.getElementById('search-result-title').style.display = 'none';
        const emptyState = document.getElementById('empty-state');
        emptyState.innerHTML = `<div style="font-size: 4rem; margin-bottom: 20px;"><i class="ph-bold ph-magnifying-glass"></i></div><span data-i18n="search.please_enter_a_search_term">${i18n.t('search.please_enter_a_search_term')}</span><br><span data-i18n="search.enter_a_song_or_artist_in" style="font-size: 0.95rem; color: var(--theme-text-muted); margin-top: 10px; display: inline-block;">${i18n.t('search.enter_a_song_or_artist_in')}</span>`;
        emptyState.style.display = 'block';
        return; // 통신하지 않고 종료
    }

    queryTextEl.textContent = query;
    if (searchInputField) searchInputField.value = query;

    const q = query.toLowerCase();
    const matchesQuery = (item) =>
        (item.title && item.title.toLowerCase().includes(q)) ||
        (item.artist && item.artist.toLowerCase().includes(q)) ||
        (item.description && item.description.toLowerCase().includes(q));

    try {
        // 타이핑 + 퀴즈 콘텐츠를 함께 검색
        const [typingRes, quizRes] = await Promise.all([
            fetch('/api/typing-contents?t=' + Date.now()),
            fetch('/api/quiz-contents?t=' + Date.now())
        ]);
        const typingData = await typingRes.json();
        const quizData = await quizRes.json();

        let results = [];
        if (typingData.success) {
            results = results.concat(typingData.data.filter(matchesQuery).map(item => ({ ...item, _type: 'typing' })));
        }
        if (quizData.success) {
            results = results.concat(quizData.data.filter(matchesQuery).map(item => ({ ...item, _type: 'quiz' })));
        }

        renderCards(results);
    } catch (err) {
        console.error('Failed to load search results', err);
    }
});

// 언어를 바꾸면 마지막 검색 결과를 현재 언어로 다시 그린다
let lastResults = null;
document.addEventListener('i18n:change', () => { if (lastResults) renderCards(lastResults); });

function renderCards(items) {
    lastResults = items;
    const grid = document.getElementById('search-results-grid');
    const emptyState = document.getElementById('empty-state');
    grid.innerHTML = '';

    if (items.length === 0) {
        emptyState.style.display = 'block';
        return;
    }
    emptyState.style.display = 'none';

    items.forEach(item => {
        const isQuiz = item._type === 'quiz';

        let badgeColor = 'pink';
        if (item.genre === 'ANIME' || item.genre === '애니메이션' || item.genre === '팝송') badgeColor = 'blue';
        else if (item.genre === '문학' || item.genre === '기타') badgeColor = 'green';

        const descPreview = (item.description && item.description.length > 30)
            ? item.description.substring(0, 30) + '...'
            : (item.description || (isQuiz ? i18n.t('common.try_a_new_quiz') : i18n.t('common.practice_typing_lyrics')));

        const diffStars = `<i class="ph-fill ph-star" style="color:var(--color-pink); vertical-align: middle;"></i> ${item.difficulty || 3}`;

        const typeKey = isQuiz ? 'nav.quiz' : 'nav.typing';
        const typeBadgeHTML = `<div style="position: absolute; top: 10px; left: 10px; background: rgba(0,0,0,0.7); color: #fff; padding: 4px 10px; border-radius: 6px; font-size: 0.8rem; font-weight: bold; border: 1px solid rgba(255,255,255,0.2); display: flex; align-items: center; gap: 4px; z-index: 2;"><i class="ph-bold ${isQuiz ? 'ph-question' : 'ph-keyboard'}"></i> <span data-i18n="${typeKey}">${i18n.t(typeKey)}</span></div>`;
        const thumbSrc = isQuiz
            ? (item.thumbnail_url || (item.youtube_id ? `https://img.youtube.com/vi/${item.youtube_id}/hqdefault.jpg` : null))
            : (item.youtube_id ? `https://img.youtube.com/vi/${item.youtube_id}/hqdefault.jpg` : null);

        let thumbnailHTML;
        if (thumbSrc) {
            thumbnailHTML = `<div style="margin: -25px -25px 15px -25px; border-radius: 20px 20px 0 0; overflow: hidden; height: 160px; position: relative;">
                <img src="${escapeHtml(thumbSrc)}" alt="${i18n.t('common.thumbnail')}" style="width: 100%; height: 100%; object-fit: cover; display: block;" class="card-thumb">
                ${typeBadgeHTML}
            </div>`;
        } else {
            thumbnailHTML = `<div style="margin: -25px -25px 15px -25px; border-radius: 20px 20px 0 0; overflow: hidden; height: 160px; background: linear-gradient(135deg, var(--color-pink), var(--color-blue)); display: flex; align-items: center; justify-content: center; color: white; font-size: 3rem; position: relative;">
                ${typeBadgeHTML}
            </div>`;
        }

        let footerRightHTML;
        if (isQuiz) {
            footerRightHTML = `<span class="time" style="margin-left: 10px;"><i class="ph-bold ph-target" style="vertical-align: middle; margin-right: 3px;"></i> ${i18n.t('common.n_points', { count: item.best_score || 0 })}</span>`;
        } else {
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
            footerRightHTML = `<span class="time" style="margin-left: 10px;"><i class="ph-bold ph-clock" style="vertical-align: middle; margin-right: 3px;"></i> ${timeStr}</span>`;
        }

        const cardHTML = `
            <div class="card" onclick="openModal(${Number(item.id)}, '${isQuiz ? 'quiz' : 'typing'}')">
                ${thumbnailHTML}
                <div class="card-badge ${badgeColor}">${escapeHtml(i18n.genre(item.genre || 'JPOP'))}</div>
                <h3 class="card-title">${escapeHtml(item.title)}</h3>
                <p class="card-desc">${escapeHtml(descPreview)}</p>
                <div class="card-footer" style="display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-top: auto;">
                    <div>
                        <span class="difficulty">${diffStars}</span>
                        ${footerRightHTML}
                        <span class="play-count" style="margin-left: 10px; font-size: 0.85rem; color: var(--theme-text-muted); font-weight: 600;"><i class="ph-bold ph-play-circle" style="vertical-align: middle; margin-right: 3px;"></i> ${item.play_count || 0}</span>
                    </div>
                </div>
            </div>
        `;
        grid.insertAdjacentHTML('beforeend', cardHTML);
    });
}

async function openModal(id, type) {
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('show'), 10);

    const isQuiz = type === 'quiz';
    const startBtn = document.getElementById('modal-start-btn');
    const rankBtn = document.getElementById('modal-rank-btn');
    const bestTimeLabel = document.getElementById('modal-best-time-label');
    const modalCover = document.getElementById('modal-cover');

    try {
        const response = await fetch((isQuiz ? '/api/quiz-content/' : '/api/typing-content/') + id + '?t=' + Date.now());
        const data = await response.json();
        if (data.success) {
            document.getElementById('modal-title').innerText = data.title;
            document.getElementById('modal-artist').innerText = data.artist || '-';
            document.getElementById('modal-genre').innerText = i18n.genre(data.genre || 'JPOP');
            document.getElementById('modal-creator').innerText = data.creator_nickname || i18n.t('nav.enterping');

            let badgeColor = 'pink';
            if (data.genre === '애니메이션' || data.genre === '팝송') badgeColor = 'blue';
            else if (data.genre === '문학' || data.genre === '기타') badgeColor = 'green';

            const genreBadge = document.getElementById('modal-genre');
            genreBadge.className = 'card-badge ' + badgeColor;

            const diffValue = data.difficulty || 3;
            document.getElementById('modal-difficulty').innerHTML = `<i class=\"ph-fill ph-star\" style=\"color:var(--color-pink); vertical-align: middle; margin-right:4px;\"></i> X ${diffValue}`;
            document.getElementById('modal-play-count').innerHTML = `<i class=\"ph-bold ph-play-circle\" style=\"vertical-align: middle; margin-right:4px;\"></i> ${i18n.t('common.n_times', { count: data.play_count || 0 })}`;

            const coverSrc = isQuiz
                ? (data.thumbnail_url || (data.youtube_id ? `https://img.youtube.com/vi/${data.youtube_id}/hqdefault.jpg` : null))
                : (data.youtube_id ? `https://img.youtube.com/vi/${data.youtube_id}/hqdefault.jpg` : null);
            modalCover.innerHTML = coverSrc ? `<img src="${escapeHtml(coverSrc)}" alt="${i18n.t('common.thumbnail')}" style="width:100%;height:100%;object-fit:cover;">` : '';

            if (isQuiz) {
                bestTimeLabel.textContent = i18n.t('common.highest_score');
                document.getElementById('modal-best-time').innerText = i18n.t('common.n_points', { count: data.best_score || 0 });
                startBtn.innerText = i18n.t('common.start_quiz');
                startBtn.onclick = () => location.href = '/quiz/' + id + '/play';
                rankBtn.style.display = 'none';
            } else {
                bestTimeLabel.textContent = i18n.t('common.time');
                document.getElementById('modal-best-time').innerText = i18n.duration(data.best_time || 0);
                startBtn.innerText = i18n.t('common.start_typing');
                startBtn.onclick = () => location.href = '/typing/' + id + '/play';
                rankBtn.style.display = '';
                rankBtn.onclick = () => location.href = '/ranking/songs?id=' + id;
            }

            document.getElementById('modal-desc').innerText = data.description || '';
        }
    } catch (error) {
        console.error("Failed to fetch content details", error);
    }
}

function closeModal(e) {
    if (e && e.target !== modal && e.target.className !== 'modal-close-btn') return;
    modal.classList.remove('show');
    setTimeout(() => {
        if (!modal.classList.contains('show')) modal.style.display = 'none';
    }, 300);
}
