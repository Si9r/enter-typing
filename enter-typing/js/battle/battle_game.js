// ── battle_game.js: 인게임 턴 진행, 타이핑/퀴즈 판정, 점수 계산 전담 ──────
import { state } from './battle_state.js';
import { send } from './battle_websocket.js';
import {
    switchView, updateVideoInfoPanel, renderLiveRanking,
    addQuizSystemChat, addQuizUserChat, addQuizOpponentChat, renderLiveRankingQuiz
} from './battle_ui.js';

// ── YouTube 플레이어 초기화 ────────────────────────────────────────
export function initYoutubePlayer() {
    YouTubeManager.createPlayer('youtube-player', {
        height: '100%',
        width: '100%',
        videoId: '',
        playerVars: {
            'autoplay': 1,
            'controls': 0,
            'disablekb': 1,
            'fs': 0,
            'rel': 0,
            'modestbranding': 1
        },
        events: {
            'onReady': (event) => {
                state.ytPlayer = event.target;
                console.log('YT Player Ready');
                const volSlider = document.getElementById("volume-slider");
                if (volSlider && state.ytPlayer && typeof state.ytPlayer.setVolume === "function") {
                    state.ytPlayer.setVolume(volSlider.value);
                }
            }
        }
    });
}

// ── 타이핑 대전 턴 상태 (이 모듈 안에서만 쓰이는 캡슐화된 상태) ────────────
let currentLineIndex = 0;
let currentHiraTarget = "";
let currentKanjiTarget = "";
let battleTargetUnits = [];
let currentUnitIndex = 0;
let currentBuffer = "";
let startWpmTime = 0;
let totalKeysTyped = 0;
let typoCount = 0;
let myProgress = 0;

// 점수 계산용 변수 (혼자하기 모드와 동일한 방식 적용)
let totalRemainingTime = 0;
let totalTimeSum = 0;
let currentLineTypingStartTime = 0;
let totalTargetCorrectChars = 0;
let totalCorrectChars = 0;

// Sync and Timing variables
let currentSectionDuration = 0;
let currentLineElapsed = 0;
let lineCompleted = false;
let isWaitingPhase = false;
let savedSectionRemaining = 0;
let isYoutubeMode = false;
let syncCheckInterval = null;

export function checkAndSendSyncReady() {
    if (!state.selectedSong || !state.selectedSong.youtube_id) {
        send({ type: "sync_ready" });
        return;
    }

    const ytPlayer = state.ytPlayer;
    if (ytPlayer && typeof ytPlayer.cueVideoById === 'function') {
        ytPlayer.cueVideoById(state.selectedSong.youtube_id);
    }

    const checkState = () => {
        if (!state.ytPlayer || typeof state.ytPlayer.getPlayerState !== 'function') {
            return;
        }
        const playerState = state.ytPlayer.getPlayerState();
        if (playerState === YT.PlayerState.CUED || playerState === YT.PlayerState.PLAYING || playerState === YT.PlayerState.PAUSED) {
            if (playerState === YT.PlayerState.PLAYING) state.ytPlayer.pauseVideo();
            if (syncCheckInterval) clearInterval(syncCheckInterval);
            send({ type: "sync_ready" });
        } else if (playerState === YT.PlayerState.UNSTARTED || playerState == null) {
            if (typeof state.ytPlayer.playVideo === 'function') state.ytPlayer.playVideo();
            setTimeout(() => {
                if (typeof state.ytPlayer.getPlayerState === 'function' && state.ytPlayer.getPlayerState() === YT.PlayerState.PLAYING) {
                    state.ytPlayer.pauseVideo();
                }
            }, 100);
        }
    };

    syncCheckInterval = setInterval(checkState, 500);
    checkState(); // Check immediately
}

function renderWaitingPhase() {
    const song = state.selectedSong;
    const totalLines = song.lines.length;
    document.getElementById("game-stage-indicator").textContent = `STAGE ${currentLineIndex + 1} / ${totalLines}`;
    document.getElementById("game-kanji-display").textContent = window.i18nTranslate ? window.i18nTranslate("준비 중...") : "준비 중...";
    const nextPrefix = window.i18nTranslate ? window.i18nTranslate("Next") : "Next";
    document.getElementById("game-next-display").textContent = `${nextPrefix} - ${song.lines[currentLineIndex] || "-"}`;
    document.getElementById("game-lyric-display").innerHTML = "<span class='lyric-unit pending'><span class='hira-text'>-</span><span class='roma-text'><span>-</span></span></span>";

    const input = document.getElementById("game-typing-input");
    input.value = "";
    input.disabled = true;
    input.placeholder = currentLineIndex === 0 ? window.i18nTranslate("전주 재생 중... 대기하세요 ⏳") : window.i18nTranslate("다음 가사 대기 중... ⏳");

    const statusPanel = document.getElementById("game-status-panel");
    if (statusPanel) {
        statusPanel.innerHTML = `<span style="color: #666;">${window.i18nTranslate("곧 가사가 시작됩니다. 대기하세요...")}</span>`;
    }

    battleTargetUnits = [];
    currentBuffer = "";
}

