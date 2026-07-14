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
            renderRanking('typing', data.typing, item => `<span>클리어한 곡: <strong>${item.unique_content_count}개</strong></span><span>평균 타수: <strong>${item.avg_wpm}WPM</strong></span><span>평균 정확도: <strong>${item.avg_accuracy}%</strong></span>`);
            renderRanking('quiz', data.quiz, item => `<span>클리어한 퀴즈 수: <strong>${item.unique_quiz_count}개</strong></span>`);
            renderRanking('battle', data.battle, item => `<span>승률: <strong>${item.win_rate}%</strong></span><span>(총 ${item.play_count}전)</span>`);
        }
    } catch (err) {
        console.error("랭킹 로드 실패", err);
        document.getElementById('typing-list').innerHTML = '<div style="text-align: center; color: red;">데이터를 불러오는 데 실패했습니다.</div>';
    }
}

function renderRanking(type, list, statsFormatter) {
    const container = document.getElementById(type + '-list');
    if (!list || list.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--theme-text-muted);">아직 등록된 랭킹 기록이 없습니다.</div>';
        return;
    }

    let html = '';
    list.forEach(item => {
        let rankClass = item.rank <= 3 ? `rank-${item.rank}` : '';
        let avatarColor = `hsl(${(item.nickname.length * 50) % 360}, 70%, 60%)`;
        let scoreUnit = type === 'battle' ? '승' : '점';

        html += `
            <div class="rank-item ${rankClass}">
                <div class="rank-number">${item.rank}</div>
                <div class="rank-avatar" style="background: ${avatarColor}">${item.nickname.charAt(0)}</div>
                <div class="rank-info">
                    <div class="rank-name">${item.nickname}</div>
                    <div class="rank-stats">
                        ${statsFormatter(item)}
                    </div>
                </div>
                <div class="rank-score">${item.total_score.toLocaleString()} ${scoreUnit}</div>
            </div>
        `;
    });
    container.innerHTML = html;
}

window.addEventListener('DOMContentLoaded', loadRankings);
