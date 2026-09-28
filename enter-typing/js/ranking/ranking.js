function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.currentTarget.classList.add('active');

    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById('tab-' + tabId).classList.add('active');
}

async function loadRankings() {
    try {
        const res = await fetch('/api/ranking/total?t=' + Date.now());
        const data = await res.json();

        if (data.success) {
            renderRanking('typing', data.typing, item => `<span>${i18n.t('ranking.cleared_songs')} <strong>${i18n.t('common.n_items', { count: item.unique_content_count })}</strong></span><span>${i18n.t('ranking.average_wpm')} <strong>${item.avg_wpm}WPM</strong></span><span>${i18n.t('ranking.average_accuracy')} <strong>${item.avg_accuracy}%</strong></span>`);
            renderRanking('quiz', data.quiz, item => `<span>${i18n.t('ranking.cleared_quizzes')} <strong>${i18n.t('common.n_items', { count: item.unique_quiz_count })}</strong></span>`);
            renderRanking('battle', data.battle, item => `<span>${i18n.t('ranking.win_rate')} <strong>${item.win_rate}%</strong></span><span>${i18n.t('ranking.total_matches', { count: item.play_count })}</span>`);
        }
    } catch (err) {
        console.error("랭킹 로드 실패", err);
        document.getElementById('typing-list').innerHTML = `<div style="text-align: center; color: red;">${i18n.t('ranking.failed_to_load_data')}</div>`;
    }
}

function renderRanking(type, list, statsFormatter) {
    const container = document.getElementById(type + '-list');
    if (!list || list.length === 0) {
        container.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--theme-text-muted);">${i18n.t('ranking.no_ranking_records_found_yet')}</div>`;
        return;
    }

    let html = '';
    list.forEach(item => {
        let rankClass = item.rank <= 3 ? `rank-${item.rank}` : '';
        let avatarColor = `hsl(${(item.nickname.length * 50) % 360}, 70%, 60%)`;
        const scoreKey = type === 'battle' ? 'common.n_wins' : 'common.n_points';

        html += `
            <div class="rank-item ${rankClass}">
                <div class="rank-number">${item.rank}</div>
                <div class="rank-avatar" style="background: ${avatarColor}">${escapeHtml(item.nickname.charAt(0))}</div>
                <div class="rank-info">
                    <div class="rank-name">${escapeHtml(item.nickname)}</div>
                    <div class="rank-stats">
                        ${statsFormatter(item)}
                    </div>
                </div>
                <div class="rank-score">${i18n.t(scoreKey, { count: item.total_score.toLocaleString() })}</div>
            </div>
        `;
    });
    container.innerHTML = html;
}

window.addEventListener('DOMContentLoaded', loadRankings);
document.addEventListener('i18n:change', loadRankings);
