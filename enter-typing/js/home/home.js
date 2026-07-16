// ── 로그인 상태에 따른 히어로 버튼 전환 ──────────────────
(function () {
    const user = window.NavAuth && window.NavAuth.getUser();
    if (!user) return;
    const primaryBtn = document.getElementById('hero-btn-primary');
    const secondaryBtn = document.getElementById('hero-btn-secondary');
    if (primaryBtn) {
        primaryBtn.textContent = '타이핑 시작하기';
        primaryBtn.onclick = () => location.href = '/typing';
    }
    if (secondaryBtn) {
        secondaryBtn.textContent = '퀴즈 풀어보기';
        secondaryBtn.onclick = () => location.href = '/quiz';
    }
})();

// ── 히어로 섹션 장식용 타이핑 애니메이션 ──────────────
const romajiStr = "sizumuyounitoketeyukuyouni";
const hiraganaStr = "しずむようにとけてゆくように";
const sequence = [
    { r: 's', h: '' }, { r: 'i', h: 'し' },
    { r: 'z', h: '' }, { r: 'u', h: 'ず' },
    { r: 'm', h: '' }, { r: 'u', h: 'む' },
    { r: 'y', h: '' }, { r: 'o', h: 'よ' },
    { r: 'u', h: 'う' },
    { r: 'n', h: '' }, { r: 'i', h: 'に' },
    { r: 't', h: '' }, { r: 'o', h: 'と' },
    { r: 'k', h: '' }, { r: 'e', h: 'け' },
    { r: 't', h: '' }, { r: 'e', h: 'て' },
    { r: 'y', h: '' }, { r: 'u', h: 'ゆ' },
    { r: 'k', h: '' }, { r: 'u', h: 'く' },
    { r: 'y', h: '' }, { r: 'o', h: 'よ' },
    { r: 'u', h: 'う' },
    { r: 'n', h: '' }, { r: 'i', h: 'に' }
];

// Background sequence 1
const bgRomajiStr = "yumenarabadorehodoyokattadesyou";
const bgHiraganaStr = "ゆめならばどれほどよかったでしょう";
const bgSequence = [
    { r: 'y', h: '' }, { r: 'u', h: 'ゆ' },
    { r: 'm', h: '' }, { r: 'e', h: 'め' },
    { r: 'n', h: '' }, { r: 'a', h: 'な' },
    { r: 'r', h: '' }, { r: 'a', h: 'ら' },
    { r: 'b', h: '' }, { r: 'a', h: 'ば' },
    { r: 'd', h: '' }, { r: 'o', h: 'ど' },
    { r: 'r', h: '' }, { r: 'e', h: 'れ' },
    { r: 'h', h: '' }, { r: 'o', h: 'ほ' },
    { r: 'd', h: '' }, { r: 'o', h: 'ど' },
    { r: 'y', h: '' }, { r: 'o', h: 'よ' },
    { r: 'k', h: '' }, { r: 'a', h: 'か' },
    { r: 't', h: '' }, { r: 't', h: 'っ' }, { r: 'a', h: 'た' },
    { r: 'd', h: '' }, { r: 'e', h: 'で' },
    { r: 's', h: '' }, { r: 'y', h: '' }, { r: 'o', h: 'しょ' }, { r: 'u', h: 'う' }
];

// Background sequence 2
const bg2Romaji = "arigatougozaimasu";
const bg2Hiragana = "ありがとうございます";
const bg2Seq = [
    { r: 'a', h: 'あ' }, { r: 'r', h: '' }, { r: 'i', h: 'り' }, { r: 'g', h: '' }, { r: 'a', h: 'が' },
    { r: 't', h: '' }, { r: 'o', h: 'と' }, { r: 'u', h: 'う' }, { r: 'g', h: '' }, { r: 'o', h: 'ご' },
    { r: 'z', h: '' }, { r: 'a', h: 'ざ' }, { r: 'i', h: 'い' }, { r: 'm', h: '' }, { r: 'a', h: 'ま' },
    { r: 's', h: '' }, { r: 'u', h: 'す' }
];

// Background sequence 3
const bg3Romaji = "kirakirahikaruhoshino";
const bg3Hiragana = "きらきらひかるほしの";
const bg3Seq = [
    { r: 'k', h: '' }, { r: 'i', h: 'き' }, { r: 'r', h: '' }, { r: 'a', h: 'ら' },
    { r: 'k', h: '' }, { r: 'i', h: 'き' }, { r: 'r', h: '' }, { r: 'a', h: 'ら' },
    { r: 'h', h: '' }, { r: 'i', h: 'ひ' }, { r: 'k', h: '' }, { r: 'a', h: 'か' }, { r: 'r', h: '' }, { r: 'u', h: 'る' },
    { r: 'h', h: '' }, { r: 'o', h: 'ほ' }, { r: 's', h: '' }, { r: 'i', h: 'し' },
    { r: 'n', h: '' }, { r: 'o', h: 'の' }
];

