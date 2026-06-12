const typingInput = document.getElementById("typing-input");
const wpmDisplay = document.getElementById("wpm");
const accuracyDisplay = document.getElementById("accuracy");
const timeDisplay = document.getElementById("time");
const typosDisplay = document.getElementById("typos"); // Added for the new UI
const stageIndicator = document.getElementById("stageIndicator");
const kanjiDisplay = document.getElementById("kanjiDisplay");
const lyricDisplay = document.getElementById("lyricDisplay");
const nextPreviewDisplay = document.getElementById("nextPreviewDisplay");
const statusPanel = document.getElementById("statusPanel");
const progressBar = document.getElementById("timerBarFill");

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
let lineCompleted = false;

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
    const placeholder = document.getElementById("video-placeholder");
    const container = document.getElementById("youtube-player-container");
    if (placeholder) placeholder.style.display = "none";
    if (container) container.style.display = "block";

    youtubePlayer = new YT.Player("youtube-player", {
      videoId: currentYoutubeId,
      playerVars: {
        playsinline: 1,
        controls: 1,
        disablekb: 0,
        fs: 0,
        rel: 0,
      },
      events: {
        onReady: function (event) {
          isPlayerReady = true;
        },
        onStateChange: function (event) {
          if (event.data == YT.PlayerState.PLAYING) {
            if (!isPlaying) {
              startGame(true);
            } else {
              resumeTimer();
            }
          } else if (
            event.data == YT.PlayerState.PAUSED ||
            event.data == YT.PlayerState.BUFFERING
          ) {
            pauseTimer();
          } else if (event.data == YT.PlayerState.ENDED && isPlaying) {
            endGame(false);
          }
        },
      },
    });
  } else if (youtubePlayer && currentYoutubeId) {
    youtubePlayer.loadVideoById(currentYoutubeId);
    youtubePlayer.pauseVideo();
  }
}

const romajiTable = {
  あ: ["a"],
  い: ["i", "yi"],
  う: ["u", "wu"],
  え: ["e", "ye"],
  お: ["o"],
  か: ["ka"],
  き: ["ki"],
  く: ["ku"],
  け: ["ke"],
  こ: ["ko"],
  さ: ["sa"],
  し: ["shi", "si"],
  す: ["su"],
  せ: ["se"],
  そ: ["so"],
  た: ["ta"],
  ち: ["chi", "ti"],
  つ: ["tsu", "tu"],
  て: ["te"],
  と: ["to"],
  だ: ["da"],
  ぢ: ["di"],
  づ: ["du"],
  で: ["de"],
  ど: ["do"],
  ば: ["ba"],
  び: ["bi"],
  ぶ: ["bu"],
  べ: ["be"],
  ぼ: ["bo"],
  ぱ: ["pa"],
  ぴ: ["pi"],
  ぷ: ["pu"],
  ぺ: ["pe"],
  ぽ: ["po"],
  な: ["na"],
  に: ["ni"],
  ぬ: ["nu"],
  ね: ["ne"],
  の: ["no"],
  は: ["ha"],
  ひ: ["hi"],
  ふ: ["fu", "hu"],
  へ: ["he"],
  ほ: ["ho"],
  ま: ["ma"],
  み: ["mi"],
  む: ["mu"],
  め: ["me"],
  も: ["mo"],
  や: ["ya"],
  ゆ: ["yu"],
  よ: ["yo"],
  ら: ["ra"],
  り: ["ri"],
  る: ["ru"],
  れ: ["re"],
  ろ: ["ro"],
  わ: ["wa"],
  を: ["wo"],
  ん: ["nn", "n", "n'"],
  が: ["ga"],
  ぎ: ["gi"],
  ぐ: ["gu"],
  げ: ["ge"],
  ご: ["go"],
  ざ: ["za"],
  じ: ["zi", "ji"],
  ず: ["zu"],
  ぜ: ["ze"],
  ぞ: ["zo"],
  ぁ: ["xa", "la"],
  ぃ: ["xi", "li"],
  ぅ: ["xu", "lu"],
  ぇ: ["xe", "le"],
  ぉ: ["xo", "lo"],
  っ: ["xtsu", "ltsu", "xtu", "ltu"],
  ゃ: ["xya", "lya"],
  ゅ: ["xyu", "lyu"],
  ょ: ["xyo", "lyo"],
  ゎ: ["xwa", "lwa"],
  " ": [" "],
  "、": [","],
  "。": ["."],
  "?": ["?"],
  "!": ["!"],
};

