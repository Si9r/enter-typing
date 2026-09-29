// ── battle_ui.js: 로비/대기실/채팅/랭킹/결과 화면 등 UI 상태 업데이트 전담 ──
import { state } from './battle_state.js';
import { send } from './battle_websocket.js';

// ── 1. 콘텐츠 목록 로드 (로비 콘텐츠 선택 모달용) ──────────────────
export async function fetchBackendSongs() {
    try {
        const res = await fetch('/api/typing-contents');
        const data = await res.json();
        if (data.success && data.data && data.data.length > 0) {
            const seen = new Set();
            const songs = [];
            data.data.forEach(item => {
                const key = `${item.title}__${item.artist}`;
                if (seen.has(key)) return;
                seen.add(key);
                songs.push({
                    id: item.id,
                    title: item.title,
                    artist: item.artist || i18n.t('common.unknown'),
                    lines: (item.lyrics || "").split('\n').filter(l => l.trim()),
                    hiragana_lines: (item.hiragana || "").split('\n').filter(l => l.trim()),
                    romaji_lines: (item.romaji || "").split('\n').filter(l => l.trim()),
                    youtube_id: item.youtube_id,
                    timestamps: (item.timestamps || "").split('\n').map(t => parseFloat(t.trim())).filter(t => !isNaN(t)),
                    difficulty: item.difficulty || 3,
                    play_count: item.play_count || 0,
                    genre: item.genre || "",
                    creator_nickname: item.creator_nickname || i18n.t('nav.enterping')
                });
            });
            state.databaseSongs = songs.filter(song => song.romaji_lines.length > 0 && song.lines.length > 0);
        }
    } catch (e) {
        console.log("Failed to fetch songs");
    }

    const modeEl = document.getElementById("page-create-mode-select");
    if (modeEl && modeEl.value === "typing") {
        onModeChange();
    }
}

export async function fetchBackendQuizzes() {
    try {
        const res = await fetch('/api/quiz-contents');
        const data = await res.json();
        if (data.success && data.data && data.data.length > 0) {
            state.databaseQuizzes = data.data.map(item => ({
                id: item.id,
                title: item.title,
                artist: item.artist || i18n.t('common.unknown'),
                genre: item.genre || "",
                thumbnail_url: item.thumbnail_url || "/assets/vinyl.svg",
                difficulty: item.difficulty || 3
            }));
        }
    } catch (e) {
        console.log("Failed to fetch quizzes");
    }
}

// ── 2. 호스트 전용: 로비에서 대전 콘텐츠(타이핑/퀴즈) 선택 ─────────────
let contentSelectorMode = "typing";

export function setContentSelectorMode(mode) {
    contentSelectorMode = mode;
    document.getElementById("content-tab-typing").className = mode === "typing" ? "btn-battle btn-battle-primary" : "btn-battle btn-battle-secondary";
    document.getElementById("content-tab-quiz").className = mode === "quiz" ? "btn-battle btn-battle-primary" : "btn-battle btn-battle-secondary";
    renderContentSelectorGrid();
}

function renderContentSelectorGrid() {
    const grid = document.getElementById("modal-content-grid");
    if (!grid) return;

    grid.innerHTML = "";
    const mode = contentSelectorMode;
    const list = mode === "typing" ? state.databaseSongs : state.databaseQuizzes;

    if (list.length === 0) {
        grid.innerHTML = `<div style='color: var(--theme-text-muted); grid-column: 1 / -1; text-align: center; padding: 40px;'>${i18n.t('battle.no_selectable_content')}</div>`;
    } else {
        list.forEach(item => {
            const isSelected = state.currentRoom && state.currentRoom.song_id === item.id && state.currentRoom.mode === mode;
            const card = document.createElement("div");
            card.style.cssText = "background: var(--theme-bg-card); border: 1px solid var(--theme-border); border-radius: 16px; overflow: hidden; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; display: flex; flex-direction: column;";
            if (isSelected) {
                card.style.border = "2px solid var(--color-battle-accent)";
                card.style.boxShadow = "0 0 0 3px rgba(255, 209, 123, 0.25)";
            }
            card.onmouseover = () => { card.style.transform = "translateY(-4px)"; card.style.boxShadow = "0 8px 24px rgba(0,0,0,0.15)"; card.style.borderColor = "var(--color-battle-primary)"; };
            card.onmouseout = () => {
                card.style.transform = "translateY(0)";
                card.style.boxShadow = isSelected ? "0 0 0 3px rgba(255, 209, 123, 0.25)" : "none";
                card.style.borderColor = isSelected ? "var(--color-battle-accent)" : "var(--theme-border)";
            };

            card.onclick = () => selectContentForRoom(item, mode);

            const thumbSrc = mode === "typing" ? `https://img.youtube.com/vi/${item.youtube_id}/mqdefault.jpg` : (item.thumbnail_url || "/assets/vinyl.svg");

            card.innerHTML = `
                <div style="width: 100%; height: 130px; background: #000; overflow: hidden; display: flex; align-items: center; justify-content: center; position: relative;">
                    <img src="${thumbSrc}" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.9;" onerror="this.onerror=null; this.src='/assets/vinyl.svg'">
                    <div style="position: absolute; bottom: 8px; right: 8px; background: rgba(0,0,0,0.7); color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: bold;">
                        ${mode === 'typing' ? i18n.t('nav.typing') : i18n.t('nav.quiz')}
                    </div>
                </div>
                <div style="padding: 16px;">
                    <div style="font-weight: bold; color: var(--theme-text-main); font-size: 1.05rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 4px;">${item.title}</div>
                    <div style="font-size: 0.85rem; color: var(--theme-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.artist}</div>
                </div>
            `;
            grid.appendChild(card);
        });
    }
}

