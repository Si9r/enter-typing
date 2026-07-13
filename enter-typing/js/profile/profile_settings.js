// ── 정보 수정 모달: 닉네임 변경, 비밀번호 변경, 회원 탈퇴, 게임 설정 ──

// ── 모달 닉네임 중복 체크 상태 ────────────────────────────────
let isModalNicknameChecked = false;

// ── 모달 열기/닫기 ─────────────────────────────────────────
export function openEditModal() {
    // 로그인 상태 확인
    const user = (typeof NavAuth !== 'undefined') ? NavAuth.getUser() : null;
    if (!user || !user.email) {
        alert('로그인이 필요합니다.');
        location.href = 'login.html';
        return;
    }
    document.getElementById('editModal').classList.add('open');
    switchModalTab('nick');
    clearModalForms();
    isModalNicknameChecked = false;
    document.getElementById('m-new-nick').value = user.nickname || '';
}

export function closeEditModal() {
    document.getElementById('editModal').classList.remove('open');
}

export function closeEditModalOutside(e) {
    if (e.target === document.getElementById('editModal')) closeEditModal();
}

export function switchModalTab(name) {
    document.querySelectorAll('.modal-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.modal-tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('mtab-' + name).classList.add('active');
    document.getElementById('mtab-' + name + '-btn').classList.add('active');
}

function clearModalForms() {
    ['m-new-nick', 'm-cur-pw', 'm-new-pw', 'm-new-pw2', 'm-del-pw'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.value = '';
            el.classList.remove('error', 'valid');
        }
    });
    document.querySelectorAll('.m-form-error').forEach(e => e.classList.remove('visible'));
    document.querySelectorAll('.m-form-success').forEach(e => e.classList.remove('visible'));
}

function showMErr(id, msg) {
    const el = document.getElementById(id);
    if (msg) el.textContent = msg;
    el.classList.add('visible');
}
function hideMErr(id) { document.getElementById(id).classList.remove('visible'); }

// 모달 닉네임 입력 시 실시간 중복 체크 리셋 및 피드백 숨기기 리스너 등록
export function initSettingsModalListeners() {
    const modalNickInput = document.getElementById('m-new-nick');
    if (modalNickInput) {
        modalNickInput.addEventListener('input', function () {
            isModalNicknameChecked = false;
            this.classList.remove('error', 'valid');
            document.getElementById('m-new-nick-err').classList.remove('visible');
            document.getElementById('m-new-nick-success').classList.remove('visible');
        });
    }
}

// ── 닉네임 중복 확인 ─────────────────────────────────────────
export async function checkNewNicknameDuplicate() {
    const user = NavAuth.getUser();
    if (!user) return;

    const newNick = document.getElementById('m-new-nick').value.trim();
    const errEl = document.getElementById('m-new-nick-err');
    const okEl = document.getElementById('m-new-nick-success');
    const input = document.getElementById('m-new-nick');

    hideMErr('m-new-nick-err');
    okEl.classList.remove('visible');
    input.classList.remove('error', 'valid');

    if (newNick === '') {
        showMErr('m-new-nick-err', '닉네임을 입력해주세요.');
        input.classList.add('error');
        isModalNicknameChecked = false;
        return;
    }

    if (newNick.length < 2 || newNick.length > 12) {
        showMErr('m-new-nick-err', '닉네임은 2자 이상 12자 이하로 입력해주세요.');
        input.classList.add('error');
        isModalNicknameChecked = false;
        return;
    }

    // 현재 본인의 닉네임과 같은 경우
    if (newNick === user.nickname) {
        okEl.textContent = '현재 사용 중인 본인의 닉네임입니다.';
        okEl.classList.add('visible');
        input.classList.add('valid');
        isModalNicknameChecked = true;
        return;
    }

    const btn = document.getElementById('m-check-nick-btn');
    btn.disabled = true;
    btn.textContent = '확인 중...';

    try {
        const res = await fetch('/api/check-nickname?nickname=' + encodeURIComponent(newNick));
        const data = await res.json();
        if (res.ok) {
            if (data.exists) {
                showMErr('m-new-nick-err', data.message);
                input.classList.add('error');
                isModalNicknameChecked = false;
            } else {
                okEl.textContent = data.message;
                okEl.classList.add('visible');
                input.classList.add('valid');
                isModalNicknameChecked = true;
            }
        } else {
            showMErr('m-new-nick-err', data.detail || '중복 확인에 실패했습니다.');
            input.classList.add('error');
            isModalNicknameChecked = false;
        }
    } catch (e) {
        showMErr('m-new-nick-err', '서버에 연결할 수 없습니다.');
        input.classList.add('error');
        isModalNicknameChecked = false;
    } finally {
        btn.disabled = false;
        btn.textContent = '중복 확인';
    }
}

