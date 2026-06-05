const linesContainer = document.getElementById('lines-container');
const typingInput = document.getElementById('typing-input');
const wpmDisplay = document.getElementById('wpm');
const accuracyDisplay = document.getElementById('accuracy');
const timeDisplay = document.getElementById('time');
const typosDisplay = document.getElementById('typos'); // Added for the new UI
const btnStart = document.getElementById('btn-start');
const btnRestart = document.getElementById('btn-restart');

let timeLeft = 60;
let timer = null;
let isPlaying = false;
let currentText = "";
let currentChars = [];
let currentIndex = 0;
let syncTimer = null;
let currentLineElapsed = 0;
let gameTimeElapsed = 0;
let isYoutubeMode = false;

let youtubePlayer = null;
let currentYoutubeId = null;
let isYoutubeReady = false;
let isPlayerReady = false;

window.onYouTubeIframeAPIReady = function () {
    isYoutubeReady = true;
    initYoutubePlayer();
};

/**
 * YouTube 플레이어를 초기화하는 함수입니다.
 * 지정된 currentYoutubeId를 사용하여 YouTube IFrame API 플레이어 객체를 생성합니다.
 */
function initYoutubePlayer() {
    if (isYoutubeReady && currentYoutubeId && !youtubePlayer) {
        const placeholder = document.getElementById('video-placeholder');
        const container = document.getElementById('youtube-player-container');
        if (placeholder) placeholder.style.display = 'none';
        if (container) container.style.display = 'block';

        youtubePlayer = new YT.Player('youtube-player', {
            videoId: currentYoutubeId,
            playerVars: {
                'playsinline': 1,
                'controls': 1,
                'disablekb': 0,
                'fs': 0,
                'rel': 0,
            },
            events: {
                'onReady': function (event) { isPlayerReady = true; },
                'onStateChange': function (event) {
                    if (event.data == YT.PlayerState.PLAYING) {
                        if (!isPlaying) {
                            startGame(true);
                        } else {
                            resumeTimer();
                        }
                    } else if (event.data == YT.PlayerState.PAUSED || event.data == YT.PlayerState.BUFFERING) {
                        pauseTimer();
                    } else if (event.data == YT.PlayerState.ENDED && isPlaying) {
                        endGame(false);
                    }
                }
            }
        });
    } else if (youtubePlayer && currentYoutubeId) {
        youtubePlayer.loadVideoById(currentYoutubeId);
        youtubePlayer.pauseVideo();
    }
}

