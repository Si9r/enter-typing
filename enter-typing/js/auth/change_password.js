// ─── 이메일 복원 (sessionStorage) ────────────────────
const changeEmail = sessionStorage.getItem('change_pw_email') || '';
if (!changeEmail) {
    // 직접 접근 방지: 이메일 정보 없으면 로그인 페이지로
    location.href = '/login';
}

// ─── 비밀번호 강도 ────────────────────────────────────
function getStrength(pw) {
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[a-zA-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^a-zA-Z0-9]/.test(pw)) score++;
    return score;
}

document.getElementById('new-password').addEventListener('input', function () {
    const pw = this.value;
    const score = getStrength(pw);
    const bars = ['bar1', 'bar2', 'bar3', 'bar4'].map(id => document.getElementById(id));
    const colors = ['', 'weak', 'medium', 'strong', 'strong'];
    const lbls = ['', '약함', '보통', '강함', '매우 강함'];

    bars.forEach((b, i) => {
        b.className = 'strength-bar';
        if (i < score && pw.length > 0) b.classList.add(colors[score]);
    });
    document.getElementById('strength-label').textContent = pw.length > 0 ? lbls[score] : '';

    // 규칙 체크
    toggle('rule-len', pw.length >= 8);
    toggle('rule-alpha', /[a-zA-Z]/.test(pw));
    toggle('rule-num', /[0-9]/.test(pw));
    toggle('rule-spec', /[^a-zA-Z0-9]/.test(pw));

    checkMatch();
});

function toggle(id, ok) {
    const el = document.getElementById(id);
    el.classList.toggle('ok', ok);
}

// ─── 비밀번호 일치 확인 ───────────────────────────────
function checkMatch() {
    const pw = document.getElementById('new-password').value;
    const cpw = document.getElementById('new-password-confirm').value;
    const input = document.getElementById('new-password-confirm');
    const errEl = document.getElementById('confirm-error');
    const okEl = document.getElementById('confirm-success');

    if (cpw === '') {
        input.classList.remove('error', 'valid');
        errEl.classList.remove('visible');
        okEl.classList.remove('visible');
        return;
    }
    if (pw === cpw) {
        input.classList.replace('error', 'valid') || input.classList.add('valid');
        input.classList.remove('error');
        errEl.classList.remove('visible');
        okEl.classList.add('visible');
    } else {
        input.classList.add('error');
        input.classList.remove('valid');
        okEl.classList.remove('visible');
        errEl.classList.add('visible');
    }
}

document.getElementById('new-password-confirm').addEventListener('input', checkMatch);

// ─── 폼 제출 ──────────────────────────────────────────
document.getElementById('changeForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    let valid = true;

    const pw = document.getElementById('new-password').value;
    const cpw = document.getElementById('new-password-confirm').value;
    const pwInput = document.getElementById('new-password');
    const pwError = document.getElementById('pw-error');
    const changeBtn = document.getElementById('change-btn');

    // 비밀번호 규칙 검사
    const pwOk = /[a-zA-Z]/.test(pw) && /[0-9]/.test(pw) && pw.length >= 8;
    if (!pwOk) {
        pwInput.classList.add('error');
        pwError.classList.add('visible');
        valid = false;
    } else {
        pwInput.classList.remove('error');
        pwError.classList.remove('visible');
    }

    // 일치 확인
    if (pw !== cpw) valid = false;

    if (!valid) return;

    changeBtn.disabled = true;
    changeBtn.textContent = '변경 중...';

    try {
        const res = await fetch('/api/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: changeEmail, new_password: pw })
        });
        const data = await res.json();

        if (res.ok && data.success) {
            sessionStorage.removeItem('change_pw_email'); // 세션 정리
            showSuccess();
        } else {
            pwError.textContent = data.detail || '비밀번호 변경에 실패했습니다. 다시 시도해주세요.';
            pwError.classList.add('visible');
        }
    } catch (err) {
        pwError.textContent = '서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.';
        pwError.classList.add('visible');
    } finally {
        changeBtn.disabled = false;
        changeBtn.textContent = '비밀번호 변경하기';
    }
});

function showSuccess() {
    document.getElementById('changeForm-wrap').style.display = 'none';
    const successWrap = document.getElementById('success-wrap');
    successWrap.classList.add('active');
}
