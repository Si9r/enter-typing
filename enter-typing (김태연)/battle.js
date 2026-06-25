let databaseSongs = [];
let currentRoom = null;
let isHost = false;

// Active User details
let myUser = { nickname: "나 (플레이어)", email: "guest@enterping.com", avatar: "나", ready: false, finished: false };

// WebSocket connections
let battleSocket = null;

// YouTube Player
let ytPlayer = null;

window.onYouTubeIframeAPIReady = function () {
    ytPlayer = new YT.Player('youtube-player', {
        height: '100%',
        width: '100%',
        videoId: '',
        playerVars: {
            'autoplay': 1,
            'controls': 0,
            'disablekb': 1,
            'fs': 0,
            'rel': 0,
            'modestbranding': 1
        },
        events: {
            'onReady': () => {
                console.log('YT Player Ready');
                const volSlider = document.getElementById("volume-slider");
                if (volSlider && ytPlayer && typeof ytPlayer.setVolume === "function") {
                    ytPlayer.setVolume(volSlider.value);
                }
            }
        }
    });
};

function loadYouTubeAPI() {
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    if (firstScriptTag && firstScriptTag.parentNode) {
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    } else {
        document.head.appendChild(tag);
    }
}

// Game State Variables
let selectedSong = null;
let currentLineIndex = 0;
let currentHiraTarget = "";
let currentKanjiTarget = "";
let battleTargetUnits = [];
let currentUnitIndex = 0;
let currentBuffer = "";
let startWpmTime = 0;
let totalKeysTyped = 0;
let typoCount = 0;
let myProgress = 0;

// 점수 계산용 변수 (혼자하기 모드와 동일한 방식 적용)
let totalRemainingTime = 0;
let totalTimeSum = 0;
let currentLineTypingStartTime = 0;
let totalTargetCorrectChars = 0;
let totalCorrectChars = 0;

// Sync and Timing variables
let syncTimer = null;
let currentSectionDuration = 0;
let currentLineElapsed = 0;
let lineCompleted = false;
let isWaitingPhase = false;
let savedSectionRemaining = 0;
let isYoutubeMode = false;

// Opponents
let opponents = {};

document.addEventListener("DOMContentLoaded", () => {
    // Check login state
    const sessUser = sessionStorage.getItem('ep_user');
    if (sessUser) {
        try {
            const parsed = JSON.parse(sessUser);
            myUser.nickname = parsed.nickname || "나 (플레이어)";
            myUser.email = parsed.email;
            myUser.avatar = myUser.nickname.charAt(0).toUpperCase();
        } catch (e) { }
    } else {
        alert("로그인이 필요합니다.");
        location.href = "login.html";
        return;
    }

    const volumeSlider = document.getElementById("volume-slider");
    const volumeDisplay = document.getElementById("volume-display");
    if (volumeSlider && volumeDisplay) {
        volumeSlider.addEventListener("input", (e) => {
            const val = e.target.value;
            volumeDisplay.innerText = val + "%";
            if (ytPlayer && typeof ytPlayer.setVolume === "function") {
                ytPlayer.setVolume(val);
            }
        });
    }

    fetchBackendSongs();
    loadYouTubeAPI();
});

// 1. HTTP API & Lobby Socket
async function fetchBackendSongs() {
    try {
        const res = await fetch('/api/typing-contents');
        const data = await res.json();
        if (data.success && data.data && data.data.length > 0) {
            const seen = new Set();
            databaseSongs = [];
            data.data.forEach(item => {
                const key = `${item.title}__${item.artist}`;
                if (seen.has(key)) return;
                seen.add(key);
                databaseSongs.push({
                    id: item.id,
                    title: item.title,
                    artist: item.artist || "알 수 없음",
                    lines: (item.lyrics || "").split('\n').filter(l => l.trim()),
                    hiragana_lines: (item.hiragana || "").split('\n').filter(l => l.trim()),
                    romaji_lines: (item.romaji || "").split('\n').filter(l => l.trim()),
                    youtube_id: item.youtube_id,
                    timestamps: (item.timestamps || "").split('\n').map(t => parseFloat(t.trim())).filter(t => !isNaN(t)),
                    difficulty: item.difficulty || 3,
                    play_count: item.play_count || 0,
                    genre: item.genre || "",
                    creator_nickname: item.creator_nickname || "엔터핑"
                });
            });
            databaseSongs = databaseSongs.filter(song => song.romaji_lines.length > 0 && song.lines.length > 0);
        }
    } catch (e) {
        console.log("Failed to fetch songs");
    }

    const selectIds = ["create-song-select", "page-create-song-select"];
    selectIds.forEach(id => {
        const selectEl = document.getElementById(id);
        if (!selectEl) return;
        selectEl.innerHTML = "";
        databaseSongs.forEach(song => {
            const opt = document.createElement("option");
            opt.value = song.id;
            opt.textContent = `${song.title} - ${song.artist}`;
            selectEl.appendChild(opt);
        });
    });
}

// 2. Room Join & Create
function goToCreateRoomPage() {
    switchView("view-create-room");
}

function joinRoomByCode() {
    const code = document.getElementById("join-code-input").value.trim();
    if (code.length !== 4) {
        alert("4자리 방 코드를 올바르게 입력해주세요!");
        return;
    }
    connectToBattleRoom(code);
}

function joinRoomByEntranceCode() {
    const code = document.getElementById("entrance-join-code").value.trim();
    if (code.length !== 4) {
        alert("4자리 방 코드를 올바르게 입력해주세요!");
        return;
    }
    connectToBattleRoom(code);
}


async function createRoomFromPageSubmit() {
    const title = document.getElementById("page-create-title-input").value.trim() || "즐거운 대전방";
    const songSelect = document.getElementById("page-create-song-select");
    if (!songSelect || !songSelect.value) {
        alert("선택 가능한 타이핑 콘텐츠가 없습니다.");
        return;
    }
    const songId = parseInt(songSelect.value);
    const maxSlots = parseInt(document.getElementById("page-create-slots-select").value);

    await createBattleRoom(title, songId, maxSlots);
}