export function openContentSelectorModal() {
    if (!state.isHost) return;
    setContentSelectorMode(contentSelectorMode);
    document.getElementById("modal-content-selector").style.display = "flex";
}

export function closeContentSelectorModal() {
    const modal = document.getElementById("modal-content-selector");
    if (modal) modal.style.display = "none";
}

async function selectContentForRoom(item, mode) {
    try {
        const res = await fetch(`/api/battle/rooms/${state.currentRoom.code}/select-content`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ mode: mode, content_id: item.id })
        });
        const data = await res.json();
        if (!data.success) {
            alert(i18n.server(data.detail, 'battle.content_select_failed'));
            return;
        }
        closeContentSelectorModal();
    } catch (e) {
        alert(i18n.t('common.an_error_occurred'));
    }
}

// ── 3. 대기실 / 비디오 정보 패널 ──────────────────────────────────
export function updateVideoInfoPanel() {
    const infoTitle = document.getElementById("info-title");
    const infoArtist = document.getElementById("info-artist");
    const infoCreator = document.getElementById("info-creator");
    const infoThumbnail = document.getElementById("info-thumbnail");
    const infoAvatarPlaceholder = document.getElementById("info-avatar-placeholder");
    const infoViews = document.getElementById("info-views");
    const infoTags = document.getElementById("info-tags");
    const timeEl = document.getElementById("time");

    const selectedSong = state.selectedSong;
    if (!selectedSong) return;

    if (infoTitle) infoTitle.innerText = selectedSong.title || i18n.t('common.no_title');
    if (infoArtist) infoArtist.innerText = selectedSong.artist || i18n.t('common.unknown_artist');
    if (infoViews) infoViews.innerText = selectedSong.play_count || "0";
    if (timeEl) timeEl.innerText = "0";

    if (infoTags) {
        infoTags.innerHTML = "";
        if (selectedSong.genre) {
            const genres = selectedSong.genre.split(',').map(g => g.trim());
            genres.forEach(g => {
                const tagSpan = document.createElement("span");
                tagSpan.style.cssText = "background: rgba(0,0,0,0.03); padding: 3px 8px; border-radius: 10px; font-size: 0.75rem; font-weight: bold; color: var(--color-battle-text-muted); border: 1.5px solid rgba(0,0,0,0.05);";
                tagSpan.innerText = i18n.genre(g);
                infoTags.appendChild(tagSpan);
            });
        } else {
            infoTags.innerHTML = `<span style="background: rgba(0,0,0,0.03); padding: 3px 8px; border-radius: 10px; font-size: 0.75rem; font-weight: bold; color: var(--color-battle-text-muted); border: 1.5px solid rgba(0,0,0,0.05);">${i18n.t('typing.no_tags')}</span>`;
        }
    }

    if (selectedSong.youtube_id) {
        if (infoThumbnail) {
            infoThumbnail.src = `https://img.youtube.com/vi/${selectedSong.youtube_id}/mqdefault.jpg`;
            infoThumbnail.style.display = "block";
        }
        if (infoAvatarPlaceholder) infoAvatarPlaceholder.style.display = "none";

        if (infoCreator) infoCreator.innerText = i18n.t('common.loading');
        fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${selectedSong.youtube_id}&format=json`)
            .then(res => res.json())
            .then(oEmbedData => {
                if (infoCreator && oEmbedData.author_name) {
                    infoCreator.innerText = oEmbedData.author_name;
                } else if (infoCreator) {
                    infoCreator.innerText = selectedSong.creator_nickname || i18n.t('nav.enterping');
                }
            })
            .catch(err => {
                if (infoCreator) infoCreator.innerText = selectedSong.creator_nickname || i18n.t('nav.enterping');
            });
    } else {
        if (infoCreator) infoCreator.innerText = selectedSong.creator_nickname || i18n.t('nav.enterping');
        if (infoThumbnail) infoThumbnail.style.display = "none";
        if (infoAvatarPlaceholder) infoAvatarPlaceholder.style.display = "flex";
    }
}

// 대기실 상단 "선택된 콘텐츠" 미리보기의 종류 배지/난이도/제목 갱신 (databaseSongs/Quizzes
// 캐시에 없어서 API로 뒤늦게 selectedSong을 채우는 fallback 경로에서도 재사용).
// ── 퀴즈 대전: 출제 문제 수 (방장만 변경) ─────────────────────
const QUESTION_COUNT_OPTIONS = [10, 30, 50];

function renderQuestionCountControl() {
    const currentRoom = state.currentRoom;
    const anchor = document.getElementById("wait-song-title");
    if (!anchor) return;
    let row = document.getElementById("wait-question-count");
    const total = currentRoom && currentRoom.mode === 'quiz' ? (currentRoom.question_total || 0) : 0;

    // 문제가 적은 퀴즈나 타이핑 모드에서는 표시하지 않는다
    if (total <= QUESTION_COUNT_OPTIONS[0]) {
        if (row) row.remove();
        return;
    }
    if (!row) {
        row = document.createElement("div");
        row.id = "wait-question-count";
        row.style.cssText = "display:flex; align-items:center; gap:8px; margin-top:8px; font-size:0.85rem; font-weight:700; color:var(--color-battle-text-muted);";
        anchor.parentElement.appendChild(row);
    }

    const count = currentRoom.question_count || total;
    const label = `<span>${i18n.t('battle.question_count_label')}</span>`;
    if (state.isHost) {
        const options = QUESTION_COUNT_OPTIONS.filter((n) => n < total)
            .map((n) => `<option value="${n}" ${n === currentRoom.question_count ? 'selected' : ''}>${i18n.t('common.n_questions', { count: n })}</option>`);
        options.push(`<option value="" ${currentRoom.question_count ? '' : 'selected'}>${i18n.t('quiz.all_questions_n', { count: total })}</option>`);
        row.innerHTML = `${label}<select id="wait-question-count-select" style="padding:4px 8px; border-radius:8px; font-weight:700;">${options.join('')}</select>`;
        row.title = i18n.t('battle.question_count_random_hint');
        row.querySelector("select").addEventListener("change", (e) => setQuestionCount(e.target.value ? Number(e.target.value) : null));
    } else {
        row.innerHTML = `${label}<strong style="color:var(--color-battle-text, inherit);">${count === total ? i18n.t('quiz.all_questions_n', { count: total }) : i18n.t('common.n_questions', { count })}</strong>`;
        row.title = i18n.t('battle.question_count_random_hint');
    }
}

async function setQuestionCount(count) {
    try {
        const res = await fetch(`/api/battle/rooms/${state.currentRoom.code}/question-count`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ count }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
            alert(i18n.server(data.detail, 'server.invalid_question_count'));
            renderQuestionCountControl(); // 선택을 서버 값으로 되돌림
        }
    } catch (e) {
        console.error('문제 수 설정 실패:', e);
    }
}

export function updateWaitContentMeta() {
    const currentRoom = state.currentRoom;
    if (!currentRoom) return;
    renderQuestionCountControl();

    const titleEl = document.getElementById("wait-song-title");
    const badgeEl = document.getElementById("wait-content-type-badge");
    const diffEl = document.getElementById("wait-content-difficulty");

    if (currentRoom.song_id) {
        titleEl.textContent = currentRoom.song_title;
        badgeEl.textContent = currentRoom.mode === 'quiz' ? i18n.t('nav.quiz') : i18n.t('nav.typing');
        badgeEl.className = `content-type-badge ${currentRoom.mode === 'quiz' ? 'mode-quiz' : 'mode-typing'}`;
        const difficulty = (state.selectedSong && state.selectedSong.difficulty) || 3;
        diffEl.innerHTML = `<i class="ph-fill ph-star"></i> ${difficulty}`;
        diffEl.classList.add('visible');
    } else {
        titleEl.textContent = state.isHost ? i18n.t('battle.please_select_content') : i18n.t('battle.the_host_is_selecting_content');
        badgeEl.textContent = "";
        badgeEl.className = "content-type-badge";
        diffEl.classList.remove('visible');
    }
}

// 대기실 상단 "선택된 콘텐츠" 썸네일만 갱신 (databaseSongs/Quizzes 캐시에 없어서
// API로 뒤늦게 selectedSong을 채우는 fallback 경로에서도 재사용).
export function updateWaitSongThumb() {
    const songThumbEl = document.getElementById("wait-song-thumb");
    if (!songThumbEl) return;
    const currentRoom = state.currentRoom;
    if (!currentRoom || !currentRoom.song_id) {
        songThumbEl.style.backgroundImage = "none";
        songThumbEl.textContent = "🎵";
        return;
    }
    const selectedSong = state.selectedSong;
    const thumbUrl = currentRoom.mode === 'quiz'
        ? (selectedSong && selectedSong.thumbnail_url)
        : (selectedSong && selectedSong.youtube_id ? `https://img.youtube.com/vi/${selectedSong.youtube_id}/mqdefault.jpg` : null);
    if (thumbUrl) {
        songThumbEl.style.backgroundImage = `url('${thumbUrl}')`;
        songThumbEl.textContent = "";
    } else {
        songThumbEl.style.backgroundImage = "none";
        songThumbEl.textContent = currentRoom.mode === 'quiz' ? "🎯" : "🎵";
    }
}

export function enterWaitingRoom() {
    switchView("view-waiting");
    const currentRoom = state.currentRoom;
    if (currentRoom.mode === 'quiz') {
        // Quiz mode doesn't need video info panel update in the same way, but let's clear it
        document.getElementById("wait-room-title").textContent = currentRoom.title + i18n.t('common.quiz');
    } else {
        updateVideoInfoPanel();
        document.getElementById("wait-room-title").textContent = currentRoom.title;
    }

    document.getElementById("wait-room-code").innerHTML = `${escapeHTML(i18n.t('battle.room_code', { code: currentRoom.code }))} <span style="font-size: 0.85rem;"></span>`;

    updateWaitContentMeta();
    updateWaitSongThumb();

    const selectBtn = document.getElementById("btn-select-content");
    selectBtn.style.display = state.isHost ? "flex" : "none";
    selectBtn.title = currentRoom.song_id ? i18n.t('battle.change_content') : i18n.t('battle.select_content');

    updateReadyButton();

    const chatMsgs = document.getElementById("chat-messages");
    chatMsgs.innerHTML = `<div class="chat-bubble system">${escapeHTML(i18n.t('battle.joined_room', { code: currentRoom.code }))}</div>`;

    renderPlayersInLobby();

    // 비디오 동기화를 위해 대기실 입장 시 사전 버퍼링
    const ytPlayer = state.ytPlayer;
    if (ytPlayer && typeof ytPlayer.cueVideoById === 'function' && state.selectedSong && state.selectedSong.youtube_id) {
        ytPlayer.cueVideoById(state.selectedSong.youtube_id);
    }
}

export function copyRoomCode() {
    if (state.currentRoom && state.currentRoom.code) {
        const textToCopy = state.currentRoom.code;

        function showSuccess() {
            const el = document.getElementById("wait-room-code");
            const originalHTML = el.innerHTML;
            el.innerHTML = `${i18n.t('battle.copied_2')} <span style="font-size: 0.85rem;"></span>`;
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
                else alert(i18n.t('battle.copy_failed_please_copy_manually'));
            } catch (err) {
                alert(i18n.t('battle.your_browser_does_not_support_the'));
            }
            document.body.removeChild(textArea);
            return;
        }

        // HTTPS 또는 localhost 환경
        navigator.clipboard.writeText(textToCopy).then(() => {
            showSuccess();
        }).catch(err => {
            console.error('복사 실패:', err);
            alert(i18n.t('battle.your_browser_does_not_support_copying'));
        });
    }
}

