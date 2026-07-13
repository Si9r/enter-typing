// ── battle.js: 실시간 대전 페이지 진입점(Entry Point) ──────────────
// 실제 로직은 battle_state / battle_websocket / battle_ui / battle_game
// 모듈로 분리되어 있으며, 이 파일은 모듈을 불러와 초기화하고
// html/battle.html의 inline onclick 핸들러가 참조할 수 있도록 필요한
// 함수들을 window 전역 객체에 연결하는 역할만 담당한다.
import { state } from './battle_state.js';
import { connectToBattleRoom, submitRoomPassword } from './battle_websocket.js';
import {
    fetchBackendSongs, fetchBackendQuizzes,
    setContentSelectorMode, openContentSelectorModal, closeContentSelectorModal,
    copyRoomCode, onReadyOrStartClick, sendChatMessage,
    leaveRoom, returnToLobby, returnToWaitingRoom
} from './battle_ui.js';
import { initYoutubePlayer, startQuizBattle, sendQuizChatMessage } from './battle_game.js';

// html/battle.html의 inline onclick="..." 핸들러들이 참조하는 전역 함수 바인딩
Object.assign(window, {
    submitRoomPassword, copyRoomCode,
    openContentSelectorModal, closeContentSelectorModal, setContentSelectorMode,
    leaveRoom, onReadyOrStartClick, sendChatMessage,
    startQuizBattle, sendQuizChatMessage,
    returnToLobby, returnToWaitingRoom
});

document.addEventListener("DOMContentLoaded", () => {
    // Check login state
    const sessUser = sessionStorage.getItem('ep_user');
    if (sessUser) {
        try {
            const parsed = JSON.parse(sessUser);
            state.myUser.nickname = parsed.nickname || "나 (플레이어)";
            state.myUser.email = parsed.email;
            state.myUser.avatar = state.myUser.nickname.charAt(0).toUpperCase();
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
            if (state.ytPlayer && typeof state.ytPlayer.setVolume === "function") {
                state.ytPlayer.setVolume(val);
            }
        });
    }

    fetchBackendSongs();
    fetchBackendQuizzes();
    initYoutubePlayer();

    // URL 경로(/battle/{room_code})에서 방 코드를 읽어 자동 입장
    const roomMatch = window.location.pathname.match(/^\/battle\/(\d{4})\/?$/);
    if (roomMatch) {
        const roomCode = roomMatch[1];
        const savedPw = sessionStorage.getItem('battle_room_pw') || "";
        sessionStorage.removeItem('battle_room_pw');
        connectToBattleRoom(roomCode, savedPw);
    } else {
        location.href = "/battle";
    }
});