async function createBattleRoom(title, songId, maxSlots) {
    const token = sessionStorage.getItem('ep_token');
    try {
        const res = await fetch('/api/battle/rooms', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                title: title,
                song_id: songId,
                max_players: maxSlots
            })
        });
        const data = await res.json();
        if (data.success) {
            connectToBattleRoom(data.room_code);
        } else {
            alert(data.detail || "방 생성에 실패했습니다.");
        }
    } catch (e) {
        alert("오류가 발생했습니다.");
    }
}

// 3. Battle WebSocket Logic
function connectToBattleRoom(roomCode) {
    const token = sessionStorage.getItem('ep_token');
    if (!token) {
        alert("로그인이 필요합니다.");
        location.href = "login.html";
        return;
    }

    if (battleSocket) {
        battleSocket.close();
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    battleSocket = new WebSocket(`${protocol}//${window.location.host}/ws/battle/${roomCode}?token=${token}`);

    battleSocket.onopen = () => {
        console.log("Battle Room Connected");
        myUser.ready = false;
        myUser.finished = false;
    };

    battleSocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log("WS MESSAGE:", data);

        switch (data.type) {
            case "error":
                alert(data.message);
                break;
            case "room_state":
                currentRoom = data.room;
                isHost = currentRoom.host === myUser.nickname;
                opponents = currentRoom.players;

                // Set selected song
                const songObj = databaseSongs.find(s => s.id === currentRoom.song_id);
                if (songObj) {
                    selectedSong = songObj;
                    console.log(`[Battle] 선택된 곡: ${songObj.title}, timestamps: [${(songObj.timestamps || []).join(', ')}]`);
                } else {
                    // databaseSongs가 아직 안 로드됐을 경우 직접 API 조회
                    console.warn(`[Battle] song_id=${currentRoom.song_id} 를 databaseSongs에서 못 찾음. API 직접 조회 시도.`);
                    fetch(`/api/typing-content/${currentRoom.song_id}`)
                        .then(r => r.json())
                        .then(data => {
                            if (data.success) {
                                selectedSong = {
                                    id: data.id,
                                    title: data.title,
                                    artist: data.artist || "알 수 없음",
                                    lines: data.lines || [],
                                    hiragana_lines: data.hiragana_lines || data.lines || [],
                                    romaji_lines: data.romaji_lines || [],
                                    youtube_id: data.youtube_id,
                                    timestamps: data.timestamps
                                        ? data.timestamps.split('\n').map(t => parseFloat(t.trim())).filter(t => !isNaN(t))
                                        : [],
                                    difficulty: data.difficulty || 3,
                                    play_count: data.play_count || 0,
                                    genre: data.genre || "",
                                    creator_nickname: data.creator_nickname || "엔터핑"
                                };
                                console.log(`[Battle] fallback 조회 성공: ${data.title}, timestamps: [${selectedSong.timestamps.join(', ')}]`);
                                updateVideoInfoPanel();
                                // 유튜브 사전 버퍼링 재시도
                                if (ytPlayer && typeof ytPlayer.cueVideoById === 'function' && selectedSong.youtube_id) {
                                    ytPlayer.cueVideoById(selectedSong.youtube_id);
                                }
                            }
                        })
                        .catch(err => console.error('[Battle] fallback 곡 조회 실패:', err));
                }

                enterWaitingRoom();
                break;
            case "player_joined":
                opponents = data.players;
                appendSystemChat(`${data.nickname}님이 입장하셨습니다.`);
                renderPlayersInLobby();
                break;
            case "player_left":
                opponents = data.players;
                currentRoom.host = data.new_host;
                isHost = currentRoom.host === myUser.nickname;
                appendSystemChat(`${data.nickname}님이 퇴장하셨습니다.`);
                updateReadyButton();
                renderPlayersInLobby();
                break;
            case "player_disconnected":
                if (data.players) opponents = data.players;
                if (data.new_host) {
                    currentRoom.host = data.new_host;
                    isHost = currentRoom.host === myUser.nickname;
                }
                appendSystemChat(`${data.nickname}님이 대전 중 퇴장하셨습니다.`);
                if (currentRoom && currentRoom.status === "playing") {
                    renderLiveRanking();
                }
                break;
            case "player_update":
                if (data.players) {
                    opponents = data.players;
                } else if (data.nickname) {
                    if (!opponents[data.nickname]) {
                        opponents[data.nickname] = { progress: 0, wpm: 0, score: 0, ready: false, is_host: false };
                    }
                    opponents[data.nickname].progress = data.progress;
                    opponents[data.nickname].wpm = data.wpm;
                    opponents[data.nickname].score = data.score;
                }
                renderPlayersInLobby();
                if (currentRoom && currentRoom.status === "playing") {
                    renderLiveRanking();
                }
                break;
            case "sync_check":
                showSyncUI();
                checkAndSendSyncReady();
                break;
            case "countdown":
                hideSyncUI();
                showCountdown(data.count);
                break;
            case "game_start":
                if (currentRoom) currentRoom.status = "playing"; // syncTimer 조건 통과용
                startGamePlay();
                break;
            case "player_finished":
                opponents = data.players;
                appendSystemChat(`${data.nickname}님이 게임을 완료했습니다!`);
                renderLiveRanking();
                break;
            case "game_end":
                showResultsScreen(data.results);
                break;
            case "chat":
                appendOpponentChat(data.nickname, data.message);
                break;
        }
    };

    battleSocket.onclose = (event) => {
        console.log("Battle Socket Closed", event.code);
        if (event.code === 4001) alert("인증에 실패했습니다.");
        else if (event.code === 4003) alert("방이 가득 찼습니다.");
        else if (event.code === 4004) alert("존재하지 않는 방입니다.");

        if (currentRoom) {
            currentRoom = null;
            returnToLobby();
        }
    };
}

