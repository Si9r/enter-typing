// Data State
let linesData = [];
let editingIndex = -1;
let youtubePlayer = null;
let isPlayerReady = false;
let currentThumbnailUrl = null;

// DOM Elements
const gridContainer = document.getElementById("quiz-card-grid");
const ytInput = document.getElementById("youtube_url");
const urlErrorMsg = document.getElementById("url-error-msg");

const startTimeInput = document.getElementById("start-time");
const endTimeInput = document.getElementById("end-time");
const quizHintInput = document.getElementById("quiz-hint");
const dynamicQuestionsContainer = document.getElementById(
    "dynamic-questions-container",
);
const btnAddQuestion = document.getElementById("btn-add-question");

function createQuestionRow(data = {}) {
    const row = document.createElement("div");
    row.className = "question-row";
    row.style =
        "display:flex;flex-direction:column;gap:8px;padding:12px;border:1px solid var(--theme-border);border-radius:10px;background: var(--theme-bg-hover);";

    row.innerHTML = `
  <div style="display:flex;gap:10px;align-items:flex-start;">
    <input type="text" class="question-label" placeholder="질문 예: 가수, 제목, 애니메이션" value="${data.question || ""
        }" style="flex:1;padding:12px;border:1px solid var(--theme-border);border-radius:8px;outline:none;" />
    <button type="button" class="btn-remove-question" style="background:#ff6b6b;color:white;border:none;border-radius:8px;padding:10px 14px;cursor:pointer;">삭제</button>
  </div>
  <textarea class="question-answer" placeholder="정답을 입력하세요. 쉼표로 동의어, 줄바꿈으로 다른 정답 옵션을 구분합니다." style="width:100%;min-height:80px;padding:12px;border:1px solid var(--theme-border);border-radius:8px;outline:none;resize:vertical;">${data.answer || ""
        }</textarea>
`;

    row
        .querySelector(".btn-remove-question")
        .addEventListener("click", () => {
            if (dynamicQuestionsContainer.children.length <= 1) {
                alert("최소 하나의 질문이 필요합니다.");
                return;
            }
            row.remove();
        });

    return row;
}

function addQuestionRow(data = {}) {
    dynamicQuestionsContainer.appendChild(createQuestionRow(data));
}

function getQuestionRowsData() {
    const rows = Array.from(
        dynamicQuestionsContainer.querySelectorAll(".question-row"),
    );
    return rows
        .map((row) => {
            const question = row.querySelector(".question-label").value.trim();
            const answerRaw = row
                .querySelector(".question-answer")
                .value.trim();
            if (!question || !answerRaw) return null;

            const answerLines = answerRaw
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter(Boolean);

            // 항상 배열로 저장
            const answer = answerLines;
            return { question, answer };
        })
        .filter(Boolean);
}

function populateQuestionRows(questions) {
    dynamicQuestionsContainer.innerHTML = "";
    if (!questions || !questions.length) {
        addQuestionRow({ question: "가수", answer: "" });
        return;
    }
    questions.forEach((questionData) => {
        let answerValue = "";
        if (Array.isArray(questionData.answer)) {
            answerValue = questionData.answer.join("\n");
        } else if (typeof questionData.answer === "string") {
            answerValue = questionData.answer;
        }
        addQuestionRow({
            question: questionData.question || "",
            answer: answerValue,
        });
    });
}

function resetQuestionForm() {
    dynamicQuestionsContainer.innerHTML = "";
    addQuestionRow({ question: "가수", answer: "" });
}

btnAddQuestion.addEventListener("click", () => {
    addQuestionRow({ question: "", answer: "" });
});

const btnAddQuiz = document.getElementById("btn-add-quiz");
const btnConfirmEdit = document.getElementById("btn-confirm-edit");
const btnCancelEdit = document.getElementById("btn-cancel-edit");

// Initial setup
btnConfirmEdit.style.display = "none";
resetQuestionForm();

function extractVideoId(url) {
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname.includes("youtube.com"))
            return urlObj.searchParams.get("v");
        if (urlObj.hostname.includes("youtu.be"))
            return urlObj.pathname.slice(1);
    } catch (e) {
        return null;
    }
    return null;
}

function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function parseTime(timeStr) {
    const parts = timeStr.split(":");
    if (parts.length === 3) {
        return (
            parseInt(parts[0]) * 3600 +
            parseInt(parts[1]) * 60 +
            parseInt(parts[2])
        );
    }
    return 0;
}

