// ── 히스토리 / 내 컨텐츠 탭: 플레이 기록, 제작한 콘텐츠 목록 ──────────
import { updateBadges } from './profile_stats.js';

export function switchSubTab(type) {
    document.getElementById('mytyping-list').style.display = type === 'typing' ? 'block' : 'none';
    document.getElementById('myquiz-list').style.display = type === 'quiz' ? 'block' : 'none';

    const btnTyping = document.getElementById('subtab-typing-btn');
    const btnQuiz = document.getElementById('subtab-quiz-btn');

    if (type === 'typing') {
        btnTyping.className = 'btn btn-pink';
        btnTyping.style.background = '';
        btnTyping.style.color = '';
        btnQuiz.className = 'btn';
        btnQuiz.style.background = 'var(--theme-bg-hover)';
        btnQuiz.style.color = 'var(--theme-text-sub)';
    } else {
        btnQuiz.className = 'btn btn-pink';
        btnQuiz.style.background = '';
        btnQuiz.style.color = '';
        btnTyping.className = 'btn';
        btnTyping.style.background = 'var(--theme-bg-hover)';
        btnTyping.style.color = 'var(--theme-text-sub)';
    }
}

// ── 내 타이핑 콘텐츠 로드 ──────────────────────────────────
export async function loadMyTypingContents() {
    const token = sessionStorage.getItem('ep_token');
    if (!token) return;
    try {
        const res = await fetch('/api/my-typing-contents', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const resData = await res.json();
        const container = document.getElementById('mytyping-list');
        if (resData.success && resData.data.length > 0) {
            container.innerHTML = resData.data.map(item => `
        <div class="history-item" style="cursor:pointer; position: relative;" onclick="location.href='/typing/${item.id}'">
          <div class="history-icon typing">⌨️</div>
          <div class="history-info">
            <div class="title">${item.title} — ${item.artist}</div>
            <div class="sub">난이도: ${` X ${item.difficulty || 3}`} · 장르: ${item.genre || 'JPOP'}</div>
          </div>
          <div class="history-result" style="margin-right: 80px;">
            <div class="score">⏱️ ${item.best_time || 0}초</div>
            <div class="date">플레이: ${item.play_count || 0}회</div>
          </div>
          <button onclick="event.stopPropagation(); location.href='/typing/${item.id}/edit'" style="position: absolute; right: 60px; top: 50%; transform: translateY(-50%); background: #3498db; color: white; border: none; border-radius: 8px; width: 32px; height: 32px; font-size: 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 5px rgba(52, 152, 219, 0.3);" title="수정">✏️</button>
          <button onclick="event.stopPropagation(); deleteMyTyping(${item.id})" style="position: absolute; right: 20px; top: 50%; transform: translateY(-50%); background: #ff4757; color: white; border: none; border-radius: 8px; width: 32px; height: 32px; font-size: 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 5px rgba(255, 71, 87, 0.3);" title="삭제">️</button>
        </div>
      `).join('');
        } else {
            container.innerHTML = '<div style="text-align:center; padding: 40px; color: var(--theme-text-muted); font-weight: bold;">아직 제작한 타이핑 콘텐츠가 없습니다.</div>';
        }
    } catch (e) {
        console.error("내 타이핑 콘텐츠를 불러오는 도중 오류가 발생했습니다:", e);
    }
}

export async function deleteMyTyping(id) {
    if (!confirm("정말 이 타이핑 콘텐츠를 삭제하시겠습니까?")) return;

    const token = sessionStorage.getItem('ep_token');
    if (!token) {
        alert("로그인이 필요합니다.");
        return;
    }

    try {
        const res = await fetch(`/api/typing-contents/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const resData = await res.json();

        if (resData.success) {
            alert("삭제되었습니다.");
            loadMyTypingContents(); // 목록 새로고침
        } else {
            alert(resData.detail || "삭제에 실패했습니다.");
        }
    } catch (e) {
        console.error("삭제 중 오류가 발생했습니다:", e);
        alert("오류가 발생했습니다.");
    }
}

export async function deleteMyQuiz(id) {
    if (!confirm("정말 이 퀴즈 콘텐츠를 삭제하시겠습니까?")) return;

    const token = sessionStorage.getItem('ep_token');
    if (!token) {
        alert("로그인이 필요합니다.");
        return;
    }

    try {
        const res = await fetch(`/api/quiz-contents/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const resData = await res.json();

        if (resData.success) {
            alert("삭제되었습니다.");
            loadMyQuizContents(); // 목록 새로고침
        } else {
            alert(resData.detail || "삭제에 실패했습니다.");
        }
    } catch (e) {
        console.error("삭제 중 오류가 발생했습니다:", e);
        alert("오류가 발생했습니다.");
    }
}

function updateProfileDashboard(data) {
    window.latestHistoryData = data;
    const totalPlays = data.length;
    let maxWpm = 0;

    // 정확도 통계는 타이핑(typing) 기록만으로 계산
    const typingPlays = data.filter(item => item.type === 'typing');
    let totalAcc = 0;
    typingPlays.forEach(item => {
        totalAcc += (item.accuracy || 0);
    });
    const avgAcc = typingPlays.length > 0 ? (totalAcc / typingPlays.length).toFixed(1) : '0';

    data.forEach(item => {
        // typing과 battle 기록 모두 최고 WPM 계산에 포함
        if ((item.type === 'typing' || item.type === 'battle') && (item.wpm || 0) > maxWpm) {
            maxWpm = item.wpm;
        }
    });

    // 1. 요약 카드 업데이트
    document.getElementById('stat-total-plays').textContent = totalPlays;
    document.getElementById('stat-avg-accuracy').innerHTML = `${avgAcc}<small style="font-size:1rem;">%</small>`;
    document.getElementById('stat-max-wpm').textContent = maxWpm || '-';

    // 2. 뱃지 업데이트
    updateBadges(data);

    // 3. 분석 탭 업데이트
    // 3-1. 평균 WPM
    let totalWpm = 0;
    typingPlays.forEach(item => { totalWpm += (item.wpm || 0); });
    const avgWpm = typingPlays.length > 0 ? Math.round(totalWpm / typingPlays.length) : 0;
    document.getElementById('analysis-avg-wpm').textContent = avgWpm;

    // 3-2. 주간/월간 WPM 추이
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    let weekWpms = [], lastWeekWpms = [], monthWpms = [];
    typingPlays.forEach(item => {
        let timeDiff = now - new Date(item.played_at).getTime();
        if (timeDiff <= 7 * oneDay) {
            weekWpms.push(item.wpm);
        } else if (timeDiff > 7 * oneDay && timeDiff <= 14 * oneDay) {
            lastWeekWpms.push(item.wpm);
        }
        if (timeDiff <= 30 * oneDay) {
            monthWpms.push(item.wpm);
        }
    });
    const weekAvg = weekWpms.length > 0 ? Math.round(weekWpms.reduce((a, b) => a + b, 0) / weekWpms.length) : 0;
    const lastWeekAvg = lastWeekWpms.length > 0 ? Math.round(lastWeekWpms.reduce((a, b) => a + b, 0) / lastWeekWpms.length) : 0;
    const monthAvg = monthWpms.length > 0 ? Math.round(monthWpms.reduce((a, b) => a + b, 0) / monthWpms.length) : 0;

    const maxTargetWpm = 500;
    document.getElementById('analysis-wpm-week-val').textContent = weekAvg;
    document.getElementById('analysis-wpm-week-bar').style.width = Math.min(100, Math.round((weekAvg / maxTargetWpm) * 100)) + '%';
    document.getElementById('analysis-wpm-lastweek-val').textContent = lastWeekAvg;
    document.getElementById('analysis-wpm-lastweek-bar').style.width = Math.min(100, Math.round((lastWeekAvg / maxTargetWpm) * 100)) + '%';
    document.getElementById('analysis-wpm-month-val').textContent = monthAvg;
    document.getElementById('analysis-wpm-month-bar').style.width = Math.min(100, Math.round((monthAvg / maxTargetWpm) * 100)) + '%';
    // stat 박스 업데이트
    document.getElementById('analysis-wpm-week-stat').textContent = weekAvg;
    document.getElementById('analysis-max-wpm-stat').textContent = maxWpm || 0;

    // 3-3. 평균 정확도 업데이트
    document.getElementById('analysis-avg-accuracy').textContent = avgAcc + '%';

    // 3-4. 활동별 플레이 수
    const typingCount = typingPlays.length;
    const quizPlays = data.filter(item => item.type === 'quiz');
    const quizCount = quizPlays.length;
    const battlePlaysAll = data.filter(item => item.type === 'battle');
    const battleCount = battlePlaysAll.length;
    const typingPct = totalPlays > 0 ? Math.round((typingCount / totalPlays) * 100) : 0;
    const quizPct = totalPlays > 0 ? Math.round((quizCount / totalPlays) * 100) : 0;
    const battlePct = totalPlays > 0 ? Math.round((battleCount / totalPlays) * 100) : 0;

    document.getElementById('analysis-play-typing-val').textContent = typingCount + '회';
    document.getElementById('analysis-play-typing-bar').style.width = typingPct + '%';
    document.getElementById('analysis-play-quiz-val').textContent = quizCount + '회';
    document.getElementById('analysis-play-quiz-bar').style.width = quizPct + '%';
    document.getElementById('analysis-play-battle-val').textContent = battleCount + '회';
    document.getElementById('analysis-play-battle-bar').style.width = battlePct + '%';
    document.getElementById('analysis-pct-typing').textContent = typingPct + '%';
    document.getElementById('analysis-pct-quiz').textContent = quizPct + '%';
    document.getElementById('analysis-pct-battle').textContent = battlePct + '%';

    // 3-6. 실시간 대전 결과 분석
    let b1st = 0, b2nd = 0, b3rd = 0, b4th = 0;
    let battleWpmTotal = 0;
    battlePlaysAll.forEach(item => {
        const r = item.rank;
        if (r === 1) b1st++;
        else if (r === 2) b2nd++;
        else if (r === 3) b3rd++;
        else b4th++;
        battleWpmTotal += (item.wpm || 0);
    });
    const battleWinRate = battleCount > 0 ? Math.round((b1st / battleCount) * 100) : 0;
    const battleAvgWpm = battleCount > 0 ? Math.round(battleWpmTotal / battleCount) : 0;

    if (document.getElementById('analysis-battle-total')) {
        document.getElementById('analysis-battle-total').textContent = battleCount;
        document.getElementById('analysis-battle-win-rate').textContent = battleWinRate + '%';
        document.getElementById('analysis-battle-avg-wpm').textContent = battleAvgWpm;
    }
}

export async function loadMyHistory() {
    const token = sessionStorage.getItem('ep_token');
    if (!token) return;
    try {
        const res = await fetch('/api/my-history', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const resData = await res.json();
        const container = document.getElementById('my-history-list');
        if (resData.success && resData.data.length > 0) {
            updateProfileDashboard(resData.data);
            container.innerHTML = resData.data.map(item => {
                let icon, url, typeLabel;
                if (item.type === 'typing') {
                    icon = '<div class="history-icon typing">⌨️</div>';
                    url = `/typing/${item.content_id}/play`;
                    typeLabel = '타이핑';
                } else if (item.type === 'battle') {
                    icon = '<div class="history-icon battle"></div>';
                    url = '/battle';
                    typeLabel = '실시간 대전';
                } else if (item.type === 'quiz') {
                    icon = '<div class="history-icon quiz"></div>';
                    url = item.content_id ? `/quiz/${item.content_id}/play` : '/quiz';
                    typeLabel = '퀴즈';
                } else if (item.type === 'create_typing') {
                    icon = '<div class="history-icon create-typing" style="background:var(--color-blue);color:white;">📁</div>';
                    url = `/typing/${item.content_id}`;
                    typeLabel = '타이핑 제작';
                } else if (item.type === 'create_quiz') {
                    icon = '<div class="history-icon create-quiz" style="background:var(--color-purple);color:white;">➕</div>';
                    url = `/quiz/${item.content_id}`;
                    typeLabel = '퀴즈 제작';
                }
                let dateStr = new Date(item.played_at).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
                return `
          <div class="history-item" style="cursor:pointer;" onclick="location.href='${url}'">
            ${icon}
            <div class="history-info">
              <div class="title">${item.title}</div>
              <div class="sub">${typeLabel} · ${item.genre}</div>
            </div>
            <div class="history-result">
              <div class="score">${item.score_str}</div>
              <div class="date">${dateStr}</div>
            </div>
            <div style="margin-left:12px;color:#ccc;font-size:1.1rem;align-self:center;">›</div>
          </div>
        `;
            }).join('');
        } else {
            updateProfileDashboard([]);
            container.innerHTML = '<div style="text-align:center; padding: 40px; color: var(--theme-text-muted); font-weight: bold;">아직 플레이한 기록이 없습니다.</div>';
        }
    } catch (e) {
        console.error("히스토리를 불러오는 도중 오류가 발생했습니다:", e);
        document.getElementById('my-history-list').innerHTML = `<div style="text-align:center; padding: 40px; color: red; font-weight: bold;">오류가 발생했습니다:<br>${e.message}</div>`;
    }
}

export async function loadMyQuizContents() {
    const token = sessionStorage.getItem('ep_token');
    if (!token) return;
    try {
        const res = await fetch('/api/my-quiz-contents', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const resData = await res.json();
        const container = document.getElementById('myquiz-list');
        if (resData.success && resData.data.length > 0) {
            container.innerHTML = resData.data.map(item => `
        <div class="history-item" style="cursor:pointer; position: relative;" onclick="location.href='/quiz/${item.id}/play'">
          <div class="history-icon quiz"></div>
          <div class="history-info">
            <div class="title">${item.title}</div>
            <div class="sub">난이도: ${` X ${item.difficulty || 3}`}</div>
          </div>
          <div class="history-result" style="margin-right: 80px;">
            <div class="score"> 최고 점수: ${item.best_score || 0}</div>
          </div>
          <button onclick="event.stopPropagation(); location.href='/quiz/${item.id}/edit'" style="position: absolute; right: 60px; top: 50%; transform: translateY(-50%); background: #3498db; color: white; border: none; border-radius: 8px; width: 32px; height: 32px; font-size: 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 5px rgba(52, 152, 219, 0.3);" title="수정">✏️</button>
          <button onclick="event.stopPropagation(); deleteMyQuiz(${item.id})" style="position: absolute; right: 20px; top: 50%; transform: translateY(-50%); background: #ff4757; color: white; border: none; border-radius: 8px; width: 32px; height: 32px; font-size: 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 5px rgba(255, 71, 87, 0.3);" title="삭제">️</button>
        </div>
      `).join('');
        } else {
            container.innerHTML = '<div style="text-align:center; padding: 40px; color: var(--theme-text-muted); font-weight: bold;">아직 제작한 퀴즈 콘텐츠가 없습니다.</div>';
        }
    } catch (e) {
        console.error("내 퀴즈 콘텐츠를 불러오는 도중 오류가 발생했습니다:", e);
    }
}
