// ── 분석 탭: 통계 요약, 뱃지, 오타 분석 ──────────────────────────

export async function loadProfileAnalysis() {
    const token = sessionStorage.getItem('ep_token');
    if (!token) return;
    try {
        const res = await fetch('/api/profile-analysis', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const resData = await res.json();
        if (resData.success) {
            document.getElementById('analysis-avg-wpm').textContent = resData.avg_wpm;

            document.getElementById('analysis-wpm-week-val').textContent = resData.wpm_week + ' WPM';
            document.getElementById('analysis-wpm-lastweek-val').textContent = resData.wpm_lastweek + ' WPM';
            document.getElementById('analysis-wpm-month-val').textContent = resData.wpm_month + ' WPM';

            const maxWpm = Math.max(resData.wpm_week, resData.wpm_lastweek, resData.wpm_month, 10);
            document.getElementById('analysis-wpm-week-bar').style.width = (resData.wpm_week / maxWpm * 100) + '%';
            document.getElementById('analysis-wpm-lastweek-bar').style.width = (resData.wpm_lastweek / maxWpm * 100) + '%';
            document.getElementById('analysis-wpm-month-bar').style.width = (resData.wpm_month / maxWpm * 100) + '%';

            document.getElementById('analysis-play-typing-val').textContent = resData.play_typing + '회';
            document.getElementById('analysis-play-quiz-val').textContent = resData.play_quiz + '회';
            document.getElementById('analysis-play-battle-val').textContent = resData.play_battle + '회';

            const totalPlays = resData.play_typing + resData.play_quiz + resData.play_battle;
            const pctTyping = totalPlays > 0 ? Math.round((resData.play_typing / totalPlays) * 100) : 0;
            const pctQuiz = totalPlays > 0 ? Math.round((resData.play_quiz / totalPlays) * 100) : 0;
            const pctBattle = totalPlays > 0 ? Math.round((resData.play_battle / totalPlays) * 100) : 0;

            document.getElementById('analysis-play-typing-bar').style.width = pctTyping + '%';
            document.getElementById('analysis-play-quiz-bar').style.width = pctQuiz + '%';
            document.getElementById('analysis-play-battle-bar').style.width = pctBattle + '%';

            document.getElementById('analysis-pct-typing').textContent = pctTyping + '%';
            document.getElementById('analysis-pct-quiz').textContent = pctQuiz + '%';
            document.getElementById('analysis-pct-battle').textContent = pctBattle + '%';

            document.getElementById('analysis-battle-total').textContent = resData.play_battle;
            document.getElementById('analysis-battle-win-rate').textContent = resData.battle_win_rate + '%';
            document.getElementById('analysis-battle-avg-wpm').textContent = resData.battle_avg_wpm;

            document.getElementById('analysis-quiz-total').textContent = resData.play_quiz;
            document.getElementById('analysis-quiz-correct').textContent = resData.quiz_total_correct;
            document.getElementById('analysis-quiz-rate').textContent = resData.quiz_correct_rate + '%';
        }
    } catch (e) {
        console.error("분석 데이터를 불러오는데 실패했습니다.", e);
    }
}

export function updateBadges(data) {
    const totalPlays = data.length;
    let maxWpm = 0;
    let jpopCount = 0;
    let hasTop10Score = false;

    // 정확도 통계는 타이핑(typing) 기록만으로 계산
    const typingPlays = data.filter(item => item.type === 'typing');
    let totalAcc = 0;
    typingPlays.forEach(item => {
        totalAcc += (item.accuracy || 0);
    });
    const avgAcc = typingPlays.length > 0 ? (totalAcc / typingPlays.length) : 0;

    let hasWon1st = false;
    data.forEach(item => {
        if ((item.type === 'typing' || item.type === 'battle') && (item.wpm || 0) > maxWpm) {
            maxWpm = item.wpm;
        }
        if (item.genre === 'JPOP') {
            jpopCount++;
        }
        if (item.score >= 5000) {
            hasTop10Score = true;
        }
        if (item.type === 'battle' && item.rank === 1) {
            hasWon1st = true;
        }
    });
    const streak = window.attendanceStreak || 0;
    const totalAttend = window.totalAttendance || 0;

    const badgeConditions = {
        'badge-passion': totalPlays >= 10,
        'badge-speed': maxWpm >= 250,
        'badge-accuracy': typingPlays.length >= 5 && avgAcc >= 90,
        'badge-attendance': streak >= 7,
        'badge-jpop': jpopCount >= 5,
        'badge-ranking': hasTop10Score,
        'badge-diamond': totalPlays >= 50,
        'badge-attendance30': totalAttend >= 30,
        'badge-king': maxWpm >= 350,
        'badge-battle': hasWon1st  // 대전 1위 달성 시 해제
    };

    for (const [id, earned] of Object.entries(badgeConditions)) {
        const el = document.getElementById(id);
        if (el) {
            if (earned) {
                el.className = 'badge-item earned';
                el.classList.remove('locked');
            } else {
                el.className = 'badge-item locked';
                el.classList.remove('earned');
            }
        }
    }
}

// ── 상세 분석 탭 로직 ─────────────────────────
const romajiLookup = {
    'あ': 'a', 'い': 'i', 'う': 'u', 'え': 'e', 'お': 'o',
    'か': 'ka', 'き': 'ki', 'く': 'ku', 'け': 'ke', 'こ': 'ko',
    'さ': 'sa', 'し': 'shi', 'す': 'su', 'せ': 'se', 'そ': 'so',
    'た': 'ta', 'ち': 'chi', 'つ': 'tsu', 'て': 'te', 'と': 'to',
    'な': 'na', 'に': 'ni', 'ぬ': 'nu', 'ね': 'ne', 'の': 'no',
    'は': 'ha', 'ひ': 'hi', 'ふ': 'fu', 'へ': 'he', 'ほ': 'ho',
    'ま': 'ma', 'み': 'mi', 'む': 'mu', 'め': 'me', 'も': 'mo',
    'や': 'ya', 'ゆ': 'yu', 'よ': 'yo',
    'ら': 'ra', 'り': 'ri', 'る': 'ru', 'れ': 're', 'ろ': 'ro',
    'わ': 'wa', 'を': 'wo', 'ん': 'n/nn', 'っ': 'xtsu',
    'が': 'ga', 'ぎ': 'gi', 'ぐ': 'gu', 'げ': 'ge', 'ご': 'go',
    'ざ': 'za', 'じ': 'ji', 'ず': 'zu', 'ぜ': 'ze', 'ぞ': 'zo',
    'だ': 'da', 'ぢ': 'di', 'づ': 'du', 'で': 'de', 'ど': 'do',
    'ば': 'ba', 'び': 'bi', 'ぶ': 'bu', 'べ': 'be', 'ぼ': 'bo',
    'ぱ': 'pa', 'ぴ': 'pi', 'ぷ': 'pu', 'ぺ': 'pe', 'ぽ': 'po',
    'きゃ': 'kya', 'きゅ': 'kyu', 'きょ': 'kyo',
    'しゃ': 'sha', 'しゅ': 'shu', 'しょ': 'sho',
    'ちゃ': 'cha', 'ちゅ': 'chu', 'ちょ': 'cho',
    'にゃ': 'nya', 'にゅ': 'nyu', 'にょ': 'nyo',
    'ひゃ': 'hya', 'ひゅ': 'hyu', 'ひょ': 'hyo',
    'みゃ': 'mya', 'みゅ': 'myu', 'みょ': 'myo',
    'りゃ': 'rya', 'りゅ': 'ryu', 'りょ': 'ryo',
    'ぎゃ': 'gya', 'ぎゅ': 'gyu', 'ぎょ': 'gyo',
    'じゃ': 'ja', 'じゅ': 'ju', 'じょ': 'jo',
    'びゃ': 'bya', 'びゅ': 'byu', 'びょ': 'byo',
    'ぴゃ': 'pya', 'ぴゅ': 'pyu', 'ぴょ': 'pyo',
};

const baseChars = [
    'あ', 'い', 'う', 'え', 'お',
    'か', 'き', 'く', 'け', 'こ',
    'さ', 'し', 'す', 'せ', 'そ',
    'た', 'ち', 'つ', 'て', 'と',
    'な', 'に', 'ぬ', 'ね', 'の',
    'は', 'ひ', 'ふ', 'へ', 'ほ',
    'ま', 'み', 'む', 'め', 'も',
    'や', 'ゆ', 'よ', 'ん', 'っ',
    'ら', 'り', 'る', 'れ', 'ろ',
    'わ', 'を', 'ぢ', 'づ', 'ぜ'
];

export function switchAnalysisTab(tab) {
    const btnOverall = document.getElementById('subtab-overall-btn');
    const btnDetail = document.getElementById('subtab-detail-btn');
    const pnlOverall = document.getElementById('analysis-overall-panel');
    const pnlDetail = document.getElementById('analysis-detail-panel');

    if (tab === 'overall') {
        btnOverall.className = 'btn btn-pink';
        btnOverall.style.background = '';
        btnOverall.style.color = '';
        btnDetail.className = 'btn';
        btnDetail.style.background = 'var(--theme-bg-hover)';
        btnDetail.style.color = 'var(--theme-text-sub)';
        pnlOverall.style.display = 'block';
        pnlDetail.style.display = 'none';
    } else {
        btnDetail.className = 'btn btn-pink';
        btnDetail.style.background = '';
        btnDetail.style.color = '';
        btnOverall.className = 'btn';
        btnOverall.style.background = 'var(--theme-bg-hover)';
        btnOverall.style.color = 'var(--theme-text-sub)';
        pnlDetail.style.display = 'block';
        pnlOverall.style.display = 'none';

        if (!window.detailStatsLoaded) {
            loadDetailStats();
            loadTypoContentList();
            window.detailStatsLoaded = true;
        }
    }
}

export function loadTypoContentList() {
    const contentSelector = document.getElementById("content-selector");
    const tk = sessionStorage.getItem('ep_token');
    fetch("/api/typo-content-list", { headers: { "Authorization": "Bearer " + tk } })
        .then(res => res.json())
        .then(data => {
            if (data.success && data.contents.length > 0) {
                data.contents.forEach(c => {
                    const opt = document.createElement("option");
                    opt.value = c.id;
                    opt.innerText = c.title;
                    contentSelector.appendChild(opt);
                });
            }
        });
    contentSelector.addEventListener("change", (e) => loadDetailStats(e.target.value));
}

export function loadDetailStats(contentId = "") {
    const url = contentId ? `/api/typo-stats?content_id=${contentId}` : "/api/typo-stats";
    const tk = sessionStorage.getItem('ep_token');
    fetch(url, { headers: { "Authorization": "Bearer " + tk } })
        .then(res => res.json())
        .then(result => {
            if (result.success) {
                renderDetailAnalysis(result);
            }
        })
        .catch(err => console.error(err));
}

export async function resetTypoStats() {
    if (!confirm('정말로 오타 기록을 모두 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;

    const tk = sessionStorage.getItem('ep_token');
    try {
        const res = await fetch('/api/typo-stats', {
            method: 'DELETE',
            headers: { "Authorization": "Bearer " + tk }
        });
        const data = await res.json();
        if (res.ok && data.success) {
            alert(data.message);
            // Reload both stats
            loadProfileAnalysis();
            const sel = document.getElementById('content-selector');
            if (sel) loadDetailStats(sel.value);
        } else {
            alert('초기화에 실패했습니다.');
        }
    } catch (e) {
        console.error(e);
        alert('서버 오류가 발생했습니다.');
    }
}

function renderDetailAnalysis(result) {
    const container = document.getElementById('profile-typo-list');
    const hm = document.getElementById('heatmap');

    // 데이터 병합 (중복 kana 처리)
    const aggregatedData = [];
    if (result.data && result.data.length > 0) {
        const aggMap = {};
        result.data.forEach(item => {
            if (aggMap[item.kana]) {
                aggMap[item.kana].error_count += item.error_count;
                aggMap[item.kana].total_count += item.total_count;
            } else {
                aggMap[item.kana] = { ...item };
            }
        });
        aggregatedData.push(...Object.values(aggMap));
    }

    // 로마자 패턴 병합
    const aggRomajiMap = {};
    if (result.romaji_patterns && result.romaji_patterns.length > 0) {
        result.romaji_patterns.forEach(rm => {
            const key = rm.char + "_" + rm.wrong;
            if (aggRomajiMap[key]) {
                aggRomajiMap[key].error_count += (rm.error_count || 0);
            } else {
                aggRomajiMap[key] = { ...rm };
                if (!aggRomajiMap[key].error_count) aggRomajiMap[key].error_count = 0;
            }
        });
    }
    const aggregatedRomaji = Object.values(aggRomajiMap);

    // 1. 히트맵 랜더링 (횟수 기반 단순화)
    if (aggregatedData.length > 0) {
        let errStats = aggregatedData.filter(item => item.error_count > 0);
        errStats.sort((a, b) => b.error_count - a.error_count);
        const maxErrors = errStats.length > 0 ? errStats[0].error_count : 1;

        const dataMap = {};
        aggregatedData.forEach(item => { dataMap[item.kana] = item; });

        hm.innerHTML = '';
        baseChars.forEach(ch => {
            const item = dataMap[ch];
            const errorCount = item ? item.error_count : 0;

            let levelClass = 'hm-none';
            if (errorCount > 0) {
                const ratio = errorCount / maxErrors;
                if (ratio >= 0.6) levelClass = 'hm-high';
                else if (ratio >= 0.3) levelClass = 'hm-med';
                else levelClass = 'hm-low';
            }

            const cell = document.createElement('div');
            cell.className = 'hm-cell ' + levelClass;
            cell.title = `${ch} — 오타 ${errorCount}회`;
            cell.innerHTML = `<span class="hm-char">${ch}</span><span class="hm-rate">${errorCount > 0 ? errorCount + '회' : '-'}</span>`;
            hm.appendChild(cell);
        });
    } else {
        hm.innerHTML = '<div style="text-align:center; grid-column:span 10; padding:20px; color:var(--theme-text-muted);">오타 기록이 아직 없습니다.</div>';
    }

    // 2. 오타 패턴 분석 (TOP 5)
    if (aggregatedData.length > 0) {
        let errStats = aggregatedData.filter(item => item.error_count > 0);
        errStats.sort((a, b) => b.error_count - a.error_count);

        if (errStats.length > 0) {
            const topTypos = errStats.slice(0, 5);
            const maxErrors = topTypos[0].error_count || 1;

            container.innerHTML = topTypos.map((item) => {
                const pct = Math.round((item.error_count / maxErrors) * 100);
                const level = pct >= 60 ? '' : pct >= 30 ? ' med' : ' low';
                const roma = romajiLookup[item.kana] || item.kana;
                return `
            <div class="typo-row">
              <div class="typo-char">
                ${item.kana}
                <small>${roma}</small>
              </div>
              <div class="typo-bar-bg">
                <div class="typo-bar-fill${level}" style="width:${pct}%;"></div>
              </div>
              <div class="typo-pct${level}">${item.error_count}회</div>
            </div>
          `;
            }).join('');
        } else {
            container.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--theme-text-muted); font-weight: bold;">오타 기록이 아직 없습니다.</div>';
        }
    } else {
        container.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--theme-text-muted); font-weight: bold;">오타 기록이 아직 없습니다.</div>';
    }

    // 3. 상세 오입력 분석 (TOP 5)
    const romajiContainer = document.getElementById('profile-romaji-list');
    if (aggregatedRomaji && aggregatedRomaji.length > 0) {
        aggregatedRomaji.sort((a, b) => b.error_count - a.error_count);
        const topRomaji = aggregatedRomaji.slice(0, 5);

        romajiContainer.innerHTML = topRomaji.map(rm => {
            return `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; background: var(--theme-bg-hover); border-radius: 12px; margin-bottom: 10px;">
          <div style="display: flex; align-items: center; gap: 16px;">
            <div style="font-size: 1.3rem; font-weight: 800; color: var(--theme-text-main); width: 40px; text-align: center;">
              ${rm.char}
            </div>
            <div style="display: flex; align-items: center; gap: 10px; font-family: monospace; font-size: 1.1rem;">
              <span style="color: #27ae60; font-weight: 700; background: rgba(39, 174, 96, 0.12); padding: 4px 10px; border-radius: 6px;">${rm.correct}</span>
              <i class="ph-bold ph-arrow-right" style="color: var(--theme-text-muted);"></i>
              <span style="color: #e74c3c; font-weight: 700; background: rgba(231, 76, 60, 0.12); padding: 4px 10px; border-radius: 6px;">${rm.wrong || '(없음)'}</span>
            </div>
          </div>
          <div style="font-weight: 800; color: var(--theme-text-main); font-size: 1.15rem;">
            ${rm.error_count}<span style="font-size: 0.85rem; color: var(--theme-text-muted); font-weight: 600; margin-left: 2px;">회</span>
          </div>
        </div>
      `;
        }).join('');
    } else {
        romajiContainer.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--theme-text-muted); font-weight: bold;">오타 기록이 아직 없습니다.</div>';
    }
}
