let pendingRoomCode = null;

function fmtMode(mode) {
    return mode === 'quiz' ? '퀴즈' : (mode === 'typing' ? '타이핑' : null);
}

async function loadRooms() {
    try {
        const res = await fetch('/api/battle/rooms');
        const data = await res.json();
        const grid = document.getElementById('room-grid');
        if (!data.success || data.rooms.length === 0) {
            grid.innerHTML = '<div class="empty-rooms">현재 열린 방이 없습니다. 새 방을 만들어보세요!</div>';
            return;
        }
        grid.innerHTML = data.rooms.map(room => {
            const modeLabel = fmtMode(room.mode);
            const songLabel = modeLabel ? `${modeLabel}: ${room.song_title || '곡 미정'}` : '콘텐츠 미정';
            const lockedClass = room.is_private ? ' locked' : '';
            const lockIcon = room.is_private ? '<i class="ph-fill ph-lock"></i>' : '';
            const statusClass = room.status === 'playing' ? ' playing' : '';
            const statusLabel = room.status === 'playing' ? '게임중' : '대기중';
            return `
                <div class="room-card${lockedClass}" onclick="onRoomClick('${room.code}', ${room.is_private})">
                    <div class="room-card-header">
                        <span class="room-card-title">${room.title}</span>
                        <span>${lockIcon}</span>
                    </div>
                    <div class="room-card-meta">방장: ${room.host} · ${songLabel}</div>
                    <div class="room-card-footer">
                        <span>${room.player_count} / ${room.max_players}명</span>
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
            alert(data.detail || '비밀번호가 올바르지 않습니다.');
        }
    } catch (e) {
        alert('비밀번호가 올바르지 않습니다.');
    }
}

function closePasswordModal() {
    document.getElementById('modal-password').classList.remove('show');
    pendingRoomCode = null;
}

function joinByCode() {
    const code = document.getElementById('join-code-input').value.trim();
    if (code.length !== 4) {
        alert('4자리 방 코드를 올바르게 입력해주세요!');
        return;
    }
    location.href = `/battle/${code}`;
}

function openCreateModal() {
    if (!(window.NavAuth && window.NavAuth.getUser())) {
        alert('로그인이 필요한 서비스입니다.');
        location.href = 'login.html';
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
    const title = document.getElementById('create-title').value.trim() || '즐거운 대전방';
    const maxPlayers = parseInt(document.getElementById('create-max-players').value);
    const isPrivate = document.getElementById('create-is-private').checked;
    const password = document.getElementById('create-password').value;

    if (isPrivate && !password) {
        alert('비밀방은 비밀번호를 입력해야 합니다.');
        return;
    }

    const token = sessionStorage.getItem('ep_token');
    try {
        const res = await fetch('/api/battle/rooms', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ title, max_players: maxPlayers, is_private: isPrivate, password: isPrivate ? password : null })
        });
        const data = await res.json();
        if (data.success) {
            if (isPrivate) sessionStorage.setItem('battle_room_pw', password);
            location.href = `/battle/${data.room_code}`;
        } else {
            alert(data.detail || '방 생성에 실패했습니다.');
        }
    } catch (e) {
        alert('오류가 발생했습니다.');
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
