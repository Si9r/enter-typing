const urlParams = new URLSearchParams(window.location.search);
const contentId = urlParams.get("id");

let player = null;
let quizData = [];
let currentIndex = 0;
let currentGuessed = { singer: false, title: false, lyrics: false };
let isPlayingSegment = false;
let isPausedManually = false;
let checkInterval = null;
let currentLoadedYoutubeId = null;

let score = 0;
let combo = 0;
let maxCombo = 0;
let correctAnswers = 0;
let wrongAnswers = 0;
let solvedQuestions = 0;
let usedHintForCurrentQuestion = false;
let hasSubmittedQuizResult = false;
let hasFinishedQuiz = false;

const ANSWER_POINTS = { singer: 50, title: 70, lyrics: 100 };
const chatMessages = document.getElementById("chat-messages");
const chatInput = document.getElementById("chat-input");
const chatSendBtn = document.getElementById("chat-send-btn");
const vinylRecord = document.getElementById("vinyl-record");
const scoreDisplay = document.getElementById("score");
const bestScoreDisplay = document.getElementById("best-score");
const accuracyDisplay = document.getElementById("accuracy");
const comboDisplay = document.getElementById("combo");

async function initQuiz() {
  if (!contentId) {
    addSystemChat("퀴즈 정보를 찾을 수 없습니다.");
    return;
  }

  try {
    const res = await fetch(`/api/quiz-content/${contentId}`);
    const data = await res.json();

    if (!data.success) {
      addSystemChat("퀴즈 데이터를 불러오지 못했습니다.");
      return;
    }

    quizData = JSON.parse(data.quiz_data || "[]");
    if (bestScoreDisplay) bestScoreDisplay.textContent = data.best_score || 0;
    updateScoreBoard();
    updateQuizCountDisplay();

    if (quizData.length > 0 && quizData[0].youtube_id) {
      currentLoadedYoutubeId = quizData[0].youtube_id;
      initYoutube(currentLoadedYoutubeId);
    } else if (data.youtube_id) {
      currentLoadedYoutubeId = data.youtube_id;
      initYoutube(currentLoadedYoutubeId);
    } else {
      addSystemChat("이 퀴즈에 연결된 유튜브 영상이 없습니다.");
    }
  } catch (err) {
    console.error(err);
    addSystemChat("퀴즈를 불러오는 중 서버 오류가 발생했습니다.");
  }
}

function initYoutube(videoId) {
  window.onYouTubeIframeAPIReady = function () {
    player = new YT.Player("youtube-player", {
      height: "1",
      width: "1",
      videoId,
      playerVars: { playsinline: 1, controls: 0 },
      events: {
        onReady: onPlayerReady,
        onStateChange: onPlayerStateChange,
      },
    });
  };

  if (window.YT && window.YT.Player) {
    window.onYouTubeIframeAPIReady();
  }
}

function onPlayerStateChange(event) {
  if (event.data === YT.PlayerState.PLAYING) {
    const currentVol = document.getElementById("volume-slider").value;
    player.setVolume(currentVol);
  }
}

function onPlayerReady() {
  player.setVolume(document.getElementById("volume-slider").value);
  addSystemChat("준비 완료! 중앙의 '?' 버튼을 눌러 시작하세요.");
}

function startQuiz() {
  if (!player || quizData.length === 0) return;

  if (currentIndex >= quizData.length) {
    addSystemChat("이미 완료된 퀴즈입니다.");
    return;
  }

  if (isPlayingSegment) {
    player.pauseVideo();
    vinylRecord.classList.add("paused");
    isPlayingSegment = false;
    isPausedManually = true;
  } else if (isPausedManually) {
    player.playVideo();
    vinylRecord.classList.remove("paused");
    isPlayingSegment = true;
    isPausedManually = false;
  } else {
    playSegment();
  }
}