const romajiEquivalents = [
    { from: 'shi', to: 'si' }, { from: 'si', to: 'shi' },
    { from: 'chi', to: 'ti' }, { from: 'ti', to: 'chi' },
    { from: 'tsu', to: 'tu' }, { from: 'tu', to: 'tsu' },
    { from: 'fu', to: 'hu' }, { from: 'hu', to: 'fu' },
    { from: 'ji', to: 'zi' }, { from: 'zi', to: 'ji' },
    { from: 'ji', to: 'di' }, { from: 'di', to: 'ji' },
    { from: 'zu', to: 'du' }, { from: 'du', to: 'zu' },
    { from: 'sha', to: 'sya' }, { from: 'sya', to: 'sha' },
    { from: 'shu', to: 'syu' }, { from: 'syu', to: 'shu' },
    { from: 'sho', to: 'syo' }, { from: 'syo', to: 'sho' },
    { from: 'cha', to: 'tya' }, { from: 'tya', to: 'cha' },
    { from: 'chu', to: 'tyu' }, { from: 'tyu', to: 'chu' },
    { from: 'cho', to: 'tyo' }, { from: 'tyo', to: 'cho' },
    { from: 'ja', to: 'zya' }, { from: 'zya', to: 'ja' },
    { from: 'ju', to: 'zyu' }, { from: 'zyu', to: 'ju' },
    { from: 'jo', to: 'zyo' }, { from: 'zyo', to: 'jo' },
    { from: 'ja', to: 'jya' }, { from: 'jya', to: 'ja' },
    { from: 'ju', to: 'jyu' }, { from: 'jyu', to: 'ju' },
    { from: 'jo', to: 'jyo' }, { from: 'jyo', to: 'jo' },
    { from: 'nn', to: 'n' }, { from: 'n', to: 'nn' },
    // 스테가나 (작은 가나) 및 추가 변환 규칙
    { from: 'she', to: 'sye' }, { from: 'sye', to: 'she' },
    { from: 'che', to: 'tye' }, { from: 'tye', to: 'che' },
    { from: 'che', to: 'cye' }, { from: 'cye', to: 'che' },
    { from: 'je', to: 'zye' }, { from: 'zye', to: 'je' },
    { from: 'je', to: 'jye' }, { from: 'jye', to: 'je' },
    { from: 'ti', to: 'thi' }, { from: 'thi', to: 'ti' },
    { from: 'di', to: 'dhi' }, { from: 'dhi', to: 'di' },
    { from: 'fa', to: 'fwa' }, { from: 'fwa', to: 'fa' },
    { from: 'fi', to: 'fwi' }, { from: 'fwi', to: 'fi' },
    { from: 'fe', to: 'fwe' }, { from: 'fwe', to: 'fe' },
    { from: 'fo', to: 'fwo' }, { from: 'fwo', to: 'fo' },
    { from: 'xa', to: 'la' }, { from: 'la', to: 'xa' },
    { from: 'xi', to: 'li' }, { from: 'li', to: 'xi' },
    { from: 'xu', to: 'lu' }, { from: 'lu', to: 'xu' },
    { from: 'xe', to: 'le' }, { from: 'le', to: 'xe' },
    { from: 'xo', to: 'lo' }, { from: 'lo', to: 'xo' },
    { from: 'xya', to: 'lya' }, { from: 'lya', to: 'xya' },
    { from: 'xyu', to: 'lyu' }, { from: 'lyu', to: 'xyu' },
    { from: 'xyo', to: 'lyo' }, { from: 'lyo', to: 'xyo' },
    { from: 'xtu', to: 'ltu' }, { from: 'ltu', to: 'xtu' },
    { from: 'xtsu', to: 'ltsu' }, { from: 'ltsu', to: 'xtsu' }
];

let hiraColorThresholds = [];



/**
 * 입력 중인 로마자와 실제 가사(히라가나) 간의 인덱스 매핑을 생성하는 함수입니다.
 * 사용자가 로마자를 타이핑할 때마다 원본 히라가나에서 어디까지 색칠해야 할지 계산합니다.
 */
function buildMapping() {
    // 현재 줄의 히라가나와 로마자
    let hiragana = contentHiraganaLines[currentLineIndex];
    let romaji = currentText;
    if (!hiragana || !romaji) return;

    // 로마자 입력 위치 -> 색칠할 히라가나 위치 매핑 테이블
    hiraColorThresholds = new Array(romaji.length + 1).fill(0);

    let hIdx = 0; // 히라가나 인덱스
    let rIdx = 0; // 로마자 인덱스

    // 작은 가나(きゃ, しゅ 등) 판별용
    const smallKana = ['ゃ', 'ゅ', 'ょ', 'ぁ', 'ぃ', 'ぅ', 'ぇ', 'ぉ', 'ゎ'];

    // 로마자 음절의 끝을 찾기 위한 모음
    const vowels = ['a', 'i', 'u', 'e', 'o'];

    while (hIdx < hiragana.length && rIdx < romaji.length) {
        let hChar = hiragana[hIdx];

        // 현재 히라가나 음절이 차지하는 길이
        let rLen = 1; // 대응되는 로마자 길이
        let hLen = 1; // 대응되는 히라가나 길이

        if (hChar === 'っ') {
            // 촉음(っ)은 자음 하나 추가(tt) 이거나 명시적 분리입력(xtsu)
            let sokuons = ['xtsu', 'ltsu', 'xtu', 'ltu'];
            rLen = 1;
            for (let sq of sokuons) {
                if (romaji.startsWith(sq, rIdx)) {
                    rLen = sq.length;
                    break;
                }
            }

        } else if (hChar === 'ん') {
            // "ん"은 n 또는 nn, xn, ln으로 입력 가능
            if (romaji.startsWith('xn', rIdx) || romaji.startsWith('ln', rIdx) || romaji.startsWith('nn', rIdx)) {
                rLen = 2;
            } else {
                rLen = 1;
            }

        } else {
            // 다음 문자가 작은 가나면 하나의 음절로 처리
            if (
                hIdx + 1 < hiragana.length &&
                smallKana.includes(hiragana[hIdx + 1])
            ) {
                hLen = 2;
            }

            // 모음이 나올 때까지 읽어서 음절 길이 계산
            rLen = 0;
            while (rIdx + rLen < romaji.length) {
                let c = romaji[rIdx + rLen];
                rLen++;

                if (vowels.includes(c)) break;
            }
        }

        if (rLen === 0) rLen = 1;

        // 음절 입력 중인 구간은 현재 히라가나 위치를 가리킴
        for (let i = 0; i < rLen; i++) {
            if (rIdx + i <= romaji.length) {
                hiraColorThresholds[rIdx + i] = hIdx;
            }
        }

        // 음절이 완성된 시점에는 다음 히라가나까지 색칠
        if (rIdx + rLen <= romaji.length) {
            hiraColorThresholds[rIdx + rLen] = hIdx + hLen;
        }

        // 다음 음절로 이동
        hIdx += hLen;
        rIdx += rLen;
    }

    // 남은 구간은 마지막 히라가나 위치로 채움
    for (let i = rIdx; i <= romaji.length; i++) {
        hiraColorThresholds[i] = hIdx;
    }
}

