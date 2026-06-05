// Typing Game Engine - typing.js

let player = null;
let songs = [];
let selectedSong = null;
let lyrics = [];
let gameActive = false;
let isPaused = false;
let activeIndex = -1;

// Typing Stats
let correctKeysCount = 0;
let incorrectKeysCount = 0;
let totalKeysPressed = 0;
let comboCount = 0;
let maxCombo = 0;
let typedIndex = 0;
let currentLineText = '';
let currentLineKanji = '';
let startTime = null;
let timerInterval = null;
let elapsedSeconds = 0;

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
  osc.frequency.setValueAtTime(800, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.05);
  
  gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
  
  osc.start();
  osc.stop(audioCtx.currentTime + 0.05);
}

function playErrorSound() {
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(130, audioCtx.currentTime);
  osc.frequency.linearRampToValueAtTime(95, audioCtx.currentTime + 0.12);
  
  gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
  
  osc.start();
  osc.stop(audioCtx.currentTime + 0.12);
}

function playLineCompleteSound() {
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  
  const now = audioCtx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
  notes.forEach((freq, index) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + index * 0.06);
    
    gain.gain.setValueAtTime(0.08, now + index * 0.06);
    gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.06 + 0.15);
    
    osc.start(now + index * 0.06);
    osc.stop(now + index * 0.06 + 0.15);
  });
}

// Fetch available songs from backend
async function fetchSongs() {
  try {
    const response = await fetch('/api/songs');
    if (!response.ok) throw new Error('Failed to fetch songs');
    songs = await response.json();
    renderSongSelector();
    // Default select Lemon
    if (songs.length > 0) {
      const lemon = songs.find(s => s.title.toLowerCase() === 'lemon') || songs[0];
      selectSong(lemon.id);
    }
  } catch (error) {
    console.error('Error fetching songs:', error);
  }
}

// Render Song selector UI
function renderSongSelector() {
  const selectEl = document.getElementById('songSelect');
  if (!selectEl) return;
  selectEl.innerHTML = '';
  songs.forEach(song => {
    const option = document.createElement('option');
    option.value = song.id;
    option.textContent = song.title;
    selectEl.appendChild(option);
  });
}

// Select a song, fetch lyrics and leaderboard
async function selectSong(songId) {
  selectedSong = songs.find(s => s.id == songId);
  if (!selectedSong) return;

  // Load metadata based on title
  const titleEl = document.getElementById('videoTitle');
  const channelEl = document.getElementById('channelName');
  const uploadDateEl = document.getElementById('uploadDate');
  const tagsEl = document.getElementById('videoTags');

  if (selectedSong.title.toLowerCase() === 'lemon') {
    if (titleEl) titleEl.textContent = 'Lemon';
    if (channelEl) channelEl.textContent = '米津玄師 Kenshi Yonezu';
    if (uploadDateEl) uploadDateEl.textContent = '2018/02/27';
    if (tagsEl) {
      tagsEl.innerHTML = `
        <span class="tag">J-POP</span>
        <span class="tag">米津玄師</span>
        <span class="tag">主題歌</span>
      `;
    }
    const imgEl = document.querySelector('.jacket-img');
    if (imgEl) imgEl.src = 'lemon_cover.png';
  } else {
    // Default generic metadata for other songs
    if (titleEl) titleEl.textContent = selectedSong.title;
    if (channelEl) channelEl.textContent = 'Official Artist';
    if (uploadDateEl) uploadDateEl.textContent = '----/--/--';
    if (tagsEl) {
      tagsEl.innerHTML = `
        <span class="tag">J-POP</span>
        <span class="tag">タイピング</span>
      `;
    }
    const imgEl = document.querySelector('.jacket-img');
    if (imgEl) imgEl.src = '';
  }

  // Load Max WPM
  const bestWpm = localStorage.getItem('best_wpm_' + selectedSong.id) || '0';
  document.getElementById('maxWpm').textContent = bestWpm;

  // Load YouTube Player
  loadYouTubeVideo(selectedSong.youtube_id);

  // Fetch lyrics
  try {
    const res = await fetch(`/api/songs/${songId}/lyrics`);
    if (!res.ok) throw new Error('Failed to fetch lyrics');
    const data = await res.json();
    lyrics = data.map(item => {
      const parts = item.lyric_text.split('|');
      return {
        time: item.display_time,
        kanji: parts[0] || '',
        romaji: parts[1] || ''
      };
    });
    // Set initial lyrics view before starting
    activeIndex = -1;
    setupNewLine();
  } catch (err) {
    console.error('Lyrics fetch error:', err);
  }

  // Fetch leaderboard
  fetchLeaderboard(songId);
}