const combinationRules = {
  き: { ゃ: ["kya"], ゅ: ["kyu"], ょ: ["kyo"] },
  し: { ゃ: ["sha", "sya"], ゅ: ["shu", "syu"], ょ: ["sho", "syo"] },
  せ: { ぃ: ["sexi", "seli"] },
  ち: { ゃ: ["cha", "tya"], ゅ: ["chu", "tyu"], ょ: ["cho", "tyo"] },
  に: { ゃ: ["nya"], ゅ: ["nyu"], ょ: ["nyo"] },
  ひ: { ゃ: ["hya"], ゅ: ["hyu"], ょ: ["hyo"] },
  み: { ゃ: ["mya"], ゅ: ["myu"], ょ: ["myo"] },
  り: { ゃ: ["rya"], ゅ: ["ryu"], ょ: ["ryo"] },
  ぎ: { ゃ: ["gya"], ゅ: ["gyu"], ょ: ["gyo"] },
  じ: { ゃ: ["ja", "zya"], ゅ: ["ju", "zyu"], ょ: ["jo", "zyo"] },
  ぢ: { ゃ: ["dya"], ゅ: ["dyu"], ょ: ["dyo"] },
  び: { ゃ: ["bya"], ゅ: ["byu"], ょ: ["byo"] },
  ぴ: { ゃ: ["pya"], ゅ: ["pyu"], ょ: ["pyo"] },
};

/**
 * 주어진 가나(Kana) 문자열을 타이핑 가능한 로마자 입력 단위(TargetUnit) 배열로 파싱하는 함수입니다.
 * 촉음(っ)이나 요음(ゃ, ゅ, ょ 등)을 처리하여 가능한 모든 로마자 입력 조합을 생성합니다.
 * @param {string} kanaString - 파싱할 히라가나/가타카나 문자열
 * @param {boolean} mustCombine - 요음/촉음 결합을 강제할지 여부
 * @returns {Array} 파싱된 입력 단위 배열
 */