let sessionCorrectChars = 0;
let sessionTotalChars = 0;
let correctChars = 0;
let totalTypos = 0; // Added for the new UI

let contentLines = [];
let contentHiraganaLines = [];
let contentRomajiLines = [];
let contentTimestamps = [];
let currentLineIndex = 0;

/**
 * 백엔드 서버에서 특정 ID의 타이핑 콘텐츠(가사, 시간, 번역 등) 데이터를 불러오는 함수입니다.
 * @param {number|string} contentId - 불러올 콘텐츠의 고유 ID
 */
async function fetchTypingContent(contentId) {
    try {
        const response = await fetch(`/api/typing-content/${contentId}`);
        const data = await response.json();
        if (data.success) {
            contentLines = data.lines;
            contentHiraganaLines = data.hiragana_lines || data.lines;
            contentRomajiLines = data.romaji_lines;
            
            // 기존 DB에 저장된 스테가나 로마자 변환 오류 교정 (jie -> je 등)
            for (let i = 0; i < contentHiraganaLines.length; i++) {
                if (contentHiraganaLines[i] && contentRomajiLines[i]) {
                    if (contentHiraganaLines[i].includes('じぇ') && contentRomajiLines[i].includes('jie')) {
                        contentRomajiLines[i] = contentRomajiLines[i].replace(/jie/g, 'je');
                    }
                    if (contentHiraganaLines[i].includes('しぇ') && contentRomajiLines[i].includes('shie')) {
                        contentRomajiLines[i] = contentRomajiLines[i].replace(/shie/g, 'she');
                    }
                    if (contentHiraganaLines[i].includes('ちぇ') && contentRomajiLines[i].includes('chie')) {
                        contentRomajiLines[i] = contentRomajiLines[i].replace(/chie/g, 'che');
                    }
                }
            }
            if (data.timestamps) {
                contentTimestamps = data.timestamps.split('\n').map(t => parseFloat(t.trim())).filter(t => !isNaN(t));
            } else {
                contentTimestamps = [];
            }
            currentYoutubeId = data.youtube_id;
            currentLineIndex = 0;
            renderLines();

            if (currentYoutubeId) {
                initYoutubePlayer();
                const controls = document.getElementById('video-controls');
                if (controls) controls.style.display = 'none';
            } else {
                const placeholder = document.getElementById('video-placeholder');
                const container = document.getElementById('youtube-player-container');
                const controls = document.getElementById('video-controls');
                if (placeholder) placeholder.style.display = 'block';
                if (container) container.style.display = 'none';
                if (controls) controls.style.display = 'block';
            }
        } else {
            console.error("Failed to load content.");
            if (linesContainer) linesContainer.innerText = "콘텐츠를 불러오는 데 실패했습니다.";
        }
    } catch (error) {
        console.error(error);
        if (linesContainer) linesContainer.innerText = "서버 에러가 발생했습니다.";
    }
}

/**
 * 현재 입력해야 할 가사와 앞으로 나올 가사들을 화면에 렌더링하는 함수입니다.
 * 가사(한자), 히라가나(읽기), 로마자(입력용)를 DOM 요소로 만들어 화면에 표시합니다.
 */
