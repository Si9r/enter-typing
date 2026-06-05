/**
 * 애플리케이션 상태 제어, 유튜브 동기화 및 동적 데이터 연동 로직
 */

let playlist = []; // 🌟 이제 전체 객체 내부의 lyrics 배열만 여기에 담기게 됩니다.
let youtubeVideoId = ""; // 🌟 JSON에서 읽어온 비디오 ID를 저장할 변수
let currentStageIndex = -1;
let targetUnits = [];
let currentUnitIndex = 0;
let currentBuffer = "";
let syncTimer = null;
let player = null;

// DOM 요소 캐싱 (기존과 동일)
const kanjiDisplay = document.getElementById("kanjiDisplay");
const lyricDisplay = document.getElementById("lyricDisplay");
const nextPreviewDisplay = document.getElementById("nextPreviewDisplay");
const timerBarFill = document.getElementById("timerBarFill");
const statusPanel = document.getElementById("statusPanel");
const typeInput = document.getElementById("typeInput");
const steganaToggle = document.getElementById("steganaToggle");
const stageIndicator = document.getElementById("stageIndicator");

// 1단계: FastAPI에서 새로운 구조의 JSON 데이터를 땡겨옵니다.
async function initApplication() {
  try {
    statusPanel.innerHTML =
      "유튜브 연결 완료! 백엔드에서 가사 데이터를 가져오는 중...";

    const apiUrl = "http://127.0.0.1:8000/api/lyrics/3";
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // 🌟 응답받은 전체 데이터를 파싱합니다.
    const responseData = await response.json();

    // 🌟 새 구조에 맞게 비디오 ID와 가사 배열을 쪼개서 매칭합니다.
    youtubeVideoId = responseData.videoId || "SX_ViT4Ra7k"; // 없을 때를 대비한 기본값(fallback) 세팅
    playlist = responseData.lyrics || [];

    if (playlist.length > 0) {
      buildYouTubePlayer();
    } else {
      statusPanel.innerHTML =
        "<span class='highlight'>오류: 데이터베이스의 가사 내용이 비어있습니다.</span>";
    }
  } catch (error) {
    console.error("FastAPI 서버 연결 실패:", error);
    statusPanel.innerHTML =
      "<span class='highlight'>오류: FastAPI 서버를 켰는지, main.py에 CORS 설정이 제대로 되어있는지 확인하세요!</span>";
  }
}

// 2단계: 플레이어를 빌드할 때 하드코딩 문자를 지우고 변수를 적용합니다.
function buildYouTubePlayer() {
  if (!youtubeVideoId) return;

  player = new YT.Player("player", {
    videoId: youtubeVideoId, // 🌟 JSON에서 읽어온 비디오 ID가 유연하게 매칭됩니다!
    playerVars: {
      playsinline: 1,
      rel: 0,
    },
    events: {
      onReady: onPlayerReady,
      onStateChange: onPlayerStateChange,
    },
  });
}

// [이하 기존 app.js의 onPlayerReady부터 끝까지 코드는 동일하므로 생략합니다]

function onPlayerReady() {
  stageIndicator.textContent = `STAGE 1 / ${playlist.length}`;
  loadStage(0);
  statusPanel.innerHTML = "위의 영상을 재생하면 타이핑이 시작됩니다!";
}

function onPlayerStateChange(event) {
  if (event.data === YT.PlayerState.PLAYING && playlist.length > 0) {
    typeInput.disabled = false;
    typeInput.placeholder = "여기에 로마자를 입력하세요...";
    clearInterval(syncTimer);
    syncTimer = setInterval(checkVideoTimeSync, 50);
  } else {
    clearInterval(syncTimer);
  }
}

function checkVideoTimeSync() {
  if (
    !player ||
    typeof player.getCurrentTime !== "function" ||
    playlist.length === 0
  )
    return;

  const currentTime = player.getCurrentTime();
  let matchedStageIdx = 0;

  for (let i = 0; i < playlist.length; i++) {
    if (currentTime >= playlist[i].time) {
      matchedStageIdx = i;
    } else {
      break;
    }
  }

  if (matchedStageIdx !== currentStageIndex) {
    loadStage(matchedStageIdx);
  }

  if (currentStageIndex !== -1 && currentStageIndex < playlist.length) {
    const startTime = playlist[currentStageIndex].time;
    let endTime = 0;

    if (currentStageIndex + 1 < playlist.length) {
      endTime = playlist[currentStageIndex + 1].time;
    } else {
      const duration =
        typeof player.getDuration === "function" ? player.getDuration() : 0;
      endTime = duration > startTime ? duration : startTime + 7.0;
    }

    const totalDuration = endTime - startTime;
    const elapsed = currentTime - startTime;

    let progressPercent = (elapsed / totalDuration) * 100;
    progressPercent = Math.max(0, Math.min(100, progressPercent));

    timerBarFill.style.width = `${progressPercent}%`;
  }
}

