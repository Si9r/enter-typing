// ========================================== //
// 1. 전역 변수 및 초기화 (Global State & Init)
// ========================================== //
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('roomId');

// 새로고침(F5) 감지 시 자동으로 방 나가기(목록 페이지로 이동) 처리
const navEntries = performance.getEntriesByType("navigation");
if (navEntries.length > 0 && navEntries[0].type === "reload") {
    location.href = "battle_list.html";
}

let token = sessionStorage.getItem('ep_token');
let userStr = sessionStorage.getItem("ep_user");
let nickname = userStr ? JSON.parse(userStr).nickname : null;

if (!token || !nickname) {
    alert("로그인이 필요합니다.");
    location.href = "login.html";
}

if (!roomId) {
    alert("방 정보가 없습니다.");
    location.href = "battle_list.html";
}

let ws;
let isReady = false;
let oppProgress = 0;

// ========================================== //
// 2. 웹소켓 통신 및 대기실 UI (WebSocket & Lobby)
// ========================================== //
function connectWebSocket() {
    const wsUrl = `ws://${window.location.host}/ws/battle/${roomId}?nickname=${encodeURIComponent(nickname)}`;
    ws = new WebSocket(wsUrl);

    ws.onopen = () => console.log("WebSocket connected.");

    ws.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === "room_state") {
            updateRoomUI(data.room);
            // 만약 방금 내가 들어왔는데 콘텐츠 정보가 없다면 API로 불러온다.
            if (contentLines.length === 0 && data.room.content_id) {
                await fetchTypingContent(data.room.content_id);
            }
        }
        else if (data.type === "start_game") {
            triggerGameStartSequence();
        }
        else if (data.type === "progress_update") {
            // Handle real-time progress updates
            if (data.progress !== undefined && data.nickname !== nickname) {
                const oppPb = document.getElementById(`battleOppProgress_${data.nickname}`);
                const oppSecPb = document.getElementById(`battleOppSectionProgress_${data.nickname}`);
                const oppWpm = document.getElementById(`battleOppWpm_${data.nickname}`);
                const oppScore = document.getElementById(`battleOppScore_${data.nickname}`);
                const oppLyric = document.getElementById(`battleOppLyric_${data.nickname}`);
                if (oppPb) oppPb.style.width = data.progress + "%";
                if (oppSecPb) oppSecPb.style.width = (data.section_progress || 0) + "%";
                if (oppWpm) oppWpm.innerText = "WPM: " + (data.wpm || 0);
                if (oppScore) oppScore.innerText = (data.score || 0) + "점";
                if (oppLyric) oppLyric.style.backgroundImage = `linear-gradient(to right, #ff5e62 ${data.section_progress || 0}%, #ccc ${data.section_progress || 0}%)`;
            }
        }
        else if (data.type === "chat_message") {
            const chatMessages = document.getElementById("chatMessages");
            if (chatMessages) {
                const isMe = data.nickname === nickname;
                const bubbleColor = isMe ? "var(--color-pink)" : "white";
                const textColor = isMe ? "white" : "#333";
                const nameDisplay = isMe ? "" : `<div style="font-size: 0.75rem; color: #888; margin-bottom: 3px; padding-left: 2px;">${data.nickname}</div>`;
                
                const msgHtml = `
                    <div style="display: flex; flex-direction: column; align-items: ${isMe ? 'flex-end' : 'flex-start'};">
                        ${nameDisplay}
                        <div style="background: ${bubbleColor}; color: ${textColor}; padding: 8px 14px; border-radius: 16px; border: ${isMe ? 'none' : '1px solid #ffe3e4'}; max-width: 80%; word-break: break-all; font-size: 0.95rem; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                            ${data.message}
                        </div>
                    </div>
                `;
                chatMessages.innerHTML += msgHtml;
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        }
        else if (data.type === "game_over") {
            handleGameOver(data.winner);
        }
    };

    ws.onclose = () => console.log("WebSocket disconnected.");
}