function renderLines() {
    if (contentLines.length === 0) return;

    if (currentLineIndex >= contentLines.length || currentLineIndex >= contentRomajiLines.length) {
        endGame(true);
        return;
    }

    linesContainer.innerHTML = '';

    // Show up to 3 lines
    for (let i = currentLineIndex; i < currentLineIndex + 3 && i < contentLines.length; i++) {
        const isCurrent = (i === currentLineIndex);

        const block = document.createElement('div');
        block.className = 'lyric-block' + (isCurrent ? ' active' : '');

        const offset = i - currentLineIndex;
        if (offset === 1) {
            block.style.opacity = '0.5';
        } else if (offset === 2) {
            block.style.opacity = '0.2';
        } else if (offset >= 3) {
            block.style.opacity = '0.05';
        }

        const kanjiDiv = document.createElement('div');
        kanjiDiv.className = 'lyric-kanji';
        kanjiDiv.innerText = contentLines[i];

        const hiraDiv = document.createElement('div');
        hiraDiv.className = 'lyric-hiragana';

        if (isCurrent) {
            const hChars = contentHiraganaLines[i].split('');
            hChars.forEach((char) => {
                const span = document.createElement('span');
                span.innerText = char;
                hiraDiv.appendChild(span);
            });
        } else {
            hiraDiv.innerText = contentHiraganaLines[i];
        }
        block.appendChild(hiraDiv);

        const romaDiv = document.createElement('div');
        romaDiv.className = 'lyric-romaji';

        if (isCurrent) {
            currentText = contentRomajiLines[i];
            currentChars = currentText.split('');
            buildMapping();
            currentChars.forEach((char) => {
                const span = document.createElement('span');
                span.innerText = char;
                romaDiv.appendChild(span);
            });
            block.appendChild(romaDiv);
        } else {
            romaDiv.innerText = contentRomajiLines[i];
            block.appendChild(romaDiv);
        }

        block.appendChild(kanjiDiv);

        if (isCurrent) {
            // Add progress bar here, underneath kanji
            const progressContainer = document.createElement('div');
            progressContainer.id = 'progress-bar-container';
            progressContainer.style.marginTop = '15px';
            progressContainer.style.width = '100%';
            progressContainer.style.height = '6px';
            progressContainer.style.background = '#ddd';
            progressContainer.style.borderRadius = '3px';
            progressContainer.style.overflow = 'hidden';

            const progressBar = document.createElement('div');
            progressBar.id = 'line-progress-bar';
            progressBar.style.width = '0%'; // Start at 0%
            progressBar.style.height = '100%';
            progressBar.style.background = 'linear-gradient(90deg, #ff9a9e, #fecfef)';
            progressBar.style.transition = 'width 0.1s linear';

            progressContainer.appendChild(progressBar);
            block.appendChild(progressContainer);
        }

        linesContainer.appendChild(block);
    }
    typingInput.value = '';
    currentIndex = 0;
    correctChars = 0;

    highlightCurrentChar();
}

/**
 * 타이핑 게임을 시작하는 함수입니다.
 * 남은 시간을 초기화하고, 입력창을 활성화하며, 타이머와 싱크 루프를 가동합니다.
 * @param {boolean} startedByYoutube - 유튜브 영상에 의해 자동으로 시작되었는지 여부
 */
function startGame(startedByYoutube = false) {
    if (isPlaying) return;
    if (contentLines.length === 0) return;

    if (!startedByYoutube && youtubePlayer && isPlayerReady) {
        youtubePlayer.playVideo();
    }

    sessionCorrectChars = 0;
    sessionTotalChars = 0;
    totalTypos = 0;
    gameTimeElapsed = 0;
    isYoutubeMode = !!(youtubePlayer && isPlayerReady && currentYoutubeId);

    if (isYoutubeMode && youtubePlayer.getDuration) {
        let dur = Math.round(youtubePlayer.getDuration());
        timeLeft = dur > 0 ? dur : 60;
    } else {
        timeLeft = 0; // 유튜브 모드가 아니면 0부터 시작해서 시간 증가 (무제한)
    }

    timeDisplay.innerText = timeLeft;
    wpmDisplay.innerText = 0;
    accuracyDisplay.innerText = '100%';
    if (typosDisplay) typosDisplay.innerText = 0;

    isPlaying = true;
    typingInput.disabled = false;
    typingInput.focus();

    currentLineIndex = 0;
    renderLines();

    startTimer();
    startSyncLoop();
}

