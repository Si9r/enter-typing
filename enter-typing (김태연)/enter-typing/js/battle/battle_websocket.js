// ── battle_websocket.js: 대전 방 WebSocket 연결/메시지 송수신 전담 ──────
import { state } from './battle_state.js';
import {
    enterWaitingRoom, appendSystemChat, appendOpponentChat, renderPlayersInLobby,
    updateReadyButton, renderLiveRanking, showSyncUI, hideSyncUI, showCountdown,
    showResultsScreen, addQuizOpponentChat, updateVideoInfoPanel, returnToLobby
} from './battle_ui.js';
import { checkAndSendSyncReady, startGamePlay, handleOpponentQuizAnswer } from './battle_game.js';

let pendingRoomCode = null;

// battleSocket이 열려있을 때만 안전하게 메시지를 전송하는 공용 헬퍼.
// 기존 코드 곳곳에 흩어져 있던 `battleSocket && readyState === OPEN` 체크를 여기로 모았다.
export function send(payload) {
    if (state.battleSocket && state.battleSocket.readyState === WebSocket.OPEN) {
        state.battleSocket.send(JSON.stringify(payload));
    }
}

export function submitRoomPassword() {
    const password = document.getElementById("room-password-input").value;
    document.getElementById("modal-room-password").style.display = "none";
    connectToBattleRoom(pendingRoomCode, password);
}