function parseKanaToTargetUnits(kanaString, mustCombine = true) {
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

    if (
      mustCombine &&
      combinationRules[char] &&
      nextChar &&
      combinationRules[char][nextChar]
    ) {
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

    const smallKana = ["ぁ", "ぃ", "ぅ", "ぇ", "ぉ", "ゃ", "ゅ", "ょ", "ゎ"];
    if (mustCombine && nextChar && smallKana.includes(nextChar)) {
      if (romajiTable[char] && romajiTable[nextChar]) {
        let combinedRomajis = [];
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
    }

    targetUnits.push({ text: char, validInputs: romajiTable[char] || [char] });
  }
  return targetUnits;
}

/**
 * 현재까지 입력 완료된 로마자의 전체 길이를 계산하여 반환하는 함수입니다.
 * @returns {number} 완료된 로마자의 문자열 길이 합
 */
function getCompletedRomajiLength() {
  return targetUnits.slice(0, currentUnitIndex).reduce((sum, unit) => {
    return sum + (unit.validInputs[0]?.length || 0);
  }, 0);
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
      currentYoutubeId = data.youtube_id;
      currentLineIndex = 0;
      renderLines();

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

  targetUnits = parseKanaToTargetUnits(currentHiragana, true);
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

  if (lyricDisplay) {
    lyricDisplay.innerHTML = "";
    targetUnits.forEach((unit, idx) => {
      const span = document.createElement("span");
      span.className = "lyric-unit " + (idx === 0 ? "current" : "pending");
      
      const hira = document.createElement("span");
      hira.className = "hira-text";
      hira.textContent = unit.text;
      
      const roma = document.createElement("span");
      roma.className = "roma-text";
      const initialRoma = unit.validInputs[0];
      for (let i = 0; i < initialRoma.length; i++) {
        const charSpan = document.createElement("span");
        charSpan.textContent = initialRoma[i];
        roma.appendChild(charSpan);
      }
      
      span.appendChild(hira);
      span.appendChild(roma);
      lyricDisplay.appendChild(span);
    });
  }

  typingInput.value = "";
  currentIndex = 0;
  correctChars = 0;
  if (progressBar) progressBar.style.width = "0%";

  updateStatus();
  highlightCurrentChar();
  if (typingInput) typingInput.focus();
}

/**
 * 한 줄의 가사를 모두 올바르게 입력했을 때 호출되는 처리 함수입니다.
 * 입력한 글자 수를 통계에 누적하고, 입력창을 비활성화하며 대기 상태를 표시합니다.
 */
function handleLineCompletion() {
  if (lineCompleted) return;
  lineCompleted = true;
  sessionCorrectChars += correctChars;
  sessionTotalChars += currentChars.length;
  updateStats();
  if (typingInput) typingInput.disabled = true;
  if (statusPanel) {
    statusPanel.innerHTML =
      '<span class="success-text">✨ 문장을 모두 입력했습니다. 다음 문장까지 기다리는 중...</span>';
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
  accuracyDisplay.innerText = "100%";
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
    wpm = Math.round((totalCorrect / 5 / timeElapsed) * 60);
  }
  wpmDisplay.innerText = wpm;

  let accuracy = 100;
  if (totalTyped > 0) {
    accuracy = Math.round((totalCorrect / totalTyped) * 100);
  }
  accuracyDisplay.innerText = accuracy + "%";
  if (typosDisplay) typosDisplay.innerText = totalTypos;
}

/**
 * 사용자가 현재 입력해야 할 문자를 화면에서 시각적으로 하이라이트(밑줄 등) 처리하는 함수입니다.
 */
function highlightCurrentChar() {
  if (!lyricDisplay) return;
  const spans = lyricDisplay.querySelectorAll(".lyric-unit");
  spans.forEach((span, idx) => {
    span.classList.remove("current", "typed", "pending");
    
    const romaContainer = span.querySelector(".roma-text");
    
    if (idx < currentUnitIndex) {
      span.classList.add("typed");
      if (romaContainer) {
        const chars = romaContainer.querySelectorAll("span");
        chars.forEach(c => {
          c.classList.remove("current", "pending");
          c.classList.add("typed");
        });
      }
    } else if (idx === currentUnitIndex) {
      span.classList.add("current");
      
      const unit = targetUnits[idx];
      let bestMatch = unit.validInputs[0];
      if (currentBuffer.length > 0) {
        for (let v of unit.validInputs) {
          if (v.startsWith(currentBuffer)) {
            bestMatch = v;
            break;
          }
        }
      }
      
      if (romaContainer && romaContainer.textContent !== bestMatch) {
        romaContainer.innerHTML = "";
        for (let i = 0; i < bestMatch.length; i++) {
          const charSpan = document.createElement("span");
          charSpan.textContent = bestMatch[i];
          romaContainer.appendChild(charSpan);
        }
      }
      
      if (romaContainer) {
        const chars = romaContainer.querySelectorAll("span");
        chars.forEach((c, i) => {
          c.classList.remove("current", "typed", "pending");
          if (i < currentBuffer.length) {
            c.classList.add("typed");
          } else if (i === currentBuffer.length) {
            c.classList.add("current");
          } else {
            c.classList.add("pending");
          }
        });
      }
    } else {
      span.classList.add("pending");
      if (romaContainer) {
        const chars = romaContainer.querySelectorAll("span");
        chars.forEach(c => {
          c.classList.remove("current", "typed");
          c.classList.add("pending");
        });
      }
    }
  });
}

/**
 * 현재 입력해야 할 가사와 현재까지 입력된 로마자 버퍼의 상태를
 * 상태 패널(Status Panel)에 업데이트하여 화면에 표시하는 함수입니다.
 */
function updateStatus() {
  if (!statusPanel) return;
  if (currentUnitIndex >= targetUnits.length) {
    statusPanel.innerHTML =
      '<span class="success-text">✨ 완벽하게 입력했습니다! 다음 문장을 기다려 주세요.</span>';
    return;
  }

  const currentUnit = targetUnits[currentUnitIndex];
  if (!currentUnit) {
    statusPanel.innerText = "입력할 항목을 준비 중입니다.";
    return;
  }

  if (currentBuffer === "") {
    statusPanel.innerHTML = `현재 입력 위치: <span class="typing-now">${currentUnit.text}</span>`;
  } else {
    statusPanel.innerHTML = `현재 입력 위치: <span class="typing-now">${currentUnit.text}</span> 입력 중... (입력된 조합: <span class="typing-now">${currentBuffer}</span>)`;
  }
}

typingInput.addEventListener("input", (e) => {
  if (!isPlaying) return;
  if (lineCompleted) return;

  let typedValue = e.target.value.toLowerCase();
  if (!targetUnits || currentUnitIndex >= targetUnits.length) return;

  if (typedValue.length < currentBuffer.length) {
    currentBuffer = typedValue;
    currentIndex = getCompletedRomajiLength() + currentBuffer.length;
    updateStatus();
    updateStats();
    highlightCurrentChar();
    return;
  }

  const newChar = typedValue.charAt(typedValue.length - 1);
  const testBuffer = currentBuffer + newChar;
  const currentUnit = targetUnits[currentUnitIndex];

  let isPossiblePrefix = false;
  let isCompleteMatch = false;

  for (let validInput of currentUnit.validInputs) {
    if (validInput === testBuffer) {
      isCompleteMatch = true;
      break;
    }
    if (validInput.startsWith(testBuffer)) {
      isPossiblePrefix = true;
    }
  }

  if (!isCompleteMatch && !isPossiblePrefix) {
    totalTypos++;
    typingInput.value = currentBuffer;
    updateStats();
    return;
  }

  currentBuffer = testBuffer;
  if (isCompleteMatch) {
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

  currentIndex = getCompletedRomajiLength() + currentBuffer.length;
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
  if (progressBar) progressBar.style.width = "0%";

  let duration = 50.0; // default 5 seconds
  if (
    contentTimestamps.length > currentLineIndex + 1 &&
    contentTimestamps[currentLineIndex] !== undefined
  ) {
    duration =
      contentTimestamps[currentLineIndex + 1] -
      contentTimestamps[currentLineIndex];
    if (duration <= 0) duration = 50.0;
  } else if (contentTimestamps[currentLineIndex] !== undefined) {
    // Last line
    duration = 50.0;
  }

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
          if (progressBar) progressBar.style.width = "100%";
          return;
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
  if (!lineCompleted && currentChars && currentIndex < currentChars.length) {
    totalTypos += currentChars.length - currentIndex;
    sessionCorrectChars += correctChars;
    sessionTotalChars += currentChars.length;
  }

  lineCompleted = false;
  if (typingInput) typingInput.disabled = false;
  updateStats();

  currentLineIndex++;

  if (
    currentLineIndex >= contentLines.length ||
    currentLineIndex >= contentRomajiLines.length
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
    if (!isPlaying && (!currentYoutubeId || !isYoutubeReady)) {
      startGame(false);
    }
    if (isPlaying && typingInput) {
      typingInput.focus();
    }
  });
}


// Load test content
const urlParams = new URLSearchParams(window.location.search);
const contentId = urlParams.get("id") || 1;
fetchTypingContent(contentId);