// ── 닉네임 변경 ────────────────────────────────────────────
export async function submitChangeNickname() {
    const user = NavAuth.getUser();
    if (!user || !user.email) { alert('로그인 정보가 없습니다.'); return; }

    const newNick = document.getElementById('m-new-nick').value.trim();
    const input = document.getElementById('m-new-nick');
    hideMErr('m-new-nick-err');

    if (newNick.length < 2 || newNick.length > 12) {
        showMErr('m-new-nick-err', '닉네임은 2자 이상 12자 이하로 입력해주세요.');
        input.classList.add('error');
        return;
    }

    if (!isModalNicknameChecked) {
        showMErr('m-new-nick-err', '닉네임 중복 확인이 필요합니다.');
        input.classList.add('error');
        return;
    }

    const btn = document.getElementById('m-change-nick-btn');
    btn.disabled = true; btn.textContent = '변경 중...';

    try {
        const token = sessionStorage.getItem('ep_token') || '';
        const res = await fetch('/api/change-nickname', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ new_nickname: newNick })
        });
        const data = await res.json();

        if (res.ok && data.success) {
            alert('닉네임이 변경되었습니다.');

            // 업데이트된 사용자 정보 저장
            const updatedUser = { ...user, nickname: data.nickname || newNick };
            sessionStorage.setItem('ep_user', JSON.stringify(updatedUser));

            // 화면에 즉시 반영
            document.getElementById('profile-nickname').textContent = updatedUser.nickname;
            document.getElementById('profile-avatar').textContent = updatedUser.nickname.charAt(0).toUpperCase();

            // 네비게이션 바 등 동기화를 위해 페이지 새로고침
            location.reload();
        } else {
            showMErr('m-new-nick-err', data.detail || '변경에 실패했습니다.');
        }
    } catch (e) {
        alert('서버에 연결할 수 없습니다.');
    } finally {
        btn.disabled = false; btn.textContent = '닉네임 변경';
    }
}

// ── 비밀번호 변경 ──────────────────────────────────────────
export async function submitChangePassword() {
    const user = NavAuth.getUser();
    if (!user || !user.email) { alert('로그인 정보가 없습니다.'); return; }

    const curPw = document.getElementById('m-cur-pw').value;
    const newPw = document.getElementById('m-new-pw').value;
    const newPw2 = document.getElementById('m-new-pw2').value;
    let valid = true;

    hideMErr('m-cur-pw-err'); hideMErr('m-new-pw-err'); hideMErr('m-new-pw2-err');

    if (!curPw) { showMErr('m-cur-pw-err', '현재 비밀번호를 입력해주세요.'); valid = false; }
    const pwOk = /[a-zA-Z]/.test(newPw) && /[0-9]/.test(newPw) && newPw.length >= 8;
    if (!pwOk) { showMErr('m-new-pw-err', '영문, 숫자를 포함해 8자 이상 입력해주세요.'); valid = false; }
    if (newPw !== newPw2) { showMErr('m-new-pw2-err', '비밀번호가 일치하지 않습니다.'); valid = false; }
    if (!valid) return;

    // Step 1: 현재 비밀번호로 로그인 검증
    const btn = document.getElementById('m-change-pw-btn');
    btn.disabled = true; btn.textContent = '변경 중...';

    try {
        // 현재 비밀번호 검증 (login API 재활용)
        const verifyRes = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: user.email, password: curPw })
        });
        const verifyData = await verifyRes.json();
        if (!verifyRes.ok) {
            showMErr('m-cur-pw-err', '현재 비밀번호가 올바르지 않습니다.');
            return;
        }

        // Step 2: 새 비밀번호로 변경
        const token = sessionStorage.getItem('ep_token') || '';
        const res = await fetch('/api/change-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ email: user.email, new_password: newPw })
        });
        const data = await res.json();

        if (res.ok && data.success) {
            alert('비밀번호가 변경되었습니다. 다시 로그인해주세요.');
            NavAuth.logout();
            closeEditModal();
            location.href = 'login.html';
        } else {
            showMErr('m-new-pw-err', data.detail || '변경에 실패했습니다.');
        }
    } catch (e) {
        alert('서버에 연결할 수 없습니다.');
    } finally {
        btn.disabled = false; btn.textContent = '비밀번호 변경';
    }
}

// ── 회원 탈퇴 ──────────────────────────────────────────────
export async function submitDeleteAccount() {
    const user = NavAuth.getUser();
    if (!user || !user.email) { alert('로그인 정보가 없습니다.'); return; }

    const pw = document.getElementById('m-del-pw').value;
    hideMErr('m-del-pw-err');
    if (!pw) { showMErr('m-del-pw-err', '비밀번호를 입력해주세요.'); return; }

    if (!confirm('정말로 탈퇴하시겠습니까? 모든 데이터가 영구 삭제됩니다.')) return;

    const btn = document.getElementById('m-del-btn');
    btn.disabled = true; btn.textContent = '처리 중...';

    try {
        const token = sessionStorage.getItem('ep_token') || '';
        const res = await fetch('/api/delete-account', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ email: user.email, password: pw })
        });
        const data = await res.json();

        if (res.ok && data.success) {
            NavAuth.logout();
            alert('회원 탈퇴가 완료되었습니다. 이용해 주셔서 감사합니다.');
            location.href = 'index.html';
        } else {
            showMErr('m-del-pw-err', data.detail || '탈퇴에 실패했습니다.');
        }
    } catch (e) {
        alert('서버에 연결할 수 없습니다.');
    } finally {
        btn.disabled = false; btn.textContent = '회원 탈퇴하기';
    }
}

// ── 게임 설정 모달 제어 ──────────────────────────────────────
export function openSettingsModal() {
    document.getElementById('settingsModal').classList.add('open');
    document.getElementById('setting-split-sokuon-main').checked = localStorage.getItem('allowSplitSokuon') === 'true';
}
export function closeSettingsModal() {
    document.getElementById('settingsModal').classList.remove('open');
}
export function closeSettingsModalOutside(e) {
    if (e.target === document.getElementById('settingsModal')) closeSettingsModal();
}
export function toggleSplitSokuonMain(checked) {
    localStorage.setItem('allowSplitSokuon', checked ? 'true' : 'false');
}
