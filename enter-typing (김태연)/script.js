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
let isLineCompleted = false;

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

const romajiTable = {
    あ: ["a"], い: ["i", "yi"], う: ["u", "wu"], え: ["e", "ye"], お: ["o"],
    か: ["ka"], き: ["ki"], く: ["ku"], け: ["ke"], こ: ["ko"],
    さ: ["sa"], し: ["shi", "si"], す: ["su"], せ: ["se"], そ: ["so"],
    た: ["ta"], ち: ["chi", "ti"], つ: ["tsu", "tu"], て: ["te"], と: ["to"],
    な: ["na"], に: ["ni"], ぬ: ["nu"], ね: ["ne"], の: ["no"],
    は: ["ha"], ひ: ["hi"], ふ: ["fu", "hu"], へ: ["he"], ほ: ["ho"],
    ま: ["ma"], み: ["mi"], む: ["mu"], め: ["me"], も: ["mo"],
    や: ["ya"], ゆ: ["yu"], よ: ["yo"],
    ら: ["ra"], り: ["ri"], る: ["ru"], れ: ["re"], ろ: ["ro"],
    わ: ["wa"], を: ["wo"], ん: ["nn", "n", "n'"],
    が: ["ga"], ぎ: ["gi"], ぐ: ["gu"], げ: ["ge"], ご: ["go"],
    ざ: ["za"], じ: ["zi", "ji"], ず: ["zu"], ぜ: ["ze"], ぞ: ["zo"],
    だ: ["da"], ぢ: ["di"], づ: ["du"], で: ["de"], ど: ["do"],
    ば: ["ba"], び: ["bi"], ぶ: ["bu"], べ: ["be"], ぼ: ["bo"],
    ぱ: ["pa"], ぴ: ["pi"], ぷ: ["pu"], ぺ: ["pe"], ぽ: ["po"],
    ぁ: ["xa", "la"], ぃ: ["xi", "li"], ぅ: ["xu", "lu"], ぇ: ["xe", "le"], ぉ: ["xo", "lo"],
    っ: ["xtsu", "ltsu", "xtu", "ltu"],
    ゃ: ["xya", "lya"], ゅ: ["xyu", "lyu"], ょ: ["xyo", "lyo"], ゎ: ["xwa", "lwa"],
    " ": [" "], "、": [","], "。": ["."], "?": ["?"], "!": ["!"],
    "？": ["?"], "！": ["!"], "〜": ["~"], "~": ["~"]
};

const combinationRules = {
    き: { ゃ: ["kya"], ゅ: ["kyu"], ょ: ["kyo"] },
    し: { ゃ: ["sha", "sya"], ゅ: ["shu", "syu"], ょ: ["sho", "syo"], ぇ: ["she", "sye"] },
    ち: { ゃ: ["cha", "tya"], ゅ: ["chu", "tyu"], ょ: ["cho", "tyo"], ぇ: ["che", "tye"] },
    に: { ゃ: ["nya"], ゅ: ["nyu"], ょ: ["nyo"] },
    ひ: { ゃ: ["hya"], ゅ: ["hyu"], ょ: ["hyo"] },
    み: { ゃ: ["mya"], ゅ: ["myu"], ょ: ["myo"] },
    り: { ゃ: ["rya"], ゅ: ["ryu"], ょ: ["ryo"] },
    ぎ: { ゃ: ["gya"], ゅ: ["gyu"], ょ: ["gyo"] },
    じ: { ゃ: ["ja", "zya"], ゅ: ["ju", "zyu"], ょ: ["jo", "zyo"], ぇ: ["je", "zye"] },
    ぢ: { ゃ: ["dya"], ゅ: ["dyu"], ょ: ["dyo"] },
    び: { ゃ: ["bya"], ゅ: ["byu"], ょ: ["byo"] },
    ぴ: { ゃ: ["pya"], ゅ: ["pyu"], ょ: ["pyo"] }
};

function parseKanaToTargetUnits(kanaString, mustCombine) {
    const rawChars = Array.from(kanaString);
    const targetUnits = [];

    for (let i = 0; i < rawChars.length; i++) {
        let char = rawChars[i];
        let nextChar = rawChars[i + 1];

        if (char === "っ" && nextChar && mustCombine && romajiTable[nextChar]) {
            let nextValidRomajis = romajiTable[nextChar];
            let combinedRomajis = [];
            nextValidRomajis.forEach((r) => {
                combinedRomajis.push(r[0] + r);
                romajiTable["っ"].forEach((s) => {
                    combinedRomajis.push(s + r);
                });
            });
            targetUnits.push({
                text: char + nextChar,
                validInputs: [...new Set(combinedRomajis)],
            });
            i++;
            continue;
        }

        if (mustCombine && combinationRules[char] && nextChar && combinationRules[char][nextChar]) {
            let combinedRomajis = [...combinationRules[char][nextChar]];
            romajiTable[char].forEach((c) => {
                romajiTable[nextChar].forEach((n) => {
                    combinedRomajis.push(c + n);
                });
            });
            targetUnits.push({
                text: char + nextChar,
                validInputs: [...new Set(combinedRomajis)],
            });
            i++;
            continue;
        }

        targetUnits.push({ text: char, validInputs: romajiTable[char] || [char] });
    }
    return targetUnits;
}

