const contentIdMatch = window.location.pathname.match(/^\/quiz\/(\d+)\/play\/?$/);
const contentId = contentIdMatch ? contentIdMatch[1] : null;

let player = null;
let quizData = [];
let currentIndex = 0;
let currentScore = 0; // 맞힌 정답 수
let currentCombo = 0;  // 연속으로 모든 정답을 맞힌 문제 수
let skipHintShown = false; // ']' 스킵 안내는 첫 문제 시작 때 한 번만
let playedCount = 0;   // 재생을 시작한 문제 수 (정답률 분모 기준)
let quizTitle = "알 수 없는 퀴즈"; // 기록 저장용 값 (화면 표시용 아님)
let currentGuessed = {};
let isPlayingSegment = false;
let isPausedManually = false;
let checkInterval = null;
let currentLoadedYoutubeId = null;
let quizLogs = [];
let hasIncrementedPlayCount = false;

// 문제 수 선택: 전체 문제가 이보다 많으면 시작 전에 몇 문제를 풀지 고르게 한다
const QUESTION_COUNT_OPTIONS = [10, 30, 50];
let isChoosingQuestionCount = false;

// 문제를 다 맞힌 뒤: 음악을 바로 끊지 않고 잠시 이어 튼 뒤(끝부분은 서서히 줄임) 멈추고, 조금 쉬었다가 다음 문제로
const PLAY_OUT_MS = 3000;   // 다 맞힌 뒤 음악을 이어서 트는 시간
const FADE_OUT_MS = 1400;    // 그중 마지막에 소리를 줄이는 시간
const NEXT_GAP_MS = 1500;   // 음악이 멈춘 뒤 다음 문제까지 쉬는 시간 (안내 문구는 '잠시 후'라 시간을 바꿔도 된다)
let playOutTimer = null;

const chatMessages = document.getElementById("chat-messages");
const chatInput = document.getElementById("chat-input");
const chatSendBtn = document.getElementById("chat-send-btn");
const vinylRecord = document.getElementById("vinyl-record");

async function initQuiz() {
    if (!contentId) {
        addSystemChat(i18n.t('quiz.quiz_id_is_invalid'));
        return;
    }
    try {
        const res = await fetch(`/api/quiz-content/${contentId}`);
        const data = await res.json();
        if (data.success) {
            quizTitle = data.title || "알 수 없는 퀴즈";
            quizData = JSON.parse(data.quiz_data || "[]");
            updateQuizCountDisplay();
            if (quizData.length > QUESTION_COUNT_OPTIONS[0]) showQuestionCountPicker();
            if (quizData.length > 0 && quizData[0].youtube_id) {
                currentLoadedYoutubeId = quizData[0].youtube_id;
                initYoutube(currentLoadedYoutubeId);
            } else if (data.youtube_id) {
                currentLoadedYoutubeId = data.youtube_id;
                initYoutube(currentLoadedYoutubeId);
            } else {
                addSystemChat(i18n.t('quiz.there_is_no_youtube_video_information'));
            }
        } else {
            addSystemChat(i18n.t('quiz.quiz_data_failed_to_load'));
        }
    } catch (err) {
        addSystemChat(i18n.t('common.a_server_error_has_occurred'));
    }
}

function initYoutube(videoId) {
    YouTubeManager.createPlayer("youtube-player", {
        height: "1",
        width: "1",
        videoId: videoId,
        playerVars: { playsinline: 1, controls: 0 },
        events: {
            onReady: onPlayerReady,
            onStateChange: onPlayerStateChange,
        },
    }).then((createdPlayer) => {
        player = createdPlayer;
    });
}

function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.PLAYING) {
        const currentVol = document.getElementById("volume-slider").value;
        player.setVolume(currentVol);
    }
}

function onPlayerReady(event) {
    player.setVolume(document.getElementById("volume-slider").value);
    // 문제 수를 고르는 중이면, 선택 후에 시작 안내를 보여준다
    if (isChoosingQuestionCount) return;
    addSystemChat(
        i18n.t('quiz.audio_loading_complete_click_the_in'),
    );
}