/**
 * 남은 시간(초)을 카운트다운하는 기본 타이머를 시작하는 함수입니다.
 * 매 초마다 남은 시간을 감소시키고 0이 되면 게임을 종료합니다.
 */
function startTimer() {
    clearInterval(timer);
    timer = setInterval(() => {
        gameTimeElapsed++;
        if (isYoutubeMode) {
            if (timeLeft > 0) {
                timeLeft--;
                timeDisplay.innerText = timeLeft;
                updateStats();
            } else {
                endGame(false);
            }
        } else {
            timeLeft++; // 무제한 모드일 때는 남은 시간 대신 경과 시간을 보여줍니다
            timeDisplay.innerText = timeLeft;
            updateStats();
        }
    }, 1000);
}

/**
 * 게임 타이머와 진행 바 싱크 루프를 일시 정지하는 함수입니다.
 */
function pauseTimer() {
    clearInterval(timer);
}

/**
 * 일시 정지된 게임 타이머와 진행 바 싱크 루프를 다시 재개하는 함수입니다.
 */
function resumeTimer() {
    if (isPlaying && timeLeft > 0) {
        startTimer();
    }
}

/**
 * 타이핑 게임을 종료하는 함수입니다.
 * 입력창을 비활성화하고 타이머를 정지시키며, 모든 가사를 성공적으로 마쳤는지 여부에 따라 결과를 출력합니다.
 * @param {boolean} completed - 끝까지 입력하여 성공적으로 게임을 마쳤는지 여부
 */
function endGame(completed = false) {
    clearInterval(timer);
    clearInterval(syncTimer);
    isPlaying = false;
    typingInput.disabled = true;

    if (youtubePlayer && isPlayerReady) {
        youtubePlayer.pauseVideo();
    }
}

/**
 * 현재까지 입력한 문자 수와 걸린 시간 등을 바탕으로 
 * WPM(분당 타자수), 정확도, 오타수 등의 통계 데이터를 갱신하여 화면에 표시하는 함수입니다.
 */
function updateStats() {
    const timeElapsed = gameTimeElapsed;
    let wpm = 0;

    const totalCorrect = sessionCorrectChars + correctChars;
    const totalTyped = sessionTotalChars + typingInput.value.length + totalTypos;

    if (timeElapsed > 0) {
        wpm = Math.round(((totalCorrect / 5) / timeElapsed) * 60);
    }
    wpmDisplay.innerText = wpm;

    let accuracy = 100;
    if (totalTyped > 0) {
        accuracy = Math.round((totalCorrect / totalTyped) * 100);
    }
    accuracyDisplay.innerText = accuracy + '%';
    if (typosDisplay) typosDisplay.innerText = totalTypos;
}

/**
 * 사용자가 현재 입력해야 할 문자를 화면에서 시각적으로 하이라이트(밑줄 등) 처리하는 함수입니다.
 */
function highlightCurrentChar() {
    const activeBlock = linesContainer.querySelector('.lyric-block.active .lyric-romaji');
    if (!activeBlock) return;
    const spans = activeBlock.querySelectorAll('span');
    spans.forEach(span => span.classList.remove('active'));
    if (currentIndex < spans.length) {
        spans[currentIndex].classList.add('active');
    }
}