// 4. UI Rendering
function updateVideoInfoPanel() {
    const infoTitle = document.getElementById("info-title");
    const infoArtist = document.getElementById("info-artist");
    const infoCreator = document.getElementById("info-creator");
    const infoThumbnail = document.getElementById("info-thumbnail");
    const infoAvatarPlaceholder = document.getElementById("info-avatar-placeholder");
    const infoViews = document.getElementById("info-views");
    const infoTags = document.getElementById("info-tags");
    const timeEl = document.getElementById("time");

    if (!selectedSong) return;

    if (infoTitle) infoTitle.innerText = selectedSong.title || "제목 없음";
    if (infoArtist) infoArtist.innerText = selectedSong.artist || "아티스트 미상";
    if (infoViews) infoViews.innerText = selectedSong.play_count || "0";
    if (timeEl) timeEl.innerText = "0";

    if (infoTags) {
        infoTags.innerHTML = "";
        if (selectedSong.genre) {
            const genres = selectedSong.genre.split(',').map(g => g.trim());
            genres.forEach(g => {
                const tagSpan = document.createElement("span");
                tagSpan.style.cssText = "background: rgba(0,0,0,0.03); padding: 3px 8px; border-radius: 10px; font-size: 0.75rem; font-weight: bold; color: var(--color-battle-text-muted); border: 1.5px solid rgba(0,0,0,0.05);";
                tagSpan.innerText = g;
                infoTags.appendChild(tagSpan);
            });
        } else {
            infoTags.innerHTML = '<span style="background: rgba(0,0,0,0.03); padding: 3px 8px; border-radius: 10px; font-size: 0.75rem; font-weight: bold; color: var(--color-battle-text-muted); border: 1.5px solid rgba(0,0,0,0.05);">태그 없음</span>';
        }
    }

    if (selectedSong.youtube_id) {
        if (infoThumbnail) {
            infoThumbnail.src = `https://img.youtube.com/vi/${selectedSong.youtube_id}/mqdefault.jpg`;
            infoThumbnail.style.display = "block";
        }
        if (infoAvatarPlaceholder) infoAvatarPlaceholder.style.display = "none";
        
        if (infoCreator) infoCreator.innerText = "로딩 중...";
        fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${selectedSong.youtube_id}&format=json`)
            .then(res => res.json())
            .then(oEmbedData => {
                if (infoCreator && oEmbedData.author_name) {
                    infoCreator.innerText = oEmbedData.author_name;
                } else if (infoCreator) {
                    infoCreator.innerText = selectedSong.creator_nickname || "엔터핑";
                }
            })
            .catch(err => {
                if (infoCreator) infoCreator.innerText = selectedSong.creator_nickname || "엔터핑";
            });
    } else {
        if (infoCreator) infoCreator.innerText = selectedSong.creator_nickname || "엔터핑";
        if (infoThumbnail) infoThumbnail.style.display = "none";
        if (infoAvatarPlaceholder) infoAvatarPlaceholder.style.display = "flex";
    }
}

function enterWaitingRoom() {
    switchView("view-waiting");
    updateVideoInfoPanel();

    document.getElementById("wait-room-title").textContent = currentRoom.title;
    document.getElementById("wait-room-code").innerHTML = `코드: ${currentRoom.code} <span style="font-size: 0.85rem;">📋</span>`;
    document.getElementById("wait-song-title").textContent = currentRoom.song_title;
    document.getElementById("wait-song-artist").textContent = currentRoom.song_artist;

    updateReadyButton();

    const chatMsgs = document.getElementById("chat-messages");
    chatMsgs.innerHTML = `<div class="chat-bubble system">대전방(#${currentRoom.code})에 입장했습니다!</div>`;

    renderPlayersInLobby();

    // 비디오 동기화를 위해 대기실 입장 시 사전 버퍼링
    if (ytPlayer && typeof ytPlayer.cueVideoById === 'function' && selectedSong && selectedSong.youtube_id) {
        ytPlayer.cueVideoById(selectedSong.youtube_id);
    }
}

window.copyRoomCode = function () {
    if (currentRoom && currentRoom.code) {
        const textToCopy = currentRoom.code;

        function showSuccess() {
            const el = document.getElementById("wait-room-code");
            const originalHTML = el.innerHTML;
            el.innerHTML = `복사되었습니다! <span style="font-size: 0.85rem;">✅</span>`;
            setTimeout(() => {
                el.innerHTML = originalHTML;
            }, 1500);
        }

        if (!navigator.clipboard) {
            // HTTP 등 안전하지 않은 환경(Secure Context 아님)에서의 Fallback
            const textArea = document.createElement("textarea");
            textArea.value = textToCopy;
            textArea.style.top = "0";
            textArea.style.left = "0";
            textArea.style.position = "fixed";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                if (document.execCommand('copy')) showSuccess();
                else alert("복사 실패. 수동으로 복사해주세요.");
            } catch (err) {
                alert("복사 기능이 지원되지 않는 브라우저입니다.");
            }
            document.body.removeChild(textArea);
            return;
        }

        // HTTPS 또는 localhost 환경
        navigator.clipboard.writeText(textToCopy).then(() => {
            showSuccess();
        }).catch(err => {
            console.error('복사 실패:', err);
            alert("복사를 지원하지 않는 브라우저입니다.");
        });
    }
};

function updateReadyButton() {
    const actionBtn = document.getElementById("btn-ready-start");
    if (isHost) {
        actionBtn.textContent = "시작하기";
        actionBtn.className = "btn-battle btn-battle-primary";
        // Check if all others ready
        const allReady = Object.entries(opponents).every(([nick, p]) => nick === myUser.nickname || p.ready);
        actionBtn.style.opacity = allReady ? "1" : "0.6";
        actionBtn.style.pointerEvents = allReady ? "auto" : "none";
    } else {
        actionBtn.textContent = myUser.ready ? "준비 해제" : "준비 완료";
        actionBtn.className = myUser.ready ? "btn-battle btn-battle-primary" : "btn-battle btn-battle-secondary";
        actionBtn.style.opacity = "1";
        actionBtn.style.pointerEvents = "auto";
    }
}

function renderPlayersInLobby() {
    const grid = document.getElementById("wait-player-grid");
    if (!grid) return;
    grid.innerHTML = "";

    const maxUsers = currentRoom.maxPlayers || currentRoom.max_players || 4;

    // Sort players so host is first, then me, then others
    let playerList = Object.entries(opponents).map(([nick, p]) => ({ nickname: nick, ...p }));
    playerList.sort((a, b) => {
        if (a.is_host) return -1;
        if (b.is_host) return 1;
        if (a.nickname === myUser.nickname) return -1;
        if (b.nickname === myUser.nickname) return 1;
        return 0;
    });

    playerList.forEach(p => {
        const isMe = p.nickname === myUser.nickname;
        const avatar = p.nickname.charAt(0).toUpperCase();

        const card = document.createElement("div");
        card.className = "player-card active-slot";

        let statusTag = '';
        if (p.is_host) {
            statusTag = `<span class="player-status-tag host">방장</span>`;
        } else if (p.ready) {
            statusTag = `<span class="player-status-tag ready">준비 완료</span>`;
        } else {
            statusTag = `<span class="player-status-tag waiting">대기 중</span>`;
        }

        card.innerHTML = `
            <div class="player-avatar-large" style="${isMe ? 'background: linear-gradient(135deg, #ff7b8e, #ffd17b)' : ''}">${avatar}</div>
            <div class="player-info">
                <div class="player-name">${p.nickname} ${isMe ? '(나)' : ''}</div>
                ${statusTag}
            </div>
        `;
        grid.appendChild(card);
    });

    // Fill empty slots
    for (let i = playerList.length; i < maxUsers; i++) {
        const card = document.createElement("div");
        card.className = "player-card empty-slot";
        card.innerHTML = `<div>👤 대기 중...</div>`;
        grid.appendChild(card);
    }

    updateReadyButton();
}

function onReadyOrStartClick() {
    if (isHost) {
        battleSocket.send(JSON.stringify({ type: "start" }));
    } else {
        myUser.ready = !myUser.ready;
        battleSocket.send(JSON.stringify({ type: "ready", ready: myUser.ready }));
    }
}

// 5. Chat System
function sendChatMessage() {
    const input = document.getElementById("chat-input");
    const text = input.value.trim();
    if (!text) return;

    appendUserChat(myUser.nickname, text);
    input.value = "";
    if (battleSocket && battleSocket.readyState === WebSocket.OPEN) {
        battleSocket.send(JSON.stringify({ type: "chat", message: text }));
    }
}

function appendUserChat(sender, message) {
    const container = document.getElementById("chat-messages");
    const bubble = document.createElement("div");
    bubble.className = "chat-bubble me";
    bubble.innerHTML = `<div class="chat-sender" style="color:#ffd17b">${sender}</div>${escapeHTML(message)}`;
    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;
}

function appendOpponentChat(sender, message) {
    const container = document.getElementById("chat-messages");
    if (!container) return;
    const bubble = document.createElement("div");
    bubble.className = "chat-bubble"; // no 'me' class means it's from opponent
    bubble.innerHTML = `<div class="chat-sender" style="color:var(--color-battle-accent)">${sender}</div>${escapeHTML(message)}`;
    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;
}

function appendSystemChat(message) {
    const container = document.getElementById("chat-messages");
    if (!container) return;
    const bubble = document.createElement("div");
    bubble.className = "chat-bubble system";
    bubble.textContent = message;
    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;
}

function escapeHTML(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// 6. Gameplay
let syncCheckInterval = null;

function showSyncUI() {
    const overlay = document.getElementById("countdown-overlay");
    const countNum = document.getElementById("countdown-num");
    overlay.style.display = "flex";
    countNum.innerHTML = `<span style="font-size:1.5rem;">영상 로딩 동기화 중...</span><br><span style="font-size:1rem;">다른 플레이어를 기다리고 있습니다.</span>`;
}


function checkAndSendSyncReady() {
    if (!selectedSong || !selectedSong.youtube_id) {
        battleSocket.send(JSON.stringify({ type: "sync_ready" }));
        return;
    }

    if (ytPlayer && typeof ytPlayer.cueVideoById === 'function') {
        ytPlayer.cueVideoById(selectedSong.youtube_id);
    }

    const checkState = () => {
        if (!ytPlayer || typeof ytPlayer.getPlayerState !== 'function') {
            return;
        }
        const state = ytPlayer.getPlayerState();
        if (state === YT.PlayerState.CUED || state === YT.PlayerState.PLAYING || state === YT.PlayerState.PAUSED) {
            if (state === YT.PlayerState.PLAYING) ytPlayer.pauseVideo();
            if (syncCheckInterval) clearInterval(syncCheckInterval);
            battleSocket.send(JSON.stringify({ type: "sync_ready" }));
        } else if (state === YT.PlayerState.UNSTARTED || state == null) {
            if (typeof ytPlayer.playVideo === 'function') ytPlayer.playVideo();
            setTimeout(() => {
                if (typeof ytPlayer.getPlayerState === 'function' && ytPlayer.getPlayerState() === YT.PlayerState.PLAYING) {
                    ytPlayer.pauseVideo();
                }
            }, 100);
        }
    };

    syncCheckInterval = setInterval(checkState, 500);
    checkState(); // Check immediately
}

function hideSyncUI() {
    // showCountdown이 오버레이를 직접 업데이트하므로 별도 처리 불필요
}

function showCountdown(count) {
    const overlay = document.getElementById("countdown-overlay");
    const countNum = document.getElementById("countdown-num");
    overlay.style.display = "flex";
    countNum.textContent = count;
}

function renderWaitingPhase() {
    const song = selectedSong;
    const totalLines = song.lines.length;
    document.getElementById("game-stage-indicator").textContent = `STAGE ${currentLineIndex + 1} / ${totalLines}`;
    document.getElementById("game-kanji-display").textContent = "준비 중...";
    document.getElementById("game-next-display").textContent = `Next - ${song.lines[currentLineIndex] || "-"}`;
    document.getElementById("game-lyric-display").innerHTML = "<span class='lyric-unit pending'><span class='hira-text'>-</span><span class='roma-text'><span>-</span></span></span>";

    const input = document.getElementById("game-typing-input");
    input.value = "";
    input.disabled = true;
    input.placeholder = currentLineIndex === 0 ? "전주 재생 중... 대기하세요 ⏳" : "다음 가사 대기 중... ⏳";

    const statusPanel = document.getElementById("game-status-panel");
    if (statusPanel) {
        statusPanel.innerHTML = '<span style="color: #666;">곧 가사가 시작됩니다. 대기하세요...</span>';
    }

    battleTargetUnits = [];
    currentBuffer = "";
}

// battle.js 의 startSyncLoop 함수 전체 교체
function startSyncLoop() {
    if (syncTimer) clearInterval(syncTimer);
    if (!currentRoom || currentRoom.status !== "playing") return;

    const song = selectedSong;
    if (!song) return;

    const progressBar = document.getElementById("game-progress-fill");
    if (progressBar) progressBar.style.width = "0%";

    let duration = 50.0;
    if (song.timestamps && song.timestamps.length > currentLineIndex + 1 && song.timestamps[currentLineIndex] !== undefined) {
        duration = song.timestamps[currentLineIndex + 1] - song.timestamps[currentLineIndex];
        if (duration <= 0) duration = 0.1;
    } else if (song.timestamps && song.timestamps[currentLineIndex] !== undefined) {
        if (ytPlayer && typeof ytPlayer.getDuration === 'function') {
            let totalDur = ytPlayer.getDuration();
            if (totalDur > 0) {
                duration = totalDur - song.timestamps[currentLineIndex];
                if (duration <= 0) duration = 5.0;
            }
        }
    }

    currentSectionDuration = duration;
    currentLineElapsed = 0;

    // 가상 타이머: YouTube가 일시 중단됐을 때 경과 시간을 추적
    // YouTube 현재 시간으로 초기화 (0에서 시작하면 timestamps[0]까지 두 번 대기하는 버그)
    let simulatedTime = (ytPlayer && typeof ytPlayer.getCurrentTime === 'function')
        ? ytPlayer.getCurrentTime()
        : 0;
    let lastTickTime = Date.now();

    syncTimer = setInterval(() => {
        if (currentRoom?.status !== "playing") {
            clearInterval(syncTimer);
            return;
        }

        // 👇 가상 시간 흐름 계산 (현실 시간 기반)
        let now = Date.now();
        let delta = (now - lastTickTime) / 1000;
        lastTickTime = now;

        if (isYoutubeMode && ytPlayer && typeof ytPlayer.getCurrentTime === 'function') {
            let state = typeof ytPlayer.getPlayerState === 'function' ? ytPlayer.getPlayerState() : -1;
            let currentTime;

            // state: 1=PLAYING, 3=BUFFERING, -1=초기화중, 0=종료, 2=일시정지
            if (state === 1) { // YT.PlayerState.PLAYING
                currentTime = ytPlayer.getCurrentTime();
                simulatedTime = currentTime;
            } else if (state === -1) {
                // 초기화 중 - simulatedTime 유지, 재생 시도
                simulatedTime += delta;
                currentTime = simulatedTime;
                if (typeof ytPlayer.playVideo === 'function') ytPlayer.playVideo();
            } else {
                // 일시정지 / 버퍼링 - 가상 시간 사용
                simulatedTime += delta;
                currentTime = simulatedTime;
                // 버퍼링(3) 제외하고 재생 요청
                if (state !== 3 && typeof ytPlayer.playVideo === 'function') {
                    ytPlayer.playVideo();
                }
            }

            if (ytPlayer.getDuration) {
                let totalDur = Math.round(ytPlayer.getDuration());
                let timeLeft = Math.max(0, Math.round(totalDur - currentTime));
                const timeEl = document.getElementById("time");
                if (timeEl) timeEl.innerText = timeLeft;
            }

            if (song.timestamps && song.timestamps[currentLineIndex] !== undefined) {
                let lineStartTime = song.timestamps[currentLineIndex];
                currentLineElapsed = currentTime - lineStartTime;

                if (currentLineElapsed < 0) {
                    if (!isWaitingPhase) {
                        isWaitingPhase = true;
                        renderWaitingPhase();
                    }

                    let prevLineStartTime = 0;
                    if (currentLineIndex > 0 && song.timestamps[currentLineIndex - 1] !== undefined) {
                        prevLineStartTime = song.timestamps[currentLineIndex - 1];
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
                        loadGameplayLine(); // ⏳ 이제 막히지 않고 가사가 화면에 뜹니다!
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
            // 유튜브가 아예 연결 안 됐을 때도 강제로 시간 흐르게 처리
            currentLineElapsed += 0.05;
            let remaining = duration - currentLineElapsed;
            if (remaining <= 0) {
                forceSkipToNextLine();
            } else {
                let percent = (currentLineElapsed / duration) * 100;
                if (percent < 0) percent = 0;
                if (percent > 100) percent = 100;
                if (progressBar) progressBar.style.width = percent + "%";
            }
        }
    }, 50);
}

function forceSkipToNextLine() {
    const song = selectedSong;
    if (!song) return;

    const lineRomaji = song.romaji_lines[currentLineIndex] || "";
    const lineRomajiLen = lineRomaji.replace(/\s+/g, "").length;
    const lineCorrect = getCompletedRomajiLength(battleTargetUnits, currentUnitIndex) + currentBuffer.length;

    if (!lineCompleted) {
        // Time limit expired, user didn't finish
        const missedCount = Math.max(0, lineRomajiLen - lineCorrect);
        typoCount += missedCount;
        totalKeysTyped += missedCount;

        totalCorrectChars += lineCorrect;
        totalRemainingTime += 0;
    } else {
        // User finished earlier
        totalCorrectChars += lineRomajiLen;
        totalRemainingTime += savedSectionRemaining;
    }

    totalTargetCorrectChars += lineRomajiLen;
    totalTimeSum += currentSectionDuration;

    lineCompleted = false;
    const input = document.getElementById("game-typing-input");
    if (input) input.disabled = false;

    currentLineIndex++;

    if (currentLineIndex >= song.lines.length) {
        finishMyTypingGame();
    } else {
        loadGameplayLine();
        startSyncLoop();
    }
}

function handleLineCompletion() {
    if (lineCompleted) return;
    lineCompleted = true;

    let elapsed = currentLineElapsed;
    if (elapsed < 0) elapsed = 0;
    savedSectionRemaining = Math.max(0, currentSectionDuration - elapsed);

    const input = document.getElementById("game-typing-input");
    if (input) {
        input.disabled = true;
        input.placeholder = "가사를 모두 입력했습니다. 대기 중... ⏳";
    }

    const statusPanel = document.getElementById("game-status-panel");
    if (statusPanel) {
        statusPanel.innerHTML = '<span class="success-text">✨ 문장을 모두 입력했습니다. 다음 문장까지 기다리는 중...</span>';
    }

    calculateMyProgress();
}

function startGamePlay() {
    const overlay = document.getElementById("countdown-overlay");
    overlay.style.display = "none";

    switchView("view-gameplay");
    updateVideoInfoPanel();

    currentLineIndex = 0;
    totalKeysTyped = 0;
    typoCount = 0;
    myProgress = 0;
    startWpmTime = Date.now();

    // 점수 변수 초기화
    totalRemainingTime = 0;
    totalTimeSum = 0;
    totalTargetCorrectChars = 0;
    totalCorrectChars = 0;
    currentLineTypingStartTime = Date.now();

    const input = document.getElementById("game-typing-input");
    input.value = "";
    input.disabled = true; // 게임 시작 직후에는 무조건 잠금
    input.placeholder = "전주 재생 중... 대기하세요 ⏳";
    input.oninput = handleTypingInput;

    if (syncTimer) clearInterval(syncTimer);

    if (ytPlayer && selectedSong.youtube_id && typeof ytPlayer.playVideo === 'function') {
        // 이미 cue 되어 있으므로 바로 play
        ytPlayer.playVideo();
    }

    isYoutubeMode = !!(ytPlayer && typeof ytPlayer.playVideo === 'function' && selectedSong && selectedSong.youtube_id);

    const song = selectedSong;
    if (isYoutubeMode && song.timestamps && song.timestamps.length > 0 && song.timestamps[0] > 0) {
        isWaitingPhase = true;
        renderWaitingPhase();
    } else {
        isWaitingPhase = false;
        loadGameplayLine();
    }

    startSyncLoop();
    renderLiveRanking();
}


function loadGameplayLine() {
    const song = selectedSong;
    if (!song) {
        console.error('[Battle] loadGameplayLine: selectedSong이 없습니다.');
        return;
    }
    if (!song.lines || !song.lines.length) {
        console.error('[Battle] loadGameplayLine: song.lines가 비어있습니다. selectedSong:', song);
        return;
    }

    const totalLines = song.lines.length;

    if (currentLineIndex >= totalLines) {
        finishMyTypingGame();
        return;
    }

    document.getElementById("game-stage-indicator").textContent = `STAGE ${currentLineIndex + 1} / ${totalLines}`;

    currentKanjiTarget = song.lines[currentLineIndex];
    currentHiraTarget = song.hiragana_lines[currentLineIndex];

    if (typeof parseKanaToTargetUnits === 'function') {
        battleTargetUnits = parseKanaToTargetUnits(currentHiraTarget.replace(/\s+/g, ""), true);
    } else {
        battleTargetUnits = [{ text: currentHiraTarget, validInputs: [song.romaji_lines[currentLineIndex].toLowerCase().replace(/\s+/g, "")] }];
    }
    currentUnitIndex = 0;
    currentBuffer = "";

    document.getElementById("game-kanji-display").textContent = currentKanjiTarget;

    const nextIdx = currentLineIndex + 1;
    if (nextIdx < totalLines) {
        document.getElementById("game-next-display").textContent = `Next - ${song.lines[nextIdx]}`;
    } else {
        document.getElementById("game-next-display").textContent = "Next - 마지막 소절입니다!";
    }

    renderActiveLyrics();
    highlightCurrentChar();

    const input = document.getElementById("game-typing-input");
    input.value = "";

    input.disabled = false;
    input.placeholder = "여기에 가사 로마자를 타이핑하세요...";
    input.focus();
    currentLineTypingStartTime = Date.now();
}

function renderActiveLyrics() {
    const container = document.getElementById("game-lyric-display");
    container.innerHTML = "";

    battleTargetUnits.forEach((unit, idx) => {
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
        container.appendChild(span);
    });
}



function highlightCurrentChar() {
    const lyricDisplay = document.getElementById("game-lyric-display");
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

            const unit = battleTargetUnits[idx];
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

    const statusPanel = document.getElementById("game-status-panel");
    if (statusPanel) {
        const currentUnit = battleTargetUnits[currentUnitIndex];
        if (currentUnit) {
            if (currentBuffer.length > 0) {
                statusPanel.innerHTML = `현재 입력 위치: <span class="typing-now">${currentUnit.text}</span> 입력 중... (입력된 조합: <span class="typing-now">${currentBuffer}</span>)`;
            } else {
                statusPanel.innerHTML = `현재 입력 위치: <span class="typing-now">${currentUnit.text}</span>`;
            }
        } else {
            statusPanel.textContent = "입력 완료!";
        }
    }
}

function handleTypingInput(e) {
    let rawValue = e.target.value;
    let convertedValue = ko2en(rawValue);
    if (rawValue !== convertedValue) {
        e.target.value = convertedValue;
    }

    let typedValue = convertedValue.toLowerCase();
    if (!battleTargetUnits || currentUnitIndex >= battleTargetUnits.length) return;

    if (typedValue.length < currentBuffer.length) {
        currentBuffer = typedValue;
        highlightCurrentChar();
        return;
    }

    const newChar = typedValue.charAt(typedValue.length - 1);
    const testBuffer = currentBuffer + newChar;
    const currentUnit = battleTargetUnits[currentUnitIndex];

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

    totalKeysTyped++;

    if (!isCompleteMatch && !isPossiblePrefix) {
        typoCount++;
        e.target.value = currentBuffer;

        const inputEl = document.getElementById("game-typing-input");
        inputEl.style.borderColor = "var(--color-battle-incorrect)";
        inputEl.style.boxShadow = "0 0 10px rgba(255, 74, 104, 0.4)";
        setTimeout(() => {
            inputEl.style.borderColor = "var(--color-battle-primary)";
            inputEl.style.boxShadow = "none";
        }, 150);

        updateLiveStats();
        return;
    }

    currentBuffer = testBuffer;
    if (isCompleteMatch) {
        currentUnitIndex++;
        currentBuffer = "";
        e.target.value = "";
    }

    calculateMyProgress();
    highlightCurrentChar();

    if (currentUnitIndex >= battleTargetUnits.length) {
        handleLineCompletion();
    }

    updateLiveStats();
}

function calculateScore() {
    const song = selectedSong;
    if (!song) return 0;

    let accuracyVal = 1.0;
    if (totalKeysTyped > 0) {
        accuracyVal = (totalKeysTyped - typoCount) / totalKeysTyped;
    }

    const currentLineRomaji = song.romaji_lines[currentLineIndex] || "";
    const currentLineRomajiLen = currentLineRomaji.replace(/\s+/g, "").length;
    const currentLineCorrect = getCompletedRomajiLength(battleTargetUnits, currentUnitIndex) + currentBuffer.length;

    const tempTotalCorrect = totalCorrectChars + currentLineCorrect;
    const tempTotalTarget = totalTargetCorrectChars + currentLineRomajiLen;

    let duration = 5.0;
    if (song.timestamps && song.timestamps.length > currentLineIndex + 1 && song.timestamps[currentLineIndex] !== undefined) {
        duration = song.timestamps[currentLineIndex + 1] - song.timestamps[currentLineIndex];
    } else if (ytPlayer && typeof ytPlayer.getDuration === 'function') {
        let totalDur = ytPlayer.getDuration();
        if (totalDur > 0 && song.timestamps && song.timestamps[currentLineIndex] !== undefined) {
            duration = totalDur - song.timestamps[currentLineIndex];
        }
    }
    let currentRemaining = 0;
    if (!lineCompleted) {
        const elapsedForLine = currentLineTypingStartTime ? (Date.now() - currentLineTypingStartTime) / 1000 : 0;
        currentRemaining = Math.max(0, duration - elapsedForLine);
    } else {
        currentRemaining = savedSectionRemaining;
    }

    const tempTotalRemaining = totalRemainingTime + currentRemaining;
    const tempTotalTimeSum = totalTimeSum + duration;

    const typingRatio = tempTotalTarget > 0 ? tempTotalCorrect / tempTotalTarget : 0;
    const timeRatio = tempTotalTimeSum > 0 ? tempTotalRemaining / tempTotalTimeSum : 0;

    return calculateTypingScore(accuracyVal, typingRatio, timeRatio, song.difficulty);
}

function calculateMyProgress() {
    const song = selectedSong;
    let totalChars = 0;
    song.romaji_lines.forEach(line => {
        totalChars += line.replace(/\s+/g, "").length;
    });

    let typedTotal = 0;
    for (let i = 0; i < currentLineIndex; i++) {
        typedTotal += song.romaji_lines[i].replace(/\s+/g, "").length;
    }
    typedTotal += getCompletedRomajiLength(battleTargetUnits, currentUnitIndex) + currentBuffer.length;

    myProgress = Math.min(Math.round((typedTotal / totalChars) * 100), 100);

    // Overall progress is not displayed on game-progress-fill, which is used for current line timer

    const currentScore = calculateScore();

    // 내 화면의 순위표(progress)도 즉시 업데이트되도록 로컬 opponents 수정
    if (opponents && opponents[myUser.nickname]) {
        opponents[myUser.nickname].progress = myProgress;
        opponents[myUser.nickname].wpm = parseInt(document.getElementById("game-wpm").textContent) || 0;
        opponents[myUser.nickname].score = currentScore;
    }
    renderLiveRanking();

    // Broadcast progress
    const wpm = parseInt(document.getElementById("game-wpm").textContent) || 0;
    const accuracy = parseInt(document.getElementById("game-accuracy").textContent) || 100;

    if (battleSocket && battleSocket.readyState === WebSocket.OPEN) {
        battleSocket.send(JSON.stringify({
            type: "progress",
            progress: myProgress,
            wpm: wpm,
            accuracy: accuracy,
            score: currentScore
        }));
    }
    renderLiveRanking();
}

function updateLiveStats() {
    const timeElapsed = (Date.now() - startWpmTime) / 1000 / 60;
    const correctKeys = totalKeysTyped - typoCount;

    let wpm = 0;
    if (timeElapsed > 0) {
        wpm = Math.round((correctKeys / 5) / timeElapsed);
    }

    let accuracy = 100;
    if (totalKeysTyped > 0) {
        accuracy = Math.round(((totalKeysTyped - typoCount) / totalKeysTyped) * 100);
    }

    document.getElementById("game-wpm").textContent = wpm;
    document.getElementById("game-accuracy").textContent = `${accuracy}%`;
}

function finishMyTypingGame() {
    if (syncTimer) clearInterval(syncTimer);
    const input = document.getElementById("game-typing-input");
    input.disabled = true;
    input.value = "완료!";

    myUser.finished = true;
    const wpm = parseInt(document.getElementById("game-wpm").textContent) || 0;
    const accuracy = parseInt(document.getElementById("game-accuracy").textContent) || 100;

    const currentScore = calculateScore();
    if (battleSocket && battleSocket.readyState === WebSocket.OPEN) {
        battleSocket.send(JSON.stringify({
            type: "finish",
            wpm: wpm,
            accuracy: accuracy,
            score: currentScore
        }));
    }
}

function renderLiveRanking() {
    const container = document.getElementById("live-ranking-container");
    if (!container) return;
    // ensure container supports ordering
    container.style.display = 'flex';
    container.style.flexDirection = 'column';

    let playerList = Object.entries(opponents).map(([nick, p]) => ({ nickname: nick, ...p }));
    playerList.sort((a, b) => {
        if (b.progress !== a.progress) return b.progress - a.progress;
        return b.wpm - a.wpm;
    });

    playerList.forEach((p, idx) => {
        const isMe = p.nickname === myUser.nickname;
        const avatar = p.nickname.charAt(0).toUpperCase();
        const rowId = `ranking-row-${p.nickname}`;

        let statusText = p.progress >= 100 ? 'FINISHED' : p.wpm + ' WPM';
        let rowOpacity = "1";
        let rowFilter = "none";
        if (p.disconnected) {
            statusText = "기권 (나감)";
            rowOpacity = "0.5";
            rowFilter = "grayscale(100%)";
        }

        let row = document.getElementById(rowId);

        if (!row) {
            row = document.createElement("div");
            row.id = rowId;
            row.className = `leaderboard-player-row ${isMe ? 'me' : ''}`;
            row.style.transition = "transform 0.4s ease";
            row.innerHTML = `
                <div class="player-status-line">
                    <div class="player-row-left">
                        <span class="rank-display" style="font-weight: 900; color: ${idx === 0 ? 'var(--color-battle-accent)' : '#fff'};">${idx + 1}등</span>
                        <div class="player-mini-avatar" style="${isMe ? 'background: linear-gradient(135deg, #ff7b8e, #ffd17b)' : ''}">${avatar}</div>
                        <span class="player-mini-name">${p.nickname} ${isMe ? '(나)' : ''}</span>
                    </div>
                    <div class="player-row-right">
                        <span class="player-wpm-stat">${statusText}</span>
                    </div>
                </div>
                <div class="player-progress-bar-bg" style="background: rgba(0,0,0,0.2); height: 12px; border-radius: 6px; overflow: hidden; margin-top: 8px;">
                    <div class="player-progress-bar-fill" style="width: ${p.progress}%; height: 100%; transition: width 0.3s cubic-bezier(0.25, 1, 0.5, 1); ${isMe ? 'background: linear-gradient(90deg, var(--color-battle-primary), #ffd17b)' : 'background: linear-gradient(90deg, var(--color-battle-secondary), #90ee90)'}"></div>
                </div>
            `;
            container.appendChild(row);
        } else {
            // Update existing element for smooth transition
            row.querySelector('.rank-display').textContent = `${idx + 1}등`;
            row.querySelector('.rank-display').style.color = idx === 0 ? 'var(--color-battle-accent)' : '#fff';
            row.querySelector('.player-wpm-stat').textContent = statusText;
            row.querySelector('.player-progress-bar-fill').style.width = `${p.progress}%`;
        }

        row.style.opacity = rowOpacity;
        row.style.filter = rowFilter;

        // CSS Flexbox Order for dynamic ranking swap
        row.style.order = idx;
    });
}

function showResultsScreen(results) {
    switchView("view-results");

    if (results.length > 0) {
        document.getElementById("podium-1st-name").textContent = results[0].nickname;
        document.getElementById("podium-1st-wpm").innerHTML = `
            <div style="font-weight: 800; color: var(--color-battle-primary); font-size: 0.95rem; margin-bottom: 2px;">${results[0].score}점</div>
            <div style="font-size: 0.8rem; color: var(--color-battle-text-muted); font-weight: 600;">${results[0].wpm} WPM</div>
        `;
        document.getElementById("podium-1st-avatar").textContent = results[0].nickname.charAt(0).toUpperCase();
        if (results[0].nickname === myUser.nickname) document.getElementById("podium-1st-avatar").style.background = "linear-gradient(135deg, #ff7b8e, #ffd17b)";
    }

    const pod2 = document.getElementById("podium-2nd");
    if (results.length > 1) {
        pod2.style.display = "flex";
        document.getElementById("podium-2nd-name").textContent = results[1].nickname;
        document.getElementById("podium-2nd-wpm").innerHTML = `
            <div style="font-weight: 800; color: var(--color-battle-primary); font-size: 0.95rem; margin-bottom: 2px;">${results[1].score}점</div>
            <div style="font-size: 0.8rem; color: var(--color-battle-text-muted); font-weight: 600;">${results[1].wpm} WPM</div>
        `;
        document.getElementById("podium-2nd-avatar").textContent = results[1].nickname.charAt(0).toUpperCase();
        if (results[1].nickname === myUser.nickname) document.getElementById("podium-2nd-avatar").style.background = "linear-gradient(135deg, #ff7b8e, #ffd17b)";
    } else {
        pod2.style.display = "none";
    }

    const pod3 = document.getElementById("podium-3rd");
    if (results.length > 2) {
        pod3.style.display = "flex";
        document.getElementById("podium-3rd-name").textContent = results[2].nickname;
        document.getElementById("podium-3rd-wpm").innerHTML = `
            <div style="font-weight: 800; color: var(--color-battle-primary); font-size: 0.95rem; margin-bottom: 2px;">${results[2].score}점</div>
            <div style="font-size: 0.8rem; color: var(--color-battle-text-muted); font-weight: 600;">${results[2].wpm} WPM</div>
        `;
        document.getElementById("podium-3rd-avatar").textContent = results[2].nickname.charAt(0).toUpperCase();
        if (results[2].nickname === myUser.nickname) document.getElementById("podium-3rd-avatar").style.background = "linear-gradient(135deg, #ff7b8e, #ffd17b)";
    } else {
        pod3.style.display = "none";
    }

    const tbody = document.getElementById("results-table-body");
    tbody.innerHTML = "";

    results.forEach((p, idx) => {
        const isMe = p.nickname === myUser.nickname;
        const tr = document.createElement("tr");
        if (isMe) tr.className = "me";

        if (p.disconnected) {
            tr.style.opacity = "0.5";
            tr.innerHTML = `
                <td style="font-weight:bold; color:#aaa">DNF</td>
                <td>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <div class="player-mini-avatar" style="${isMe ? 'background: linear-gradient(135deg, #ff7b8e, #ffd17b)' : ''}; filter: grayscale(100%);">${p.nickname.charAt(0).toUpperCase()}</div>
                        <span>${p.nickname} ${isMe ? '<strong>(나)</strong>' : ''} <span style="color:#ff4a68; font-size: 0.8rem;">(기권)</span></span>
                    </div>
                </td>
                <td colspan="3" style="text-align: center; color: #ff4a68; font-weight: bold;">중도 퇴장</td>
            `;
        } else {
            tr.innerHTML = `
                <td style="font-weight:bold; color:${idx === 0 ? 'var(--color-battle-accent)' : ''}">${p.rank}등</td>
                <td>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <div class="player-mini-avatar" style="${isMe ? 'background: linear-gradient(135deg, #ff7b8e, #ffd17b)' : ''}">${p.nickname.charAt(0).toUpperCase()}</div>
                        <span>${p.nickname} ${isMe ? '<strong>(나)</strong>' : ''}</span>
                    </div>
                </td>
                <td><strong>${p.wpm}</strong> WPM</td>
                <td>${p.accuracy}%</td>
                <td>${p.score}점</td>
            `;
        }
        tbody.appendChild(tr);
    });
}

function switchView(viewId) {
    const sections = document.querySelectorAll(".view-section");
    sections.forEach(s => s.classList.remove("active"));

    const target = document.getElementById(viewId);
    if (target) target.classList.add("active");
}

function leaveRoom() {
    if (confirm("정말 대기실에서 퇴장하시겠습니까?")) {
        if (battleSocket) {
            battleSocket.close();
            battleSocket = null;
        }
        currentRoom = null;
        returnToLobby();
    }
}

function returnToLobby() {
    if (ytPlayer && ytPlayer.stopVideo) {
        ytPlayer.stopVideo();
    }
    if (syncTimer) clearInterval(syncTimer);
    switchView("view-entrance");
}

function returnToWaitingRoom() {
    enterWaitingRoom();
}
