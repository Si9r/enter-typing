const typingInput = document.getElementById("typing-input");
const wpmDisplay = document.getElementById("wpm");
const accuracyDisplay = document.getElementById("accuracy");
const timeDisplay = document.getElementById("time");
const typosDisplay = document.getElementById("typos"); // Added for the new UI
const scoreDisplay = document.getElementById("score"); // Added for score display
const stageIndicator = document.getElementById("stageIndicator");
const kanjiDisplay = document.getElementById("kanjiDisplay");
const lyricDisplay = document.getElementById("lyricDisplay");
const nextPreviewDisplay = document.getElementById("nextPreviewDisplay");
const statusPanel = document.getElementById("statusPanel");
const progressBar = document.getElementById("timerBarFill");

// URL 경로(/typing/{id}/play)에서 콘텐츠 id를 읽어옵니다.
const TYPING_CONTENT_ID = (() => {
  const match = window.location.pathname.match(/^\/typing\/(\d+)\/play\/?$/);
  return match ? match[1] : "1";
})();

let timeLeft = 60;

function escapeHTML(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
let timer = null;
let isPlaying = false;
let currentText = "";
let currentChars = [];
let currentIndex = 0;
let syncTimer = null;
let currentLineElapsed = 0;
let gameTimeElapsed = 0;
let isYoutubeMode = false;
let isWaitingPhase = false;
let typoDetails = [];
let allTargetUnits = [];
let keyTypoCollector = null;

// Variables for new score logic
let totalTypedChars = 0;
let totalCorrectChars = 0;
let totalTargetCorrectChars = 0;
let totalRemainingTime = 0;
let totalTimeSum = 0;
let contentDifficulty = 3;
let currentSectionDuration = 0;
let sectionTypos = 0;
let savedSectionRemaining = 0;

let youtubePlayer = null;
let currentYoutubeId = null;
let isPlayerReady = false;
let lineCompleted = false;

// Variables for countdown overlay
let isCountingDown = false;
let isResumeAuthorized = false;
let isWaitingForResume = false;
let countdownInterval = null;
let playCountIncremented = false; // 세션 내 중복 카운트 방지

/**
 * YouTube 플레이어를 초기화하는 함수입니다.
 * 지정된 currentYoutubeId를 사용하여 YouTube IFrame API 플레이어 객체를 생성합니다.
 */
function initYoutubePlayer() {
  if (!currentYoutubeId) return;

  if (youtubePlayer) {
    youtubePlayer.loadVideoById(currentYoutubeId);
    youtubePlayer.pauseVideo();
    return;
  }

  const placeholder = document.getElementById("video-placeholder");
  const container = document.getElementById("youtube-player-container");
  if (placeholder) placeholder.style.display = "none";
  if (container) container.style.display = "block";

  YouTubeManager.createPlayer("youtube-player", {
    videoId: currentYoutubeId,
    playerVars: {
      playsinline: 1,
      controls: 0,
      disablekb: 1,
      fs: 0,
      rel: 0,
    },
    events: {
      onReady: function (event) {
        youtubePlayer = event.target;
        isPlayerReady = true;
        const volSlider = document.getElementById("volume-slider");
        if (volSlider && typeof youtubePlayer.setVolume === "function") {
          youtubePlayer.setVolume(volSlider.value);
        }
      },
      onStateChange: function (event) {
        if (event.data == YT.PlayerState.PLAYING) {
          if (!isPlaying) {
            startGame(true);
          } else {
            if (isWaitingForResume && !isResumeAuthorized) {
              youtubePlayer.pauseVideo();
              if (!isCountingDown) {
                startCountdownAndPlay();
              }
            } else {
              isWaitingForResume = false;
              isResumeAuthorized = false;
              resumeTimer();
            }
          }
        } else if (
          event.data == YT.PlayerState.PAUSED ||
          event.data == YT.PlayerState.BUFFERING
        ) {
          pauseTimer();
          if (event.data == YT.PlayerState.PAUSED) {
            isWaitingForResume = true;
          }
        } else if (event.data == YT.PlayerState.ENDED && isPlaying) {
          endGame(false);
        }
      },
    },
  });
}


let hiraColorThresholds = [];
let targetUnits = [];
let currentUnitIndex = 0;
let currentBuffer = "";
let currentLineText = "";

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
  const smallKana = ["ゃ", "ゅ", "ょ", "ぁ", "ぃ", "ぅ", "ぇ", "ぉ", "ゎ"];

  // 로마자 음절의 끝을 찾기 위한 모음
  const vowels = ["a", "i", "u", "e", "o"];

  while (hIdx < hiragana.length && rIdx < romaji.length) {
    let hChar = hiragana[hIdx];

    // 현재 히라가나 음절이 차지하는 길이
    let rLen = 1; // 대응되는 로마자 길이
    let hLen = 1; // 대응되는 히라가나 길이

    if (hChar === "っ") {
      // 촉음(っ)은 자음 하나 추가(tt) 이거나 명시적 분리입력(xtsu)
      let sokuons = ["xtsu", "ltsu", "xtu", "ltu"];
      rLen = 1;
      for (let sq of sokuons) {
        if (romaji.startsWith(sq, rIdx)) {
          rLen = sq.length;
          break;
        }
      }
    } else if (hChar === "ん") {
      // "ん"은 n 또는 nn, xn, ln으로 입력 가능
      if (
        romaji.startsWith("xn", rIdx) ||
        romaji.startsWith("ln", rIdx) ||
        romaji.startsWith("nn", rIdx)
      ) {
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
          if (
            contentHiraganaLines[i].includes("じぇ") &&
            contentRomajiLines[i].includes("jie")
          ) {
            contentRomajiLines[i] = contentRomajiLines[i].replace(/jie/g, "je");
          }
          if (
            contentHiraganaLines[i].includes("しぇ") &&
            contentRomajiLines[i].includes("shie")
          ) {
            contentRomajiLines[i] = contentRomajiLines[i].replace(
              /shie/g,
              "she",
            );
          }
          if (
            contentHiraganaLines[i].includes("ちぇ") &&
            contentRomajiLines[i].includes("chie")
          ) {
            contentRomajiLines[i] = contentRomajiLines[i].replace(
              /chie/g,
              "che",
            );
          }
        }
      }
      if (data.timestamps) {
        contentTimestamps = data.timestamps
          .split("\n")
          .map((t) => parseFloat(t.trim()))
          .filter((t) => !isNaN(t));
      } else {
        contentTimestamps = [];
      }
      contentDifficulty = data.difficulty !== undefined ? data.difficulty : 3;
      currentYoutubeId = data.youtube_id;
      currentLineIndex = 0;
      if (currentYoutubeId && contentTimestamps.length > 0 && contentTimestamps[0] > 0) {
        isWaitingPhase = true;
        renderWaitingPhase();
      } else {
        isWaitingPhase = false;
        renderLines();
      }

      // Update Video Info Panel
      const infoTitle = document.getElementById("info-title");
      const infoArtist = document.getElementById("info-artist");
      const infoCreator = document.getElementById("info-creator");
      const infoThumbnail = document.getElementById("info-thumbnail");
      const infoAvatarPlaceholder = document.getElementById("info-avatar-placeholder");
      const infoViews = document.getElementById("info-views");
      const infoTags = document.getElementById("info-tags");

      if (infoTitle) infoTitle.innerText = data.title || "제목 없음";
      if (infoArtist) infoArtist.innerText = data.artist || "아티스트 미상";
      if (infoViews) infoViews.innerText = data.play_count || "0";
      
      if (infoTags) {
          infoTags.innerHTML = "";
          if (data.genre) {
              const genres = data.genre.split(',').map(g => g.trim());
              genres.forEach(g => {
                  const tagSpan = document.createElement("span");
                  tagSpan.style.cssText = "background: #f0f0f0; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: bold; color: #555; border: 1px solid #ddd;";
                  tagSpan.innerText = g;
                  infoTags.appendChild(tagSpan);
              });
          } else {
              infoTags.innerHTML = '<span style="background: #f0f0f0; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: bold; color: #555; border: 1px solid #ddd;">태그 없음</span>';
          }
      }

      if (currentYoutubeId) {
          if (infoThumbnail) {
              infoThumbnail.src = `https://img.youtube.com/vi/${currentYoutubeId}/mqdefault.jpg`;
              infoThumbnail.style.display = "block";
          }
          if (infoAvatarPlaceholder) infoAvatarPlaceholder.style.display = "none";
          
          if (infoCreator) infoCreator.innerText = "로딩 중...";
          fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${currentYoutubeId}&format=json`)
            .then(res => res.json())
            .then(oEmbedData => {
                if (infoCreator && oEmbedData.author_name) {
                    infoCreator.innerText = oEmbedData.author_name;
                } else if (infoCreator) {
                    infoCreator.innerText = data.creator_nickname || "엔터핑";
                }
            })
            .catch(err => {
                if (infoCreator) infoCreator.innerText = data.creator_nickname || "엔터핑";
            });
      } else {
          if (infoCreator) infoCreator.innerText = data.creator_nickname || "엔터핑";
          if (infoThumbnail) infoThumbnail.style.display = "none";
          if (infoAvatarPlaceholder) infoAvatarPlaceholder.style.display = "flex";
      }

      if (currentYoutubeId) {
        initYoutubePlayer();
        const controls = document.getElementById("video-controls");
        if (controls) controls.style.display = "none";
      } else {
        const placeholder = document.getElementById("video-placeholder");
        const container = document.getElementById("youtube-player-container");
        const controls = document.getElementById("video-controls");
        if (placeholder) placeholder.style.display = "block";
        if (container) container.style.display = "none";
        if (controls) controls.style.display = "block";
        if (statusPanel) {
          statusPanel.innerHTML = '<span style="color: #c92a2a; font-weight: bold;">타이핑 영역을 클릭하면 게임이 시작됩니다!</span>';
        }
      }
    } else {
      console.error("Failed to load content.");
      if (statusPanel)
        statusPanel.innerText = "콘텐츠를 불러오는 데 실패했습니다.";
    }
  } catch (error) {
    console.error(error);
    if (statusPanel) statusPanel.innerText = "서버 에러가 발생했습니다.";
  }
}

function renderWaitingPhase() {
  if (stageIndicator) {
    stageIndicator.innerText = `STAGE ${currentLineIndex + 1} / ${contentLines.length}`;
  }
  if (kanjiDisplay) {
    kanjiDisplay.innerText = "준비 중...";
  }
  if (nextPreviewDisplay) {
    nextPreviewDisplay.innerHTML = `<span class='prefix'>Next</span> -`;
  }
  if (lyricDisplay) {
    lyricDisplay.innerHTML = "<span class='lyric-unit pending'><span class='hira-text'>-</span><span class='roma-text'><span>-</span></span></span>";
  }
  if (typingInput) {
    typingInput.value = "";
    typingInput.disabled = true;
  }
  if (statusPanel) {
    statusPanel.innerHTML = '<span style="color: #666;">전주 재생 중... 곧 가사가 시작됩니다.</span>';
  }
  targetUnits = [];
  currentBuffer = "";
  currentText = "";
  currentChars = [];
}

/**
 * 현재 입력해야 할 가사와 앞으로 나올 가사들을 화면에 렌더링하는 함수입니다.
 * 가사(한자), 히라가나(읽기), 로마자(입력용)를 DOM 요소로 만들어 화면에 표시합니다.
 */
function renderLines() {
  if (contentLines.length === 0) return;

  if (
    currentLineIndex >= contentLines.length ||
    currentLineIndex >= contentHiraganaLines.length
  ) {
    endGame(true);
    return;
  }

  const currentKanji = contentLines[currentLineIndex] || "";
  if (currentKanji === "[END]") {
      endGame(true);
      return;
  }
  const currentHiragana = contentHiraganaLines[currentLineIndex] || "";
  const nextKanji = contentLines[currentLineIndex + 1] || "-";

  if (stageIndicator) {
    stageIndicator.innerText = `STAGE ${currentLineIndex + 1} / ${contentLines.length}`;
  }
  if (kanjiDisplay) {
    kanjiDisplay.innerText = currentKanji;
  }
  if (nextPreviewDisplay) {
    nextPreviewDisplay.innerHTML = `<span class='prefix'>Next</span> ${nextKanji}`;
  }

  targetUnits = parseKanaToTargetUnits(currentHiragana);
  allTargetUnits[currentLineIndex] = targetUnits;
  currentUnitIndex = 0;
  currentBuffer = "";
  currentLineText = targetUnits
    .map((unit) => unit.validInputs[0] || unit.text)
    .join("");
  currentText = currentLineText;
  currentChars = currentText.split("");
  buildMapping();

  lineCompleted = false;
  if (isPlaying && typingInput) typingInput.disabled = false;

  TypingEngine.renderActiveLyrics(lyricDisplay, targetUnits);

  typingInput.value = "";
  currentIndex = 0;
  correctChars = 0;
  sectionTypos = 0;
  if (progressBar) progressBar.style.width = "0%";

  updateStatus();
  highlightCurrentChar();
  if (typingInput) typingInput.focus({ preventScroll: true });
}

/**
 * 한 줄의 가사를 모두 올바르게 입력했을 때 호출되는 처리 함수입니다.
 * 입력한 글자 수를 통계에 누적하고, 입력창을 비활성화하며 대기 상태를 표시합니다.
 */
function handleLineCompletion() {
  if (lineCompleted) return;
  lineCompleted = true;

  let elapsed = currentLineElapsed;
  if (elapsed < 0) elapsed = 0;
  savedSectionRemaining = Math.max(0, currentSectionDuration - elapsed);

  sessionCorrectChars += correctChars;
  sessionTotalChars += currentChars.length;
  updateStats();
  if (typingInput) typingInput.disabled = true;
  if (statusPanel) {
    statusPanel.innerHTML =
      '<span class="success-text"> 문장을 모두 입력했습니다. 다음 문장까지 기다리는 중...</span>';
  }
}

/**
 * 타이핑 게임을 시작하는 함수입니다.
 * 남은 시간을 초기화하고, 입력창을 활성화하며, 타이머와 싱크 루프를 가동합니다.
 * @param {boolean} startedByYoutube - 유튜브 영상에 의해 자동으로 시작되었는지 여부
 */
function startGame(startedByYoutube = false) {
  if (isPlaying) return;
  if (contentLines.length === 0) return;

  // 플레이 수 카운트 (최초 1회만, 새로고침 시 초기화)
  if (!playCountIncremented) {
    playCountIncremented = true;
    fetch(`/api/typing-content/${TYPING_CONTENT_ID}/play`, { method: "POST" })
      .catch(err => console.warn("play_count 업데이트 실패:", err));
  }
  if (countdownInterval) clearInterval(countdownInterval);
  isCountingDown = false;
  const overlay = document.getElementById("countdown-overlay");
  if (overlay) overlay.style.display = "none";

  if (!startedByYoutube && youtubePlayer && isPlayerReady) {
    isResumeAuthorized = true;
    youtubePlayer.playVideo();
  }

  sessionCorrectChars = 0;
  sessionTotalChars = 0;
  totalTypos = 0;
  gameTimeElapsed = 0;
  totalTypedChars = 0;
  totalCorrectChars = 0;
  totalTargetCorrectChars = 0;
  totalRemainingTime = 0;
  totalTimeSum = 0;
  typoDetails = [];
  allTargetUnits = [];
  keyTypoCollector = TypingEngine.createKeyTypoCollector();
  keyTypoCollector.reset();
  if (scoreDisplay) scoreDisplay.innerText = 0;
  isYoutubeMode = !!(youtubePlayer && isPlayerReady && currentYoutubeId);

  if (isYoutubeMode && youtubePlayer.getDuration) {
    let dur = Math.round(youtubePlayer.getDuration());
    timeLeft = dur > 0 ? dur : 60;
  } else {
    timeLeft = 0; // 유튜브 모드가 아니면 0부터 시작해서 시간 증가 (무제한)
  }

  timeDisplay.innerText = timeLeft;
  wpmDisplay.innerText = 0;
  accuracyDisplay.innerText = "100%";
  if (typosDisplay) typosDisplay.innerText = 0;

  isPlaying = true;
  typingInput.disabled = false;
  typingInput.focus({ preventScroll: true });

  currentLineIndex = 0;
  if (isYoutubeMode && contentTimestamps.length > 0 && contentTimestamps[0] > 0) {
    isWaitingPhase = true;
    renderWaitingPhase();
  } else {
    isWaitingPhase = false;
    renderLines();
  }

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
    if (!lineCompleted && !isWaitingPhase) {
      gameTimeElapsed++;
    }
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
  if (typingInput) {
    typingInput.disabled = true;
  }
}

/**
 * 일시 정지된 게임 타이머와 진행 바 싱크 루프를 다시 재개하는 함수입니다.
 */
function resumeTimer() {
  if (isPlaying && timeLeft > 0) {
    startTimer();
    if (typingInput && !lineCompleted) {
      typingInput.disabled = false;
      typingInput.focus({ preventScroll: true });
    }
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
  if (countdownInterval) clearInterval(countdownInterval);
  isCountingDown = false;
  const overlay = document.getElementById("countdown-overlay");
  if (overlay) overlay.style.display = "none";
  isPlaying = false;
  if (typingInput) typingInput.disabled = true;

  if (youtubePlayer && isPlayerReady) {
    youtubePlayer.pauseVideo();
  }

  if (statusPanel) {
    statusPanel.innerHTML = '<span class="success-text"> 모든 타이핑이 종료되었습니다!</span>';
  }

  const resultModal = document.getElementById("resultModal");
  if (resultModal) {
    document.getElementById("final-score").innerText = scoreDisplay ? scoreDisplay.innerText : "0";
    document.getElementById("final-wpm").innerText = wpmDisplay ? wpmDisplay.innerText : "0";
    document.getElementById("final-accuracy").innerText = accuracyDisplay ? accuracyDisplay.innerText : "100%";
    document.getElementById("final-typos").innerText = typosDisplay ? typosDisplay.innerText : "0";
    
    const typoContainer = document.getElementById("typo-details-container");
    const typoList = document.getElementById("typo-list");
    if (typoContainer && typoList) {
      if (contentLines && contentLines.length > 0) {
        typoList.innerHTML = "";
        
        const groupedTypos = {};
        typoDetails.forEach(t => {
          if (!groupedTypos[t.lineIndex]) {
             groupedTypos[t.lineIndex] = [];
          }
          groupedTypos[t.lineIndex].push(t);
        });

        // 1. Calculate Top 5 Typos
        const typoCounts = {};
        typoDetails.forEach(t => {
            if (t.type === 'typing') {
                typoCounts[t.word] = (typoCounts[t.word] || 0) + 1;
            }
        });
        const topTypos = Object.entries(typoCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        const topTypoList = document.getElementById("top-typo-list");
        if (topTypoList) {
            topTypoList.innerHTML = "";
            if (topTypos.length === 0) {
                topTypoList.innerHTML = "<div style='text-align: center; color: #888; margin-top: 20px;'>오타가 없습니다! 완벽해요 </div>";
            } else {
                topTypos.forEach((item, idx) => {
                    const row = document.createElement("div");
                    row.style.display = "flex";
                    row.style.flexDirection = "row";
                    row.style.alignItems = "center";
                    row.style.padding = "6px 12px";
                    row.style.background = idx === 0 ? "#fff0f2" : "#fff";
                    row.style.border = "1px solid #eee";
                    row.style.borderRadius = "20px";
                    row.style.gap = "8px";

                    const rankSpan = document.createElement("span");
                    rankSpan.style.fontWeight = "bold";
                    rankSpan.style.color = idx < 3 ? "var(--color-pink)" : "#777";
                    rankSpan.style.fontSize = "0.85rem";
                    rankSpan.innerText = `${idx + 1}위`;

                    const wordSpan = document.createElement("span");
                    wordSpan.style.fontWeight = "bold";
                    wordSpan.style.fontSize = "1rem";
                    wordSpan.style.color = "#333";
                    wordSpan.innerText = `'${item[0]}'`;

                    const countSpan = document.createElement("span");
                    countSpan.style.fontWeight = "bold";
                    countSpan.style.color = "#e67700";
                    countSpan.style.fontSize = "0.9rem";
                    countSpan.innerText = `${item[1]}회`;

                    row.appendChild(rankSpan);
                    row.appendChild(wordSpan);
                    row.appendChild(countSpan);
                    topTypoList.appendChild(row);
                });
            }
        }

        let maxLinePlayed = currentLineIndex;
        if (maxLinePlayed >= contentLines.length) {
            maxLinePlayed = contentLines.length - 1;
        }

        for (let i = 0; i <= maxLinePlayed; i++) {
           const errors = groupedTypos[i] || [];
           const units = allTargetUnits[i] || [];
           const lineText = contentLines[i] || "알 수 없는 구간";
           
           const sectionDiv = document.createElement("div");
           sectionDiv.style.marginBottom = "10px";
           sectionDiv.style.border = "1px solid var(--theme-border)";
           sectionDiv.style.borderRadius = "6px";
           sectionDiv.style.overflow = "hidden";
           
           const sectionHeader = document.createElement("div");
           sectionHeader.style.padding = "10px 15px";
           sectionHeader.style.background = "var(--theme-bg-hover)";
           sectionHeader.style.cursor = "pointer";
           sectionHeader.style.display = "flex";
           sectionHeader.style.justifyContent = "space-between";
           sectionHeader.style.alignItems = "center";
           sectionHeader.style.fontWeight = "bold";
           sectionHeader.style.color = "var(--theme-text-main)";
           
           let coloredLineHtml = "";
           if (units.length > 0) {
               units.forEach((u, idx) => {
                   let hadTypo = errors.some(t => t.type === 'typing' && t.unitIndex === idx);
                   let wasTimeout = errors.some(t => t.type === 'timeout' && idx >= t.startUnitIndex);
                   
                   if (wasTimeout) {
                       coloredLineHtml += `<span style="color: #c92a2a; background: #fff5f5; padding: 2px; border-radius: 4px;">${escapeHTML(u.text)}</span>`;
                   } else if (hadTypo) {
                       coloredLineHtml += `<span style="color: #e67700; background: #fff4e6; padding: 2px; border-radius: 4px;">${escapeHTML(u.text)}</span>`;
                   } else {
                       coloredLineHtml += `<span style="color: var(--theme-text-sub);">${escapeHTML(u.text)}</span>`;
                   }
               });
           } else {
               coloredLineHtml = `<span>${escapeHTML(lineText)}</span>`;
           }

           let titleHtml = `<span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;">[구간 ${i + 1}] <span style="font-weight: normal; color: var(--theme-text-muted); margin-left: 10px;">${coloredLineHtml}</span></span>`;
           if (errors.length === 0) {
              titleHtml += `<span style="color: #2b8a3e; font-size: 0.85rem; margin-left: 15px; white-space: nowrap; flex-shrink: 0;">(완벽함! )</span>`;
           } else {
              let typingErrors = errors.filter(e => e.type === 'typing').length;
              let timeoutErrors = errors.filter(e => e.type === 'timeout').length;
              titleHtml += `<span style="color: #e67700; font-size: 0.85rem; margin-left: 15px; white-space: nowrap; flex-shrink: 0;">오타 ${typingErrors} / 시간초과 ${timeoutErrors}</span>`;
           }
           sectionHeader.innerHTML = `<div style="display: flex; align-items: center; width: 100%; overflow: hidden; justify-content: space-between;">${titleHtml}</div><span class="toggle-arrow" style="font-size: 0.8rem; color: var(--theme-text-muted); margin-left: 10px; flex-shrink: 0;">▼</span>`;

           const detailsDiv = document.createElement("div");
           detailsDiv.style.padding = "15px";
           detailsDiv.style.background = "var(--theme-bg-card)";
           detailsDiv.style.display = "none";

           sectionHeader.addEventListener("click", () => {
               const arrow = sectionHeader.querySelector(".toggle-arrow");
               if (detailsDiv.style.display === "none") {
                   detailsDiv.style.display = "block";
                   if (arrow) arrow.innerText = "▲";
               } else {
                   detailsDiv.style.display = "none";
                   if (arrow) arrow.innerText = "▼";
               }
           });

           sectionDiv.appendChild(sectionHeader);

           if (units.length > 0) {
               const visualTextContainer = document.createElement("div");
               visualTextContainer.style.fontSize = "1.2rem";
               visualTextContainer.style.fontWeight = "bold";
               visualTextContainer.style.marginBottom = "8px";
               visualTextContainer.style.lineHeight = "1.4";
               visualTextContainer.style.wordBreak = "keep-all";
               visualTextContainer.innerHTML = coloredLineHtml;
               detailsDiv.appendChild(visualTextContainer);
           } else {
               const visualTextContainer = document.createElement("div");
               visualTextContainer.style.fontSize = "1.1rem";
               visualTextContainer.style.fontWeight = "bold";
               visualTextContainer.style.marginBottom = "8px";
               visualTextContainer.innerText = lineText;
               detailsDiv.appendChild(visualTextContainer);
           }

           if (errors.length > 0) {
               const analysisLabel = document.createElement("div");
               analysisLabel.style.fontSize = "0.85rem";
               analysisLabel.style.fontWeight = "bold";
               analysisLabel.style.color = "var(--theme-text-muted)";
               analysisLabel.style.marginBottom = "4px";
               analysisLabel.innerText = "오타 상세 분석:";
               detailsDiv.appendChild(analysisLabel);

               const ul = document.createElement("ul");
               ul.style.margin = "0";
               ul.style.paddingLeft = "20px";
               ul.style.lineHeight = "1.6";
               ul.style.fontSize = "0.9rem";

               errors.forEach(t => {
                  const li = document.createElement("li");
                  li.style.marginBottom = "2px";
                  if (t.type === 'typing') {
                    li.innerHTML = `「${escapeHTML(t.word)}」 오타: <span style="color: #e67700; font-weight: bold;">'${escapeHTML(t.typed)}'</span> (정답: <strong>${escapeHTML(t.expected)}</strong>)`;
                  } else if (t.type === 'timeout') {
                    li.innerHTML = `<span style="color: #c92a2a; font-weight: bold;">[시간 초과]</span> 미입력: <strong>${escapeHTML(t.missedText)}</strong>`;
                  }
                  ul.appendChild(li);
               });
               detailsDiv.appendChild(ul);
           } else {
               const perfectMsg = document.createElement("div");
               perfectMsg.style.fontSize = "0.9rem";
               perfectMsg.style.color = "#2b8a3e";
               perfectMsg.innerText = "이 구간은 완벽하게 입력했습니다!";
               detailsDiv.appendChild(perfectMsg);
           }
           
           sectionDiv.appendChild(detailsDiv);
           typoList.appendChild(sectionDiv);
        }
        
        if (maxLinePlayed >= 0) {
            typoContainer.style.display = "block";
        } else {
            typoContainer.style.display = "none";
        }
      } else {
        typoContainer.style.display = "none";
      }
    }

    resultModal.style.display = "flex";

    // --- 히스토리 저장 로직 추가 ---
    const token = localStorage.getItem("ep_token");
    if (token) {
      const finalWpm = parseInt(document.getElementById("final-wpm").innerText) || 0;
      const finalAcc = parseFloat(document.getElementById("final-accuracy").innerText) || 0;
      const title = document.getElementById("info-title").innerText || "알 수 없는 곡";
      const tagsContainer = document.getElementById("info-tags");
      let genre = "타이핑";
      if (tagsContainer && tagsContainer.children.length > 0) {
          genre = tagsContainer.children[0].innerText;
      }
      
      fetch("/api/typing-history", {
          method: "POST",
          headers: {
              "Content-Type": "application/json",
              "Authorization": "Bearer " + token
          },
          body: JSON.stringify({
              content_title: title,
              genre: genre,
              wpm: finalWpm,
              accuracy: finalAcc,
              text: "history_record"
          })
      })
      .then(res => res.json())
      .then(data => console.log("히스토리 저장:", data))
      .catch(err => console.error("히스토리 저장 오류:", err));

      // 키 단위 오타 통계 서버 저장
      if (keyTypoCollector) {
        // 게임이 중간 종료되어 아직 처리되지 않은 현재 라인의 남은 유닛이 있으면
        // totals 보강 (미완료 상태에서 endGame 진입 시 유실 방지)
        if (!lineCompleted && targetUnits && currentUnitIndex < targetUnits.length) {
          for (let ui = currentUnitIndex; ui < targetUnits.length; ui++) {
            const u = targetUnits[ui];
            if (u && u.validInputs && u.validInputs.length > 0) {
              keyTypoCollector.addTotalsOnly(u.validInputs[0]);
            }
          }
        }

        const payload = keyTypoCollector.getPayload();
        if (payload.key_typos.length > 0 || payload.key_totals.length > 0) {
          fetch("/api/typo-stats", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": "Bearer " + token
            },
            body: JSON.stringify({
              content_id: parseInt(TYPING_CONTENT_ID) || null,
              key_typos: payload.key_typos,
              key_totals: payload.key_totals
            })
          })
          .then(res => res.json())
          .then(d => console.log("오타 통계 저장:", d))
          .catch(err => console.error("오타 통계 저장 오류:", err));
        }
      }
    }
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
  const totalTypedLegacy = sessionTotalChars + typingInput.value.length + totalTypos;

  let currentElapsed = currentLineElapsed;
  if (currentElapsed < 0) currentElapsed = 0;
  let currentRemaining = 0;
  if (!lineCompleted) {
    currentRemaining = Math.max(0, currentSectionDuration - currentElapsed);
  } else {
    currentRemaining = savedSectionRemaining;
  }

  let tempTotalTyped = totalTypedChars + correctChars + sectionTypos;
  let tempTotalCorrect = totalCorrectChars + correctChars;
  let tempTotalTarget = totalTargetCorrectChars + (currentChars ? currentChars.length : 0);
  let tempTotalRemaining = totalRemainingTime + currentRemaining;
  let tempTotalTimeSum = totalTimeSum + currentSectionDuration;

  if (timeElapsed > 0) {
    wpm = Math.round((tempTotalCorrect / 5 / timeElapsed) * 60);
  }
  wpmDisplay.innerText = wpm;

  let accuracyVal = 1;
  if (tempTotalTyped > 0) {
    accuracyVal = tempTotalCorrect / tempTotalTyped;
  }
  let accuracy = Math.round(accuracyVal * 100);
  accuracyDisplay.innerText = accuracy + "%";
  if (typosDisplay) typosDisplay.innerText = totalTypos;

  let typingRatio = tempTotalTarget > 0 ? tempTotalCorrect / tempTotalTarget : 0;
  let timeRatio = tempTotalTimeSum > 0 ? tempTotalRemaining / tempTotalTimeSum : 0;

  let totalScore = calculateTypingScore(accuracyVal, typingRatio, timeRatio, contentDifficulty);

  const diffWeight = {1: 0.8, 2: 0.9, 3: 1.0, 4: 1.1, 5: 1.2}[contentDifficulty] || 1.0;
  const baseScore = typingRatio * 100 * Math.pow(accuracyVal, 2) * diffWeight;
  console.log(`[Score Log] diffWeight: ${diffWeight}, typingRatio: ${typingRatio.toFixed(3)}, timeRatio: ${timeRatio.toFixed(3)}, accuracy: ${accuracyVal.toFixed(3)}, baseScore: ${baseScore.toFixed(1)}, totalScore: ${totalScore}`);

  if (scoreDisplay) scoreDisplay.innerText = totalScore;
}