function loadStage(stageIdx) {
  if (playlist.length === 0) return;

  if (stageIdx >= playlist.length) {
    kanjiDisplay.textContent = "끝!";
    lyricDisplay.innerHTML = "모든 싱크 구간이 끝났습니다.";
    nextPreviewDisplay.innerHTML = "<span class='prefix'>Next</span> end";
    timerBarFill.style.width = "100%";
    typeInput.disabled = true;
    return;
  }

  currentStageIndex = stageIdx;
  const currentData = playlist[currentStageIndex];

  kanjiDisplay.textContent = currentData.kanji;
  stageIndicator.textContent = `STAGE ${currentStageIndex + 1} / ${playlist.length}`;

  const nextStageIndex = currentStageIndex + 1;
  if (nextStageIndex < playlist.length) {
    nextPreviewDisplay.innerHTML = `<span class="prefix">Next</span> ${playlist[nextStageIndex].kanji}`;
  } else {
    nextPreviewDisplay.innerHTML = `<span class="prefix">Next</span> end`;
  }

  targetUnits = parseKanaToTargetUnits(currentData.kana, steganaToggle.checked);

  currentUnitIndex = 0;
  currentBuffer = "";
  typeInput.value = "";
  renderLyrics();
  updateStatus();
  typeInput.focus();
}

function renderLyrics() {
  lyricDisplay.innerHTML = "";
  targetUnits.forEach((unit, idx) => {
    const span = document.createElement("span");
    span.className = "char-unit";
    span.textContent = unit.text;

    if (idx < currentUnitIndex) {
      span.classList.add("typed");
    } else if (idx === currentUnitIndex) {
      span.classList.add("current");
    } else {
      span.classList.add("pending");
    }
    lyricDisplay.appendChild(span);
  });
}

function updateStatus() {
  if (currentUnitIndex >= targetUnits.length) {
    statusPanel.innerHTML =
      "<span class='success-text'>✨ 완벽하게 입력했습니다! 다음 싱크 문장을 기다리세요.</span>";
    return;
  }

  const currentUnit = targetUnits[currentUnitIndex];
  if (currentBuffer === "") {
    statusPanel.innerHTML = `현재 입력 위치: <span class="typing-now">${currentUnit.text}</span>`;
  } else {
    statusPanel.innerHTML = `<span class="typing-now">${currentUnit.text}</span> 입력 중... (입력된 조합: <span class="typing-now">${currentBuffer}</span>)`;
  }
}

typeInput.addEventListener("input", (e) => {
  const inputVal = e.target.value.toLowerCase();

  if (inputVal.length < currentBuffer.length) {
    currentBuffer = inputVal;
    updateStatus();
    return;
  }

  const newChar = inputVal.charAt(inputVal.length - 1);
  const testBuffer = currentBuffer + newChar;

  if (currentUnitIndex >= targetUnits.length) return;
  const currentUnit = targetUnits[currentUnitIndex];

  let isPossiblePrefix = false;
  let isCompleteMatch = false;

  for (let validTarget of currentUnit.validInputs) {
    if (validTarget === testBuffer) {
      isCompleteMatch = true;
      break;
    }
    if (validTarget.startsWith(testBuffer)) {
      isPossiblePrefix = true;
    }
  }

  if (!isCompleteMatch && !isPossiblePrefix) {
    e.target.value = currentBuffer;
    statusPanel.innerHTML = `현재 입력 위치: <span class="typing-now">${currentUnit.text}</span> | <span class="highlight">오타 감지: "${newChar}"</span>`;
    return;
  }

  currentBuffer = testBuffer;

  if (isCompleteMatch) {
    currentUnitIndex++;
    currentBuffer = "";
    e.target.value = "";
    renderLyrics();
  }
  updateStatus();
});

steganaToggle.addEventListener("change", () => {
  if (currentStageIndex !== -1) loadStage(currentStageIndex);
});

// 🌟 [수정] 1단계: 브라우저가 유튜브 스크립트를 완전히 읽어들이는 "첫 관문"이 열리면 프로그램 구동을 시작합니다.
window.onYouTubeIframeAPIReady = function () {
  console.log("유튜브 IFrame API 완료 신호 수신");
  initApplication();
};

// 최초 구동 초기 비활성화 상태 세팅
typeInput.disabled = true;
