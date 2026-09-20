// ── battle_state.js: battle_websocket / battle_ui / battle_game가 공유하는
// 상태를 한 곳에 모아둔다. 각 모듈은 이 객체의 프로퍼티를 직접 읽고 쓴다
// (모듈 스코프의 재할당 제약을 피하면서도 상태를 한 군데로 캡슐화하기 위함).
// 한 턴(타이핑 진행률, 퀴즈 정답 상태 등) 안에서만 쓰이는 값은 여기 두지 않고
// 해당 로직을 소유한 모듈(battle_game.js) 내부 변수로 캡슐화되어 있다.
export const state = {
    // 콘텐츠 목록 (로비/콘텐츠 선택 모달)
    databaseSongs: [],
    databaseQuizzes: [],

    // 방 / 세션
    currentRoom: null,
    isHost: false,
    myUser: { nickname: "나 (플레이어)", email: "guest@enterping.com", avatar: "나", ready: false, finished: false },
    battleSocket: null,
    opponents: {},

    // YouTube 플레이어 (로비 미리보기 + 인게임 동기화 재생에 공용으로 쓰임)
    ytPlayer: null,

    // 현재 선택된 콘텐츠 (타이핑 곡 또는 퀴즈)
    selectedSong: null,

    // 인게임 동기화 타이머. returnToLobby(UI)에서도 정리해야 해서 공유 상태로 둔다.
    syncTimer: null,
};
