// J-Pop Music Quiz Engine - quiz.js

let player = null;
let playerReady = false;
let ytApiReady = false;
let mountedVideoId = null;
let mountedForIdx = -1;
let awaitingAutoPlay = false;
let pendingPreloadIdx = -1;
let pendingPlayOnReady = false;
let questions = [];
let currentQuestionIdx = -1;

// Quiz State Variables
let score = 0;
let streak = 0;
let maxStreak = 0;
let lives = 3;
let gameActive = false;
let isPaused = false;
let questionTimer = null;
let currentQuestionPlayedTime = 0;

// Audio Context
let audioCtx = null;

// Initialize Web Audio API
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function playCorrectSound() {
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(659.25, audioCtx.currentTime); // E5
  osc.frequency.setValueAtTime(880.00, audioCtx.currentTime + 0.08); // A5
  
  gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
  
  osc.start();
  osc.stop(audioCtx.currentTime + 0.25);
}

function playErrorSound() {
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(120, audioCtx.currentTime);
  osc.frequency.linearRampToValueAtTime(80, audioCtx.currentTime + 0.18);
  
  gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.18);
  
  osc.start();
  osc.stop(audioCtx.currentTime + 0.18);
}

function playQuizCompleteSound() {
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  
  // Happy arpeggio
  const now = audioCtx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51]; // C5, E5, G5, C6, E6
  notes.forEach((freq, index) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + index * 0.08);
    
    gain.gain.setValueAtTime(0.06, now + index * 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.08 + 0.2);
    
    osc.start(now + index * 0.08);
    osc.stop(now + index * 0.08 + 0.2);
  });
}

// Fetch questions from FastAPI backend
async function fetchQuestions() {
  try {
    const res = await fetch('/api/quiz/questions');
    if (!res.ok) throw new Error('Failed to fetch quiz questions');
    questions = await res.json();
    updateStartButtonState();
    preloadFirstQuestion();
  } catch (err) {
    console.error('Error fetching questions:', err);
    updateStartButtonState();
  }
}

function updateStartButtonState() {
  const btn = document.getElementById('startBtn');
  if (!btn) return;

  if (!questions.length) {
    btn.disabled = true;
    btn.textContent = 'データ読込失敗（quiz.py起動を確認）';
    return;
  }

  const ready = ytApiReady && playerReady;
  btn.disabled = !ready;
  btn.textContent = ready ? 'クイズを始める' : 'プレイヤー準備中...';
}

function preloadFirstQuestion() {
  if (!questions.length || gameActive || !ytApiReady) return;
  loadYouTubeForQuestion(questions[0], false, 0);
}

// Load Leaderboard
async function fetchLeaderboard() {
  try {
    const res = await fetch('/api/quiz/scores');
    if (!res.ok) throw new Error('Failed to fetch leaderboard');
    const scores = await res.json();
    const listEl = document.getElementById('leaderboardList');
    if (!listEl) return;
    listEl.innerHTML = '';
    if (scores.length === 0) {
      listEl.innerHTML = '<li class="no-scores">ハイスコアはまだありません</li>';
    } else {
      scores.forEach((entry, idx) => {
        const li = document.createElement('li');
        li.innerHTML = `
          <span class="rank">${idx + 1}</span>
          <span class="player">${escapeHTML(entry.username)}</span>
          <span class="score-val">${entry.score} pts</span>
        `;
        listEl.appendChild(li);
      });
    }
  } catch (err) {
    console.error('Leaderboard error:', err);
  }
}

// Escapes HTML to prevent XSS
function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}



function loadYouTubeForQuestion(q, autoPlay, questionIdx = currentQuestionIdx) {
  if (!q || !ytApiReady) return;

  const wrapper = document.getElementById('player-wrapper');
  if (!wrapper) return;

  clearInterval(questionTimer);
  playerReady = false;
  mountedVideoId = null;
  mountedForIdx = -1;
  awaitingAutoPlay = autoPlay && gameActive;
  pendingPlayOnReady = autoPlay && gameActive && questionIdx === currentQuestionIdx;
  wrapper.innerHTML = '<div id="youtube-player"></div>';

  const width = wrapper.clientWidth || 640;
  const height = wrapper.clientHeight || 360;
  const question = q;
  const targetIdx = questionIdx;

  player = new YT.Player('youtube-player', {
    height: height,
    width: width,
    videoId: question.youtube_id,
    playerVars: {
      autoplay: autoPlay ? 1 : 0,
      controls: 0,
      disablekb: 1,
      enablejsapi: 1,
      fs: 0,
      modestbranding: 1,
      rel: 0,
      playsinline: 1
    },
    events: {
      onReady: (event) => {
        playerReady = true;
        mountedVideoId = question.youtube_id;
        mountedForIdx = targetIdx;
        const p = event.target;
        p.unMute();
        p.setVolume(100);
        p.seekTo(question.start_time, true);
        updateStartButtonState();
        if (pendingPlayOnReady && targetIdx === currentQuestionIdx) {
          pendingPlayOnReady = false;
          p.playVideo();
        } else if (autoPlay && gameActive && targetIdx === currentQuestionIdx) {
          p.playVideo();
        }
        if (pendingPreloadIdx >= 0 && pendingPreloadIdx === targetIdx) {
          setNextQuestionButtonReady(pendingPreloadIdx);
        }
      },
      onStateChange: onPlayerStateChange,
      onError: (event) => {
        console.error('YouTube embed error code:', event.data);
      }
    }
  });
}