export function updateReadyButton() {
    const actionBtn = document.getElementById("btn-ready-start");
    if (state.isHost) {
        actionBtn.textContent = i18n.t('common.getting_started');
        actionBtn.className = "btn-battle btn-battle-primary";
        // 콘텐츠가 선택되어 있고, 나를 제외한 모두가 준비 완료했을 때만 시작 가능
        const hasContent = !!(state.currentRoom && state.currentRoom.song_id);
        const allReady = Object.entries(state.opponents).every(([nick, p]) => nick === state.myUser.nickname || p.ready);
        const canStart = hasContent && allReady;
        actionBtn.style.opacity = canStart ? "1" : "0.6";
        actionBtn.style.pointerEvents = canStart ? "auto" : "none";
    } else {
        actionBtn.textContent = state.myUser.ready ? i18n.t('battle.unready') : i18n.t('battle.ready');
        actionBtn.className = state.myUser.ready ? "btn-battle btn-battle-primary" : "btn-battle btn-battle-secondary";
        actionBtn.style.opacity = "1";
        actionBtn.style.pointerEvents = "auto";
    }
}

export function renderPlayersInLobby() {
    const grid = document.getElementById("wait-player-grid");
    if (!grid) return;
    grid.innerHTML = "";

    const currentRoom = state.currentRoom;
    const maxUsers = currentRoom.maxPlayers || currentRoom.max_players || 4;

    // Sort players so host is first, then me, then others
    let playerList = Object.entries(state.opponents).map(([nick, p]) => ({ nickname: nick, ...p }));
    playerList.sort((a, b) => {
        if (a.is_host) return -1;
        if (b.is_host) return 1;
        if (a.nickname === state.myUser.nickname) return -1;
        if (b.nickname === state.myUser.nickname) return 1;
        return 0;
    });

    playerList.forEach(p => {
        const isMe = p.nickname === state.myUser.nickname;
        const avatar = p.nickname.charAt(0).toUpperCase();

        const card = document.createElement("div");
        card.className = "player-card active-slot";

        let statusTag = '';
        if (p.is_host) {
            statusTag = `<span class="player-status-tag host">${i18n.t('battle.host')}</span>`;
        } else if (p.ready) {
            statusTag = `<span class="player-status-tag ready">${i18n.t('battle.ready')}</span>`;
        } else {
            statusTag = `<span class="player-status-tag waiting">${i18n.t('common.waiting')}</span>`;
        }

        card.innerHTML = `
            <div class="player-avatar-large" style="${isMe ? 'background: linear-gradient(135deg, #ff7b8e, #ffd17b)' : ''}">${escapeHTML(avatar)}</div>
            <div class="player-info">
                <div class="player-name">${escapeHTML(p.nickname)} ${isMe ? i18n.t('battle.me') : ''}</div>
                ${statusTag}
            </div>
        `;
        grid.appendChild(card);
    });

    // Fill empty slots
    for (let i = playerList.length; i < maxUsers; i++) {
        const card = document.createElement("div");
        card.className = "player-card empty-slot";
        card.innerHTML = `<div> ${i18n.t('battle.waiting')}</div>`;
        grid.appendChild(card);
    }

    updateReadyButton();
}