ytInput.addEventListener("change", () => {
    const vid = extractVideoId(ytInput.value);
    if (!vid) {
        ytInput.style.borderColor = "#ff4d4d";
        urlErrorMsg.textContent = "유효한 유튜브 링크를 입력해주세요.";
        urlErrorMsg.style.display = "block";
        return;
    }
    ytInput.style.borderColor = "var(--theme-border)";
    urlErrorMsg.style.display = "none";

    if (youtubePlayer) {
        youtubePlayer.loadVideoById(vid);
    } else {
        document.getElementById("youtube-player").innerHTML = "";
        YouTubeManager.createPlayer("youtube-player", {
            height: "100%",
            width: "100%",
            videoId: vid,
            playerVars: { playsinline: 1, origin: window.location.origin },
            events: {
                onReady: () => (isPlayerReady = true),
                onError: onPlayerError,
            },
        }).then((createdPlayer) => {
            youtubePlayer = createdPlayer;
        });
    }
});

function onPlayerError(event) {
    let errorMsg = "알 수 없는 오류가 발생했습니다.";
    switch (event.data) {
        case 2:
            errorMsg = "잘못된 유튜브 영상 ID입니다. 링크를 확인해 주세요.";
            break;
        case 5:
            errorMsg = "HTML5 플레이어에서 재생할 수 없는 영상입니다.";
            break;
        case 100:
            errorMsg =
                "동영상을 찾을 수 없습니다. 삭제되었거나 비공개 처리된 영상일 수 있습니다.";
            break;
        case 101:
        case 150:
            errorMsg =
                "동영상 소유자가 다른 웹사이트에서의 재생(퍼가기)을 허용하지 않은 영상입니다. 다른 영상을 사용해 주세요.";
            break;
    }
    urlErrorMsg.textContent = `동영상 로드 실패: ${errorMsg}`;
    urlErrorMsg.style.display = "block";
    ytInput.style.borderColor = "#ff4d4d";
}

document
    .getElementById("btn-start-here")
    .addEventListener("click", () => {
        if (youtubePlayer && isPlayerReady) {
            const time = youtubePlayer.getCurrentTime();
            startTimeInput.value = formatTime(time);
            hasSetStart = true;
        }
    });

document.getElementById("btn-end-here").addEventListener("click", () => {
    if (youtubePlayer && isPlayerReady) {
        const time = youtubePlayer.getCurrentTime();
        endTimeInput.value = formatTime(time);
        hasSetEnd = true;
    }
});

document.querySelectorAll(".btn-offset").forEach((btn) => {
    btn.addEventListener("click", () => {
        const offset = parseInt(btn.getAttribute("data-sec"));
        const startSec = parseTime(startTimeInput.value);
        const endSec = startSec + offset;
        endTimeInput.value = formatTime(endSec);
        hasSetEnd = true;

        if (youtubePlayer && isPlayerReady) {
            youtubePlayer.seekTo(endSec);
            youtubePlayer.pauseVideo();
        }
    });
});

const sliderContainer = document.getElementById("custom-slider");
const sliderHighlight = document.getElementById("slider-highlight");
const thumbStart = document.getElementById("slider-start");
const thumbEnd = document.getElementById("slider-end");
const thumbPlayhead = document.getElementById("slider-playhead");

let isDraggingPlayhead = false;
let isDraggingStart = false;
let isDraggingEnd = false;
let hasSetStart = false;
let hasSetEnd = false;

startTimeInput.addEventListener("input", () => (hasSetStart = true));
endTimeInput.addEventListener("input", () => (hasSetEnd = true));

thumbPlayhead.addEventListener(
    "mousedown",
    () => (isDraggingPlayhead = true),
);
thumbStart.addEventListener("mousedown", () => (isDraggingStart = true));
thumbEnd.addEventListener("mousedown", () => (isDraggingEnd = true));

document.addEventListener("mousemove", (e) => {
    if (!isDraggingPlayhead && !isDraggingStart && !isDraggingEnd) return;

    const rect = sliderContainer.getBoundingClientRect();
    let percent = (e.clientX - rect.left) / rect.width;
    percent = Math.max(0, Math.min(1, percent));

    if (!youtubePlayer || !isPlayerReady || !youtubePlayer.getDuration)
        return;
    const duration = youtubePlayer.getDuration();
    const time = percent * duration;

    if (isDraggingPlayhead) {
        youtubePlayer.seekTo(time);
    } else if (isDraggingStart) {
        startTimeInput.value = formatTime(time);
        hasSetStart = true;
    } else if (isDraggingEnd) {
        endTimeInput.value = formatTime(time);
        hasSetEnd = true;
    }
    updateThumbs();
});