let rTyped = "", hTyped = ""; let seqIdx = 0;
let bgRTyped = "", bgHTyped = ""; let bgSeqIdx = 0;
let bg2RTyped = "", bg2HTyped = ""; let bg2SeqIdx = 0;
let bg3RTyped = "", bg3HTyped = ""; let bg3SeqIdx = 0;

function typeNext() {
    if (seqIdx >= sequence.length) {
        setTimeout(() => { rTyped = ""; hTyped = ""; seqIdx = 0; updateDOM(); setTimeout(typeNext, 1500); }, 3000);
        return;
    }
    rTyped += sequence[seqIdx].r; hTyped += sequence[seqIdx].h; updateDOM(); seqIdx++;
    setTimeout(typeNext, 50 + Math.random() * 100);
}

function typeBgNext() {
    if (bgSeqIdx >= bgSequence.length) {
        setTimeout(() => { bgRTyped = ""; bgHTyped = ""; bgSeqIdx = 0; updateBgDOM(); setTimeout(typeBgNext, 2000); }, 3500);
        return;
    }
    bgRTyped += bgSequence[bgSeqIdx].r; bgHTyped += bgSequence[bgSeqIdx].h; updateBgDOM(); bgSeqIdx++;
    setTimeout(typeBgNext, 40 + Math.random() * 80);
}

function typeBg2Next() {
    if (bg2SeqIdx >= bg2Seq.length) {
        setTimeout(() => { bg2RTyped = ""; bg2HTyped = ""; bg2SeqIdx = 0; updateBg2DOM(); setTimeout(typeBg2Next, 2200); }, 3200);
        return;
    }
    bg2RTyped += bg2Seq[bg2SeqIdx].r; bg2HTyped += bg2Seq[bg2SeqIdx].h; updateBg2DOM(); bg2SeqIdx++;
    setTimeout(typeBg2Next, 45 + Math.random() * 90);
}

function typeBg3Next() {
    if (bg3SeqIdx >= bg3Seq.length) {
        setTimeout(() => { bg3RTyped = ""; bg3HTyped = ""; bg3SeqIdx = 0; updateBg3DOM(); setTimeout(typeBg3Next, 1800); }, 2800);
        return;
    }
    bg3RTyped += bg3Seq[bg3SeqIdx].r; bg3HTyped += bg3Seq[bg3SeqIdx].h; updateBg3DOM(); bg3SeqIdx++;
    setTimeout(typeBg3Next, 55 + Math.random() * 75);
}

function updateDOM() {
    document.getElementById("r-typed").innerText = rTyped;
    document.getElementById("r-untyped").innerText = romajiStr.substring(rTyped.length);
    document.getElementById("h-typed").innerText = hTyped;
    document.getElementById("h-untyped").innerText = hiraganaStr.substring(hTyped.length);
}

function updateBgDOM() {
    document.getElementById("bg-r-typed").innerText = bgRTyped;
    document.getElementById("bg-r-untyped").innerText = bgRomajiStr.substring(bgRTyped.length);
    document.getElementById("bg-h-typed").innerText = bgHTyped;
    document.getElementById("bg-h-untyped").innerText = bgHiraganaStr.substring(bgHTyped.length);
}

function updateBg2DOM() {
    document.getElementById("bg2-r-typed").innerText = bg2RTyped;
    document.getElementById("bg2-r-untyped").innerText = bg2Romaji.substring(bg2RTyped.length);
    document.getElementById("bg2-h-typed").innerText = bg2HTyped;
    document.getElementById("bg2-h-untyped").innerText = bg2Hiragana.substring(bg2HTyped.length);
}

function updateBg3DOM() {
    document.getElementById("bg3-r-typed").innerText = bg3RTyped;
    document.getElementById("bg3-r-untyped").innerText = bg3Romaji.substring(bg3RTyped.length);
    document.getElementById("bg3-h-typed").innerText = bg3HTyped;
    document.getElementById("bg3-h-untyped").innerText = bg3Hiragana.substring(bg3HTyped.length);
}

setTimeout(typeNext, 1000);
setTimeout(typeBgNext, 500);
setTimeout(typeBg2Next, 1200);
setTimeout(typeBg3Next, 200);

