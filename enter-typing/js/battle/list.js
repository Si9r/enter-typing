let pendingRoomCode = null;

function fmtMode(mode) {
    return mode === 'quiz' ? `<span>${i18n.t('nav.quiz')}</span>` : (mode === 'typing' ? `<span>${i18n.t('nav.typing')}</span>` : null);
}

async function loadRooms() {
    try {
        const res = await fetch('/api/battle/rooms');
        const data = await res.json();
        const grid = document.getElementById('room-grid');
        if (!data.success || data.rooms.length === 0) {
            grid.innerHTML = `<div class="empty-rooms">${i18n.t('battle.there_are_currently_no_open_rooms')}</div>`;
            return;
        }
        grid.innerHTML = data.rooms.map(room => {
            const modeLabel = fmtMode(room.mode);
            const songLabel = modeLabel ? `${modeLabel}: ${room.song_title ? escapeHtml(room.song_title) : `<span>${i18n.t('battle.song_tbd')}</span>`}` : `<span>${i18n.t('battle.content_tbd')}</span>`;
            const lockedClass = room.is_private ? ' locked' : '';
            const lockIcon = room.is_private ? '<i class="ph-fill ph-lock"></i>' : '';
            const statusClass = room.status === 'playing' ? ' playing' : '';
            const statusLabel = room.status === 'playing' ? `<span>${i18n.t('battle.playing')}</span>` : `<span>${i18n.t('battle.waiting_2')}</span>`;
            return `
                <div class="room-card${lockedClass}" onclick="onRoomClick('${escapeHtml(room.code)}', ${room.is_private ? 'true' : 'false'})">
                    <div class="room-card-header">
                        <span class="room-card-title">${escapeHtml(room.title)}</span>
                        <span>${lockIcon}</span>
                    </div>
                    <div class="room-card-meta"><span>${i18n.t('battle.host')}</span>: ${escapeHtml(room.host)} · ${songLabel}</div>
                    <div class="room-card-footer">
                        <span>${room.player_count} / ${i18n.t('common.n_people', { count: room.max_players })}</span>
                        <span class="room-card-status${statusClass}">${statusLabel}</span>
                    </div>
                </div>
            `;
        }).join('');
    } catch (e) {
        console.error('방 목록 조회 실패:', e);
    }
}

function onRoomClick(code, isPrivate) {
    if (isPrivate) {
        pendingRoomCode = code;
        document.getElementById('join-password').value = '';
        document.getElementById('modal-password').classList.add('show');
    } else {
        location.href = `/battle/${code}`;
    }
}

async function submitPassword() {
    const password = document.getElementById('join-password').value;
    try {
        const res = await fetch(`/api/battle/rooms/${pendingRoomCode}/verify-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        const data = await res.json();
        if (data.success) {
            sessionStorage.setItem('battle_room_pw', password);
            location.href = `/battle/${pendingRoomCode}`;
        } else {
            alert(data.detail || i18n.t('battle.wrong_password'));
        }
    } catch (e) {
        alert(i18n.t('battle.wrong_password'));
    }
}

function closePasswordModal() {
    document.getElementById('modal-password').classList.remove('show');
    pendingRoomCode = null;
}

function joinByCode() {
    const code = document.getElementById('join-code-input').value.trim();
    if (code.length !== 4) {
        alert(i18n.t('battle.please_enter_the_4_digit_room'));
        return;
    }
    location.href = `/battle/${code}`;
}

function openCreateModal() {
    if (!(window.NavAuth && window.NavAuth.getUser())) {
        alert(i18n.t('common.this_service_requires_login'));
        location.href = '/login';
        return;
    }
    document.getElementById('create-title').value = '';
    document.getElementById('create-max-players').value = '4';
    document.getElementById('create-is-private').checked = false;
    document.getElementById('create-password-row').style.display = 'none';
    document.getElementById('create-password').value = '';
    document.getElementById('modal-create-room').classList.add('show');
}

function closeCreateModal() {
    document.getElementById('modal-create-room').classList.remove('show');
}

function onPrivateToggle() {
    const checked = document.getElementById('create-is-private').checked;
    document.getElementById('create-password-row').style.display = checked ? 'block' : 'none';
}

async function submitCreateRoom() {
    const title = document.getElementById('create-title').value.trim() || '즐거운 대전방'; // 서버에 저장되는 방 제목 (번역하지 않음)
    const maxPlayers = parseInt(document.getElementById('create-max-players').value);
    const isPrivate = document.getElementById('create-is-private').checked;
    const password = document.getElementById('create-password').value;

    if (isPrivate && !password) {
        alert(i18n.t('battle.private_rooms_require_a_password'));
        return;
    }

    try {
        const res = await fetch('/api/battle/rooms', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ title, max_players: maxPlayers, is_private: isPrivate, password: isPrivate ? password : null })
        });
        const data = await res.json();
        if (data.success) {
            if (isPrivate) sessionStorage.setItem('battle_room_pw', password);
            location.href = `/battle/${data.room_code}`;
        } else {
            alert(data.detail || i18n.t('battle.room_creation_failed'));
        }
    } catch (e) {
        alert(i18n.t('common.an_error_occurred'));
    }
}

// 실시간 방 목록 갱신 (로비 웹소켓)
function connectLobbySocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/lobby`);
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'lobby_update') loadRooms();
    };
    ws.onclose = () => setTimeout(connectLobbySocket, 3000);
}

loadRooms();
connectLobbySocket();