document.addEventListener("mouseup", () => {
    isDraggingPlayhead = false;
    isDraggingStart = false;
    isDraggingEnd = false;
});

function updateThumbs() {
    if (!youtubePlayer || !isPlayerReady || !youtubePlayer.getDuration)
        return;
    const duration = youtubePlayer.getDuration();
    if (duration === 0) return;

    const startSec = parseTime(startTimeInput.value) || 0;
    const endSec = parseTime(endTimeInput.value) || 0;
    const currSec = youtubePlayer.getCurrentTime() || 0;

    const startPct = Math.min(
        100,
        Math.max(0, (startSec / duration) * 100),
    );
    const endPct = Math.min(100, Math.max(0, (endSec / duration) * 100));
    const currPct = Math.min(100, Math.max(0, (currSec / duration) * 100));

    if (!hasSetStart) {
        thumbStart.style.display = "none";
    } else {
        thumbStart.style.display = "block";
        thumbStart.style.left = startPct + "%";
    }

    if (!hasSetEnd) {
        thumbEnd.style.display = "none";
    } else {
        thumbEnd.style.display = "block";
        thumbEnd.style.left = endPct + "%";
    }

    thumbPlayhead.style.left = currPct + "%";

    const minPct = Math.min(startPct, endPct);
    const maxPct = Math.max(startPct, endPct);

    sliderHighlight.style.left = minPct + "%";
    if (!hasSetEnd) {
        sliderHighlight.style.width = "0%";
        sliderHighlight.style.display = "none";
    } else {
        sliderHighlight.style.display = "block";
        sliderHighlight.style.width = maxPct - minPct + "%";
    }
}

setInterval(() => {
    if (!isDraggingPlayhead && !isDraggingStart && !isDraggingEnd) {
        updateThumbs();

        if (youtubePlayer && isPlayerReady && youtubePlayer.getPlayerState) {
            const state = youtubePlayer.getPlayerState();
            if (state === 1) {
                // 1 = PLAYING
                const startSec = parseTime(startTimeInput.value) || 0;
                const endSec = parseTime(endTimeInput.value) || 0;
                const currSec = youtubePlayer.getCurrentTime() || 0;

                if (endSec > startSec && currSec >= endSec) {
                    youtubePlayer.seekTo(startSec);
                }
            }
        }
    }
}, 100);

function startAdding() {
    resetForm();
    document.querySelector(".editor-main").style.display = "flex";
    renderGrid();
}

// Grid Rendering
function renderGrid() {
    gridContainer.innerHTML = "";

    // Add new quiz card (always visible)
    const addCard = document.createElement("div");
    addCard.className = "quiz-add-card";
    if (
        editingIndex === -1 &&
        document.querySelector(".editor-main").style.display === "flex"
    ) {
        addCard.style.borderColor = "var(--color-pink)";
        addCard.style.color = "var(--color-pink)";
    }
    addCard.innerHTML = `+`;
    addCard.addEventListener("click", () => {
        startAdding();
    });
    gridContainer.appendChild(addCard);

    // Sort lines by start time
    linesData.sort((a, b) => a.start - b.start);

    linesData.forEach((line, index) => {
        const card = document.createElement("div");
        card.className = "quiz-edit-card";
        if (index === editingIndex) card.classList.add("active");

        const thumbnailUrl = line.youtube_id
            ? `https://img.youtube.com/vi/${line.youtube_id}/mqdefault.jpg`
            : "";

        const questions = Object.keys(line)
            .filter((key) => key.startsWith("question_"))
            .sort()
            .map((key) => {
                const q = line[key];
                const answerText = Array.isArray(q.answer)
                    ? q.answer.join(", ")
                    : q.answer || "";
                return `<div class="quiz-info"><span>${q.question || "질문"}</span> ${answerText || "-"}</div>`;
            })
            .join("");

        card.innerHTML = `
            ${thumbnailUrl ? `<img src="${thumbnailUrl}" class="card-thumbnail" alt="thumbnail">` : `<div class="card-thumbnail" style="display:flex; align-items:center; justify-content:center; color: var(--theme-text-muted); font-size: 0.9rem;">No Image</div>`}
            <div class="time-range">⏱ ${formatTime(line.start)} ~ ${formatTime(line.end)}</div>
            ${questions}
            <div class="quiz-info"><span>힌트</span> ${line.hint || "-"}</div>
            <div class="del-icon" data-index="${index}" title="삭제">️</div>
        `;

        card.addEventListener("click", (e) => {
            if (e.target.classList.contains("del-icon")) {
                e.stopPropagation();
                deleteLine(index);
                return;
            }
            startEditing(index);
        });

        gridContainer.appendChild(card);
    });
}