// Load Leaderboard
async function fetchLeaderboard(songId) {
  try {
    const res = await fetch(`/api/songs/${songId}/scores`);
    if (!res.ok) throw new Error('Failed to fetch scores');
    const scores = await res.json();
    const listEl = document.getElementById('leaderboardList');
    if (!listEl) return;
    listEl.innerHTML = '';
    // Show top 5
    const topScores = scores.slice(0, 5);
    if (topScores.length === 0) {
      listEl.innerHTML = '<li class="no-scores">ランキングデータなし</li>';
    } else {
      topScores.forEach((entry, idx) => {
        const li = document.createElement('li');
        li.innerHTML = `
          <span class="rank">${idx + 1}</span>
          <span class="player">${escapeHTML(entry.username)}</span>
          <span class="score-val">${entry.score} pts</span>
          <span class="acc-val">${entry.accuracy.toFixed(1)}%</span>
        `;
        listEl.appendChild(li);
      });
    }
  } catch (err) {
    console.error('Error fetching leaderboard:', err);
  }
}

// Escapes html strings to prevent XSS
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

// YouTube Player controls
function loadYouTubeVideo(videoId) {
  const container = document.getElementById('player-wrapper');
  container.innerHTML = '<div id="youtube-player"></div>';
  
  player = new YT.Player('youtube-player', {
    height: '100%',
    width: '100%',
    videoId: videoId,
    playerVars: {
      autoplay: 0,
      controls: 1,
      rel: 0,
      showinfo: 0,
      modestbranding: 1
    },
    events: {
      onStateChange: onPlayerStateChange
    }
  });
}

function onPlayerStateChange(event) {
  if (event.data === YT.PlayerState.PLAYING) {
    initAudio();
    if (!gameActive) {
      startGame();
    } else if (isPaused) {
      resumeGame();
    }
  } else if (event.data === YT.PlayerState.PAUSED) {
    if (gameActive && !isPaused) {
      pauseGame();
    }
  } else if (event.data === YT.PlayerState.ENDED) {
    if (gameActive) {
      endGame();
    }
  }
}

// Start Game
function startGame() {
  gameActive = true;
  isPaused = false;
  correctKeysCount = 0;
  incorrectKeysCount = 0;
  totalKeysPressed = 0;
  comboCount = 0;
  maxCombo = 0;
  typedIndex = 0;
  activeIndex = -1;
  elapsedSeconds = 0;
  startTime = Date.now();

  document.getElementById('start-overlay').style.display = 'none';
  document.getElementById('result-overlay').style.display = 'none';
  document.getElementById('pause-overlay').style.display = 'none';
  document.getElementById('game-area').classList.add('is-playing');

  // Start timer interval
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (!isPaused) {
      elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
      updateStatsUI();
    }
  }, 1000);

  // Focus game
  window.focus();

  // Play audio video
  if (player && player.getPlayerState() !== YT.PlayerState.PLAYING) {
    player.playVideo();
  }

  // Animation sync loop
  requestAnimationFrame(gameLoop);
}

