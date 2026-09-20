// ─── 스텝 전환 ────────────────────────────────────────
let currentStep = 1;
let verifiedEmail = '';

function goStep(n) {
    document.getElementById('step' + currentStep).classList.remove('active');
    document.getElementById('step' + n).classList.add('active');

    // 인디케이터 업데이트
    for (let i = 1; i <= 3; i++) {
        const dot = document.getElementById('dot' + i);
        const lbl = document.getElementById('lbl' + i);
        dot.className = 'step-dot';
        lbl.className = 'step-label';

        if (i < n) { dot.classList.add('done'); lbl.classList.add('done'); }
        else if (i === n) { dot.classList.add('active'); lbl.classList.add('active'); }
    }

    // 연결선 업데이트
    for (let i = 1; i <= 2; i++) {
        const line = document.getElementById('line' + i);
        line.className = 'step-line' + (i < n ? ' done' : '');
    }

    currentStep = n;
}

// ─── Step 1: 이메일 폼 ────────────────────────────────
document.getElementById('emailForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const emailInput = document.getElementById('fp-email');
    const emailError = document.getElementById('fp-email-error');
    const sendBtn = document.getElementById('send-code-btn');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(emailInput.value.trim())) {
        emailInput.classList.add('error');
        emailError.classList.add('visible');
        return;
    }

    emailInput.classList.remove('error');
    emailError.classList.remove('visible');
    verifiedEmail = emailInput.value.trim();

    // 버튼 로딩 상태
    sendBtn.disabled = true;
    sendBtn.textContent = '발송 중...';

    try {
        const res = await fetch('/api/send-verification-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: verifiedEmail })
        });
        const data = await res.json();

        if (!res.ok) {
            emailInput.classList.add('error');
            emailError.textContent = data.detail || '발송에 실패했습니다. 다시 시도해주세요.';
            emailError.classList.add('visible');
            return;
        }

        // Step 2로 이동 후 타이머 시작
        document.getElementById('step2-email').textContent = verifiedEmail;
        document.getElementById('step3-email').textContent = verifiedEmail;
        goStep(2);
        startTimer();
    } catch (err) {
        emailError.textContent = '서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.';
        emailError.classList.add('visible');
    } finally {
        sendBtn.disabled = false;
        sendBtn.textContent = '인증번호 발송';
    }
});

document.getElementById('fp-email').addEventListener('input', function () {
    this.classList.remove('error');
    document.getElementById('fp-email-error').classList.remove('visible');
});

// ─── 타이머 (3분) ─────────────────────────────────────
let timerInterval = null;
let timeLeft = 180; // 3분

function startTimer() {
    clearInterval(timerInterval);
    timeLeft = 180;
    document.getElementById('resend-btn').disabled = true;
    updateTimerDisplay();

    timerInterval = setInterval(function () {
        timeLeft--;
        updateTimerDisplay();
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            document.getElementById('timer').textContent = '만료됨';
            document.getElementById('resend-btn').disabled = false;
        }
    }, 1000);
}

function updateTimerDisplay() {
    const m = String(Math.floor(timeLeft / 60)).padStart(1, '0');
    const s = String(timeLeft % 60).padStart(2, '0');
    document.getElementById('timer').textContent = m + ':' + s;
}

// ─── 재전송 버튼 ──────────────────────────────────────
document.getElementById('resend-btn').addEventListener('click', async function () {
    const resendBtn = this;
    resendBtn.disabled = true;
    resendBtn.textContent = '발송 중';

    try {
        const res = await fetch('/api/send-verification-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: verifiedEmail })
        });
        if (res.ok) {
            document.getElementById('fp-code').value = '';
            document.getElementById('fp-code').classList.remove('error', 'valid');
            document.getElementById('fp-code-error').classList.remove('visible');
            startTimer();
        }
    } catch (err) {
        // 네트워크 오류 시 재시도 허용
        resendBtn.disabled = false;
    } finally {
        resendBtn.textContent = '재전송';
    }
});

// ─── Step 2: 인증번호 폼 ──────────────────────────────
document.getElementById('codeForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const codeInput = document.getElementById('fp-code');
    const codeError = document.getElementById('fp-code-error');
    const verifyBtn = e.submitter;
    const code = codeInput.value.trim();

    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
        codeInput.classList.add('error');
        codeError.textContent = '6자리 숫자를 입력해주세요.';
        codeError.classList.add('visible');
        return;
    }

    verifyBtn.disabled = true;
    verifyBtn.textContent = '확인 중...';

    try {
        const res = await fetch('/api/verify-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: verifiedEmail, code: code })
        });
        const data = await res.json();

        if (res.ok && data.success) {
            clearInterval(timerInterval);
            codeInput.classList.remove('error');
            codeError.classList.remove('visible');
            goStep(3);
        } else {
            codeInput.classList.add('error');
            codeError.textContent = data.detail || '인증번호가 올바르지 않습니다.';
            codeError.classList.add('visible');
        }
    } catch (err) {
        codeError.textContent = '서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.';
        codeError.classList.add('visible');
    } finally {
        verifyBtn.disabled = false;
        verifyBtn.textContent = '인증번호 확인';
    }
});

document.getElementById('fp-code').addEventListener('input', function () {
    this.value = this.value.replace(/\D/g, '').slice(0, 6);
    this.classList.remove('error');
    document.getElementById('fp-code-error').classList.remove('visible');
});