function playSegment() {
  const item = quizData[currentIndex];
  if (!item) {
    finishQuiz();
    return;
  }

  currentGuessed = { singer: false, title: false, lyrics: false };
  usedHintForCurrentQuestion = false;
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
    player.loadVideoById({ videoId: targetVideoId, startSeconds: item.start });
    currentLoadedYoutubeId = targetVideoId;
  } else {
    player.seekTo(item.start);
    player.playVideo();
  }

  clearInterval(checkInterval);
  const progressCircle = document.getElementById("vinyl-progress");
  if (progressCircle) progressCircle.style.strokeDashoffset = "189";

  checkInterval = setInterval(() => {
    const currentTime = player.getCurrentTime();
    const totalDuration = item.end - item.start;
    const elapsed = currentTime - item.start;

    if (progressCircle && totalDuration > 0) {
      let progress = elapsed / totalDuration;
      if (progress < 0) progress = 0;
      if (progress > 1) progress = 1;
      progressCircle.style.strokeDashoffset = 189 - 189 * progress;
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

function checkAnswerMatch(targetAnswersStr, normInput) {
  if (!targetAnswersStr) return false;
  const answers = targetAnswersStr.split(",");
  for (const ans of answers) {
    if (normalizeString(ans) === normInput) return true;
  }
  return false;
}

function getQuizAccuracy() {
  const attempts = correctAnswers + wrongAnswers;
  if (attempts === 0) return 100;
  return Math.round((correctAnswers / attempts) * 100);
}

function updateScoreBoard() {
  if (scoreDisplay) scoreDisplay.textContent = score;
  if (comboDisplay) comboDisplay.textContent = combo;
  if (accuracyDisplay) accuracyDisplay.textContent = `${getQuizAccuracy()}%`;
}

function awardAnswer(answerType) {
  const base = ANSWER_POINTS[answerType] || 100;
  const hintMultiplier = usedHintForCurrentQuestion ? 0.6 : 1;
  const comboBonus = combo * 10;
  score += Math.round(base * hintMultiplier) + comboBonus;
  combo += 1;
  maxCombo = Math.max(maxCombo, combo);
  correctAnswers += 1;
  updateScoreBoard();
}

function registerWrongAnswer() {
  wrongAnswers += 1;
  combo = 0;
  updateScoreBoard();
}

function handleChat() {
  const text = chatInput.value.trim();
  if (!text) return;

  addUserChat(text);
  chatInput.value = "";

  if (currentIndex >= quizData.length) return;

  const item = quizData[currentIndex];
  const normText = normalizeString(text);
  let answerType = null;

  if (item.singer && !currentGuessed.singer && checkAnswerMatch(item.singer, normText)) {
    currentGuessed.singer = true;
    document.getElementById("board-singer").textContent = item.singer.split(",")[0].trim();
    answerType = "singer";
    addSystemChat("정답입니다! 가수를 맞혔어요.");
  } else if (item.title && !currentGuessed.title && checkAnswerMatch(item.title, normText)) {
    currentGuessed.title = true;
    document.getElementById("board-title").textContent = item.title.split(",")[0].trim();
    answerType = "title";
    addSystemChat("정답입니다! 제목을 맞혔어요.");
  } else if (item.lyrics && !currentGuessed.lyrics && checkAnswerMatch(item.lyrics, normText)) {
    currentGuessed.lyrics = true;
    document.getElementById("board-lyrics").textContent = item.lyrics.split(",")[0].trim();
    answerType = "lyrics";
    addSystemChat("정답입니다! 가사를 맞혔어요.");
  }

  if (answerType) {
    awardAnswer(answerType);
    checkSegmentComplete();
  } else {
    registerWrongAnswer();
    addSystemChat("오답입니다. 콤보가 초기화됐어요.");
  }
}

function checkSegmentComplete() {
  const item = quizData[currentIndex];
  let allGuessed = true;
  if (item.singer && !currentGuessed.singer) allGuessed = false;
  if (item.title && !currentGuessed.title) allGuessed = false;
  if (item.lyrics && !currentGuessed.lyrics) allGuessed = false;

  if (!item.singer && !item.title && !item.lyrics) allGuessed = true;

  if (allGuessed) {
    solvedQuestions += 1;
    addSystemChat("모든 정답을 맞혔습니다. 잠시 후 다음 문제로 넘어갑니다.");
    pauseCurrentSegment();
    goToNextQuestion(3000);
  }
}

function pauseCurrentSegment() {
  if (player && player.pauseVideo) player.pauseVideo();
  if (vinylRecord) vinylRecord.classList.add("paused");
  clearInterval(checkInterval);
  isPlayingSegment = false;
  if (chatInput) chatInput.disabled = true;
  if (chatSendBtn) chatSendBtn.disabled = true;
}

function goToNextQuestion(delay) {
  setTimeout(() => {
    currentIndex += 1;
    updateQuizCountDisplay();
    if (currentIndex >= quizData.length) {
      finishQuiz();
    } else {
      playSegment();
    }
  }, delay);
}

function finishQuiz() {
  if (hasFinishedQuiz) return;
  hasFinishedQuiz = true;
  pauseCurrentSegment();
  updateQuizCountDisplay();
  addSystemChat("퀴즈가 완료되었습니다. 로그인한 사용자는 결과가 저장됩니다.");
  submitQuizResult();
}

function skipCurrentQuestion() {
  addSystemChat("문제를 건너뛰었습니다. 콤보가 초기화됐어요.");
  registerWrongAnswer();
  pauseCurrentSegment();
  goToNextQuestion(1500);
}

async function submitQuizResult() {
  if (hasSubmittedQuizResult) return;
  hasSubmittedQuizResult = true;

  const token = sessionStorage.getItem("ep_token");
  if (!token || !contentId) return;

  try {
    const res = await fetch("/api/quiz-results", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        content_id: Number(contentId),
        score,
        correct_count: solvedQuestions,
        total_questions: quizData.length,
        accuracy: getQuizAccuracy(),
        max_combo: maxCombo,
      }),
    });
    const data = await res.json();
    if (data.success && bestScoreDisplay) {
      bestScoreDisplay.textContent = data.best_score;
    }
  } catch (err) {
    console.warn("퀴즈 결과 저장 실패", err);
  }
}