function updateRoomUI(room) {
    const gameStatus = document.getElementById("gameStatus");
    if(gameStatus) gameStatus.style.display = "none";
    
    const roomInfoHeader = document.getElementById("roomInfoHeader");
    if (roomInfoHeader) roomInfoHeader.style.display = "block";
    const lobbyRoomTitle = document.getElementById("lobbyRoomTitle");
    if (lobbyRoomTitle) lobbyRoomTitle.innerText = room.title;
    
    let me = room.players.find(p => p.nickname === nickname);
    let otherPlayers = room.players.filter(p => p.nickname !== nickname);

    if (me) {
        document.getElementById("myName").innerText = me.nickname;
        if (me.disconnected) {
            document.getElementById("myStatus").innerText = "연결 끊김";
            document.getElementById("myStatus").className = "status-badge";
            document.getElementById("myStatus").style.backgroundColor = "#ffebee";
            document.getElementById("myStatus").style.color = "#c62828";
        } else {
            let isMeCreator = (nickname === room.creator);
            document.getElementById("myName").innerText = isMeCreator ? "👑 " + me.nickname : me.nickname;
            document.getElementById("myStatus").innerText = isMeCreator ? "방장" : (me.ready ? "준비 완료" : "대기 중");
            document.getElementById("myStatus").className = (isMeCreator || me.ready) ? "status-badge status-ready" : "status-badge status-waiting";
            document.getElementById("myStatus").style.backgroundColor = "";
            document.getElementById("myStatus").style.color = "";
        }
    }

    // Dynamic Wait Container (Lobby players area)
    const waitContainer = document.getElementById("opponentsWaitContainer");
    if(waitContainer) {
        waitContainer.innerHTML = "";
        const maxOpponents = (room.max_players || 2) - 1;
        for (let i = 0; i < maxOpponents; i++) {
            let opponent = otherPlayers[i];
            let html = ``;
            if (opponent) {
                let isOpponentCreator = (opponent.nickname === room.creator);
                let displayName = isOpponentCreator ? "👑 " + opponent.nickname : opponent.nickname;
                let statusText = isOpponentCreator ? "방장" : (opponent.ready ? "준비 완료" : "대기 중");
                let statusClass = (isOpponentCreator || opponent.ready) ? "status-badge status-ready" : "status-badge status-waiting";
                let styleStr = "";
                
                if (opponent.disconnected) {
                    statusText = "연결 끊김";
                    statusClass = "status-badge";
                    styleStr = "background-color: #ffebee; color: #c62828;";
                }
                html = `
                <div class="player-panel opponent" style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 180px;">
                    <div class="player-avatar" style="width: 70px; height: 70px; border-radius: 50%; background: #ffe3e4; display: flex; align-items: center; justify-content: center; font-size: 2rem; margin-bottom: 15px;">👤</div>
                    <div class="player-name">${displayName}</div>
                    <div class="${statusClass}" style="${styleStr}">${statusText}</div>
                </div>`;
            } else {
                html = `
                <div class="player-panel opponent" style="opacity: 0.6; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 180px;">
                    <div class="player-avatar" style="width: 70px; height: 70px; border-radius: 50%; background: #f0f2f5; display: flex; align-items: center; justify-content: center; font-size: 2rem; margin-bottom: 15px;">⏳</div>
                    <div class="player-name" style="font-size: 1.1rem; color: #888;">대기 중...</div>
                </div>`;
            }
            waitContainer.innerHTML += html;
        }
    }

    // Dynamic Progress Container (Stats panel)
    const progressContainer = document.getElementById("opponentsProgressContainer");
    if(progressContainer) {
        progressContainer.innerHTML = "";
        otherPlayers.forEach((opponent) => {
            let html = `
            <div style="background: #fdfdfd; border: 1.5px solid #ffe3e4; border-radius: 12px; padding: 10px;">
                <div style="font-size: 0.85rem; font-weight: bold; color: #666; margin-bottom: 5px; display: flex; justify-content: space-between;">
                    <span>${opponent.nickname}</span>
                    <span>
                        <span id="battleOppScore_${opponent.nickname}" style="margin-right: 10px; color: #e67700;">${opponent.score || 0}점</span>
                        <span id="battleOppWpm_${opponent.nickname}">WPM: ${opponent.wpm || 0}</span>
                    </span>
                </div>
                <div class="progress-bar-container" style="height: 12px; margin-bottom: 3px;" title="전체 진행도">
                    <div class="progress-bar" id="battleOppProgress_${opponent.nickname}" style="width: ${opponent.progress || 0}%; background-color: var(--color-pink);"></div>
                </div>
                <div class="progress-bar-container" style="height: 6px; margin-bottom: 5px; background-color: #ffe3e4;" title="현재 구간 진행도">
                    <div class="progress-bar" id="battleOppSectionProgress_${opponent.nickname}" style="width: ${opponent.section_progress || 0}%; background-color: #ffb6c1;"></div>
                </div>
                <div id="battleOppLyric_${opponent.nickname}" style="font-size: 0.85rem; font-weight: 800; margin-top: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; background-image: linear-gradient(to right, #ff5e62 ${opponent.section_progress || 0}%, #ccc ${opponent.section_progress || 0}%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; color: transparent;">(대기 중)</div>
            </div>`;
            progressContainer.innerHTML += html;
        });
    }

    if (!isPlaying && !isCountingDown) {
        let isCreator = (nickname === room.creator);
        if (isCreator) {
            document.getElementById("readyBtn").style.display = "none";
            document.getElementById("startGameBtn").style.display = "inline-block";
            
            let otherPlayers = room.players.filter(p => p.nickname !== nickname && !p.disconnected);
            let canStart = otherPlayers.length >= 1 && otherPlayers.every(p => p.ready);
            document.getElementById("startGameBtn").disabled = !canStart;
            
            if (me && !me.disconnected) {
                document.getElementById("myStatus").innerText = "방장";
                document.getElementById("myStatus").className = "status-badge status-ready";
            }
        } else {
            document.getElementById("startGameBtn").style.display = "none";
            document.getElementById("readyBtn").style.display = "inline-block";
        }
    }
    updateMiniLyrics();
}