typingInput.addEventListener('input', (e) => {
    if (!isPlaying) return;

    let typedValue = typingInput.value;

    let validPrefixLength = 0;
    for (let i = 0; i < typedValue.length; i++) {
        if (typedValue[i] === currentChars[i]) {
            validPrefixLength++;
        } else {
            break;
        }
    }

    if (validPrefixLength < typedValue.length) {
        let replaced = false;
        for (let k = Math.min(validPrefixLength, 3); k >= 0; k--) {
            let checkPos = validPrefixLength - k;
            let textToMatch = currentText.substring(checkPos);
            for (let eq of romajiEquivalents) {
                if (textToMatch.startsWith(eq.from)) {
                    let newText = currentText.substring(0, checkPos) + eq.to + currentText.substring(checkPos + eq.from.length);
                    if (newText.startsWith(typedValue)) {
                        currentText = newText;
                        currentChars = currentText.split('');
                        replaced = true;
                        buildMapping();

                        const activeBlock = linesContainer.querySelector('.lyric-block.active .lyric-romaji');
                        if (activeBlock) {
                            activeBlock.innerHTML = '';
                            currentChars.forEach((char) => {
                                const span = document.createElement('span');
                                span.innerText = char;
                                activeBlock.appendChild(span);
                            });
                        }

                        validPrefixLength = typedValue.length;
                        break;
                    }
                }
            }
            if (replaced) break;

            // 동적 촉음(sokuon) 변환 규칙: 연속된 자음(예: tta) <-> 분리 입력(xtsuta, ltsuta 등)
            // (마이페이지 설정에서 켠 유저만 허용)
            if (localStorage.getItem('allowSplitSokuon') === 'true') {
                if (textToMatch.length >= 2 && textToMatch[0] === textToMatch[1] && 'bcdfghjklmnpqrstvwxyz'.includes(textToMatch[0])) {
                    let rest = textToMatch.substring(1); // 첫 번째 자음을 뺀 나머지
                    let possibleSokuons = ['xtsu', 'ltsu', 'xtu', 'ltu'];
                    for (let sokuon of possibleSokuons) {
                        let newText = currentText.substring(0, checkPos) + sokuon + rest;
                        if (newText.startsWith(typedValue)) {
                            currentText = newText;
                            currentChars = currentText.split('');
                            replaced = true;
                            buildMapping();
                            const activeBlock = linesContainer.querySelector('.lyric-block.active .lyric-romaji');
                            if (activeBlock) {
                                activeBlock.innerHTML = '';
                                currentChars.forEach((char) => {
                                    const span = document.createElement('span');
                                    span.innerText = char;
                                    activeBlock.appendChild(span);
                                });
                            }
                            validPrefixLength = typedValue.length;
                            break;
                        }
                    }
                }
                if (replaced) break;

                // 분리 입력(xtsuta) -> 연속된 자음(tta) 역변환 규칙
                let possibleSokuons = ['xtsu', 'ltsu', 'xtu', 'ltu'];
                for (let sokuon of possibleSokuons) {
                    if (textToMatch.startsWith(sokuon) && textToMatch.length > sokuon.length) {
                        let nextChar = textToMatch[sokuon.length];
                        if ('bcdfghjklmnpqrstvwxyz'.includes(nextChar)) {
                            let newText = currentText.substring(0, checkPos) + nextChar + textToMatch.substring(sokuon.length);
                            if (newText.startsWith(typedValue)) {
                                currentText = newText;
                                currentChars = currentText.split('');
                                replaced = true;
                                buildMapping();
                                const activeBlock = linesContainer.querySelector('.lyric-block.active .lyric-romaji');
                                if (activeBlock) {
                                    activeBlock.innerHTML = '';
                                    currentChars.forEach((char) => {
                                        const span = document.createElement('span');
                                        span.innerText = char;
                                        activeBlock.appendChild(span);
                                    });
                                }
                                validPrefixLength = typedValue.length;
                                break;
                            }
                        }
                    }
                }
                if (replaced) break;
            }
        }

        if (!replaced) {
            // A wrong character was typed
            totalTypos++;
            typingInput.value = currentChars.slice(0, validPrefixLength).join('');
            typedValue = typingInput.value;
            updateStats(); // update typos immediately
        }
    }

    const activeBlock = linesContainer.querySelector('.lyric-block.active .lyric-romaji');
    const hiraBlock = linesContainer.querySelector('.lyric-block.active .lyric-hiragana');

    if (!activeBlock) return;
    const spans = activeBlock.querySelectorAll('span');
    const hiraSpans = hiraBlock ? hiraBlock.querySelectorAll('span') : [];

    correctChars = 0;

    spans.forEach((span, index) => {
        span.className = '';

        if (index < typedValue.length) {
            span.classList.add('correct');
            correctChars++;
        }
    });

    // Color hiragana progressively based on the exact mora thresholds
    const hiraCorrectCount = hiraColorThresholds[typedValue.length] || 0;

    hiraSpans.forEach((span, index) => {
        span.className = '';
        if (index < hiraCorrectCount) {
            span.classList.add('correct');
        }
    });

    currentIndex = typedValue.length;
    highlightCurrentChar();

    if (currentIndex >= currentChars.length) {
        sessionCorrectChars += correctChars;
        sessionTotalChars += typedValue.length;

        currentLineIndex++;

        setTimeout(() => {
            if (isPlaying) {
                renderLines();
                startSyncLoop();
            }
        }, 300);
    }
});