// Helper to format time (mm:ss)
function formatTime(secs) {
  if (isNaN(secs) || secs < 0) return '00:00';
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = Math.floor(secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// Game Loop for time synchronization
function gameLoop() {
  if (!gameActive || isPaused) return;

  if (player && player.getCurrentTime) {
    const currentTime = player.getCurrentTime();
    const duration = player.getDuration ? player.getDuration() : 0;
    
    // Update play time text in Video Info Card
    const durationEl = document.getElementById('videoDuration');
    if (durationEl) {
      durationEl.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
    }

    // Find active lyric index
    let newActiveIdx = -1;
    for (let i = 0; i < lyrics.length; i++) {
      if (lyrics[i].time <= currentTime) {
        newActiveIdx = i;
      } else {
        break;
      }
    }

    if (newActiveIdx !== activeIndex) {
      activeIndex = newActiveIdx;
      setupNewLine();
    }

    // Update progress bar
    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
    const progressFill = document.getElementById('progressFill');
    if (progressFill) progressFill.style.width = `${progress}%`;
  }

  requestAnimationFrame(gameLoop);
}

// Setup a new active lyric line
function setupNewLine() {
  typedIndex = 0;
  if (activeIndex >= 0 && activeIndex < lyrics.length) {
    const activeLyric = lyrics[activeIndex];
    currentLineText = activeLyric.romaji;
    currentLineKanji = activeLyric.kanji;
  } else {
    currentLineText = '';
    currentLineKanji = '';
  }

  // Auto skip spaces at start
  while (typedIndex < currentLineText.length && currentLineText[typedIndex] === ' ') {
    typedIndex++;
  }

  renderLyricsUI();
}

// Render active, next, and next-next lyrics
function renderLyricsUI() {
  const currentJaEl = document.getElementById('currentJa');
  const currentRomaEl = document.getElementById('currentRoma');
  const nextJaEl = document.getElementById('nextJa');
  const nextRomaEl = document.getElementById('nextRoma');
  const nextNextJaEl = document.getElementById('nextNextJa');
  const nextNextRomaEl = document.getElementById('nextNextRoma');

  // Current Line
  if (currentJaEl) {
    currentJaEl.textContent = currentLineKanji || '...';
  }

  if (currentRomaEl) {
    currentRomaEl.innerHTML = '';
    if (!currentLineText) {
      currentRomaEl.innerHTML = '<span class="prompt-text">間奏中（タイピング待機）</span>';
    } else {
      for (let i = 0; i < currentLineText.length; i++) {
        const char = currentLineText[i];
        const span = document.createElement('span');
        
        if (char === ' ') {
          span.innerHTML = '&nbsp;';
          span.className = 'char char--space';
        } else {
          span.textContent = char;
          span.className = 'char';
        }

        if (i < typedIndex) {
          span.classList.add('char--typed');
        } else if (i === typedIndex) {
          span.classList.add('char--active');
        } else {
          span.classList.add('char--remaining');
        }
        
        currentRomaEl.appendChild(span);
      }
    }
  }

  // Next Line (activeIndex + 1)
  const nextIdx = activeIndex + 1;
  if (nextJaEl && nextRomaEl) {
    if (nextIdx >= 0 && nextIdx < lyrics.length) {
      nextJaEl.textContent = lyrics[nextIdx].kanji;
      nextRomaEl.textContent = lyrics[nextIdx].romaji;
    } else {
      nextJaEl.textContent = '...';
      nextRomaEl.textContent = '';
    }
  }

  // Next-Next Line (activeIndex + 2)
  const nextNextIdx = activeIndex + 2;
  if (nextNextJaEl && nextNextRomaEl) {
    if (nextNextIdx >= 0 && nextNextIdx < lyrics.length) {
      nextNextJaEl.textContent = lyrics[nextNextIdx].kanji;
      nextNextRomaEl.textContent = lyrics[nextNextIdx].romaji;
    } else {
      nextNextJaEl.textContent = '';
      nextNextRomaEl.textContent = '';
    }
  }
}

// Updates typing statistics UI
function updateStatsUI() {
  const wpm = elapsedSeconds > 0 ? Math.round((correctKeysCount / 5) / (elapsedSeconds / 60)) : 0;
  const accuracy = totalKeysPressed > 0 ? Math.round((correctKeysCount / totalKeysPressed) * 100) : 100;

  // Max WPM calculation and persistent storage
  let bestWpm = parseInt(localStorage.getItem('best_wpm_' + selectedSong.id) || '0');
  if (wpm > bestWpm && elapsedSeconds > 5) {
    bestWpm = wpm;
    localStorage.setItem('best_wpm_' + selectedSong.id, bestWpm.toString());
  }

  document.getElementById('currentWpm').textContent = wpm;
  document.getElementById('maxWpm').textContent = bestWpm;
  document.getElementById('currentAccuracy').textContent = `${accuracy}%`;
  document.getElementById('mistakeCount').textContent = incorrectKeysCount;
}

// Pause Game
function pauseGame() {
  isPaused = true;
  document.getElementById('pause-overlay').style.display = 'flex';
  if (player && player.getPlayerState() === YT.PlayerState.PLAYING) {
    player.pauseVideo();
  }
}

// Resume Game
function resumeGame() {
  isPaused = false;
  startTime = Date.now() - (elapsedSeconds * 1000);
  document.getElementById('pause-overlay').style.display = 'none';
  if (player && player.getPlayerState() !== YT.PlayerState.PLAYING) {
    player.playVideo();
  }
  requestAnimationFrame(gameLoop);
}

// End Game
function endGame() {
  gameActive = false;
  if (timerInterval) clearInterval(timerInterval);
  
  const accuracy = totalKeysPressed > 0 ? (correctKeysCount / totalKeysPressed) * 100 : 100;
  const wpm = elapsedSeconds > 0 ? Math.round((correctKeysCount / 5) / (elapsedSeconds / 60)) : 0;
  const finalScore = correctKeysCount * 10 + maxCombo * 5;

  document.getElementById('game-area').classList.remove('is-playing');
  document.getElementById('result-overlay').style.display = 'flex';

  // Populate results modal
  document.getElementById('resScore').textContent = finalScore;
  document.getElementById('resAccuracy').textContent = `${accuracy.toFixed(1)}%`;
  document.getElementById('resWPM').textContent = wpm;
  document.getElementById('resCombo').textContent = maxCombo;
  document.getElementById('scoreMsg').textContent = '';

  playLineCompleteSound();
}

// Submit Score Event
async function submitPlayerScore(event) {
  event.preventDefault();
  const usernameInput = document.getElementById('usernameInput');
  const submitBtn = document.getElementById('submitScoreBtn');
  const messageEl = document.getElementById('scoreMsg');

  const username = usernameInput.value.trim();
  if (!username) {
    messageEl.textContent = 'ユーザー名を入力してください';
    messageEl.className = 'error-msg';
    return;
  }

  const accuracy = totalKeysPressed > 0 ? (correctKeysCount / totalKeysPressed) * 100 : 100;
  const wpm = elapsedSeconds > 0 ? Math.round((correctKeysCount / 5) / (elapsedSeconds / 60)) : 0;
  const finalScore = correctKeysCount * 10 + maxCombo * 5;

  submitBtn.disabled = true;
  messageEl.textContent = '送信中...';
  messageEl.className = '';

  try {
    const res = await fetch(`/api/songs/${selectedSong.id}/scores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: username,
        wpm: wpm,
        accuracy: accuracy,
        score: finalScore
      })
    });

    if (!res.ok) throw new Error('Score submission failed');
    messageEl.textContent = 'スコアを登録しました！';
    messageEl.className = 'success-msg';
    
    // Refresh Leaderboard
    fetchLeaderboard(selectedSong.id);
    
    // Clear input
    usernameInput.value = '';
  } catch (err) {
    messageEl.textContent = '登録に失敗しました。サーバーの状態を確認してください。';
    messageEl.className = 'error-msg';
  } finally {
    submitBtn.disabled = false;
  }
}

// Shake animation on typos
function triggerTypoAnimation() {
  const container = document.getElementById('typing-board');
  if (!container) return;
  container.classList.add('shake');
  setTimeout(() => {
    container.classList.remove('shake');
  }, 250);
}

// Register Keyboard events
window.addEventListener('keydown', (e) => {
  if (!gameActive || isPaused) return;

  // Ignore system keys
  if (e.key.length !== 1) return;
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  const typedChar = e.key.toLowerCase();
  let targetChar = currentLineText[typedIndex]?.toLowerCase();
  
  if (!targetChar) return;

  totalKeysPressed++;

  if (typedChar === targetChar) {
    typedIndex++;
    correctKeysCount++;
    comboCount++;
    if (comboCount > maxCombo) {
      maxCombo = comboCount;
    }

    playCorrectSound();

    // Auto skip remaining spaces
    while (typedIndex < currentLineText.length && currentLineText[typedIndex] === ' ') {
      typedIndex++;
    }

    // Line finished
    if (typedIndex >= currentLineText.length) {
      playLineCompleteSound();
    }

    renderLyricsUI();
    updateStatsUI();
  } else {
    incorrectKeysCount++;
    comboCount = 0;

    playErrorSound();
    triggerTypoAnimation();

    renderLyricsUI();
    updateStatsUI();
  }
});

// App Startup initialization
window.addEventListener('DOMContentLoaded', () => {
  fetchSongs();

  // Attach handlers
  document.getElementById('songSelect').addEventListener('change', (e) => {
    selectSong(e.target.value);
  });

  document.getElementById('startBtn').addEventListener('click', () => {
    initAudio();
    startGame();
  });

  document.getElementById('resumeBtn').addEventListener('click', () => {
    resumeGame();
  });

  document.getElementById('restartBtn').addEventListener('click', () => {
    initAudio();
    startGame();
  });

  document.getElementById('scoreForm').addEventListener('submit', submitPlayerScore);
});