function toggleReady() {
    isReady = !isReady;
    document.getElementById("readyBtn").innerText = isReady ? "준비 취소" : "준비하기";
    ws.send(JSON.stringify({ type: "ready", ready: isReady }));
}

function requestStartGame() {
    if (ws) ws.send(JSON.stringify({ type: "start_game_request" }));
}

function leaveRoom() {
    if (confirm("정말로 방을 나가시겠습니까?")) {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "leave" }));
        }
        if (ws) {
            ws.close();
        }
        location.href = "battle_list.html";
    }
}

// ========================================== //
// 3. 게임 시작/종료 시퀀스 (Game Flow)
// ========================================== //
function triggerGameStartSequence() {
    // Hide lobby UI, show grid
    document.body.classList.remove("lobby-mode");
    const lobby = document.getElementById("lobbyContainer");
    if (lobby) lobby.style.display = "none";
    const roomInfoHeader = document.getElementById("roomInfoHeader");
    if (roomInfoHeader) roomInfoHeader.style.display = "none";
    const playersArea = document.getElementById("playersArea");
    if (playersArea) playersArea.style.display = "none";
    document.getElementById("actionArea").style.display = "none";
    document.getElementById("gameStatus").style.display = "none";
    document.getElementById("battleLayoutGrid").style.display = "grid";
    
    startCountdownSequence();
}

function startCountdownSequence() {
    isCountingDown = true;
    const overlay = document.getElementById("countdown-overlay");
    const countText = document.getElementById("countdown-text");
    const msgText = document.getElementById("countdown-msg");
    if(overlay) overlay.style.display = "flex";
    if(msgText) msgText.innerText = "게임이 시작됩니다 준비하세요!";
    
    let count = 3;
    countText.innerText = count;
    
    countdownInterval = setInterval(() => {
        count--;
        if(count > 0) {
            countText.innerText = count;
        } else {
            clearInterval(countdownInterval);
            if(overlay) overlay.style.display = "none";
            isCountingDown = false;
            startGame(false); // start the game logic
        }
    }, 1000);
}