function isPlayerReadyForQuestion(idx) {
  const q = questions[idx];
  return !!(
    q &&
    player &&
    playerReady &&
    mountedForIdx === idx &&
    mountedVideoId === q.youtube_id
  );
}

function playPreparedQuestionSync() {
  const q = questions[currentQuestionIdx];
  if (!q || !isPlayerReadyForQuestion(currentQuestionIdx)) return false;

  try {
    player.unMute();
    player.setVolume(100);
    player.seekTo(q.start_time, true);
    if (player.getPlayerState() !== YT.PlayerState.PLAYING) {
      player.playVideo();
    }
    return true;
  } catch (e) {
    console.error('YouTube再生エラー:', e);
    return false;
  }
}

function onPlayerStateChange(event) {
  if (
    awaitingAutoPlay &&
    gameActive &&
    !isPaused &&
    (event.data === YT.PlayerState.CUED || event.data === YT.PlayerState.BUFFERING)
  ) {
    player.playVideo();
  }

  if (event.data === YT.PlayerState.PLAYING) {
    awaitingAutoPlay = false;
    initAudio();
    if (gameActive && !isPaused) {
      startQuestionTimers();
    }
  }
}

function hideNextQuestionButton() {
  const btn = document.getElementById('nextQuestionBtn');
  if (!btn) return;
  btn.hidden = true;
  btn.disabled = true;
}

function showNextQuestionButton() {
  const btn = document.getElementById('nextQuestionBtn');
  if (!btn) return;
  btn.hidden = false;
  btn.disabled = true;
  btn.textContent = '次の曲を準備中...';
}

function setNextQuestionButtonReady(expectedIdx) {
  const btn = document.getElementById('nextQuestionBtn');
  if (!btn || btn.hidden) return;
  if (expectedIdx !== currentQuestionIdx + 1) return;

  btn.disabled = false;
  btn.textContent = '次の問題へ ▶';
}

function preloadNextQuestion() {
  const nextIdx = currentQuestionIdx + 1;
  if (nextIdx >= 5 || nextIdx >= questions.length) return;

  const q = questions[nextIdx];
  if (isPlayerReadyForQuestion(nextIdx)) {
    pendingPreloadIdx = nextIdx;
    setNextQuestionButtonReady(nextIdx);
    return;
  }

  pendingPreloadIdx = nextIdx;
  loadYouTubeForQuestion(q, false, nextIdx);
}

function promptNextQuestion() {
  if (currentQuestionIdx + 1 >= 5 || currentQuestionIdx + 1 >= questions.length) {
    setTimeout(endQuiz, 2000);
    return;
  }

  showNextQuestionButton();
  const nextIdx = currentQuestionIdx + 1;
  const nextQ = questions[nextIdx];

  if (isPlayerReadyForQuestion(nextIdx)) {
    pendingPreloadIdx = nextIdx;
    setNextQuestionButtonReady(nextIdx);
  } else {
    preloadNextQuestion();
  }
}

function handleNextQuestion() {
  hideNextQuestionButton();
  currentQuestionIdx++;

  if (currentQuestionIdx >= questions.length || currentQuestionIdx >= 5) {
    endQuiz();
    return;
  }

  setupQuestionUI();

  const q = questions[currentQuestionIdx];
  if (isPlayerReadyForQuestion(currentQuestionIdx)) {
    playPreparedQuestionSync();
  } else {
    loadYouTubeForQuestion(q, true, currentQuestionIdx);
  }
}

// Start Quiz Game
function startQuiz() {
  if (questions.length === 0) {
    alert('クイズデータが読み込めませんでした。データベースとサーバーの状態を確認してください。');
    return;
  }

  gameActive = true;
  isPaused = false;
  score = 0;
  streak = 0;
  maxStreak = 0;
  lives = 3;
  currentQuestionIdx = 0;

  document.getElementById('start-overlay').style.display = 'none';
  document.getElementById('result-overlay').style.display = 'none';
  document.getElementById('pause-overlay').style.display = 'none';
  document.getElementById('game-area').classList.add('is-playing');

  setupQuestionUI();
  hideNextQuestionButton();
}