function updateQuizCountDisplay() {
  const display = document.getElementById("quiz-count-display");
  if (!display || quizData.length === 0) return;
  const remaining = quizData.length - currentIndex;
  display.textContent = remaining > 0 ? `남은 퀴즈: ${remaining}개` : "퀴즈 완료!";
}

function updateAnswerBoard() {
  const item = quizData[currentIndex] || {};
  document.getElementById("board-singer").textContent = item.singer ? "정답 대기" : "-";
  document.getElementById("board-title").textContent = item.title ? "정답 대기" : "-";
  document.getElementById("board-lyrics").textContent = item.lyrics ? "정답 대기" : "-";

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
    usedHintForCurrentQuestion = true;
    boardHint.style.display = "block";
    btn.style.visibility = "hidden";
  } else {
    boardHint.style.display = "none";
    btn.style.visibility = "visible";
  }
}

if (chatSendBtn) {
  chatSendBtn.addEventListener("click", handleChat);
}

if (chatInput) {
  chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleChat();
  });
}

document.addEventListener("keydown", (e) => {
  if (e.key === "]" && currentIndex < quizData.length && chatInput && !chatInput.disabled) {
    e.preventDefault();
    skipCurrentQuestion();
  }
});

const volumeSlider = document.getElementById("volume-slider");
if (volumeSlider) {
  volumeSlider.addEventListener("input", (e) => {
    document.getElementById("volume-display").textContent = `${e.target.value}%`;
    if (player && player.setVolume) {
      player.setVolume(e.target.value);
    }
  });
}

window.startQuiz = startQuiz;
window.toggleHintDisplay = toggleHintDisplay;

initQuiz();