function handleGameOver(winner) {
    isPlaying = false;
    pauseTimer();
    if (typingInput) typingInput.disabled = true;
    
    // Custom modal for battle finish
    const modal = document.getElementById("resultModal");
    if (modal) {
        modal.style.display = "flex";
        modal.innerHTML = `
        <div style="background: #fff; border-radius: 12px; padding: 30px; width: 600px; text-align: center; border: 4px solid #ff9a9e;">
            <h2 style="font-size: 2rem; font-weight: 900; margin-bottom: 20px;">🎉 게임 종료! 🎉</h2>
            <h3 style="font-size: 1.5rem; font-weight: 700; color: #333; margin-bottom: 30px;">승리자: ${winner}</h3>
            <button class="btn btn-blue" onclick="location.href='battle_list.html'" style="font-size:1.2rem; padding: 15px 30px;">로비로 돌아가기</button>
        </div>`;
    } else {
        alert(`게임 종료! 승리자: ${winner}`);
        location.href = "battle_list.html";
    }
}

// Ensure connectWebSocket runs
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', connectWebSocket);
} else {
    connectWebSocket();
}


const typingInput = document.getElementById("typing-input");
const wpmDisplay = document.getElementById("myWpm");
const accuracyDisplay = document.getElementById("accuracy");
const timeDisplay = document.getElementById("time");
const typosDisplay = document.getElementById("typos"); // Added for the new UI
const scoreDisplay = document.getElementById("score"); // Added for score display
const stageIndicator = document.getElementById("stageIndicator");
const kanjiDisplay = document.getElementById("kanjiDisplay");
const lyricDisplay = document.getElementById("lyricDisplay");
const nextPreviewDisplay = document.getElementById("nextPreviewDisplay");
const statusPanel = document.getElementById("statusPanel");
const progressBar = document.getElementById("myProgress");

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
let isWaitingPhase = false;
let typoDetails = [];
let allTargetUnits = [];

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
let isYoutubeReady = false;
let isPlayerReady = false;
let lineCompleted = false;

// Variables for countdown overlay
let isCountingDown = false;
let countdownInterval = null;