function highlightCurrentChar() {
  TypingEngine.highlightCurrentChar(lyricDisplay, targetUnits, currentUnitIndex, currentBuffer);
}

/**
 * 현재 입력해야 할 가사와 현재까지 입력된 로마자 버퍼의 상태를
 * 상태 패널(Status Panel)에 업데이트하여 화면에 표시하는 함수입니다.
 */
function updateStatus() {
  TypingEngine.getStatusHTML(statusPanel, targetUnits, currentUnitIndex, currentBuffer, '<span class="success-text"> 완벽하게 입력했습니다! 다음 문장을 기다려 주세요.</span>');
}


typingInput.addEventListener("input", (e) => {
  if (!isPlaying) return;
  if (lineCompleted) return;

  let rawValue = e.target.value;
  let convertedValue = ko2en(rawValue);
  if (rawValue !== convertedValue) {
    e.target.value = convertedValue;
  }
  
  let typedValue = convertedValue.toLowerCase();
  if (!targetUnits || currentUnitIndex >= targetUnits.length) return;

  if (typedValue.length < currentBuffer.length) {
    currentBuffer = typedValue;
    currentIndex = getCompletedRomajiLength(targetUnits, currentUnitIndex) + currentBuffer.length;
    updateStatus();
    updateStats();
    highlightCurrentChar();
    return;
  }

  const newChar = typedValue.charAt(typedValue.length - 1);
  const testBuffer = currentBuffer + newChar;
  const currentUnit = targetUnits[currentUnitIndex];

  const { isCompleteMatch, isPossiblePrefix } = TypingEngine.checkRomajiMatch(currentUnit, testBuffer);

  if (!isCompleteMatch && !isPossiblePrefix) {
    // ── ん(n) 입력 후 'n'을 또 눌렀을 때 (nn 의도) 오타 처리 방지 ──
    if (newChar === 'n' && currentBuffer === "" && currentUnitIndex > 0) {
      const prevUnit = targetUnits[currentUnitIndex - 1];
      if (prevUnit.text === 'ん' && prevUnit.typedAs === 'n') {
        prevUnit.typedAs = 'nn'; // 더 이상 이 조건에 걸리지 않도록 방지
        typingInput.value = currentBuffer; // 입력 무시
        return;
      }
    }

    totalTypos++;
    sectionTypos++;
    typingInput.value = currentBuffer;
    
    const expectedCharStr = currentUnit.validInputs.join(" / ");
    typoDetails.push({
      lineIndex: currentLineIndex,
      lineText: contentLines[currentLineIndex] || "알 수 없는 구간",
      type: 'typing',
      unitIndex: currentUnitIndex,
      word: currentUnit.text,
      expected: expectedCharStr,
      typed: testBuffer
    });

    // 키 단위 오타 수집: 잘못 누른 키를 현재 유닛의 pending 목록에 기록
    if (keyTypoCollector) keyTypoCollector.recordTypo(newChar);

    updateStats();
    return;
  }

  currentBuffer = testBuffer;
  if (isCompleteMatch) {
    currentUnit.typedAs = testBuffer; // 기록해두기
    // 키 단위 오타 수집: 확정된 로마자 패턴(testBuffer) 기준으로 유닛 커밋
    if (keyTypoCollector) keyTypoCollector.commitUnit(testBuffer);
    currentUnitIndex++;
    currentBuffer = "";
    typingInput.value = "";
  }

  if (currentUnitIndex >= targetUnits.length) {
    currentIndex = currentChars.length;
    correctChars = currentIndex;
    updateStatus();
    updateStats();
    highlightCurrentChar();
    handleLineCompletion();
    return;
  }

  currentIndex = getCompletedRomajiLength(targetUnits, currentUnitIndex) + currentBuffer.length;
  correctChars = currentIndex;

  highlightCurrentChar();
  updateStatus();
  updateStats();
});

