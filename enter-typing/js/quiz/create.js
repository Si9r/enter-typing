// Data State
let linesData = [];
let editingIndex = -1;
let youtubePlayer = null;
let isPlayerReady = false;
let playerGeneration = 0;   // 플레이어를 초기화할 때마다 증가 (늦게 생성된 이전 플레이어를 버리기 위함)
let pendingSeekSec = null;  // 수정 모드: 영상이 준비되면 이동할 구간 시작 시간
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
    <input type="text" class="question-label" placeholder="${i18n.t('quiz.example_questions_singer_title_animation')}" value="${escapeHtml(data.question || "")
        }" style="flex:1;padding:12px;border:1px solid var(--theme-border);border-radius:8px;outline:none;" />
    <button type="button" class="btn-remove-question" style="background:#ff6b6b;color:white;border:none;border-radius:8px;padding:10px 14px;cursor:pointer;">${i18n.t('nav.delete')}</button>
  </div>
  <textarea class="question-answer" placeholder="${i18n.t('quiz.please_enter_the_correct_answer_separate')}" style="width:100%;min-height:80px;padding:12px;border:1px solid var(--theme-border);border-radius:8px;outline:none;resize:vertical;">${escapeHtml(data.answer || "")
        }</textarea>
`;

    row
        .querySelector(".btn-remove-question")
        .addEventListener("click", () => {
            if (dynamicQuestionsContainer.children.length <= 1) {
                alert(i18n.t('quiz.at_least_one_question_is_required'));
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
        addQuestionRow({ question: "", answer: "" });
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
    addQuestionRow({ question: "", answer: "" });
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
        urlErrorMsg.textContent = i18n.t('quiz.please_enter_a_valid_youtube_link');
        urlErrorMsg.style.display = "block";
        return;
    }
    ytInput.style.borderColor = "var(--theme-border)";
    urlErrorMsg.style.display = "none";

    if (youtubePlayer) {
        youtubePlayer.loadVideoById(vid);
    } else {
        const generation = playerGeneration;
        document.getElementById("youtube-player").innerHTML = "";
        YouTubeManager.createPlayer("youtube-player", {
            height: "100%",
            width: "100%",
            videoId: vid,
            // 수정 모드면 해당 구간 시작 위치부터 재생되도록 한다 (재생 전 seekTo 는 위치가 반영되지 않음)
            playerVars: { playsinline: 1, origin: window.location.origin, ...(pendingSeekSec !== null ? { start: Math.floor(pendingSeekSec) } : {}) },
            events: {
                onReady: (e) => {
                    if (generation !== playerGeneration) return;
                    isPlayerReady = true;
                    if (pendingSeekSec !== null) {
                        e.target.seekTo(pendingSeekSec, true);
                        pendingSeekSec = null;
                    }
                },
                onError: onPlayerError,
            },
        }).then((createdPlayer) => {
            // 그사이 모달이 닫혀 초기화됐다면, 늦게 만들어진 플레이어는 버린다
            if (generation !== playerGeneration) {
                try { createdPlayer.destroy(); } catch (e) { /* 이미 제거됨 */ }
                return;
            }
            youtubePlayer = createdPlayer;
        });
    }
});

function onPlayerError(event) {
    let errorMsg = i18n.t('quiz.an_unknown_error_occurred');
    switch (event.data) {
        case 2:
            errorMsg = i18n.t('quiz.invalid_youtube_video_id_please_check');
            break;
        case 5:
            errorMsg = i18n.t('quiz.this_video_cannot_be_played_on');
            break;
        case 100:
            errorMsg =
                i18n.t('quiz.video_not_found_the_video_may');
            break;
        case 101:
        case 150:
            errorMsg =
                i18n.t('quiz.this_video_does_not_allow_playback');
            break;
    }
    urlErrorMsg.textContent = i18n.t('quiz.video_load_failed', { message: errorMsg });
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

    const currentTimeDisplay = document.getElementById("current-time-display");
    if (currentTimeDisplay) {
        currentTimeDisplay.textContent = i18n.t('quiz.current_time', { sec: currSec.toFixed(2) });
    }

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

// ── 편집 모달 ─────────────────────────────────────────
const editorModal = document.getElementById("editor-modal");
const PLAYER_PLACEHOLDER = document.getElementById("youtube-player").innerHTML;

function isEditorOpen() {
    return editorModal.classList.contains("open");
}

function openEditor() {
    editorModal.classList.add("open");
    document.body.style.overflow = "hidden";
}

function closeEditor() {
    resetForm();
    renderGrid();
}

/** 유튜브 플레이어를 완전히 제거하고 URL 입력칸을 비운다 (다음 등록창에 이전 영상이 남지 않도록). */
function resetVideo() {
    playerGeneration++;
    pendingSeekSec = null;
    if (youtubePlayer) {
        try { youtubePlayer.destroy(); } catch (e) { /* 이미 제거됨 */ }
    }
    youtubePlayer = null;
    isPlayerReady = false;
    document.getElementById("video-container").innerHTML = `<div id="youtube-player">${PLAYER_PLACEHOLDER}</div>`;
    ytInput.value = "";
    ytInput.style.borderColor = "var(--theme-border)";
    urlErrorMsg.style.display = "none";
}

document.getElementById("btn-close-editor").addEventListener("click", closeEditor);
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isEditorOpen()) closeEditor();
});

function startAdding() {
    resetForm();
    openEditor();
    renderGrid();
}

// Grid Rendering
function renderGrid() {
    gridContainer.innerHTML = "";
    i18n.setText(document.getElementById("quiz-total-count"), "quiz.total_count", { count: linesData.length });

    // Add new quiz card (always visible)
    const addCard = document.createElement("div");
    addCard.className = "quiz-add-card";
    if (editingIndex === -1 && isEditorOpen()) {
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
                return `<div class="quiz-info"><span>${escapeHtml(q.question || i18n.t('common.question_2'))}</span> ${escapeHtml(answerText || "-")}</div>`;
            })
            .join("");

        card.innerHTML = `
            ${thumbnailUrl ? `<img src="${escapeHtml(thumbnailUrl)}" class="card-thumbnail" alt="thumbnail">` : `<div class="card-thumbnail" style="display:flex; align-items:center; justify-content:center; color: var(--theme-text-muted); font-size: 0.9rem;">No Image</div>`}
            <div class="time-range">⏱ ${formatTime(line.start)} ~ ${formatTime(line.end)}</div>
            ${questions}
            <div class="quiz-info"><span>${i18n.t('common.hint')}</span> ${escapeHtml(line.hint || "-")}</div>
            <div class="del-icon" data-index="${index}" title="${i18n.t('nav.delete')}"><i class="ph-bold ph-trash"></i></div>
        `;

        card.addEventListener("click", (e) => {
            if (e.target.closest(".del-icon")) {
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
        return alert(i18n.t('quiz.please_enter_the_youtube_url_correspondi'));

    if (questions.length === 0)
        return alert(i18n.t('quiz.please_enter_at_least_one_question'));
    if (start >= end && end !== 0)
        return alert(i18n.t('quiz.the_end_time_must_be_greater'));

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

    // 수정할 문제의 영상을 새로 불러오고, 준비되면 구간 시작 위치로 이동
    resetVideo();
    if (line.youtube_id) {
        pendingSeekSec = line.start;
        ytInput.value = "https://youtu.be/" + line.youtube_id;
        ytInput.dispatchEvent(new Event("change"));
    }

    btnAddQuiz.style.display = "none";
    btnConfirmEdit.style.display = "inline-block";

    openEditor();

    renderGrid();
}

btnCancelEdit.addEventListener("click", () => {
    resetForm();
    renderGrid();
});

function deleteLine(index) {
    if (confirm(i18n.t('quiz.are_you_sure_you_want_to'))) {
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

    // 등록/취소/닫기 후에는 영상을 끊고 모달을 닫는다
    resetVideo();
    editorModal.classList.remove("open");
    document.body.style.overflow = "";
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
            alert(i18n.t('quiz.image_upload_failed') + i18n.server(data.detail, 'common.unknown_error'));
        }
    } catch (err) {
        console.error(err);
        alert(i18n.t('quiz.an_error_occurred_while_uploading_the'));
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
        if (!title) return alert(i18n.t('common.please_enter_the_video_title'));
        if (linesData.length === 0)
            return alert(i18n.t('quiz.please_add_at_least_one_quiz'));

        const youtube_id = linesData[0].youtube_id;
        if (!youtube_id) return alert(i18n.t('quiz.a_valid_youtube_url_is_required'));

        const artist = document.getElementById("artist").value.trim();
        const genre = document.getElementById("genre").value;
        const description = document
            .getElementById("description")
            .value.trim();
        const difficulty = parseInt(
            document.getElementById("difficulty").value,
        );

        if (!localStorage.getItem("ep_user")) {
            alert(i18n.t('common.login_is_required'));
            location.href = "/login";
            return;
        }

        try {
            const method = editContentId ? "PUT" : "POST";
            const url = editContentId ? `/api/quiz-contents/${editContentId}` : "/api/quiz-contents";

            const res = await fetch(url, {
                method: method,
                headers: {
                    "Content-Type": "application/json",
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
                alert(editContentId ? i18n.t('quiz.your_quiz_has_been_successfully_edited') : i18n.t('quiz.saved_successfully'));
                location.href = "/quiz";
            } else {
                alert(i18n.server(data.detail, 'quiz.save_failed'));
            }
        } catch (err) {
            console.error(err);
            alert(i18n.t('quiz.a_server_communication_error_occurred'));
        }
    });

// Initialize on load
async function loadEditData() {
    const editCurrentUser = window.NavAuth && window.NavAuth.getUser();
    if (!editCurrentUser) {
        alert(i18n.t('common.this_service_requires_login'));
        location.href = '/login';
        return;
    }

    try {
        const res = await fetch(`/api/quiz-content/${editContentId}`);
        const data = await res.json();
        if (data.success) {
            const isOwner = editCurrentUser.id === data.creator_id;
            if (!isOwner && !editCurrentUser.is_admin) {
                alert(i18n.t('typing.no_edit_permission'));
                location.href = '/quiz';
                return;
            }

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
            alert(i18n.t('quiz.failed_to_load_quiz_information'));
        }
    } catch (err) {
        console.error(err);
        alert(i18n.t('common.a_server_error_occurred'));
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

// Volume Slider Logic
const volumeSlider = document.getElementById("volume-slider");
const volumeDisplay = document.getElementById("volume-display");
if (volumeSlider) {
    volumeSlider.addEventListener("input", (e) => {
        const volume = e.target.value;
        if (volumeDisplay) volumeDisplay.textContent = volume + "%";
        if (youtubePlayer && isPlayerReady && typeof youtubePlayer.setVolume === "function") {
            youtubePlayer.setVolume(volume);
            if (youtubePlayer.isMuted()) {
                youtubePlayer.unMute();
            }
        }
    });
}