/**
 * 현재 가사의 재생 시간(싱크)에 맞춰 진행 바(Progress Bar)를 업데이트하고,
 * 설정된 시간이 초과되면 강제로 다음 줄로 넘어가도록 체크하는 루프 함수입니다.
 */
function startSyncLoop() {
    clearInterval(syncTimer);
    const progressContainer = document.getElementById('progress-bar-container');
    const progressBar = document.getElementById('line-progress-bar');
    if (progressContainer) progressContainer.style.opacity = '1';

    let duration = 50.0; // default 5 seconds
    if (contentTimestamps.length > currentLineIndex + 1 && contentTimestamps[currentLineIndex] !== undefined) {
        duration = contentTimestamps[currentLineIndex + 1] - contentTimestamps[currentLineIndex];
        if (duration <= 0) duration = 50.0;
    } else if (contentTimestamps[currentLineIndex] !== undefined) {
        // Last line
        duration = 50.0;
    }

    currentLineElapsed = 0;

    syncTimer = setInterval(() => {
        if (!isPlaying) return;

        if (isYoutubeMode) {
            if (contentTimestamps.length > 0 && contentTimestamps[currentLineIndex] !== undefined) {
                let currentTime = youtubePlayer.getCurrentTime();
                let lineStartTime = contentTimestamps[currentLineIndex];
                currentLineElapsed = currentTime - lineStartTime;

                if (currentLineElapsed < 0) {
                    if (progressBar) progressBar.style.width = '100%';
                    return;
                }
            } else {
                currentLineElapsed += 0.05;
            }

            let remaining = duration - currentLineElapsed;

            if (remaining <= 0) {
                forceSkipToNextLine();
            } else {
                let percent = (currentLineElapsed / duration) * 100;
                if (percent < 0) percent = 0;
                if (percent > 100) percent = 100;
                if (progressBar) progressBar.style.width = percent + '%';
            }
        } else {
            // 유튜브 영상이 없는 경우, 강제 스킵 없이 진행바를 꽉 채워둠
            if (progressBar) progressBar.style.width = '100%';
        }
    }, 50);
}

/**
 * 사용자가 현재 줄의 가사를 시간 내에 다 치지 못했을 때 강제로 다음 가사로 넘기는 함수입니다.
 * 입력하지 못한 글자들은 자동으로 오타(typos) 처리됩니다.
 */
function forceSkipToNextLine() {
    if (currentChars && currentIndex < currentChars.length) {
        totalTypos += (currentChars.length - currentIndex);
    }

    sessionCorrectChars += correctChars;
    sessionTotalChars += currentChars.length;
    updateStats();

    currentLineIndex++;

    if (currentLineIndex >= contentLines.length || currentLineIndex >= contentRomajiLines.length) {
        endGame(true);
    } else {
        renderLines();
        startSyncLoop();
    }
}

// Click anywhere in typing area to focus input
const typingPanel = document.querySelector('.typing-panel');
if (typingPanel) {
    typingPanel.addEventListener('click', () => {
        if (isPlaying) typingInput.focus();
    });
}

btnStart.addEventListener('click', startGame);

btnRestart.addEventListener('click', () => {
    clearInterval(timer);
    isPlaying = false;
    typingInput.value = '';
    typingInput.disabled = true;
    timeDisplay.innerText = 0;
    wpmDisplay.innerText = 0;
    accuracyDisplay.innerText = '100%';
    if (typosDisplay) typosDisplay.innerText = 0;

    if (youtubePlayer && isPlayerReady) {
        youtubePlayer.pauseVideo();
        youtubePlayer.seekTo(0);
    }

    currentLineIndex = 0;
    renderLines();
    const progressContainer = document.getElementById('progress-bar-container');
    if (progressContainer) progressContainer.style.opacity = '0';
    clearInterval(syncTimer);
});

// Load test content
const urlParams = new URLSearchParams(window.location.search);
const contentId = urlParams.get('id') || 1;
fetchTypingContent(contentId);