// ── 문제 수 선택 패널 ─────────────────────────────────
function shuffle(list) {
    const arr = [...list];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function showQuestionCountPicker() {
    const total = quizData.length;
    const counts = QUESTION_COUNT_OPTIONS.filter((n) => n < total);
    isChoosingQuestionCount = true;

    const overlay = document.createElement("div");
    overlay.id = "question-count-picker";
    overlay.style.cssText = "position:absolute; inset:0; z-index:30; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:14px; background:rgba(0,0,0,0.55); backdrop-filter:blur(2px);";

    const buttonStyle = "min-width:120px; padding:12px 20px; border:none; border-radius:12px; font-size:1rem; font-weight:800; cursor:pointer; background:var(--theme-bg-card); color:var(--theme-text-main); box-shadow:0 4px 12px rgba(0,0,0,0.15);";
    const buttons = counts.map((n) => `<button type="button" data-count="${n}" data-i18n="common.n_questions" data-i18n-args='{"count": ${n}}' style="${buttonStyle}">${i18n.t('common.n_questions', { count: n })}</button>`);
    buttons.push(`<button type="button" data-count="${total}" data-i18n="quiz.all_questions_n" data-i18n-args='{"count": ${total}}' style="${buttonStyle} background:var(--color-pink); color:#fff;">${i18n.t('quiz.all_questions_n', { count: total })}</button>`);

    overlay.innerHTML = `
        <div data-i18n="quiz.choose_question_count" style="color:#fff; font-size:1.3rem; font-weight:900;">${i18n.t('quiz.choose_question_count')}</div>
        <div style="display:flex; flex-wrap:wrap; justify-content:center; gap:10px; max-width:90%;">${buttons.join('')}</div>
        <div data-i18n="quiz.random_pick_hint" style="color:rgba(255,255,255,0.8); font-size:0.85rem;">${i18n.t('quiz.random_pick_hint')}</div>
    `;
    overlay.querySelectorAll("button[data-count]").forEach((btn) => {
        btn.addEventListener("click", () => selectQuestionCount(Number(btn.dataset.count)));
    });

    // 레코드판이 있는 영역 위에 띄운다
    const area = vinylRecord.closest(".vinyl-container").parentElement;
    area.appendChild(overlay);
}

function selectQuestionCount(count) {
    // 선택한 개수만큼 무작위로 뽑는다. 전체를 고르면 순서만 섞는다.
    quizData = shuffle(quizData).slice(0, count);
    isChoosingQuestionCount = false;
    const overlay = document.getElementById("question-count-picker");
    if (overlay) overlay.remove();
    updateQuizCountDisplay();
    addSystemChat(i18n.t('quiz.starting_with_n', { count: quizData.length }));
}

function startQuiz() {
    if (!player || quizData.length === 0) return;
    if (isChoosingQuestionCount) return; // 문제 수를 먼저 골라야 한다
    if (currentIndex >= quizData.length) {
        addSystemChat(i18n.t('quiz.the_quiz_is_already_over'));
        return;
    }

    if (isPlayingSegment) {
        player.pauseVideo();
        vinylRecord.classList.add("paused");
        isPlayingSegment = false;
        isPausedManually = true;
    } else {
        if (isPausedManually) {
            player.playVideo();
            vinylRecord.classList.remove("paused");
            isPlayingSegment = true;
            isPausedManually = false;
        } else {
            if (!hasIncrementedPlayCount) {
                hasIncrementedPlayCount = true;
                fetch(`/api/quiz-content/${contentId}/play`, { method: "POST" }).catch(e => console.error(e));
            }
            playSegment();
        }
    }
}

function playSegment() {
    const item = quizData[currentIndex];
    playedCount = Math.max(playedCount, currentIndex + 1);
    updateAccuracyDisplay();
    if (!skipHintShown) {
        skipHintShown = true;
        addSystemChat(i18n.t('quiz.skip_key_hint'));
    }
    currentGuessed = {};
    const questionKeys = Object.keys(item)
        .filter((key) => key.startsWith("question_"))
        .sort();
    questionKeys.forEach((key) => {
        const question = item[key];
        const answerCount = (question.answer && question.answer.length) || 0;
        currentGuessed[`guessed_${key}`] = new Array(answerCount).fill(null); // Array of matched answers
    });
    updateAnswerBoard();

    chatInput.disabled = false;
    chatSendBtn.disabled = false;
    chatInput.focus({ preventScroll: true });

    vinylRecord.classList.remove("paused");
    isPlayingSegment = true;
    isPausedManually = false;

    const targetVideoId = item.youtube_id || currentLoadedYoutubeId;
    const currentVol = document.getElementById("volume-slider").value;
    player.setVolume(currentVol);

    if (targetVideoId !== currentLoadedYoutubeId) {
        player.loadVideoById({
            videoId: targetVideoId,
            startSeconds: item.start,
        });
        currentLoadedYoutubeId = targetVideoId;
    } else {
        player.seekTo(item.start);
        player.playVideo();
    }

    clearInterval(checkInterval);
    clearInterval(playOutTimer);
    const progressCircle = document.getElementById("vinyl-progress");
    if (progressCircle) {
        progressCircle.style.strokeDashoffset = "264"; // reset
    }

    checkInterval = setInterval(() => {
        const currentTime = player.getCurrentTime();
        const totalDuration = item.end - item.start;
        const elapsed = currentTime - item.start;

        if (progressCircle && totalDuration > 0) {
            let progress = elapsed / totalDuration;
            if (progress < 0) progress = 0;
            if (progress > 1) progress = 1;
            const dashoffset = 264 - 264 * progress;
            progressCircle.style.strokeDashoffset = dashoffset;
        }

        if (currentTime >= item.end && item.end > item.start) {
            player.pauseVideo();
            vinylRecord.classList.add("paused");
            isPlayingSegment = false;
            clearInterval(checkInterval);
        }
    }, 100);
}

function addSystemChat(msg) {
    const div = document.createElement("div");
    div.className = "chat-bubble chat-system";
    div.textContent = msg;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addUserChat(msg) {
    const div = document.createElement("div");
    div.className = "chat-bubble chat-user";
    div.textContent = msg;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 한 정답 안의 동의어 구분자: 쉼표(,), 일본어 쉼표(、), 전각 쉼표(，)
const SYNONYM_SEPARATOR = /[,、，]/;

/** 정답 한 칸의 동의어 목록. 、 가 들어간 제목(예: "さよなら、またいつか！")도 통째로 입력하면 맞도록 원문 전체도 포함한다. */
function synonymsOf(answerGroup) {
    const parts = answerGroup.split(SYNONYM_SEPARATOR).map((v) => v.trim()).filter(Boolean);
    const whole = answerGroup.trim();
    return parts.includes(whole) ? parts : [...parts, whole];
}

function normalizeString(str) {
    if (!str) return "";
    return str.toLowerCase().replace(/\s+/g, "");
}

function checkAnswerMatch(targetAnswer, normInput) {
    if (!targetAnswer) return false;
    // targetAnswer is always an array now
    const answers = Array.isArray(targetAnswer)
        ? targetAnswer
        : [targetAnswer];
    for (let ansGroup of answers) {
        // Each array element may contain comma-separated variations
        const variations = synonymsOf(ansGroup);
        for (let ans of variations) {
            if (normalizeString(ans) === normInput) {
                return true;
            }
        }
    }
    return false;
}

function handleChat() {
    const text = chatInput.value.trim();
    if (!text) return;

    addUserChat(text);
    chatInput.value = "";

    if (currentIndex >= quizData.length) return;

    const item = quizData[currentIndex];
    const normText = normalizeString(text);
    const questionKeys = Object.keys(item)
        .filter((key) => key.startsWith("question_"))
        .sort();

    let foundNew = false;

    for (const key of questionKeys) {
        const question = item[key];
        const guessedKey = `guessed_${key}`;
        const guessedArray = currentGuessed[guessedKey];

        // Find which answer index matches
        let matchedIndex = -1;
        let matchedAnswer = null;
        for (let i = 0; i < question.answer.length; i++) {
            const ansGroup = question.answer[i];
            const variations = synonymsOf(ansGroup);
            const found = variations.find(
                (ans) => normalizeString(ans) === normText,
            );
            if (found) {
                matchedIndex = i;
                matchedAnswer = found;
                break;
            }
        }

        // Only process if this specific answer hasn't been guessed yet
        if (matchedIndex !== -1 && guessedArray[matchedIndex] === null) {
            guessedArray[matchedIndex] = matchedAnswer;
            updateBoardItem(key, matchedIndex, matchedAnswer);
            addSystemChat(i18n.t('quiz.correct_msg') + ` (${question.question || i18n.t('common.question_2')})`);

            quizLogs.push({
                quizIndex: currentIndex + 1,
                questionLabel: question.question || i18n.t('common.question_2'),
                matchedAnswer: matchedAnswer
            });

            currentScore += 1;
            document.getElementById('score').innerText = currentScore;
            updateAccuracyDisplay();

            foundNew = true;
            break;
        }
    }

    if (foundNew) {
        checkSegmentComplete();
    }
}

function checkSegmentComplete() {
    const item = quizData[currentIndex];
    const questionKeys = Object.keys(item)
        .filter((key) => key.startsWith("question_"))
        .sort();

    let allGuessed = true;
    for (const key of questionKeys) {
        const guessedKey = `guessed_${key}`;
        const guessedArray = currentGuessed[guessedKey];
        // Check if all answers in this question are guessed (no null values)
        if (guessedArray.includes(null)) {
            allGuessed = false;
            break;
        }
    }

    if (allGuessed) {
        currentCombo += 1;
        updateAccuracyDisplay();

        chatInput.disabled = true;
        chatSendBtn.disabled = true;

        if (currentIndex >= quizData.length - 1) {
            addSystemChat(i18n.t('quiz.you_got_everything_correct_the_quiz'));
            currentIndex++;
            updateQuizCountDisplay();
            saveQuizHistory();
            showQuizResult();
            playOutAndStop(null);
        } else {
            addSystemChat(
                i18n.t('quiz.you_got_everything_correct_after_3'),
            );
            playOutAndStop(() => {
                setTimeout(() => {
                    currentIndex++;
                    updateQuizCountDisplay();
                    playSegment();
                }, NEXT_GAP_MS);
            });
        }
    }
}

/**
 * 정답을 다 맞힌 뒤 음악을 PLAY_OUT_MS 동안 이어 틀고, 마지막 FADE_OUT_MS 동안 소리를 줄여 멈춘다.
 * 이미 멈춰 있었다면(일시정지·구간 끝) 같은 시간만 기다린다. 멈춘 뒤 onStopped 를 부른다.
 */
function playOutAndStop(onStopped) {
    const wasPlaying = isPlayingSegment;
    clearInterval(checkInterval); // 구간 끝에서 멈추는 처리도 끈다 (정답 후에는 구간을 조금 넘겨도 된다)
    clearInterval(playOutTimer);
    isPlayingSegment = false;

    const volume = Number(document.getElementById("volume-slider").value);
    const stop = () => {
        clearInterval(playOutTimer);
        playOutTimer = null;
        player.pauseVideo();
        player.setVolume(document.getElementById("volume-slider").value); // 다음 재생을 위해 원래 음량으로 되돌린다
        vinylRecord.classList.add("paused");
        if (onStopped) onStopped();
    };

    if (!wasPlaying) {
        player.pauseVideo();
        vinylRecord.classList.add("paused");
        playOutTimer = setInterval(stop, PLAY_OUT_MS);
        return;
    }

    const startedAt = Date.now();
    playOutTimer = setInterval(() => {
        const left = PLAY_OUT_MS - (Date.now() - startedAt);
        if (left <= 0) {
            stop();
        } else if (left < FADE_OUT_MS) {
            player.setVolume(Math.round(volume * (left / FADE_OUT_MS)));
        }
    }, 50);
}

// ── 정답률: 지금까지 출제된 문제의 정답 중 맞힌 비율 (점수 대신 표시) ──
function answerCount(item) {
    return Object.keys(item || {})
        .filter((key) => key.startsWith("question_"))
        .reduce((sum, key) => sum + ((item[key].answer && item[key].answer.length) || 0), 0);
}

function totalAnswers(upToIndex) {
    return quizData.slice(0, upToIndex).reduce((sum, item) => sum + answerCount(item), 0);
}

function accuracyRate(correct, total) {
    return total > 0 ? Math.round((correct / total) * 100) : 0;
}

function updateAccuracyDisplay() {
    // 재생을 시작한 문제들의 정답 수 기준 (아직 시작 전이면 "-")
    document.getElementById("accuracy").innerText = playedCount > 0 ? accuracyRate(currentScore, totalAnswers(playedCount)) + "%" : "-";
    document.getElementById("combo").innerText = currentCombo;
    document.getElementById("question-total").innerText = quizData.length;
}

function updateQuizCountDisplay() {
    const display = document.getElementById("quiz-count-display");
    if (!display || quizData.length === 0) return;
    updateAccuracyDisplay();
    const remaining = quizData.length - currentIndex;
    if (remaining > 0) {
        display.innerHTML = `<span>${i18n.t('common.remaining_quizzes')}</span> <span>${i18n.t('common.n_items', { count: remaining })}</span>`;
    } else {
        display.innerHTML = `<span>${i18n.t('quiz.quiz_completed')}</span>`;
    }
}

function updateAnswerBoard() {
    const item = quizData[currentIndex] || {};
    const boardItems = document.getElementById("board-items");
    boardItems.innerHTML = "";

    const questionKeys = Object.keys(item)
        .filter((key) => key.startsWith("question_"))
        .sort();

    questionKeys.forEach((key) => {
        const question = item[key];
        const guessedKey = `guessed_${key}`;
        const guessedArray = currentGuessed[guessedKey];
        const displayTexts = guessedArray.map((ans, idx) =>
            ans !== null ? ans : "???",
        );
        const displayText = displayTexts.join(", ");

        const itemEl = document.createElement("div");
        itemEl.style = "display:flex;flex-direction:column;gap:6px;";
        itemEl.setAttribute("data-question-key", key);
        itemEl.innerHTML = `
            <div style="font-size: 1.15rem; font-weight: bold; color: var(--theme-text-main);">
                ${escapeHtml(question.question || i18n.t('common.question_2'))}<br>
                <span style="color: var(--color-pink); display: inline-block; margin-top: 5px;">${displayText || "-"}</span>
            </div>
        `;
        boardItems.appendChild(itemEl);
    });

    const hintWrapper = document.getElementById("hint-wrapper");
    const hintToggleBtn = document.getElementById("hint-toggle-btn");
    const boardHint = document.getElementById("board-hint");
    const boardHintText = document.getElementById("board-hint-text");
    if (item.hint) {
        hintWrapper.style.display = "flex";
        hintToggleBtn.style.visibility = "visible";
        boardHint.style.display = "none";
        boardHintText.textContent = item.hint;
    } else {
        hintWrapper.style.display = "none";
    }
}

function toggleHintDisplay() {
    const btn = document.getElementById("hint-toggle-btn");
    const boardHint = document.getElementById("board-hint");
    if (boardHint.style.display === "none") {
        boardHint.style.display = "block";
        btn.style.visibility = "hidden";
    } else {
        boardHint.style.display = "none";
        btn.style.visibility = "visible";
    }
}

function updateBoardItem(key, answerIndex, answeredText) {
    const boardItems = document.getElementById("board-items");
    const targetEl = boardItems.querySelector(
        `[data-question-key="${key}"]`,
    );
    if (targetEl) {
        const guessedKey = `guessed_${key}`;
        const guessedArray = currentGuessed[guessedKey];
        const displayTexts = guessedArray.map((ans, idx) =>
            ans !== null ? ans : "???",
        );
        const span = targetEl.querySelector("span");
        if (span) {
            span.textContent = displayTexts.join(", ");
        }
    }
}

chatSendBtn.addEventListener("click", handleChat);
chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleChat();
});

// 스킵할 때 보여줄, 아직 맞히지 못한 정답 ("가수: YOASOBI / 요아소비 · 제목: 夜に駆ける")
function missedAnswersText(item) {
    return Object.keys(item || {})
        .filter((key) => key.startsWith("question_"))
        .sort()
        .map((key) => {
            const question = item[key];
            const guessed = currentGuessed[`guessed_${key}`] || [];
            const missed = (question.answer || [])
                .filter((_, i) => guessed[i] === null || guessed[i] === undefined)
                .map((group) => group.split(SYNONYM_SEPARATOR).map((v) => v.trim()).filter(Boolean).join(" / "));
            if (missed.length === 0) return null;
            return `${question.question || i18n.t('common.question_2')}: ${missed.join(", ")}`;
        })
        .filter(Boolean)
        .join(" · ");
}

document.addEventListener("keydown", (e) => {
    if (
        e.key === "]" &&
        currentIndex < quizData.length &&
        !chatInput.disabled
    ) {
        e.preventDefault();

        if (player && player.pauseVideo) player.pauseVideo();
        vinylRecord.classList.add("paused");
        clearInterval(checkInterval);
        clearInterval(playOutTimer);
        isPlayingSegment = false;

        chatInput.disabled = true;
        chatSendBtn.disabled = true;
        currentCombo = 0;

        const missed = missedAnswersText(quizData[currentIndex]);
        if (missed) addSystemChat(i18n.t('quiz.skipped_answers', { answers: missed }));

        if (currentIndex >= quizData.length - 1) {
            addSystemChat(i18n.t('quiz.you_skipped_the_song_the_quiz'));
            currentIndex++;
            updateQuizCountDisplay();
            saveQuizHistory();
            showQuizResult();
        } else {
            addSystemChat(i18n.t('quiz.you_skipped_the_song_let_s'));
            setTimeout(() => {
                currentIndex++;
                updateQuizCountDisplay();
                playSegment();
            }, 1500);
        }
    }
});

document
    .getElementById("volume-slider")
    .addEventListener("input", (e) => {
        document.getElementById("volume-display").textContent =
            e.target.value + "%";
        if (player && player.setVolume) {
            player.setVolume(e.target.value);
        }
    });

function showQuizResult() {
    const modal = document.getElementById('quiz-result-modal');
    const total = totalAnswers(quizData.length);
    i18n.setText(document.getElementById('modal-result-summary'), 'quiz.result_summary', {
        questions: quizData.length, correct: currentScore, total, rate: accuracyRate(currentScore, total),
    });

    const logContainer = document.getElementById('modal-log-container');
    logContainer.innerHTML = '';

    if (quizLogs.length === 0) {
        logContainer.innerHTML = `<div style="text-align:center; color: var(--theme-text-muted); padding: 20px;">${i18n.t('quiz.no_correct_answers')}</div>`;
    } else {
        // Group by quizIndex
        const grouped = {};
        quizLogs.forEach(log => {
            if (!grouped[log.quizIndex]) grouped[log.quizIndex] = [];
            grouped[log.quizIndex].push(log);
        });

        Object.keys(grouped).forEach(qIdx => {
            const groupDiv = document.createElement('div');
            groupDiv.style.cssText = "background: var(--theme-bg-card); border: 1px solid var(--theme-border); border-radius: 6px; padding: 15px; box-shadow: 0 2px 5px rgba(0,0,0,0.02);";

            const header = document.createElement('div');
            header.style.cssText = "font-weight: 800; font-size: 1.05rem; color: var(--theme-text-main); margin-bottom: 12px; border-bottom: 1px dashed var(--theme-border); padding-bottom: 8px;";
            header.innerText = i18n.t('quiz.question_n', { n: qIdx });
            groupDiv.appendChild(header);

            grouped[qIdx].forEach(log => {
                const itemDiv = document.createElement('div');
                itemDiv.style.cssText = "font-size: 0.95rem; margin-bottom: 12px; display: flex; flex-direction: column; gap: 6px;";
                itemDiv.innerHTML = `<span style="color: var(--theme-text-muted); line-height: 1.4; word-break: keep-all;">Q. ${escapeHtml(log.questionLabel)}</span> <span style="font-weight:bold; color: var(--color-pink); font-size: 1.05rem; padding-left: 10px;">${escapeHtml(log.matchedAnswer)}</span>`;
                groupDiv.appendChild(itemDiv);
            });

            logContainer.appendChild(groupDiv);
        });
    }

    modal.style.display = 'flex';
}

function saveQuizHistory() {
    if (!localStorage.getItem("ep_user")) return;

    fetch("/api/quiz-history", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            quiz_category: quizTitle,
            score: currentScore,
            total_questions: quizData.length
        })
    })
        .then(res => res.json())
        .then(data => console.log("퀴즈 기록 저장:", data))
        .catch(err => console.error("퀴즈 기록 저장 오류:", err));
}

initQuiz();