function handleAddOrUpdate() {
    const start = parseTime(startTimeInput.value);
    const end = parseTime(endTimeInput.value);
    const questions = getQuestionRowsData();
    const hint = quizHintInput.value.trim();

    const youtube_id = extractVideoId(ytInput.value);
    if (!youtube_id)
        return alert("현재 문제에 해당하는 유튜브 URL을 입력해주세요.");

    if (questions.length === 0)
        return alert("최소 1개 이상의 질문과 정답을 입력해주세요.");
    if (start >= end && end !== 0)
        return alert("종료 시간은 시작 시간보다 커야 합니다.");

    const quizItem = {
        start,
        end,
        hint,
        youtube_id,
    };
    questions.forEach((question, idx) => {
        quizItem[`question_${idx + 1}`] = question;
    });

    if (editingIndex === -1) {
        linesData.push(quizItem);
    } else {
        linesData[editingIndex] = quizItem;
    }

    resetForm();
    renderGrid();
}

btnAddQuiz.addEventListener("click", handleAddOrUpdate);
btnConfirmEdit.addEventListener("click", handleAddOrUpdate);

function startEditing(index) {
    editingIndex = index;
    const line = linesData[index];
    startTimeInput.value = formatTime(line.start);
    endTimeInput.value = formatTime(line.end);
    hasSetStart = true;
    hasSetEnd = true;

    const questions = Object.keys(line)
        .filter((key) => key.startsWith("question_"))
        .sort()
        .map((key) => ({
            question: line[key].question || "",
            answer: line[key].answer || [],
        }));
    populateQuestionRows(questions);

    quizHintInput.value = line.hint || "";

    if (line.youtube_id) {
        ytInput.value = "https://youtu.be/" + line.youtube_id;
        ytInput.dispatchEvent(new Event("change"));
    }

    btnAddQuiz.style.display = "none";
    btnConfirmEdit.style.display = "inline-block";

    // Show editor
    document.querySelector(".editor-main").style.display = "flex";

    // Seek video if available
    if (youtubePlayer && isPlayerReady && line.youtube_id) {
        setTimeout(() => youtubePlayer.seekTo(line.start), 500);
    }

    renderGrid();
}

btnCancelEdit.addEventListener("click", () => {
    resetForm();
    renderGrid();
});

function deleteLine(index) {
    if (confirm("정말 이 퀴즈를 삭제하시겠습니까?")) {
        linesData.splice(index, 1);
        if (editingIndex === index) resetForm();
        else if (editingIndex > index) editingIndex--;
        renderGrid();
    }
}

function resetForm() {
    editingIndex = -1;
    startTimeInput.value = "00:00:00";
    endTimeInput.value = "00:00:00";
    hasSetStart = false;
    hasSetEnd = false;
    quizHintInput.value = "";
    resetQuestionForm();

    btnAddQuiz.style.display = "flex"; // It's flex in style
    btnConfirmEdit.style.display = "none";

    document.querySelector(".editor-main").style.display = "none";
}

// Settings Modal
const modal = document.getElementById("settings-modal");
document
    .getElementById("btn-settings")
    .addEventListener("click", () => (modal.style.display = "flex"));
document
    .getElementById("close-settings")
    .addEventListener("click", () => (modal.style.display = "none"));
document
    .getElementById("btn-save-settings")
    .addEventListener("click", () => (modal.style.display = "none"));

const thumbnailFile = document.getElementById("thumbnail-file");
const thumbnailPreview = document.getElementById("thumbnail-preview");

thumbnailFile.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
        const res = await fetch("/api/upload-image", {
            method: "POST",
            body: formData
        });
        const data = await res.json();
        if (data.success) {
            currentThumbnailUrl = data.url;
            thumbnailPreview.style.backgroundImage = `url(${data.url})`;
            thumbnailPreview.style.display = "block";
        } else {
            alert("이미지 업로드에 실패했습니다: " + data.detail);
        }
    } catch (err) {
        console.error(err);
        alert("이미지 업로드 중 오류가 발생했습니다.");
    }
});