/**
 * 현재 가사의 재생 시간(싱크)에 맞춰 진행 바(Progress Bar)를 업데이트하고,
 * 설정된 시간이 초과되면 강제로 다음 줄로 넘어가도록 체크하는 루프 함수입니다.
 */
function startSyncLoop() {
  clearInterval(syncTimer);
  if (!isPlaying) return;
  if (progressBar) progressBar.style.width = "0%";

  let duration = 50.0; // default 5 seconds
  if (
    contentTimestamps.length > currentLineIndex + 1 &&
    contentTimestamps[currentLineIndex] !== undefined
  ) {
    duration =
      contentTimestamps[currentLineIndex + 1] -
      contentTimestamps[currentLineIndex];
    if (duration <= 0) duration = 0.1;
  } else if (contentTimestamps[currentLineIndex] !== undefined) {
    // Last line
    duration = 50.0;
  }

  currentSectionDuration = duration;
  currentLineElapsed = 0;

  syncTimer = setInterval(() => {
    if (!isPlaying) return;

    if (isYoutubeMode) {
      if (
        contentTimestamps.length > 0 &&
        contentTimestamps[currentLineIndex] !== undefined
      ) {
        let currentTime = youtubePlayer.getCurrentTime();
        let lineStartTime = contentTimestamps[currentLineIndex];
        currentLineElapsed = currentTime - lineStartTime;

        if (currentLineElapsed < 0) {
          if (!isWaitingPhase) {
            isWaitingPhase = true;
            renderWaitingPhase();
          }

          let prevLineStartTime = 0;
          if (currentLineIndex > 0 && contentTimestamps[currentLineIndex - 1] !== undefined) {
            prevLineStartTime = contentTimestamps[currentLineIndex - 1];
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
            renderLines();
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
      // 유튜브 영상이 없는 경우, 강제 스킵 없이 진행바를 꽉 채워둠
      if (progressBar) progressBar.style.width = "100%";
    }
  }, 50);
}

/**
 * 다음 가사로 넘어가는 트랜지션 함수입니다.
 * @param {boolean} isForceSkip - 시간 초과로 인해 강제로 넘어가는지 여부
 */
function forceSkipToNextLine() {
  if (!lineCompleted) {
    let elapsed = currentLineElapsed;
    if (elapsed < 0) elapsed = 0;
    savedSectionRemaining = Math.max(0, currentSectionDuration - elapsed);
  }

  if (!lineCompleted && currentChars && currentIndex < currentChars.length) {
    let missedCharsCount = currentChars.length - currentIndex;
    totalTypos += missedCharsCount;
    sectionTypos += missedCharsCount;
    
    let missedText = currentText.substring(currentIndex);
    typoDetails.push({
      lineIndex: currentLineIndex,
      lineText: contentLines[currentLineIndex] || "알 수 없는 구간",
      type: 'timeout',
      startUnitIndex: currentUnitIndex,
      missedText: missedText,
      count: missedCharsCount
    });

    sessionCorrectChars += correctChars;
    sessionTotalChars += currentChars.length;
  }

  // 키 단위 오타 수집: 시간 초과로 스킵되는 라인의 미완료 유닛 집계
  if (keyTypoCollector && !lineCompleted && targetUnits) {
    if (currentUnitIndex < targetUnits.length) {
      // 부분 입력 중이던 현재 유닛: 확정 패턴을 추정해 pending 오타 유실 방지
      const partialUnit = targetUnits[currentUnitIndex];
      if (partialUnit && partialUnit.validInputs && partialUnit.validInputs.length > 0) {
        let bestMatch = partialUnit.validInputs.find(
          (v) => v.indexOf(currentBuffer) === 0
        );
        if (!bestMatch) bestMatch = partialUnit.validInputs[0];
        keyTypoCollector.commitUnit(bestMatch);
      }
      // 남은 미도달 유닛들: totals만 누적
      for (let ui = currentUnitIndex + 1; ui < targetUnits.length; ui++) {
        const u = targetUnits[ui];
        if (u && u.validInputs && u.validInputs.length > 0) {
          keyTypoCollector.addTotalsOnly(u.validInputs[0]);
        }
      }
      // 이 라인은 수집 완료로 표시 (endGame 보강 시 중복 집계 방지)
      currentUnitIndex = targetUnits.length;
    }
  }

  let sectionCorrect = correctChars;
  let sectionTyped = sectionCorrect + sectionTypos;
  let sectionTarget = currentChars ? currentChars.length : 0;

  totalTypedChars += sectionTyped;
  totalCorrectChars += sectionCorrect;
  totalTargetCorrectChars += sectionTarget;
  totalRemainingTime += savedSectionRemaining;
  totalTimeSum += currentSectionDuration;

  lineCompleted = false;
  if (typingInput) typingInput.disabled = false;
  updateStats();

  currentLineIndex++;

  if (
    currentLineIndex >= contentLines.length ||
    currentLineIndex >= contentHiraganaLines.length
  ) {
    endGame(true);
  } else {
    renderLines();
    startSyncLoop();
  }
}

// Click anywhere in typing area to focus input
const typingPanel = document.querySelector(".typing-panel");
if (typingPanel) {
  typingPanel.addEventListener("click", () => {
    if (!isPlaying && (!currentYoutubeId || !isPlayerReady)) {
      startGame(false);
    }
    if (isPlaying && typingInput) {
      typingInput.focus({ preventScroll: true });
    }
  });
}

// Tab skip and Spacebar pause logic
document.addEventListener("keydown", function(e) {
  if (isPlaying) {
    if (e.key === "Tab") {
      e.preventDefault();
      const hira = contentHiraganaLines[currentLineIndex];
      const isLyricsEmpty = !hira || hira.trim() === "-" || hira.trim() === "";
      if (lineCompleted || isLyricsEmpty || isWaitingPhase) {
        skipTo80Percent();
      }
    } else if (e.code === "Space" || e.key === " ") {
      e.preventDefault();
      if (isYoutubeMode && youtubePlayer && isPlayerReady) {
        if (isCountingDown) return; // Ignore spacebar during countdown
        
        const state = youtubePlayer.getPlayerState();
        if (state === YT.PlayerState.PLAYING) {
          youtubePlayer.pauseVideo();
        } else if (state === YT.PlayerState.PAUSED) {
          startCountdownAndPlay();
        }
      }
    }
  }
});

function startCountdownAndPlay() {
  const overlay = document.getElementById("countdown-overlay");
  const text = document.getElementById("countdown-text");
  
  if (!overlay || !text) {
    isResumeAuthorized = true;
    youtubePlayer.playVideo();
    return;
  }

  isCountingDown = true;
  overlay.style.display = "flex";
  let count = 3;
  text.innerText = count;

  countdownInterval = setInterval(() => {
    count--;
    if (count > 0) {
      text.innerText = count;
    } else {
      clearInterval(countdownInterval);
      overlay.style.display = "none";
      isCountingDown = false;
      isResumeAuthorized = true;
      youtubePlayer.playVideo();
    }
  }, 1000);
}

function skipTo80Percent() {
  if (!isPlaying || !isYoutubeMode || !youtubePlayer || !isPlayerReady) return;

  let currentTime = youtubePlayer.getCurrentTime();
  
  if (contentTimestamps.length > 0 && contentTimestamps[currentLineIndex] !== undefined) {
    let lineStartTime = contentTimestamps[currentLineIndex];
    let elapsed = currentTime - lineStartTime;
    
    if (elapsed < 0) {
      // Waiting phase skip
      let prevLineStartTime = 0;
      if (currentLineIndex > 0 && contentTimestamps[currentLineIndex - 1] !== undefined) {
        prevLineStartTime = contentTimestamps[currentLineIndex - 1];
      }
      let waitDuration = lineStartTime - prevLineStartTime;
      let targetTime = prevLineStartTime + waitDuration * 0.8;
      
      if (targetTime > currentTime) {
        youtubePlayer.seekTo(targetTime, true);
      }
    } else {
      // Active line skip
      let duration = 5; // default 5s if last line
      if (
        currentLineIndex + 1 < contentTimestamps.length &&
        contentTimestamps[currentLineIndex + 1] !== undefined
      ) {
        duration = contentTimestamps[currentLineIndex + 1] - lineStartTime;
      }
      
      let targetTime = lineStartTime + duration * 0.8;
      
      if (targetTime > currentTime) {
        youtubePlayer.seekTo(targetTime, true);
      }
    }
  }
}

// Load test content
fetchTypingContent(TYPING_CONTENT_ID);

// Volume control logic
const volumeSlider = document.getElementById("volume-slider");
const volumeDisplay = document.getElementById("volume-display");

if (volumeSlider && volumeDisplay) {
  volumeSlider.addEventListener("input", (e) => {
    const val = e.target.value;
    volumeDisplay.innerText = val + "%";
    if (youtubePlayer && typeof youtubePlayer.setVolume === "function") {
      youtubePlayer.setVolume(val);
    }
  });
}