// ── 인기 타이핑/추천 퀴즈 콘텐츠 로딩 ─────────────────
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Fetch popular typing contents
        const typingRes = await fetch('/api/typing-contents?t=' + Date.now());
        const typingData = await typingRes.json();
        if (typingData.success) {
            const sortedTyping = typingData.data.sort((a, b) => (b.play_count || 0) - (a.play_count || 0)).slice(0, 4);
            const typingGrid = document.getElementById('popular-typing-grid');
            typingGrid.innerHTML = '';
            sortedTyping.forEach(item => {
                let badgeColor = 'pink';
                if (item.genre === 'ANIME' || item.genre === '애니메이션' || item.genre === '팝송') badgeColor = 'blue';
                else if (item.genre === '문학' || item.genre === '기타') badgeColor = 'green';
                const descPreview = (item.description && item.description.length > 30) ? item.description.substring(0, 30) + '...' : (item.description || '가사 타이핑 연습하기');
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
                const typeBadge = `<div style="position: absolute; top: 10px; left: 10px; background: rgba(0,0,0,0.7); color: #fff; padding: 4px 10px; border-radius: 6px; font-size: 0.8rem; font-weight: bold; border: 1px solid rgba(255,255,255,0.2); display: flex; align-items: center; gap: 4px; z-index: 2;"><i class="ph-bold ph-keyboard"></i> 타이핑</div>`;
                if (item.youtube_id) {
                    thumbnailHTML = `<div style="margin: -25px -25px 15px -25px; border-radius: 20px 20px 0 0; overflow: hidden; height: 160px; position: relative;">
                        ${typeBadge}
                        <img src="https://img.youtube.com/vi/${item.youtube_id}/hqdefault.jpg" alt="썸네일" style="width: 100%; height: 100%; object-fit: cover; display: block;" class="card-thumb">
                    </div>`;
                } else {
                    thumbnailHTML = `<div style="margin: -25px -25px 15px -25px; border-radius: 20px 20px 0 0; overflow: hidden; height: 160px; background: linear-gradient(135deg, var(--color-pink), var(--color-blue)); display: flex; align-items: center; justify-content: center; color: white; font-size: 3rem; position: relative;">
                        ${typeBadge}
                    </div>`;
                }

                typingGrid.insertAdjacentHTML('beforeend', `
                    <div class="card" onclick="location.href='/typing/${item.id}/play'">
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
                        </div>
                    </div>
                `);
            });
        }

        // Fetch popular quiz contents
        const quizRes = await fetch('/api/quiz-contents?t=' + Date.now());
        const quizData = await quizRes.json();
        if (quizData.success) {
            const sortedQuiz = quizData.data.sort((a, b) => (b.play_count || 0) - (a.play_count || 0)).slice(0, 3);
            const quizGrid = document.getElementById('popular-quiz-grid');
            quizGrid.innerHTML = '';
            sortedQuiz.forEach(item => {
                let badgeColor = 'pink';
                if (item.genre === '영어' || item.genre === '일본어' || item.genre === 'ANIME') badgeColor = 'blue';
                else if (item.genre === '상식' || item.genre === '역사' || item.genre === '문학') badgeColor = 'green';
                const descPreview = (item.description && item.description.length > 30) ? item.description.substring(0, 30) + '...' : (item.description || '퀴즈 풀기');
                const diffStars = `<i class="ph-fill ph-star" style="color:var(--color-pink); vertical-align: middle;"></i> ${item.difficulty || 3}`;
                const bestScore = item.best_score || 0;

                let thumbnailHTML = '';
                const typeBadge = `<div style="position: absolute; top: 10px; left: 10px; background: rgba(0,0,0,0.7); color: #fff; padding: 4px 10px; border-radius: 6px; font-size: 0.8rem; font-weight: bold; border: 1px solid rgba(255,255,255,0.2); display: flex; align-items: center; gap: 4px; z-index: 2;"><i class="ph-bold ph-question"></i> 퀴즈</div>`;
                if (item.thumbnail_url) {
                    thumbnailHTML = `<div style="margin: -25px -25px 15px -25px; border-radius: 20px 20px 0 0; overflow: hidden; height: 160px; position: relative;">
                        ${typeBadge}
                        <img src="${item.thumbnail_url}" alt="썸네일" style="width: 100%; height: 100%; object-fit: cover; display: block;" class="card-thumb">
                    </div>`;
                } else if (item.youtube_id) {
                    thumbnailHTML = `<div style="margin: -25px -25px 15px -25px; border-radius: 20px 20px 0 0; overflow: hidden; height: 160px; position: relative;">
                        ${typeBadge}
                        <img src="https://img.youtube.com/vi/${item.youtube_id}/hqdefault.jpg" alt="썸네일" style="width: 100%; height: 100%; object-fit: cover; display: block;" class="card-thumb">
                    </div>`;
                } else {
                    thumbnailHTML = `<div style="margin: -25px -25px 15px -25px; border-radius: 20px 20px 0 0; overflow: hidden; height: 160px; position: relative; background: var(--theme-bg-hover); display:flex; align-items:center; justify-content:center;">
                        ${typeBadge}
                        <img src="/assets/logo_icon.png" alt="기본 썸네일" style="height: 60%; opacity: 0.5;">
                    </div>`;
                }

                quizGrid.insertAdjacentHTML('beforeend', `
                    <div class="card" onclick="location.href='/quiz/${item.id}/play'">
                        ${thumbnailHTML}
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                            <div class="card-badge ${badgeColor}" style="margin-bottom: 0;">${item.genre || '퀴즈'}</div>
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
                                <span class="play-count" style="margin-left: 10px; font-size: 0.85rem; color: var(--theme-text-muted); font-weight: 600;"><i class="ph-bold ph-play-circle" style="vertical-align: middle; margin-right: 3px;"></i> ${item.play_count || 0}</span>
                            </div>
                        </div>
                    </div>
                `);
            });
        }
    } catch (err) {
        console.error('Failed to load popular contents', err);
    }
});

function scrollSlider(id, direction) {
    const slider = document.getElementById(id);
    if (slider) {
        const scrollAmount = 300; // Amount to scroll per click
        slider.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
    }
}