// Fetch params for Edit Mode - URL 경로(/quiz/{id}/edit)에서 id를 읽습니다.
const editContentIdMatch = window.location.pathname.match(/^\/quiz\/(\d+)\/edit\/?$/);
const editContentId = editContentIdMatch ? editContentIdMatch[1] : null;

// Save Content (Actual API Call)
document
    .getElementById("btn-save")
    .addEventListener("click", async () => {
        const title = document.getElementById("title").value.trim();
        if (!title) return alert("동영상 제목을 입력해주세요.");
        if (linesData.length === 0)
            return alert("최소 1개 이상의 퀴즈를 추가해주세요.");

        const youtube_id = linesData[0].youtube_id;
        if (!youtube_id) return alert("유효한 유튜브 URL이 필요합니다.");

        const artist = document.getElementById("artist").value.trim();
        const genre = document.getElementById("genre").value;
        const description = document
            .getElementById("description")
            .value.trim();
        const difficulty = parseInt(
            document.getElementById("difficulty").value,
        );

        const token = sessionStorage.getItem("ep_token");
        if (!token) {
            alert("로그인이 필요합니다.");
            location.href = "login.html";
            return;
        }

        try {
            const method = editContentId ? "PUT" : "POST";
            const url = editContentId ? `/api/quiz-contents/${editContentId}` : "/api/quiz-contents";

            const res = await fetch(url, {
                method: method,
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    title,
                    artist,
                    genre,
                    description,
                    youtube_id,
                    thumbnail_url: currentThumbnailUrl,
                    difficulty,
                    quiz_data: JSON.stringify(linesData),
                }),
            });
            const data = await res.json();
            if (data.success) {
                alert(editContentId ? "퀴즈가 성공적으로 수정되었습니다!" : "퀴즈가 성공적으로 저장되었습니다!");
                location.href = "/quiz";
            } else {
                alert(data.detail || "저장에 실패했습니다.");
            }
        } catch (err) {
            console.error(err);
            alert("서버 통신 오류가 발생했습니다.");
        }
    });

// Initialize on load
async function loadEditData() {
    try {
        const res = await fetch(`/api/quiz-content/${editContentId}`);
        const data = await res.json();
        if (data.success) {
            document.getElementById("title").value = data.title || "";
            document.getElementById("artist").value = data.artist || "";
            document.getElementById("genre").value = data.genre || "JPOP";
            document.getElementById("description").value = data.description || "";
            document.getElementById("difficulty").value = data.difficulty || "3";

            if (data.thumbnail_url) {
                currentThumbnailUrl = data.thumbnail_url;
                thumbnailPreview.style.backgroundImage = `url(${data.thumbnail_url})`;
                thumbnailPreview.style.display = "block";
            }

            if (data.quiz_data) {
                linesData = JSON.parse(data.quiz_data);
            }
            renderGrid();
        } else {
            alert("퀴즈 정보를 불러오는데 실패했습니다.");
        }
    } catch (err) {
        console.error(err);
        alert("서버 오류가 발생했습니다.");
    }
}

if (editContentId) {
    loadEditData();
} else {
    renderGrid();
}

// Guide Modal Logic
const guideModal = document.getElementById('guide-modal');
const hideGuideCheckbox = document.getElementById('hide-guide-today');

function showGuideModal() {
    const hideUntil = localStorage.getItem('hideQuizGuideUntil');
    const now = new Date().getTime();

    if (editContentId) return;

    if (!hideUntil || now > parseInt(hideUntil)) {
        guideModal.style.display = 'flex';
    }
}

function closeGuideModal() {
    if (hideGuideCheckbox.checked) {
        const now = new Date();
        now.setHours(now.getHours() + 24);
        localStorage.setItem('hideQuizGuideUntil', now.getTime());
    }
    guideModal.style.display = 'none';
}

document.getElementById('close-guide').addEventListener('click', closeGuideModal);
document.getElementById('btn-close-guide').addEventListener('click', closeGuideModal);
document.getElementById('btn-show-guide').addEventListener('click', () => {
    guideModal.style.display = 'flex';
});

window.addEventListener('DOMContentLoaded', showGuideModal);