let currentUnits = [];

function findValidPath(units, typedStr, unitIndex = 0, path = []) {
    if (typedStr.length === 0) return { isValid: true, matchedCount: unitIndex, currentMatch: "", path: path };
    if (unitIndex >= units.length) return { isValid: false };

    let unit = units[unitIndex];

    for (let val of unit.validInputs) {
        if (typedStr.startsWith(val)) {
            let res = findValidPath(units, typedStr.substring(val.length), unitIndex + 1, [...path, val]);
            if (res.isValid) {
                return res;
            }
        }
    }

    for (let val of unit.validInputs) {
        if (val.startsWith(typedStr)) {
            return { isValid: true, matchedCount: unitIndex, currentMatch: typedStr, path: [...path, val] };
        }
    }

    return { isValid: false };
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

                // 첫 가사가 나오기 전까지(0.5초 초과) 대기 시간이 있다면 시작 전 간주 더미 추가
                if (contentTimestamps.length > 0 && contentTimestamps[0] > 0.5) {
                    contentLines.unshift("🎵");
                    contentHiraganaLines.unshift("");
                    contentRomajiLines.unshift("");
                    contentTimestamps.unshift(0);
                }
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
            currentUnits = parseKanaToTargetUnits(contentHiraganaLines[i], true);
            currentText = currentUnits.map(u => u.validInputs[0]).join('');
            currentChars = currentText.split('');

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
            progressBar.style.transition = 'width 0.1s linear, background 0.3s ease';

            progressContainer.appendChild(progressBar);
            block.appendChild(progressContainer);
        }

        linesContainer.appendChild(block);
    }
    isLineCompleted = false;
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
    if (isLineCompleted) {
        typingInput.value = currentChars.join('');
        return;
    }
    if (currentUnits.length === 0) {
        typingInput.value = '';
        return;
    }

    let typedValue = typingInput.value;
    let res = findValidPath(currentUnits, typedValue);

    if (!res.isValid) {
        // Typo
        totalTypos++;
        typingInput.value = typedValue.slice(0, -1);
        typedValue = typingInput.value;
        updateStats();

        // Re-evaluate valid path for the reverted string
        res = findValidPath(currentUnits, typedValue);
        if (!res.isValid) return; // Should not happen
    }

    // Update dynamic romaji text to match the chosen path
    let newText = "";
    for (let i = 0; i < currentUnits.length; i++) {
        if (i < res.path.length) {
            newText += res.path[i];
        } else {
            newText += currentUnits[i].validInputs[0]; // fallback to default
        }
    }

    if (newText !== currentText) {
        currentText = newText;
        currentChars = currentText.split('');

        const activeBlock = linesContainer.querySelector('.lyric-block.active .lyric-romaji');
        if (activeBlock) {
            activeBlock.innerHTML = '';
            currentChars.forEach((char) => {
                const span = document.createElement('span');
                span.innerText = char;
                activeBlock.appendChild(span);
            });
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

    let hiraCorrectCount = 0;
    for (let i = 0; i < res.matchedCount; i++) {
        hiraCorrectCount += currentUnits[i].text.length;
    }

    hiraSpans.forEach((span, index) => {
        span.className = '';
        if (index < hiraCorrectCount) {
            span.classList.add('correct');
        }
    });

    currentIndex = typedValue.length;
    highlightCurrentChar();

    if (res.matchedCount === currentUnits.length && res.currentMatch === "") {
        isLineCompleted = true;

        const activeHiraBlock = linesContainer.querySelector('.lyric-block.active .lyric-hiragana');
        if (activeHiraBlock) {
            const hiraSpans = activeHiraBlock.querySelectorAll('span');
            hiraSpans.forEach(span => {
                span.style.color = '#27ae60';
                span.style.textShadow = '0 0 8px rgba(39, 174, 96, 0.4)';
            });
        }

        const progressBar = document.getElementById('line-progress-bar');
        if (progressBar) {
            progressBar.style.background = 'linear-gradient(90deg, #27ae60, #2ecc71)';
        }

        if (!isYoutubeMode) {
            setTimeout(() => {
                if (isPlaying) {
                    transitionNextLine(false);
                }
            }, 300);
        }
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
                transitionNextLine(!isLineCompleted);
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
 * 다음 가사로 넘어가는 트랜지션 함수입니다.
 * @param {boolean} isForceSkip - 시간 초과로 인해 강제로 넘어가는지 여부
 */
function transitionNextLine(isForceSkip) {
    if (isForceSkip) {
        if (currentChars && currentIndex < currentChars.length) {
            totalTypos += (currentChars.length - currentIndex);
        }
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