export function onReadyOrStartClick() {
    if (state.isHost) {
        send({ type: "start" });
    } else {
        state.myUser.ready = !state.myUser.ready;
        send({ type: "ready", ready: state.myUser.ready });
    }
}

// ── 4. 채팅 시스템 (대기실/게임 화면 공용 채팅) ────────────────────────
export function sendChatMessage() {
    const input = document.getElementById("chat-input");
    const text = input.value.trim();
    if (!text) return;

    appendUserChat(state.myUser.nickname, text);
    input.value = "";
    send({ type: "chat", message: text });
}

export function appendUserChat(sender, message) {
    const container = document.getElementById("chat-messages");
    const bubble = document.createElement("div");
    bubble.className = "chat-bubble me";
    bubble.innerHTML = `<div class="chat-sender" style="color:#ffd17b">${escapeHTML(sender)}</div>${escapeHTML(message)}`;
    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;
}

export function appendOpponentChat(sender, message) {
    const container = document.getElementById("chat-messages");
    if (!container) return;
    const bubble = document.createElement("div");
    bubble.className = "chat-bubble"; // no 'me' class means it's from opponent
    bubble.innerHTML = `<div class="chat-sender" style="color:var(--color-battle-accent)">${escapeHTML(sender)}</div>${escapeHTML(message)}`;
    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;
}