// ========================================== //
// 4. 유튜브 API 연동 및 싱크 (YouTube & Sync)
// ========================================== //
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
        controls: 0,
        disablekb: 1,
        fs: 0,
        rel: 0,
      },
      events: {
        onReady: function (event) {
          isPlayerReady = true;
          const volSlider = document.getElementById("volume-slider");
          if (volSlider && typeof youtubePlayer.setVolume === "function") {
            youtubePlayer.setVolume(volSlider.value);
          }
        },
        onStateChange: function (event) {
          if (event.data == YT.PlayerState.PLAYING) {
            if (!isPlaying && !isCountingDown) {
              // startGame(true);
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
// ========================================== //
// 5. 타이핑 엔진 (문자열 파싱 로직)
// ========================================== //
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
// ========================================== //
// 6. 데이터 로드 및 화면 렌더링 (Data Fetch & Render)
// ========================================== //
async function fetchTypingContent(contentId) {
  try {
    const response = await fetch(`/api/typing-content/${contentId}`);
    const data = await response.json();
    if (data.success) {
      const lobbyRoomContentText = document.getElementById("lobbyRoomContentText");
      if (lobbyRoomContentText) {
          lobbyRoomContentText.innerText = `${data.title} - ${data.artist}`;
      }
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

function updateMiniLyrics() {
    let currentLyricText = contentLines[currentLineIndex] || "";
    const myLyric = document.getElementById("battleMyLyric");
    if (myLyric) myLyric.innerText = currentLyricText;
    
    document.querySelectorAll('[id^="battleOppLyric_"]').forEach(el => {
        el.innerText = currentLyricText;
    });
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

  targetUnits = parseKanaToTargetUnits(currentHiragana, true);
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
  sectionTypos = 0;
  if (progressBar) progressBar.style.width = "0%";

  updateStatus();
  highlightCurrentChar();
  updateMiniLyrics();
  updateStats();
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

  if (countdownInterval) clearInterval(countdownInterval);
  isCountingDown = false;
  const overlay = document.getElementById("countdown-overlay");
  if (overlay) overlay.style.display = "none";

  if (!startedByYoutube && youtubePlayer && isPlayerReady) {
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
  if (scoreDisplay) scoreDisplay.innerText = 0;
  isYoutubeMode = !!(youtubePlayer && isPlayerReady && currentYoutubeId);

  if (isYoutubeMode && youtubePlayer.getDuration) {
    let dur = Math.round(youtubePlayer.getDuration());
    timeLeft = dur > 0 ? dur : 60;
  } else {
    timeLeft = 0; // 유튜브 모드가 아니면 0부터 시작해서 시간 증가 (무제한)
  }

  if (timeDisplay) timeDisplay.innerText = timeLeft;
  if (wpmDisplay) wpmDisplay.innerText = 0;
  if (accuracyDisplay) accuracyDisplay.innerText = "100%";
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
    gameTimeElapsed++;
    if (isYoutubeMode) {
      if (timeLeft > 0) {
        timeLeft--;
        if (timeDisplay) timeDisplay.innerText = timeLeft;
        updateStats();
      } else {
        endGame(false);
      }
    } else {
      timeLeft++; // 무제한 모드일 때는 남은 시간 대신 경과 시간을 보여줍니다
      if (timeDisplay) timeDisplay.innerText = timeLeft;
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
    if (completed && ws && isPlaying) {
        ws.send(JSON.stringify({ type: "finish" }));
    }

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
    statusPanel.innerHTML = '<span class="success-text">✨ 모든 타이핑이 종료되었습니다!</span>';
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
                topTypoList.innerHTML = "<div style='text-align: center; color: #888; margin-top: 20px;'>오타가 없습니다! 완벽해요 👏</div>";
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
           sectionDiv.style.border = "1px solid #ddd";
           sectionDiv.style.borderRadius = "6px";
           sectionDiv.style.overflow = "hidden";
           
           const sectionHeader = document.createElement("div");
           sectionHeader.style.padding = "10px 15px";
           sectionHeader.style.background = "#f1f1f1";
           sectionHeader.style.cursor = "pointer";
           sectionHeader.style.display = "flex";
           sectionHeader.style.justifyContent = "space-between";
           sectionHeader.style.alignItems = "center";
           sectionHeader.style.fontWeight = "bold";
           sectionHeader.style.color = "#444";
           
           let coloredLineHtml = "";
           if (units.length > 0) {
               units.forEach((u, idx) => {
                   let hadTypo = errors.some(t => t.type === 'typing' && t.unitIndex === idx);
                   let wasTimeout = errors.some(t => t.type === 'timeout' && idx >= t.startUnitIndex);
                   
                   if (wasTimeout) {
                       coloredLineHtml += `<span style="color: #c92a2a; background: #fff5f5; padding: 2px; border-radius: 4px;">${u.text}</span>`;
                   } else if (hadTypo) {
                       coloredLineHtml += `<span style="color: #e67700; background: #fff4e6; padding: 2px; border-radius: 4px;">${u.text}</span>`;
                   } else {
                       coloredLineHtml += `<span style="color: #555;">${u.text}</span>`;
                   }
               });
           } else {
               coloredLineHtml = `<span>${lineText}</span>`;
           }

           let titleHtml = `<span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;">[구간 ${i + 1}] <span style="font-weight: normal; color: #666; margin-left: 10px;">${coloredLineHtml}</span></span>`;
           if (errors.length === 0) {
              titleHtml += `<span style="color: #2b8a3e; font-size: 0.85rem; margin-left: 15px; white-space: nowrap; flex-shrink: 0;">(완벽함! ✨)</span>`;
           } else {
              let typingErrors = errors.filter(e => e.type === 'typing').length;
              let timeoutErrors = errors.filter(e => e.type === 'timeout').length;
              titleHtml += `<span style="color: #e67700; font-size: 0.85rem; margin-left: 15px; white-space: nowrap; flex-shrink: 0;">오타 ${typingErrors} / 시간초과 ${timeoutErrors}</span>`;
           }
           sectionHeader.innerHTML = `<div style="display: flex; align-items: center; width: 100%; overflow: hidden; justify-content: space-between;">${titleHtml}</div><span class="toggle-arrow" style="font-size: 0.8rem; color: #888; margin-left: 10px; flex-shrink: 0;">▼</span>`;

           const detailsDiv = document.createElement("div");
           detailsDiv.style.padding = "15px";
           detailsDiv.style.background = "#fff";
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
               analysisLabel.style.color = "#888";
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
                    li.innerHTML = `「${t.word}」 오타: <span style="color: #e67700; font-weight: bold;">'${t.typed}'</span> (정답: <strong>${t.expected}</strong>)`;
                  } else if (t.type === 'timeout') {
                    li.innerHTML = `<span style="color: #c92a2a; font-weight: bold;">[시간 초과]</span> 미입력: <strong>${t.missedText}</strong>`;
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
    const token = sessionStorage.getItem("ep_token");
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
    }
  }
}

/**
 * 현재까지 입력한 문자 수와 걸린 시간 등을 바탕으로
 * WPM(분당 타자수), 정확도, 오타수 등의 통계 데이터를 갱신하여 화면에 표시하는 함수입니다.
 */
// ========================================== //
// 7. 통계(WPM/정확도) 및 타이머 관리
// ========================================== //
function updateStats() {
    let prog = 0;
    let sectionProg = 0;
    let myWpm = 0;

    if (isPlaying && ws && contentRomajiLines) {
        let totalContentChars = contentRomajiLines.reduce((sum, line) => sum + line.length, 0);
        let pastTotal = 0;
        for(let i=0; i<currentLineIndex; i++) {
             pastTotal += contentRomajiLines[i].length;
        }
        let totalTyped = pastTotal + getCompletedRomajiLength();
        prog = totalContentChars > 0 ? Math.round((totalTyped / totalContentChars) * 100) : 0;
        if (prog > 100) prog = 100;
        
        let elapsedMins = gameTimeElapsed / 60;
        myWpm = elapsedMins > 0 ? Math.round((totalTyped / 5) / elapsedMins) : 0;
        
        if(progressBar) progressBar.style.width = prog + "%";
        if(wpmDisplay) wpmDisplay.innerText = "WPM: " + myWpm;
        
        sectionProg = currentChars && currentChars.length > 0 ? Math.round((correctChars / currentChars.length) * 100) : 0;
        if (sectionProg > 100) sectionProg = 100;

        // update local UI as well
        const battleProg = document.getElementById("battleMyProgress");
        const battleWpm = document.getElementById("battleMyWpm");
        if(battleProg) battleProg.style.width = prog + "%";
        if(battleWpm) battleWpm.innerText = "WPM: " + myWpm;
        
        const battleSecProg = document.getElementById("battleMySectionProgress");
        if(battleSecProg) battleSecProg.style.width = sectionProg + "%";
    }

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
  if (wpmDisplay) wpmDisplay.innerText = wpm;

  let accuracyVal = 1;
  if (tempTotalTyped > 0) {
    accuracyVal = tempTotalCorrect / tempTotalTyped;
  }
  let accuracy = Math.round(accuracyVal * 100);
  if (accuracyDisplay) accuracyDisplay.innerText = accuracy + "%";
  if (typosDisplay) typosDisplay.innerText = totalTypos;

  let diffWeight = {1: 0.8, 2: 0.9, 3: 1.0, 4: 1.1, 5: 1.2}[contentDifficulty] || 1.0;
  let typingRatio = tempTotalTarget > 0 ? tempTotalCorrect / tempTotalTarget : 0;
  let timeRatio = tempTotalTimeSum > 0 ? tempTotalRemaining / tempTotalTimeSum : 0;

  let baseScore = typingRatio * 100 * Math.pow(accuracyVal, 2) * diffWeight;
  let totalScore = Math.round(baseScore * (1 + timeRatio * 0.12));

  console.log(`[Score Log] diffWeight: ${diffWeight}, typingRatio: ${typingRatio.toFixed(3)}, timeRatio: ${timeRatio.toFixed(3)}, accuracy: ${accuracyVal.toFixed(3)}, baseScore: ${baseScore.toFixed(1)}, totalScore: ${totalScore.toFixed(1)}`);

  if (scoreDisplay) scoreDisplay.innerText = totalScore;
  const battleScore = document.getElementById("battleMyScore");
  if (battleScore) battleScore.innerText = totalScore + "점";

  if (isPlaying && ws && contentRomajiLines) {
      ws.send(JSON.stringify({ type: "progress", progress: prog, section_progress: sectionProg, wpm: myWpm, score: totalScore }));
  }
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

// 채팅 전송 함수
// ========================================== //
// 8. 기타 유틸리티 및 채팅 기능 (Utils & Chat)
// ========================================== //
function sendChatMessage() {
    const chatInput = document.getElementById("chatInput");
    if (chatInput && chatInput.value.trim() !== "") {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "chat", message: chatInput.value.trim() }));
            chatInput.value = "";
        }
    }
}

// 엔터 키로 채팅 전송
document.addEventListener("DOMContentLoaded", () => {
    const chatInput = document.getElementById("chatInput");
    if (chatInput) {
        chatInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                sendChatMessage();
            }
        });
    }
});

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

const KO_CHO = ["r","R","s","e","E","f","a","q","Q","t","T","d","w","W","c","z","x","v","g"];
const KO_JUNG = ["k","o","i","O","j","p","u","P","h","hk","ho","hl","y","n","nj","np","nl","b","m","ml","l"];
const KO_JONG = ["","r","R","rt","s","sw","sg","e","f","fr","fa","fq","ft","fx","fv","fg","a","q","qt","t","T","d","w","c","z","x","v","g"];
const KO_JA_MO = {"ㄱ":"r","ㄲ":"R","ㄳ":"rt","ㄴ":"s","ㄵ":"sw","ㄶ":"sg","ㄷ":"e","ㄸ":"E","ㄹ":"f","ㄺ":"fr","ㄻ":"fa","ㄼ":"fq","ㄽ":"ft","ㄾ":"fx","ㄿ":"fv","ㅀ":"fg","ㅁ":"a","ㅂ":"q","ㅃ":"Q","ㅄ":"qt","ㅅ":"t","ㅆ":"T","ㅇ":"d","ㅈ":"w","ㅉ":"W","ㅊ":"c","ㅋ":"z","ㅌ":"x","ㅍ":"v","ㅎ":"g","ㅏ":"k","ㅐ":"o","ㅑ":"i","ㅒ":"O","ㅓ":"j","ㅔ":"p","ㅕ":"u","ㅖ":"P","ㅗ":"h","ㅘ":"hk","ㅙ":"ho","ㅚ":"hl","ㅛ":"y","ㅜ":"n","ㅝ":"nj","ㅞ":"np","ㅟ":"nl","ㅠ":"b","ㅡ":"m","ㅢ":"ml","ㅣ":"l"};

function ko2en(str) {
  let res = "";
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    if (code >= 0xac00 && code <= 0xd7a3) {
      code -= 0xac00;
      let jong = code % 28;
      let jung = ((code - jong) / 28) % 21;
      let cho = parseInt(((code - jong) / 28) / 21);
      res += KO_CHO[cho] + KO_JUNG[jung] + KO_JONG[jong];
    } else if (code >= 0x3131 && code <= 0x3163) {
      res += KO_JA_MO[str.charAt(i)] || str.charAt(i);
    } else {
      res += str.charAt(i);
    }
  }
  return res;
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
      typed: newChar
    });

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
      typingInput.focus({ preventScroll: true });
    }
  });
}

// Tab skip and Spacebar pause logic
document.addEventListener("keydown", function(e) {
  if (isPlaying) {
    if (e.key === "Tab") {
      e.preventDefault();
      // 대전 모드에서는 영상 스킵 불가능
    } else if (e.code === "Space" || e.key === " ") {
      // 대전 모드에서는 영상 일시정지 불가능 (타이핑 창 제외하고 스페이스바 막기)
      if (document.activeElement !== typingInput) {
        e.preventDefault();
      }
    }
  }
});

function startCountdownAndPlay() {
  const overlay = document.getElementById("countdown-overlay");
  const text = document.getElementById("countdown-text");
  
  if (!overlay || !text) {
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

// Battle mode uses WS for content loading

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