function setupQuestionUI() {
  if (currentQuestionIdx >= questions.length || currentQuestionIdx >= 5) {
    endQuiz();
    return;
  }

  document.getElementById('hintText').textContent = '';
  document.getElementById('feedbackText').textContent = '曲が流れています。回答を入力してください！';
  document.getElementById('feedbackText').className = 'feedback-text';
  document.getElementById('feedbackIcon').textContent = '';
  document.getElementById('titleReveal').textContent = '';

  const guessInput = document.getElementById('guessInput');
  guessInput.value = '';
  guessInput.disabled = false;
  guessInput.focus();
  document.getElementById('submitGuessBtn').disabled = false;

  updateStatsUI();
  document.getElementById('progressFill').style.width = '0%';
  hideNextQuestionButton();
}

// Track snippet duration
function startQuestionTimers() {
  clearInterval(questionTimer);
  const q = questions[currentQuestionIdx];
  if (!q) return;

  questionTimer = setInterval(() => {
    if (!gameActive || isPaused || !player || !player.getCurrentTime) return;
    
    const elapsed = player.getCurrentTime() - q.start_time;
    const progress = Math.min((elapsed / q.duration) * 100, 100);
    document.getElementById('progressFill').style.width = `${progress}%`;

    if (elapsed >= q.duration) {
      player.pauseVideo();
      clearInterval(questionTimer);
      handleTimeUp();
    }
  }, 50);
}

// User didn't answer in time
function handleTimeUp() {
  playErrorSound();
  lives--;
  streak = 0;
  updateStatsUI();

  document.getElementById('guessInput').disabled = true;
  document.getElementById('submitGuessBtn').disabled = true;

  revealAnswer(false, 'タイムアップ！');

  if (lives <= 0) {
    setTimeout(endQuiz, 2500);
  } else {
    promptNextQuestion();
  }
}

// Check User Guess
async function checkUserGuess(event) {
  if (event) event.preventDefault();

  const guessInput = document.getElementById('guessInput');
  const guess = guessInput.value.trim();
  if (!guess || !gameActive) return;

  // Stop playback and timers
  clearInterval(questionTimer);
  if (player && player.pauseVideo) {
    player.pauseVideo();
  }

  guessInput.disabled = true;
  document.getElementById('submitGuessBtn').disabled = true;

  const q = questions[currentQuestionIdx];

  try {
    const res = await fetch('/api/quiz/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        song_id: q.id,
        guess: guess
      })
    });

    if (!res.ok) throw new Error('Answer check failed');
    const result = await res.json();

    if (result.correct) {
      playCorrectSound();
      
      // Calculate score based on speed
      const elapsed = player.getCurrentTime() - q.start_time;
      const timeLeft = Math.max(0, q.duration - elapsed);
      const points = Math.max(10, Math.round(timeLeft * 10)) + (streak * 10);
      score += points;
      
      streak++;
      if (streak > maxStreak) maxStreak = streak;

      revealAnswer(true, '正解！', result.official_title);
    } else {
      playErrorSound();
      triggerShakeAnimation();
      
      lives--;
      streak = 0;

      revealAnswer(false, '不正解...', result.official_title);
    }

    updateStatsUI();

    if (lives <= 0) {
      setTimeout(endQuiz, 2500);
    } else {
      promptNextQuestion();
    }

  } catch (err) {
    console.error(err);
    document.getElementById('feedbackText').textContent = 'エラーが発生しました。';
  }
}

// Reveal Answer feedback
function revealAnswer(correct, message, officialTitle = '') {
  const textEl = document.getElementById('feedbackText');
  const iconEl = document.getElementById('feedbackIcon');
  const revealEl = document.getElementById('titleReveal');

  textEl.textContent = message;
  textEl.className = 'feedback-text ' + (correct ? 'correct-feedback' : 'incorrect-feedback');
  iconEl.textContent = correct ? '✅' : '❌';
  if (officialTitle) {
    revealEl.textContent = `正解は:「${officialTitle}」でした！`;
  }
}

// Provide dynamic hint based on youtube_id
function displayHint() {
  const q = questions[currentQuestionIdx];
  if (q && isPlayerReadyForQuestion(currentQuestionIdx)) {
    playPreparedQuestionSync();
  } else if (q) {
    loadYouTubeForQuestion(q, true, currentQuestionIdx);
  }

  const hintsMap = {
    'j_rM7SpA-Gg': 'ヒント：アーティストは「米津玄師」です。',
    'vd3IlOjSUGQ': 'ヒント：アーティストは「YOASOBI」です。',
    '0xSiBpUdW4E': 'ヒント：アーティストは「あいみょん」です。',
    'by4SYYWlhEs': 'ヒント：アーティストは「YOASOBI」です。',
    'TQ8WlA2GXbk': 'ヒント：アーティストは「Official髭男dism」です。',
    'ony53KuCwMc': 'ヒント：アーティストは「King Gnu」です。'
  };

  const hint = hintsMap[q.youtube_id] || 'ヒント：有名なJ-Popの楽曲です。';
  document.getElementById('hintText').textContent = hint;
}