export function appendSystemChat(message) {
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

// ── 5. 동기화 로딩 / 카운트다운 오버레이 ───────────────────────────────
export function showSyncUI() {
    const overlay = document.getElementById("countdown-overlay");
    const countNum = document.getElementById("countdown-num");
    overlay.style.display = "flex";
    countNum.innerHTML = `<span style="font-size:1.5rem;">${i18n.t('battle.synchronizing_video_loading')}</span><br><span style="font-size:1rem;">${i18n.t('battle.waiting_for_other_players')}</span>`;
}

export function hideSyncUI() {
    // showCountdown이 오버레이를 직접 업데이트하므로 별도 처리 불필요
}

export function showCountdown(count) {
    const overlay = document.getElementById("countdown-overlay");
    const countNum = document.getElementById("countdown-num");
    overlay.style.display = "flex";
    countNum.textContent = count;
}

// ── 6. 실시간 랭킹 / 결과 화면 ────────────────────────────────────────
export function renderLiveRanking() {
    if (state.currentRoom && state.currentRoom.mode === 'quiz') {
        renderLiveRankingQuiz();
        return;
    }
    const container = document.getElementById("live-ranking-container");
    if (!container) return;
    // ensure container supports ordering
    container.style.display = 'flex';
    container.style.flexDirection = 'column';

    let playerList = Object.entries(state.opponents).map(([nick, p]) => ({ nickname: nick, ...p }));
    playerList.sort((a, b) => {
        if (b.progress !== a.progress) return b.progress - a.progress;
        return b.wpm - a.wpm;
    });

    playerList.forEach((p, idx) => {
        const isMe = p.nickname === state.myUser.nickname;
        const avatar = p.nickname.charAt(0).toUpperCase();
        const rowId = `ranking-row-${p.nickname}`;

        let statusText = p.progress >= 100 ? 'FINISHED' : p.wpm + ' WPM';
        let rowOpacity = "1";
        let rowFilter = "none";
        if (p.disconnected) {
            statusText = i18n.t('battle.abstain_exit');
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
                        <span class="rank-display" style="font-weight: 900; color: ${idx === 0 ? 'var(--color-battle-accent)' : '#fff'};">${i18n.t('battle.rank_place', { rank: idx + 1 })}</span>
                        <div class="player-mini-avatar" style="${isMe ? 'background: linear-gradient(135deg, #ff7b8e, #ffd17b)' : ''}">${escapeHTML(avatar)}</div>
                        <span class="player-mini-name">${escapeHTML(p.nickname)} ${isMe ? i18n.t('battle.me') : ''}</span>
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
            row.querySelector('.rank-display').textContent = i18n.t('battle.rank_place', { rank: idx + 1 });
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

export function showResultsScreen(results) {
    switchView("view-results");

    // 퀴즈 모드이면 테이블 헤더 변경
    const isQuizMode = state.currentRoom && state.currentRoom.mode === 'quiz';
    const thWpm = document.getElementById("result-th-wpm");
    const thAccuracy = document.getElementById("result-th-accuracy");
    if (thWpm) thWpm.textContent = isQuizMode ? i18n.t('common.correct_answers') : i18n.t('battle.strokes_per_minute_wpm');
    if (thAccuracy) thAccuracy.textContent = isQuizMode ? i18n.t('common.accuracy') : i18n.t('common.accuracy');

    if (results.length > 0) {
        document.getElementById("podium-1st-name").textContent = results[0].nickname;
        document.getElementById("podium-1st-wpm").innerHTML = `
            <div style="font-weight: 800; color: var(--color-battle-primary); font-size: 0.95rem; margin-bottom: 2px;">${i18n.t('common.n_points', { count: results[0].score })}</div>
            ${isQuizMode ? "" : `<div style="font-size: 0.8rem; color: var(--color-battle-text-muted); font-weight: 600;">${results[0].wpm} WPM</div>`}
        `;
        document.getElementById("podium-1st-avatar").textContent = results[0].nickname.charAt(0).toUpperCase();
        if (results[0].nickname === state.myUser.nickname) document.getElementById("podium-1st-avatar").style.background = "linear-gradient(135deg, #ff7b8e, #ffd17b)";
    }

    const pod2 = document.getElementById("podium-2nd");
    if (results.length > 1) {
        pod2.style.display = "flex";
        document.getElementById("podium-2nd-name").textContent = results[1].nickname;
        document.getElementById("podium-2nd-wpm").innerHTML = `
            <div style="font-weight: 800; color: var(--color-battle-primary); font-size: 0.95rem; margin-bottom: 2px;">${i18n.t('common.n_points', { count: results[1].score })}</div>
            ${isQuizMode ? "" : `<div style="font-size: 0.8rem; color: var(--color-battle-text-muted); font-weight: 600;">${results[1].wpm} WPM</div>`}
        `;
        document.getElementById("podium-2nd-avatar").textContent = results[1].nickname.charAt(0).toUpperCase();
        if (results[1].nickname === state.myUser.nickname) document.getElementById("podium-2nd-avatar").style.background = "linear-gradient(135deg, #ff7b8e, #ffd17b)";
    } else {
        pod2.style.display = "none";
    }

    const pod3 = document.getElementById("podium-3rd");
    if (results.length > 2) {
        pod3.style.display = "flex";
        document.getElementById("podium-3rd-name").textContent = results[2].nickname;
        document.getElementById("podium-3rd-wpm").innerHTML = `
            <div style="font-weight: 800; color: var(--color-battle-primary); font-size: 0.95rem; margin-bottom: 2px;">${i18n.t('common.n_points', { count: results[2].score })}</div>
            ${isQuizMode ? "" : `<div style="font-size: 0.8rem; color: var(--color-battle-text-muted); font-weight: 600;">${results[2].wpm} WPM</div>`}
        `;
        document.getElementById("podium-3rd-avatar").textContent = results[2].nickname.charAt(0).toUpperCase();
        if (results[2].nickname === state.myUser.nickname) document.getElementById("podium-3rd-avatar").style.background = "linear-gradient(135deg, #ff7b8e, #ffd17b)";
    } else {
        pod3.style.display = "none";
    }

    const tbody = document.getElementById("results-table-body");
    tbody.innerHTML = "";

    results.forEach((p, idx) => {
        const isMe = p.nickname === state.myUser.nickname;
        const tr = document.createElement("tr");
        if (isMe) tr.className = "me";

        if (p.disconnected) {
            tr.style.opacity = "0.5";
            tr.innerHTML = `
                <td style="font-weight:bold; color:#aaa">DNF</td>
                <td>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <div class="player-mini-avatar" style="${isMe ? 'background: linear-gradient(135deg, #ff7b8e, #ffd17b)' : ''}; filter: grayscale(100%);">${escapeHTML(p.nickname.charAt(0).toUpperCase())}</div>
                        <span>${escapeHTML(p.nickname)} ${isMe ? `<strong>${i18n.t('battle.me')}</strong>` : ''} <span style="color:#ff4a68; font-size: 0.8rem;">${i18n.t('battle.give_up')}</span></span>
                    </div>
                </td>
                <td colspan="3" style="text-align: center; color: #ff4a68; font-weight: bold;">${i18n.t('battle.left_mid_game')}</td>
            `;
        } else {
            tr.innerHTML = `
                <td style="font-weight:bold; color:${idx === 0 ? 'var(--color-battle-accent)' : ''}">${i18n.t('battle.rank_place', { rank: p.rank })}</td>
                <td>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <div class="player-mini-avatar" style="${isMe ? 'background: linear-gradient(135deg, #ff7b8e, #ffd17b)' : ''}">${escapeHTML(p.nickname.charAt(0).toUpperCase())}</div>
                        <span>${escapeHTML(p.nickname)} ${isMe ? `<strong>${i18n.t('battle.me')}</strong>` : ''}</span>
                    </div>
                </td>
                <td>${isQuizMode ? i18n.t('common.n_questions', { count: `<strong>${Number(p.score) || 0}</strong>` }) : `<strong>${p.wpm}</strong> WPM`}</td>
                <td>${isQuizMode ? `-` : `${p.accuracy}%`}</td>
                <td>${i18n.t('common.n_points', { count: p.score })}</td>
            `;
        }
        tbody.appendChild(tr);
    });
}

export function switchView(viewId) {
    const sections = document.querySelectorAll(".view-section");
    sections.forEach(s => s.classList.remove("active"));

    const target = document.getElementById(viewId);
    if (target) target.classList.add("active");
}

// ── 7. 방 나가기 / 이동 ──────────────────────────────────────────────
export function leaveRoom() {
    if (confirm(i18n.t('battle.do_you_really_want_to_leave'))) {
        if (state.battleSocket) {
            state.battleSocket.close();
            state.battleSocket = null;
        }
        state.currentRoom = null;
        returnToLobby();
    }
}

export function returnToLobby() {
    if (state.ytPlayer && state.ytPlayer.stopVideo) {
        state.ytPlayer.stopVideo();
    }
    if (state.syncTimer) clearInterval(state.syncTimer);
    location.href = "/battle";
}

export function returnToWaitingRoom() {
    enterWaitingRoom();
}

// ── 8. 퀴즈 대전 전용 채팅/랭킹 렌더링 ──────────────────────────────────
export function addQuizSystemChat(msg) {
    const container = document.getElementById("quiz-chat-messages");
    if (!container) return;
    const div = document.createElement("div");
    div.className = "chat-bubble system";
    div.style.alignSelf = "center";
    div.style.backgroundColor = "rgba(255, 209, 123, 0.08)";
    div.style.color = "var(--color-battle-accent)";
    div.style.border = "1px solid rgba(255, 209, 123, 0.15)";
    div.style.padding = "8px 12px";
    div.style.borderRadius = "12px";
    div.style.fontSize = "0.8rem";
    div.style.fontWeight = "600";
    div.textContent = msg;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

export function addQuizUserChat(sender, msg, isCorrect) {
    const container = document.getElementById("quiz-chat-messages");
    if (!container) return;
    const bubble = document.createElement("div");
    bubble.className = "chat-bubble me";
    if (isCorrect) {
        bubble.style.border = "2px solid #34a853";
        bubble.innerHTML = `<div class="chat-sender" style="color:#ffd17b">${escapeHTML(sender)} <span style="color:#34a853"></span></div>${escapeHTML(msg)}`;
    } else {
        bubble.innerHTML = `<div class="chat-sender" style="color:#ffd17b">${escapeHTML(sender)}</div>${escapeHTML(msg)}`;
    }
    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;
}

export function addQuizOpponentChat(sender, msg, isCorrect) {
    const container = document.getElementById('quiz-chat-messages');
    if (!container) return;
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    if (isCorrect) {
        bubble.style.border = '2px solid #1a73e8';
        bubble.innerHTML = `<div class="chat-sender" style="color:var(--color-battle-accent)">${escapeHTML(sender)} <span style="color:#1a73e8"></span></div>${escapeHTML(msg)}`;
    } else {
        bubble.innerHTML = `<div class="chat-sender" style="color:var(--color-battle-accent)">${escapeHTML(sender)}</div>${escapeHTML(msg)}`;
    }
    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;
}

export function renderLiveRankingQuiz() {
    const container = document.getElementById("quiz-live-ranking-container");
    if (!container) return;
    container.innerHTML = "";

    let playerList = Object.entries(state.opponents).map(([nick, p]) => ({ nickname: nick, ...p }));
    playerList.sort((a, b) => b.score - a.score);

    playerList.forEach((p, idx) => {
        const isMe = p.nickname === state.myUser.nickname;

        const row = document.createElement("div");
        row.style.display = "flex";
        row.style.alignItems = "center";
        row.style.gap = "10px";

        const rankBadge = document.createElement("div");
        rankBadge.style.width = "24px";
        rankBadge.style.height = "24px";
        rankBadge.style.borderRadius = "50%";
        rankBadge.style.display = "flex";
        rankBadge.style.alignItems = "center";
        rankBadge.style.justifyContent = "center";
        rankBadge.style.fontWeight = "bold";
        rankBadge.style.fontSize = "0.8rem";
        rankBadge.style.color = "white";

        if (idx === 0) rankBadge.style.background = "#ffd700";
        else if (idx === 1) rankBadge.style.background = "#c0c0c0";
        else if (idx === 2) rankBadge.style.background = "#cd7f32";
        else rankBadge.style.background = "#999";
        rankBadge.innerText = idx + 1;

        const nameLabel = document.createElement("div");
        nameLabel.style.flex = "1";
        nameLabel.style.minWidth = "0";
        nameLabel.style.fontSize = "0.95rem";
        nameLabel.style.fontWeight = isMe ? "bold" : "500";
        nameLabel.style.color = isMe ? "var(--color-battle-primary)" : "var(--color-battle-text)";
        nameLabel.style.whiteSpace = "nowrap";
        nameLabel.style.overflow = "hidden";
        nameLabel.style.textOverflow = "ellipsis";
        nameLabel.innerText = p.nickname;

        const scoreLabel = document.createElement("div");
        scoreLabel.style.flexShrink = "0";
        scoreLabel.style.textAlign = "right";
        scoreLabel.style.fontSize = "0.95rem";
        scoreLabel.style.fontWeight = "bold";
        scoreLabel.style.color = isMe ? "var(--color-battle-primary)" : "var(--color-battle-text-muted)";
        scoreLabel.innerText = i18n.t('common.n_points', { count: p.score });

        row.appendChild(rankBadge);
        row.appendChild(nameLabel);
        row.appendChild(scoreLabel);

        container.appendChild(row);
    });
}