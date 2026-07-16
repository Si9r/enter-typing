const contentIdMatch = window.location.pathname.match(/^\/quiz\/(\d+)\/play\/?$/);
const contentId = contentIdMatch ? contentIdMatch[1] : null;

let player = null;
let quizData = [];
let currentIndex = 0;
let currentScore = 0;
let quizTitle = "알 수 없는 퀴즈";
let currentGuessed = {};
let isPlayingSegment = false;
let isPausedManually = false;
let checkInterval = null;
let currentLoadedYoutubeId = null;
let quizLogs = [];
let hasIncrementedPlayCount = false;

const chatMessages = document.getElementById("chat-messages");
const chatInput = document.getElementById("chat-input");
const chatSendBtn = document.getElementById("chat-send-btn");
const vinylRecord = document.getElementById("vinyl-record");

async function initQuiz() {
    if (!contentId) {
        addSystemChat("퀴즈 ID가 유효하지 않습니다.");
        return;
    }
    try {
        const res = await fetch(`/api/quiz-content/${contentId}`);
        const data = await res.json();
        if (data.success) {
            quizTitle = data.title || "알 수 없는 퀴즈";
            quizData = JSON.parse(data.quiz_data || "[]");
            document.getElementById("best-score").innerText = data.best_score || 0;
            updateQuizCountDisplay();
            if (quizData.length > 0 && quizData[0].youtube_id) {
                currentLoadedYoutubeId = quizData[0].youtube_id;
                initYoutube(currentLoadedYoutubeId);
            } else if (data.youtube_id) {
                currentLoadedYoutubeId = data.youtube_id;
                initYoutube(currentLoadedYoutubeId);
            } else {
                addSystemChat("유튜브 영상 정보가 없습니다.");
            }
        } else {
            addSystemChat("퀴즈 데이터를 불러오지 못했습니다.");
        }
    } catch (err) {
        addSystemChat("서버 에러가 발생했습니다.");
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
    addSystemChat(
        window.i18nTranslate("음원 로딩이 완료되었습니다. 가운데 '?' 를 클릭해 시작하세요!"),
    );
}

function startQuiz() {
    if (!player || quizData.length === 0) return;
    if (currentIndex >= quizData.length) {
        addSystemChat(window.i18nTranslate("퀴즈가 이미 끝났습니다."));
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
        const variations = ansGroup.split(",").map((v) => v.trim());
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
            const variations = ansGroup.split(",").map((v) => v.trim());
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
            addSystemChat(window.i18nTranslate("정답입니다!") + ` (${question.question || window.i18nTranslate("질문")})`);

            quizLogs.push({
                quizIndex: currentIndex + 1,
                questionLabel: question.question || "질문",
                matchedAnswer: matchedAnswer
            });

            currentScore += 1;
            document.getElementById('score').innerText = currentScore;

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
        player.pauseVideo();
        vinylRecord.classList.add("paused");
        clearInterval(checkInterval);
        isPlayingSegment = false;

        chatInput.disabled = true;
        chatSendBtn.disabled = true;

        if (currentIndex >= quizData.length - 1) {
            addSystemChat(window.i18nTranslate("모든 정답을 맞췄습니다! 퀴즈가 모두 끝났습니다! 축하합니다"));
            currentIndex++;
            updateQuizCountDisplay();
            saveQuizHistory();
            showQuizResult();
        } else {
            addSystemChat(
                window.i18nTranslate("모든 정답을 맞췄습니다! 3초 후 다음 문제로 넘어갑니다."),
            );
            setTimeout(() => {
                currentIndex++;
                updateQuizCountDisplay();
                playSegment();
            }, 3000);
        }
    }
}

function updateQuizCountDisplay() {
    const display = document.getElementById("quiz-count-display");
    if (!display || quizData.length === 0) return;
    const remaining = quizData.length - currentIndex;
    if (remaining > 0) {
        display.textContent = `${window.i18nTranslate("남은 퀴즈:")} ${remaining}${window.i18nTranslate("개")}`;
    } else {
        display.textContent = window.i18nTranslate("퀴즈 완료!");
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
                ${question.question || "질문"}<br>
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
        isPlayingSegment = false;

        chatInput.disabled = true;
        chatSendBtn.disabled = true;

        if (currentIndex >= quizData.length - 1) {
            addSystemChat(window.i18nTranslate("노래를 스킵하셨습니다. 퀴즈가 모두 끝났습니다! 축하합니다"));
            currentIndex++;
            updateQuizCountDisplay();
            saveQuizHistory();
            showQuizResult();
        } else {
            addSystemChat(window.i18nTranslate("노래를 스킵하셨습니다. 다음 문제로 넘어갑니다."));
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
    document.getElementById('modal-total-score').innerText = currentScore;

    const logContainer = document.getElementById('modal-log-container');
    logContainer.innerHTML = '';

    if (quizLogs.length === 0) {
        logContainer.innerHTML = `<div style="text-align:center; color: var(--theme-text-muted); padding: 20px;">${window.i18nTranslate("맞춘 정답이 없습니다")}</div>`;
    } else {
        // Group by quizIndex
        const grouped = {};
        quizLogs.forEach(log => {
            if (!grouped[log.quizIndex]) grouped[log.quizIndex] = [];
            grouped[log.quizIndex].push(log);
        });

        Object.keys(grouped).forEach(qIdx => {
            const groupDiv = document.createElement('div');
            groupDiv.style.cssText = "background: var(--theme-bg-card); border: 1px solid #eaeaea; border-radius: 6px; padding: 15px; box-shadow: 0 2px 5px rgba(0,0,0,0.02);";

            const header = document.createElement('div');
            header.style.cssText = "font-weight: 800; font-size: 1.05rem; color: var(--theme-text-main); margin-bottom: 12px; border-bottom: 1px dashed var(--theme-border); padding-bottom: 8px;";
            header.innerText = `${window.i18nTranslate("문제")} ${qIdx}`;
            groupDiv.appendChild(header);

            grouped[qIdx].forEach(log => {
                const itemDiv = document.createElement('div');
                itemDiv.style.cssText = "font-size: 0.95rem; margin-bottom: 12px; display: flex; flex-direction: column; gap: 6px;";
                itemDiv.innerHTML = `<span style="color: var(--theme-text-muted); line-height: 1.4; word-break: keep-all;">Q. ${log.questionLabel}</span> <span style="font-weight:bold; color: var(--color-pink); font-size: 1.05rem; padding-left: 10px;">${log.matchedAnswer}</span>`;
                groupDiv.appendChild(itemDiv);
            });

            logContainer.appendChild(groupDiv);
        });
    }

    modal.style.display = 'flex';
}

function saveQuizHistory() {
    const token = localStorage.getItem("ep_token");
    if (!token) return;

    fetch("/api/quiz-history", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token
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