export function connectToBattleRoom(roomCode, password = "") {
    const token = sessionStorage.getItem('ep_token');
    if (!token) {
        alert("로그인이 필요합니다.");
        location.href = "login.html";
        return;
    }

    if (state.battleSocket) {
        state.battleSocket.close();
    }

    pendingRoomCode = roomCode;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    state.battleSocket = new WebSocket(`${protocol}//${window.location.host}/ws/battle/${roomCode}?token=${token}&password=${encodeURIComponent(password)}`);

    state.battleSocket.onopen = () => {
        console.log("Battle Room Connected");
        state.myUser.ready = false;
        state.myUser.finished = false;
    };

    state.battleSocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log("WS MESSAGE:", data);

        switch (data.type) {
            case "error":
                alert(data.message);
                break;
            case "room_state":
                state.currentRoom = data.room;
                state.isHost = state.currentRoom.host === state.myUser.nickname;
                state.opponents = state.currentRoom.players;

                // Set selected song
                if (!state.currentRoom.song_id) {
                    state.selectedSong = null;
                    enterWaitingRoom();
                    break;
                }
                if (state.currentRoom.mode === 'quiz') {
                    const quizObj = state.databaseQuizzes.find(s => s.id === state.currentRoom.song_id);
                    if (quizObj && quizObj.quiz_data) {
                        state.selectedSong = quizObj;
                        console.log(`[Battle] 선택된 퀴즈: ${quizObj.title}`);
                    } else {
                        console.log(`[Battle] quiz_id=${state.currentRoom.song_id} 의 상세 데이터를 API에서 조회합니다.`);
                        fetch(`/api/quiz-content/${state.currentRoom.song_id}`)
                            .then(r => r.json())
                            .then(data => {
                                if (data.success) {
                                    state.selectedSong = data;
                                    console.log(`[Battle] 퀴즈 상세 데이터 조회 성공: ${state.selectedSong.title}`);
                                }
                            })
                            .catch(err => console.error('[Battle] 퀴즈 상세 데이터 조회 실패:', err));
                    }
                } else {
                    const songObj = state.databaseSongs.find(s => s.id === state.currentRoom.song_id);
                    if (songObj) {
                        state.selectedSong = songObj;
                        console.log(`[Battle] 선택된 곡: ${songObj.title}`);
                    } else {
                        console.warn(`[Battle] song_id=${state.currentRoom.song_id} 를 databaseSongs에서 못 찾음. API 직접 조회 시도.`);
                        fetch(`/api/typing-content/${state.currentRoom.song_id}`)
                            .then(r => r.json())
                            .then(data => {
                                if (data.success) {
                                    state.selectedSong = {
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
                                    console.log(`[Battle] fallback 조회 성공: ${data.title}`);
                                    updateVideoInfoPanel();
                                    if (state.ytPlayer && typeof state.ytPlayer.cueVideoById === 'function' && state.selectedSong.youtube_id) {
                                        state.ytPlayer.cueVideoById(state.selectedSong.youtube_id);
                                    }
                                }
                            })
                            .catch(err => console.error('[Battle] fallback 곡 조회 실패:', err));
                    }
                }

                enterWaitingRoom();
                break;
            case "player_joined":
                state.opponents = data.players;
                appendSystemChat(`${data.nickname}님이 입장하셨습니다.`);
                renderPlayersInLobby();
                break;
            case "player_left":
                state.opponents = data.players;
                state.currentRoom.host = data.new_host;
                state.isHost = state.currentRoom.host === state.myUser.nickname;
                appendSystemChat(`${data.nickname}님이 퇴장하셨습니다.`);
                updateReadyButton();
                renderPlayersInLobby();
                break;
            case "player_disconnected":
                if (data.players) state.opponents = data.players;
                if (data.new_host) {
                    state.currentRoom.host = data.new_host;
                    state.isHost = state.currentRoom.host === state.myUser.nickname;
                }
                appendSystemChat(`${data.nickname}님이 대전 중 퇴장하셨습니다.`);
                if (state.currentRoom && state.currentRoom.status === "playing") {
                    renderLiveRanking();
                }
                break;
            case "player_update":
                if (data.players) {
                    state.opponents = data.players;
                } else if (data.nickname) {
                    if (!state.opponents[data.nickname]) {
                        state.opponents[data.nickname] = { progress: 0, wpm: 0, score: 0, ready: false, is_host: false };
                    }
                    state.opponents[data.nickname].progress = data.progress;
                    state.opponents[data.nickname].wpm = data.wpm;
                    state.opponents[data.nickname].score = data.score;
                }
                renderPlayersInLobby();
                if (state.currentRoom && state.currentRoom.status === "playing") {
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
                if (state.currentRoom) state.currentRoom.status = "playing"; // syncTimer 조건 통과용
                startGamePlay();
                break;
            case "player_finished":
                state.opponents = data.players;
                appendSystemChat(`${data.nickname}님이 게임을 완료했습니다!`);
                renderLiveRanking();
                break;
            case "game_end":
                showResultsScreen(data.results);
                break;
            case "chat":
                // 퀴즈 뷰에 있을 때는 퀴즈 채팅창으로 라우팅
                if (state.currentRoom && state.currentRoom.mode === 'quiz' && document.getElementById('view-quiz-gameplay')?.classList.contains('active')) {
                    addQuizOpponentChat(data.nickname, data.message, false);
                } else {
                    appendOpponentChat(data.nickname, data.message);
                }
                break;
            case "quiz_answer":
                handleOpponentQuizAnswer(data);
                break;
            case "quiz_chat":
                addQuizOpponentChat(data.nickname, data.message, false);
                break;
            case "content_selected":
                state.currentRoom = data.room;
                state.selectedSong = null;
                appendSystemChat(`방장이 콘텐츠를 선택했습니다: ${state.currentRoom.song_title}`);
                if (state.currentRoom.mode === 'quiz') {
                    const quizObj = state.databaseQuizzes.find(s => s.id === state.currentRoom.song_id);
                    if (quizObj) state.selectedSong = quizObj;
                } else {
                    const songObj = state.databaseSongs.find(s => s.id === state.currentRoom.song_id);
                    if (songObj) {
                        state.selectedSong = songObj;
                        if (state.ytPlayer && typeof state.ytPlayer.cueVideoById === 'function' && state.selectedSong.youtube_id) {
                            state.ytPlayer.cueVideoById(state.selectedSong.youtube_id);
                        }
                    }
                }
                enterWaitingRoom();
                break;
        }
    };

    state.battleSocket.onclose = (event) => {
        console.log("Battle Socket Closed", event.code);
        if (event.code === 4005) {
            document.getElementById("room-password-input").value = "";
            document.getElementById("modal-room-password").style.display = "flex";
            return;
        }
        if (event.code === 4001) alert("인증에 실패했습니다.");
        else if (event.code === 4003) alert("방이 가득 찼습니다.");
        else if (event.code === 4004) alert("존재하지 않는 방입니다.");

        if (event.code !== 4005) {
            state.currentRoom = null;
            if (event.code !== 1000) returnToLobby();
        }
    };
}