// Updates statistics UI
function updateStatsUI() {
  document.getElementById('currentQuestionNum').textContent = `${Math.min(currentQuestionIdx + 1, 5)} / 5`;
  document.getElementById('currentScore').textContent = score;
  document.getElementById('currentStreak').textContent = streak;

  let livesStr = '';
  for (let i = 0; i < 3; i++) {
    livesStr += i < lives ? '❤️ ' : '🖤 ';
  }
  document.getElementById('lifeCount').textContent = livesStr;
}

// Pause/Resume Quiz
function pauseQuiz() {
  isPaused = true;
  document.getElementById('pause-overlay').style.display = 'flex';
  document.getElementById('listeningCover').classList.add('is-paused');
  if (player && player.pauseVideo) player.pauseVideo();
}

function resumeQuiz() {
  isPaused = false;
  document.getElementById('pause-overlay').style.display = 'none';
  document.getElementById('listeningCover').classList.remove('is-paused');
  if (player && player.playVideo) player.playVideo();
}

// End Quiz Game
function endQuiz() {
  gameActive = false;
  clearInterval(questionTimer);
  if (player && player.pauseVideo) player.pauseVideo();

  document.getElementById('game-area').classList.remove('is-playing');
  document.getElementById('result-overlay').style.display = 'flex';

  // Stats calculation
  const totalQuestionsPlayed = Math.min(currentQuestionIdx, 5);
  const correctCount = totalQuestionsPlayed - (3 - Math.max(lives, 0));
  const accuracy = totalQuestionsPlayed > 0 ? (correctCount / totalQuestionsPlayed) * 100 : 0;

  document.getElementById('resScore').textContent = score;
  document.getElementById('resAccuracy').textContent = `${accuracy.toFixed(0)}%`;
  document.getElementById('resCorrect').textContent = `${correctCount} / 5`;
  document.getElementById('resStreak').textContent = maxStreak;
  document.getElementById('scoreMsg').textContent = '';

  playQuizCompleteSound();
}

// Submit Quiz Score
async function submitQuizScore(event) {
  event.preventDefault();
  const usernameInput = document.getElementById('usernameInput');
  const submitBtn = document.getElementById('submitScoreBtn');
  const messageEl = document.getElementById('scoreMsg');

  const username = usernameInput.value.trim();
  if (!username) {
    messageEl.textContent = 'ユーザー名を入力してください';
    messageEl.className = 'score-msg error-msg';
    return;
  }

  submitBtn.disabled = true;
  messageEl.textContent = '送信中...';
  messageEl.className = 'score-msg';

  try {
    const res = await fetch('/api/quiz/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: username,
        score: score
      })
    });

    if (!res.ok) throw new Error('Failed to submit score');
    messageEl.textContent = 'ハイスコアを登録しました！';
    messageEl.className = 'score-msg success-msg';
    
    // Refresh Leaderboard
    fetchLeaderboard();
    
    // Clear input
    usernameInput.value = '';
  } catch (err) {
    messageEl.textContent = 'スコア登録に失敗しました。';
    messageEl.className = 'score-msg error-msg';
  } finally {
    submitBtn.disabled = false;
  }
}

// Shake animation on typos/errors
function triggerShakeAnimation() {
  const container = document.getElementById('input-board');
  if (!container) return;
  container.classList.add('shake');
  setTimeout(() => {
    container.classList.remove('shake');
  }, 250);
}

function handleQuizStart() {
  initAudio();
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  startQuiz();

  const q = questions[currentQuestionIdx];
  if (!q) return;

  if (isPlayerReadyForQuestion(0)) {
    playPreparedQuestionSync();
  } else {
    loadYouTubeForQuestion(q, true, 0);
  }
}

// App Startup initialization
window.addEventListener('DOMContentLoaded', () => {
  fetchLeaderboard();
  fetchQuestions();

  // Attach Handlers
  document.getElementById('startBtn').addEventListener('click', handleQuizStart);
  document.getElementById('restartBtn').addEventListener('click', handleQuizStart);

  document.getElementById('resumeBtn').addEventListener('click', () => {
    resumeQuiz();
  });

  document.getElementById('guessForm').addEventListener('submit', checkUserGuess);
  document.getElementById('scoreForm').addEventListener('submit', submitQuizScore);
  document.getElementById('hintBtn').addEventListener('click', displayHint);
  document.getElementById('nextQuestionBtn').addEventListener('click', handleNextQuestion);
});

window.onYouTubeIframeAPIReady = function() {
  ytApiReady = true;
  updateStartButtonState();
  preloadFirstQuestion();
};