function startSyncLoop() {
    if (state.syncTimer) clearInterval(state.syncTimer);
    if (!state.currentRoom || state.currentRoom.status !== "playing") return;

    const song = state.selectedSong;
    if (!song) return;

    const progressBar = document.getElementById("game-progress-fill");
    if (progressBar) progressBar.style.width = "0%";

    let duration = 50.0;
    if (song.timestamps && song.timestamps.length > currentLineIndex + 1 && song.timestamps[currentLineIndex] !== undefined) {
        duration = song.timestamps[currentLineIndex + 1] - song.timestamps[currentLineIndex];
        if (duration <= 0) duration = 0.1;
    } else if (song.timestamps && song.timestamps[currentLineIndex] !== undefined) {
        if (state.ytPlayer && typeof state.ytPlayer.getDuration === 'function') {
            let totalDur = state.ytPlayer.getDuration();
            if (totalDur > 0) {
                duration = totalDur - song.timestamps[currentLineIndex];
                if (duration <= 0) duration = 5.0;
            }
        }
    }

    currentSectionDuration = duration;
    currentLineElapsed = 0;

    // 가상 타이머: YouTube가 일시 중단됐을 때 경과 시간을 추적
    // YouTube 현재 시간으로 초기화 (0에서 시작하면 timestamps[0]까지 두 번 대기하는 버그)
    let simulatedTime = (state.ytPlayer && typeof state.ytPlayer.getCurrentTime === 'function')
        ? state.ytPlayer.getCurrentTime()
        : 0;
    let lastTickTime = Date.now();

    state.syncTimer = setInterval(() => {
        if (state.currentRoom?.status !== "playing") {
            clearInterval(state.syncTimer);
            return;
        }

        //  가상 시간 흐름 계산 (현실 시간 기반)
        let now = Date.now();
        let delta = (now - lastTickTime) / 1000;
        lastTickTime = now;

        const ytPlayer = state.ytPlayer;
        if (isYoutubeMode && ytPlayer && typeof ytPlayer.getCurrentTime === 'function') {
            let playerState = typeof ytPlayer.getPlayerState === 'function' ? ytPlayer.getPlayerState() : -1;
            let currentTime;

            // state: 1=PLAYING, 3=BUFFERING, -1=초기화중, 0=종료, 2=일시정지
            if (playerState === 1) { // YT.PlayerState.PLAYING
                currentTime = ytPlayer.getCurrentTime();
                simulatedTime = currentTime;
            } else if (playerState === -1) {
                // 초기화 중 - simulatedTime 유지, 재생 시도
                simulatedTime += delta;
                currentTime = simulatedTime;
                if (typeof ytPlayer.playVideo === 'function') ytPlayer.playVideo();
            } else {
                // 일시정지 / 버퍼링 - 가상 시간 사용
                simulatedTime += delta;
                currentTime = simulatedTime;
                // 버퍼링(3) 제외하고 재생 요청
                if (playerState !== 3 && typeof ytPlayer.playVideo === 'function') {
                    ytPlayer.playVideo();
                }
            }

            if (ytPlayer.getDuration) {
                let totalDur = Math.round(ytPlayer.getDuration());
                let timeLeft = Math.max(0, Math.round(totalDur - currentTime));
                const timeEl = document.getElementById("time");
                if (timeEl) timeEl.innerText = timeLeft;
            }

            if (song.timestamps && song.timestamps[currentLineIndex] !== undefined) {
                let lineStartTime = song.timestamps[currentLineIndex];
                currentLineElapsed = currentTime - lineStartTime;

                if (currentLineElapsed < 0) {
                    if (!isWaitingPhase) {
                        isWaitingPhase = true;
                        renderWaitingPhase();
                    }

                    let prevLineStartTime = 0;
                    if (currentLineIndex > 0 && song.timestamps[currentLineIndex - 1] !== undefined) {
                        prevLineStartTime = song.timestamps[currentLineIndex - 1];
                    }
                    let waitDuration = lineStartTime - prevLineStartTime;
                    let waitElapsed = currentTime - prevLineStartTime;

                    if (waitDuration > 0) {
                        let percent = (waitElapsed / waitDuration) * 100;
                        if (percent < 0) percent = 0;
                        if (percent > 100) percent = 100;
                        if (progressBar) progressBar.style.width = percent + "%";
                    } else {
                        if (progressBar) progressBar.style.width = "100%";
                    }
                    return;
                } else {
                    if (isWaitingPhase) {
                        isWaitingPhase = false;
                        loadGameplayLine(); // ⏳ 이제 막히지 않고 가사가 화면에 뜹니다!
                    }
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
                if (progressBar) progressBar.style.width = percent + "%";
            }
        } else {
            // 유튜브가 아예 연결 안 됐을 때도 강제로 시간 흐르게 처리
            currentLineElapsed += 0.05;
            let remaining = duration - currentLineElapsed;
            if (remaining <= 0) {
                forceSkipToNextLine();
            } else {
                let percent = (currentLineElapsed / duration) * 100;
                if (percent < 0) percent = 0;
                if (percent > 100) percent = 100;
                if (progressBar) progressBar.style.width = percent + "%";
            }
        }
    }, 50);
}

function forceSkipToNextLine() {
    const song = state.selectedSong;
    if (!song) return;

    const lineRomaji = song.romaji_lines[currentLineIndex] || "";
    const lineRomajiLen = lineRomaji.replace(/\s+/g, "").length;
    const lineCorrect = getCompletedRomajiLength(battleTargetUnits, currentUnitIndex) + currentBuffer.length;

    if (!lineCompleted) {
        // Time limit expired, user didn't finish
        const missedCount = Math.max(0, lineRomajiLen - lineCorrect);
        typoCount += missedCount;
        totalKeysTyped += missedCount;

        totalCorrectChars += lineCorrect;
        totalRemainingTime += 0;
    } else {
        // User finished earlier
        totalCorrectChars += lineRomajiLen;
        totalRemainingTime += savedSectionRemaining;
    }

    totalTargetCorrectChars += lineRomajiLen;
    totalTimeSum += currentSectionDuration;

    lineCompleted = false;
    const input = document.getElementById("game-typing-input");
    if (input) input.disabled = false;

    currentLineIndex++;

    if (currentLineIndex >= song.lines.length) {
        finishMyTypingGame();
    } else {
        loadGameplayLine();
        startSyncLoop();
    }
}

function handleLineCompletion() {
    if (lineCompleted) return;
    lineCompleted = true;

    let elapsed = currentLineElapsed;
    if (elapsed < 0) elapsed = 0;
    savedSectionRemaining = Math.max(0, currentSectionDuration - elapsed);

    const input = document.getElementById("game-typing-input");
    if (input) {
        input.disabled = true;
        input.placeholder = window.i18nTranslate("가사를 모두 입력했습니다. 대기 중... ⏳");
    }

    const statusPanel = document.getElementById("game-status-panel");
    if (statusPanel) {
        statusPanel.innerHTML = `<span class="success-text"> ${window.i18nTranslate("문장을 모두 입력했습니다. 다음 문장까지 기다리는 중...")}</span>`;
    }

    calculateMyProgress();
}

export function startGamePlay() {
    const overlay = document.getElementById("countdown-overlay");
    overlay.style.display = "none";

    if (state.currentRoom && state.currentRoom.mode === "quiz") {
        startQuizGameplay();
        return;
    }

    switchView("view-gameplay");
    updateVideoInfoPanel();

    currentLineIndex = 0;
    totalKeysTyped = 0;
    typoCount = 0;
    myProgress = 0;
    startWpmTime = Date.now();

    // 점수 변수 초기화
    totalRemainingTime = 0;
    totalTimeSum = 0;
    totalTargetCorrectChars = 0;
    totalCorrectChars = 0;
    currentLineTypingStartTime = Date.now();

    const input = document.getElementById("game-typing-input");
    input.value = "";
    input.disabled = true; // 게임 시작 직후에는 무조건 잠금
    input.placeholder = window.i18nTranslate("전주 재생 중... 대기하세요 ⏳");
    input.oninput = handleTypingInput;

    if (state.syncTimer) clearInterval(state.syncTimer);

    const ytPlayer = state.ytPlayer;
    const selectedSong = state.selectedSong;
    if (ytPlayer && selectedSong.youtube_id && typeof ytPlayer.playVideo === 'function') {
        // 이미 cue 되어 있으므로 바로 play
        ytPlayer.playVideo();
    }

    isYoutubeMode = !!(ytPlayer && typeof ytPlayer.playVideo === 'function' && selectedSong && selectedSong.youtube_id);

    const song = selectedSong;
    if (isYoutubeMode && song.timestamps && song.timestamps.length > 0 && song.timestamps[0] > 0) {
        isWaitingPhase = true;
        renderWaitingPhase();
    } else {
        isWaitingPhase = false;
        loadGameplayLine();
    }

    startSyncLoop();
    renderLiveRanking();
}

function loadGameplayLine() {
    const song = state.selectedSong;
    if (!song) {
        console.error('[Battle] loadGameplayLine: selectedSong이 없습니다.');
        return;
    }
    if (!song.lines || !song.lines.length) {
        console.error('[Battle] loadGameplayLine: song.lines가 비어있습니다. selectedSong:', song);
        return;
    }

    const totalLines = song.lines.length;

    if (currentLineIndex >= totalLines) {
        finishMyTypingGame();
        return;
    }

    document.getElementById("game-stage-indicator").textContent = `STAGE ${currentLineIndex + 1} / ${totalLines}`;

    currentKanjiTarget = song.lines[currentLineIndex];
    currentHiraTarget = song.hiragana_lines[currentLineIndex];

    if (typeof parseKanaToTargetUnits === 'function') {
        battleTargetUnits = parseKanaToTargetUnits(currentHiraTarget.replace(/\s+/g, ""));
    } else {
        battleTargetUnits = [{ text: currentHiraTarget, validInputs: [song.romaji_lines[currentLineIndex].toLowerCase().replace(/\s+/g, "")] }];
    }
    currentUnitIndex = 0;
    currentBuffer = "";

    document.getElementById("game-kanji-display").textContent = currentKanjiTarget;

    const nextIdx = currentLineIndex + 1;
    const nextPrefix = window.i18nTranslate ? window.i18nTranslate("Next") : "Next";
    if (nextIdx < totalLines) {
        document.getElementById("game-next-display").textContent = `${nextPrefix} - ${song.lines[nextIdx]}`;
    } else {
        const lastMsg = window.i18nTranslate ? window.i18nTranslate("마지막 소절입니다!") : "마지막 소절입니다!";
        document.getElementById("game-next-display").textContent = `${nextPrefix} - ${lastMsg}`;
    }

    renderActiveLyrics();
    highlightCurrentChar();

    const input = document.getElementById("game-typing-input");
    input.value = "";

    input.disabled = false;
    input.placeholder = window.i18nTranslate ? window.i18nTranslate("로마자를 입력하세요...") : "로마자를 입력하세요...";
    input.focus();
    currentLineTypingStartTime = Date.now();
}

function renderActiveLyrics() {
    const container = document.getElementById("game-lyric-display");
    TypingEngine.renderActiveLyrics(container, battleTargetUnits);
}

function highlightCurrentChar() {
    const lyricDisplay = document.getElementById("game-lyric-display");
    TypingEngine.highlightCurrentChar(lyricDisplay, battleTargetUnits, currentUnitIndex, currentBuffer);

    const statusPanel = document.getElementById("game-status-panel");
    const successMsg = window.i18nTranslate ? window.i18nTranslate("완벽하게 입력했습니다! 다음 문장을 기다려 주세요.") : "완벽하게 입력했습니다! 다음 문장을 기다려 주세요.";
    TypingEngine.getStatusHTML(statusPanel, battleTargetUnits, currentUnitIndex, currentBuffer, `<span class="success-text">${successMsg}</span>`);
}

function handleTypingInput(e) {
    let rawValue = e.target.value;
    let convertedValue = ko2en(rawValue);
    if (rawValue !== convertedValue) {
        e.target.value = convertedValue;
    }

    let typedValue = convertedValue.toLowerCase();
    if (!battleTargetUnits || currentUnitIndex >= battleTargetUnits.length) return;

    if (typedValue.length < currentBuffer.length) {
        currentBuffer = typedValue;
        highlightCurrentChar();
        return;
    }

    const newChar = typedValue.charAt(typedValue.length - 1);
    const testBuffer = currentBuffer + newChar;
    const currentUnit = battleTargetUnits[currentUnitIndex];

    const { isCompleteMatch, isPossiblePrefix } = TypingEngine.checkRomajiMatch(currentUnit, testBuffer);

    totalKeysTyped++;

    if (!isCompleteMatch && !isPossiblePrefix) {
        // ── ん(n) 입력 후 'n'을 또 눌렀을 때 (nn 의도) 오타 처리 방지 ──
        if (newChar === 'n' && currentBuffer === "" && currentUnitIndex > 0) {
            const prevUnit = battleTargetUnits[currentUnitIndex - 1];
            if (prevUnit.text === 'ん' && prevUnit.typedAs === 'n') {
                prevUnit.typedAs = 'nn'; // 더 이상 이 조건에 걸리지 않도록 방지
                e.target.value = currentBuffer; // 입력 무시
                return;
            }
        }

        typoCount++;
        e.target.value = currentBuffer;

        const inputEl = document.getElementById("game-typing-input");
        inputEl.style.borderColor = "var(--color-battle-incorrect)";
        inputEl.style.boxShadow = "0 0 10px rgba(255, 74, 104, 0.4)";
        setTimeout(() => {
            inputEl.style.borderColor = "var(--color-battle-primary)";
            inputEl.style.boxShadow = "none";
        }, 150);

        updateLiveStats();
        return;
    }

    currentBuffer = testBuffer;
    if (isCompleteMatch) {
        currentUnit.typedAs = testBuffer; // 기록해두기
        currentUnitIndex++;
        currentBuffer = "";
        e.target.value = "";
    }

    calculateMyProgress();
    highlightCurrentChar();

    if (currentUnitIndex >= battleTargetUnits.length) {
        handleLineCompletion();
    }

    updateLiveStats();
}

function calculateScore() {
    const song = state.selectedSong;
    if (!song) return 0;

    let accuracyVal = 1.0;
    if (totalKeysTyped > 0) {
        accuracyVal = (totalKeysTyped - typoCount) / totalKeysTyped;
    }

    const currentLineRomaji = song.romaji_lines[currentLineIndex] || "";
    const currentLineRomajiLen = currentLineRomaji.replace(/\s+/g, "").length;
    const currentLineCorrect = getCompletedRomajiLength(battleTargetUnits, currentUnitIndex) + currentBuffer.length;

    const tempTotalCorrect = totalCorrectChars + currentLineCorrect;
    const tempTotalTarget = totalTargetCorrectChars + currentLineRomajiLen;

    let duration = 5.0;
    if (song.timestamps && song.timestamps.length > currentLineIndex + 1 && song.timestamps[currentLineIndex] !== undefined) {
        duration = song.timestamps[currentLineIndex + 1] - song.timestamps[currentLineIndex];
    } else if (state.ytPlayer && typeof state.ytPlayer.getDuration === 'function') {
        let totalDur = state.ytPlayer.getDuration();
        if (totalDur > 0 && song.timestamps && song.timestamps[currentLineIndex] !== undefined) {
            duration = totalDur - song.timestamps[currentLineIndex];
        }
    }
    let currentRemaining = 0;
    if (!lineCompleted) {
        const elapsedForLine = currentLineTypingStartTime ? (Date.now() - currentLineTypingStartTime) / 1000 : 0;
        currentRemaining = Math.max(0, duration - elapsedForLine);
    } else {
        currentRemaining = savedSectionRemaining;
    }

    const tempTotalRemaining = totalRemainingTime + currentRemaining;
    const tempTotalTimeSum = totalTimeSum + duration;

    const typingRatio = tempTotalTarget > 0 ? tempTotalCorrect / tempTotalTarget : 0;
    const timeRatio = tempTotalTimeSum > 0 ? tempTotalRemaining / tempTotalTimeSum : 0;

    return calculateTypingScore(accuracyVal, typingRatio, timeRatio, song.difficulty);
}

function calculateMyProgress() {
    const song = state.selectedSong;
    let totalChars = 0;
    song.romaji_lines.forEach(line => {
        totalChars += line.replace(/\s+/g, "").length;
    });

    let typedTotal = 0;
    for (let i = 0; i < currentLineIndex; i++) {
        typedTotal += song.romaji_lines[i].replace(/\s+/g, "").length;
    }
    typedTotal += getCompletedRomajiLength(battleTargetUnits, currentUnitIndex) + currentBuffer.length;

    myProgress = Math.min(Math.round((typedTotal / totalChars) * 100), 100);

    // Overall progress is not displayed on game-progress-fill, which is used for current line timer

    const currentScore = calculateScore();

    // 내 화면의 순위표(progress)도 즉시 업데이트되도록 로컬 opponents 수정
    if (state.opponents && state.opponents[state.myUser.nickname]) {
        state.opponents[state.myUser.nickname].progress = myProgress;
        state.opponents[state.myUser.nickname].wpm = parseInt(document.getElementById("game-wpm").textContent) || 0;
        state.opponents[state.myUser.nickname].score = currentScore;
    }
    renderLiveRanking();

    // Broadcast progress
    const wpm = parseInt(document.getElementById("game-wpm").textContent) || 0;
    const accuracy = parseInt(document.getElementById("game-accuracy").textContent) || 100;

    send({
        type: "progress",
        progress: myProgress,
        wpm: wpm,
        accuracy: accuracy,
        score: currentScore
    });
    renderLiveRanking();
}

function updateLiveStats() {
    const timeElapsed = (Date.now() - startWpmTime) / 1000 / 60;
    const correctKeys = totalKeysTyped - typoCount;

    let wpm = 0;
    if (timeElapsed > 0) {
        wpm = Math.round((correctKeys / 5) / timeElapsed);
    }

    let accuracy = 100;
    if (totalKeysTyped > 0) {
        accuracy = Math.round(((totalKeysTyped - typoCount) / totalKeysTyped) * 100);
    }

    document.getElementById("game-wpm").textContent = wpm;
    document.getElementById("game-accuracy").textContent = `${accuracy}%`;
}

function finishMyTypingGame() {
    if (state.syncTimer) clearInterval(state.syncTimer);
    const input = document.getElementById("game-typing-input");
    input.disabled = true;
    input.value = "완료!";

    state.myUser.finished = true;
    const wpm = parseInt(document.getElementById("game-wpm").textContent) || 0;
    const accuracy = parseInt(document.getElementById("game-accuracy").textContent) || 100;

    const currentScore = calculateScore();
    send({
        type: "finish",
        wpm: wpm,
        accuracy: accuracy,
        score: currentScore
    });
}

// ====== 실시간 퀴즈 대전 관련 로직 ======
let quizData = [];
let currentQuizIndex = 0;
let currentQuizCombo = 0;
let quizIsPlayingSegment = false;
let quizIsPausedManually = false;
let currentGuessedQuiz = {};
let quizCheckInterval = null;

function startQuizGameplay() {
    switchView("view-quiz-gameplay");

    currentQuizIndex = 0;
    currentQuizCombo = 0;
    state.myUser.score = 0;
    state.myUser.progress = 0;

    document.getElementById("quiz-my-score").innerText = "0";
    document.getElementById("quiz-my-combo").innerText = "0";
    document.getElementById("quiz-chat-messages").innerHTML = `<div class="chat-bubble system" style="align-self: center; background-color: rgba(255, 209, 123, 0.08); color: var(--color-battle-accent); border: 1px solid rgba(255, 209, 123, 0.15); padding: 8px 12px; border-radius: 12px; font-size: 0.8rem; font-weight: 600;">${window.i18nTranslate("퀴즈 대전이 시작되었습니다! 정답을 입력하면 자동으로 채점됩니다.")}</div>`;

    const inputField = document.getElementById("quiz-chat-input");
    if (inputField) {
        inputField.disabled = true;
        inputField.value = "";
    }
    const sendBtn = document.getElementById("quiz-chat-send-btn");
    if (sendBtn) sendBtn.disabled = true;

    const selectedSong = state.selectedSong;
    if (selectedSong && selectedSong.quiz_data) {
        try {
            quizData = typeof selectedSong.quiz_data === 'string' ? JSON.parse(selectedSong.quiz_data) : selectedSong.quiz_data;
        } catch (e) {
            console.error("Quiz data parse error:", e);
            quizData = [];
        }
    } else {
        quizData = [];
    }

    const countDisplay = document.getElementById("quiz-count-display-battle");
    if (countDisplay) countDisplay.innerText = `${window.i18nTranslate("남은 퀴즈:")} ${quizData.length}`;

    const infoTitle = document.getElementById("quiz-info-title");
    if (infoTitle) infoTitle.innerText = selectedSong.title || "로딩 중...";

    // Set up volume slider
    const volSlider = document.getElementById("quiz-volume-slider");
    if (volSlider) {
        volSlider.oninput = function () {
            document.getElementById("quiz-volume-display").innerText = this.value + "%";
            if (state.ytPlayer && typeof state.ytPlayer.setVolume === 'function') {
                state.ytPlayer.setVolume(this.value);
            }
        };
    }

    renderLiveRankingQuiz();

    if (quizData.length > 0) {
        setupQuizBoard(0);
    }

    // 자동 시작
    setTimeout(() => {
        startQuizBattle();
    }, 1000);
}

function startQuizBattle() {
    if (quizData.length === 0) return;
    if (currentQuizIndex >= quizData.length) {
        addQuizSystemChat(window.i18nTranslate("모든 문제가 끝났습니다."));
        return;
    }

    const vinylRecord = document.getElementById("quiz-vinyl-record");
    if (quizIsPlayingSegment) {
        // 일시정지 기능 제거: 재생 중에는 아무 동작도 하지 않음
        return;
    } else {
        if (quizIsPausedManually) {
            if (state.ytPlayer && state.ytPlayer.playVideo) state.ytPlayer.playVideo();
            if (vinylRecord) vinylRecord.classList.remove("paused");
            quizIsPlayingSegment = true;
            quizIsPausedManually = false;
        } else {
            playQuizSegment();
        }
    }
}

function playQuizSegment() {
    const item = quizData[currentQuizIndex];
    if (!item) return;
    setupQuizBoard(currentQuizIndex);

    const chatInput = document.getElementById("quiz-chat-input");
    if (chatInput) {
        chatInput.disabled = false;
        chatInput.focus({ preventScroll: true });
    }
    const sendBtn = document.getElementById("quiz-chat-send-btn");
    if (sendBtn) sendBtn.disabled = false;

    const vinylRecord = document.getElementById("quiz-vinyl-record");
    if (vinylRecord) vinylRecord.classList.remove("paused");
    quizIsPlayingSegment = true;
    quizIsPausedManually = false;

    const targetVideoId = item.youtube_id || state.selectedSong.youtube_id;
    const volSlider = document.getElementById("quiz-volume-slider");
    const currentVol = volSlider ? volSlider.value : 50;

    const ytPlayer = state.ytPlayer;
    if (ytPlayer && typeof ytPlayer.setVolume === 'function') {
        ytPlayer.setVolume(currentVol);
        ytPlayer.loadVideoById({
            videoId: targetVideoId,
            startSeconds: item.start,
        });
    }

    if (quizCheckInterval) clearInterval(quizCheckInterval);
    const progressCircle = document.getElementById("quiz-vinyl-progress");
    if (progressCircle) {
        progressCircle.style.strokeDashoffset = "264";
    }

    quizCheckInterval = setInterval(() => {
        if (!state.ytPlayer || typeof state.ytPlayer.getCurrentTime !== 'function') return;

        const currentTime = state.ytPlayer.getCurrentTime();
        const totalDuration = item.end - item.start;
        const elapsed = currentTime - item.start;

        if (progressCircle && totalDuration > 0) {
            let p = elapsed / totalDuration;
            if (p < 0) p = 0;
            if (p > 1) p = 1;
            const dashoffset = 264 - (264 * p);
            progressCircle.style.strokeDashoffset = dashoffset;
        }

        if (currentTime >= item.end && item.end > item.start) {
            clearInterval(quizCheckInterval);
            if (state.ytPlayer && state.ytPlayer.pauseVideo) state.ytPlayer.pauseVideo();
            if (vinylRecord) vinylRecord.classList.add("paused");
            quizIsPlayingSegment = false;

            addQuizSystemChat(window.i18nTranslate("시간 초과! 잠시 후 다음 문제로 넘어갑니다."));

            currentQuizCombo = 0;
            const comboEl = document.getElementById("quiz-my-combo");
            if (comboEl) comboEl.innerText = "0";

            const chatInput = document.getElementById("quiz-chat-input");
            if (chatInput) chatInput.disabled = true;
            const sendBtn = document.getElementById("quiz-chat-send-btn");
            if (sendBtn) sendBtn.disabled = true;

            setTimeout(() => {
                currentQuizIndex++;
                if (currentQuizIndex < quizData.length) {
                    playQuizSegment();
                } else {
                    finishQuizBattle();
                }
            }, 1500);
        }
    }, 100);
}

function setupQuizBoard(index) {
    const item = quizData[index];
    if (!item) return;
    currentGuessedQuiz = {};
    const questionKeys = Object.keys(item)
        .filter((key) => key.startsWith("question_"))
        .sort();

    questionKeys.forEach((key) => {
        const question = item[key];
        const answerCount = (question.answer && question.answer.length) || 0;
        currentGuessedQuiz[`guessed_${key}`] = new Array(answerCount).fill(null);
    });

    const countDisplay = document.getElementById("quiz-count-display-battle");
    if (countDisplay) {
        countDisplay.innerText = `남은 퀴즈: ${quizData.length - currentQuizIndex}`;
    }
    updateQuizAnswerBoard();
}

function updateQuizAnswerBoard() {
    const boardItems = document.getElementById("quiz-board-items");
    if (!boardItems) return;
    boardItems.innerHTML = "";

    const item = quizData[currentQuizIndex];
    if (!item) return;

    // ── 문제 번호 + 힌트(제목) 표시 ──────────────────────
    const headerDiv = document.createElement("div");
    headerDiv.style.marginBottom = "12px";
    headerDiv.style.paddingBottom = "10px";
    headerDiv.style.borderBottom = "1.5px dashed rgba(0,0,0,0.1)";

    // 문제 번호 배지
    const numBadge = document.createElement("div");
    numBadge.style.display = "inline-block";
    numBadge.style.background = "linear-gradient(135deg, var(--color-battle-primary), var(--color-battle-secondary))";
    numBadge.style.color = "white";
    numBadge.style.padding = "3px 12px";
    numBadge.style.borderRadius = "20px";
    numBadge.style.fontSize = "0.8rem";
    numBadge.style.fontWeight = "900";
    numBadge.style.marginBottom = "8px";
    numBadge.textContent = `문제 ${currentQuizIndex + 1} / ${quizData.length}`;
    headerDiv.appendChild(numBadge);

    // hint(제목) 토글 버튼 방식
    if (item.hint) {
        const hintRow = document.createElement("div");
        hintRow.style.display = "flex";
        hintRow.style.alignItems = "center";
        hintRow.style.gap = "8px";
        hintRow.style.marginTop = "6px";

        const hintBtn = document.createElement("button");
        hintBtn.textContent = " 힌트 보기";
        hintBtn.style.cssText = "background: rgba(255,209,123,0.15); border: 1.5px solid rgba(255,209,123,0.4); color: #a07000; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: bold; cursor: pointer; transition: all 0.2s; flex-shrink: 0;";

        const hintText = document.createElement("span");
        hintText.textContent = item.hint;
        hintText.style.cssText = "font-size: 0.95rem; font-weight: 800; color: var(--theme-text-main); display: none; word-break: keep-all;";

        hintBtn.onclick = () => {
            const isHidden = hintText.style.display === "none";
            hintText.style.display = isHidden ? "inline" : "none";
            hintBtn.textContent = isHidden ? " 힌트 숨기기" : " 힌트 보기";
        };

        hintRow.appendChild(hintBtn);
        hintRow.appendChild(hintText);
        headerDiv.appendChild(hintRow);
    }

    boardItems.appendChild(headerDiv);

    // ── 정답 슬롯 렌더링 ──────────────────────────────────
    const questionKeys = Object.keys(item).filter((key) => key.startsWith("question_")).sort();

    questionKeys.forEach((key) => {
        const question = item[key];
        const answers = question.answer;
        const guessedArray = currentGuessedQuiz[`guessed_${key}`] || [];

        const row = document.createElement("div");
        row.style.display = "flex";
        row.style.alignItems = "center";
        row.style.gap = "10px";

        const typeBadge = document.createElement("div");
        typeBadge.textContent = question.question || question.type || "질문";
        typeBadge.style.background = "var(--color-battle-primary)";
        typeBadge.style.color = "white";
        typeBadge.style.padding = "4px 10px";
        typeBadge.style.borderRadius = "20px";
        typeBadge.style.fontSize = "0.85rem";
        typeBadge.style.fontWeight = "bold";
        typeBadge.style.flexShrink = "0";
        row.appendChild(typeBadge);

        const slotContainer = document.createElement("div");
        slotContainer.style.display = "flex";
        slotContainer.style.gap = "8px";
        slotContainer.style.flexWrap = "wrap";

        answers.forEach((ans, i) => {
            const isGuessed = guessedArray[i] !== null;
            const slot = document.createElement("div");
            slot.style.padding = "6px 14px";
            slot.style.borderRadius = "8px";
            slot.style.fontWeight = "bold";
            slot.style.fontSize = "0.95rem";

            if (isGuessed) {
                slot.textContent = guessedArray[i];
                slot.style.background = "rgba(52, 168, 83, 0.15)";
                slot.style.border = "1.5px solid #34a853";
                slot.style.color = "var(--color-green, #27ae60)";
            } else {
                slot.textContent = "?";
                slot.style.background = "var(--theme-bg-hover)";
                slot.style.border = "1.5px dashed var(--theme-border)";
                slot.style.color = "var(--theme-text-muted)";
                slot.style.minWidth = "40px";
                slot.style.textAlign = "center";
            }
            slotContainer.appendChild(slot);
        });

        row.appendChild(slotContainer);
        boardItems.appendChild(row);
    });
}

export function sendQuizChatMessage() {
    const input = document.getElementById("quiz-chat-input");
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    // 오답 채팅은 quiz_chat 타입으로 서버 전송 (정답은 아래에서 별도 처리)

    let correctFound = false;
    const item = quizData[currentQuizIndex];
    if (item) {
        const normalizedInput = text.toLowerCase().replace(/\s+/g, "");

        const questionKeys = Object.keys(item).filter((key) => key.startsWith("question_"));
        for (let key of questionKeys) {
            const question = item[key];
            const answers = question.answer;
            const guessedArray = currentGuessedQuiz[`guessed_${key}`];

            for (let i = 0; i < answers.length; i++) {
                if (guessedArray[i] === null) {
                    const synonyms = answers[i].split(",").map(s => s.trim().toLowerCase().replace(/\s+/g, ""));
                    if (synonyms.includes(normalizedInput)) {
                        guessedArray[i] = answers[i].split(",")[0].trim();
                        correctFound = true;
                    }
                }
            }
        }
    }

    if (correctFound) {
        currentQuizCombo++;
        state.myUser.score += 1;

        document.getElementById("quiz-my-score").innerText = state.myUser.score;
        document.getElementById("quiz-my-combo").innerText = currentQuizCombo;

        // opponents 내 내 점수 즉시 반영 (랭킹 표시 정확성)
        if (state.opponents && state.opponents[state.myUser.nickname]) {
            state.opponents[state.myUser.nickname].score = state.myUser.score;
        }

        addQuizUserChat(state.myUser.nickname, text, true);
        updateQuizAnswerBoard();

        // 정답을 quiz_answer 타입으로 서버에 전송해 상대방에게 브로드캐스트
        send({
            type: "quiz_answer",
            question_key: Object.keys(quizData[currentQuizIndex] || {}).find(k => k.startsWith('question_')),
            answer_text: text,
            score: state.myUser.score,
            message: text
        });

        let allGuessed = true;
        const questionKeys = Object.keys(item).filter((key) => key.startsWith("question_"));
        for (let key of questionKeys) {
            if (currentGuessedQuiz[`guessed_${key}`].includes(null)) {
                allGuessed = false;
                break;
            }
        }

        if (allGuessed) {
            addQuizSystemChat("모든 정답을 맞췄습니다! 잠시 후 다음 문제로 넘어갑니다.");
            input.disabled = true;
            document.getElementById("quiz-chat-send-btn").disabled = true;
            state.myUser.progress = Math.min(100, Math.floor(((currentQuizIndex + 1) / quizData.length) * 100));

            setTimeout(() => {
                currentQuizIndex++;
                if (currentQuizIndex < quizData.length) {
                    playQuizSegment();
                } else {
                    finishQuizBattle();
                }
            }, 3000);
        }
    } else {
        currentQuizCombo = 0;
        document.getElementById("quiz-my-combo").innerText = "0";
        addQuizUserChat(state.myUser.nickname, text, false);
        // 오답 채팅을 quiz_chat 타입으로 서버에 전송
        send({ type: "quiz_chat", message: text });
    }

    send({
        type: "progress",
        score: state.myUser.score,
        progress: state.myUser.progress || 0,
        wpm: 0,
        accuracy: 100
    });

    input.value = "";
}

function finishQuizBattle() {
    if (quizCheckInterval) clearInterval(quizCheckInterval);
    if (state.ytPlayer && state.ytPlayer.pauseVideo) state.ytPlayer.pauseVideo();

    addQuizSystemChat("모든 퀴즈가 종료되었습니다!");
    const chatInput = document.getElementById("quiz-chat-input");
    if (chatInput) chatInput.disabled = true;

    state.myUser.finished = true;
    send({
        type: "finish",
        score: state.myUser.score,
        progress: 100,
        wpm: 0,
        accuracy: 100
    });
}

// ── 상대방 퀴즈 정답 처리 ──────────────────────────────────────────
export function handleOpponentQuizAnswer(data) {
    const { nickname, answer_text, score, message } = data;

    // 1. 퀴즈 채팅창에 상대방 정답 표시
    addQuizOpponentChat(nickname, message || answer_text, true);

    // 2. 상대방 점수 opponents에 반영 후 랭킹 재렌더링
    if (state.opponents && state.opponents[nickname]) {
        state.opponents[nickname].score = score || state.opponents[nickname].score;
    }
    renderLiveRankingQuiz();

    // 3. 상대방이 맞춘 답도 문제판에 표시 (옵션 A: 정보 공유)
    const item = quizData[currentQuizIndex];
    if (item && answer_text) {
        const normalizedInput = answer_text.toLowerCase().replace(/\s+/g, '');
        const questionKeys = Object.keys(item).filter(k => k.startsWith('question_'));
        let boardUpdated = false;
        for (let key of questionKeys) {
            const question = item[key];
            const answers = question.answer;
            const guessedArray = currentGuessedQuiz[`guessed_${key}`];
            if (!guessedArray) continue;
            for (let i = 0; i < answers.length; i++) {
                if (guessedArray[i] === null) {
                    const synonyms = answers[i].split(",").map(s => s.trim().toLowerCase().replace(/\s+/g, ""));
                    if (synonyms.includes(normalizedInput)) {
                        guessedArray[i] = answers[i].split(",")[0].trim();
                        boardUpdated = true;
                    }
                }
            }
        }
        if (boardUpdated) {
            updateQuizAnswerBoard();

            let allGuessed = true;
            for (let key of questionKeys) {
                if (currentGuessedQuiz[`guessed_${key}`].includes(null)) {
                    allGuessed = false;
                    break;
                }
            }

            if (allGuessed) {
                addQuizSystemChat("모든 정답을 맞췄습니다! 잠시 후 다음 문제로 넘어갑니다.");
                const input = document.getElementById("quiz-chat-input");
                if (input) input.disabled = true;
                const sendBtn = document.getElementById("quiz-chat-send-btn");
                if (sendBtn) sendBtn.disabled = true;

                state.myUser.progress = Math.min(100, Math.floor(((currentQuizIndex + 1) / quizData.length) * 100));

                setTimeout(() => {
                    currentQuizIndex++;
                    if (currentQuizIndex < quizData.length) {
                        playQuizSegment();
                    } else {
                        finishQuizBattle();
                    }
                }, 3000);
            }
        }
    }
}

export { startQuizBattle };
