// ─── 비밀번호 강도 체크 ───────────────────────────────
function getPasswordStrength(pw) {
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[a-zA-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^a-zA-Z0-9]/.test(pw)) score++;
    return score;
}

document.getElementById('signup-password').addEventListener('input', function () {
    const pw = this.value;
    const score = getPasswordStrength(pw);
    const bars = [
        document.getElementById('bar1'),
        document.getElementById('bar2'),
        document.getElementById('bar3'),
        document.getElementById('bar4')
    ];
    const labels = ['', '약함', '보통', '강함', '매우 강함'];
    const colors = ['', 'weak', 'medium', 'strong', 'strong'];

    bars.forEach((bar, i) => {
        bar.className = 'strength-bar';
        if (i < score && pw.length > 0) bar.classList.add(colors[score]);
    });

    document.getElementById('strength-label').textContent = pw.length > 0 ? labels[score] : '';

    // 비밀번호 확인란과 연동
    checkPasswordMatch();
});

// ─── 비밀번호 일치 확인 ────────────────────────────────
function checkPasswordMatch() {
    const pw = document.getElementById('signup-password').value;
    const cpw = document.getElementById('signup-password-confirm').value;
    const errEl = document.getElementById('confirm-error');
    const okEl = document.getElementById('confirm-success');
    const input = document.getElementById('signup-password-confirm');

    if (cpw === '') {
        input.classList.remove('error', 'valid');
        errEl.classList.remove('visible');
        okEl.classList.remove('visible');
        return;
    }
    if (pw === cpw) {
        input.classList.remove('error'); input.classList.add('valid');
        errEl.classList.remove('visible');
        okEl.classList.add('visible');
    } else {
        input.classList.remove('valid'); input.classList.add('error');
        okEl.classList.remove('visible');
        errEl.classList.add('visible');
    }
}

document.getElementById('signup-password-confirm').addEventListener('input', checkPasswordMatch);

// ─── 전체 동의 체크박스 ────────────────────────────────
const agreeAll = document.getElementById('agree-all');
const agreeTerms = document.getElementById('agree-terms');
const agreePrivacy = document.getElementById('agree-privacy');
const agreeMarket = document.getElementById('agree-marketing');
const allItems = [agreeTerms, agreePrivacy, agreeMarket];

agreeAll.addEventListener('change', function () {
    allItems.forEach(cb => cb.checked = this.checked);
});

allItems.forEach(cb => {
    cb.addEventListener('change', function () {
        agreeAll.checked = allItems.every(c => c.checked);
    });
});

// ─── 실시간 중복 체크 상태 ─────────────────────────────
let isEmailChecked = false;
let isNicknameChecked = false;

async function checkEmailDuplicate() {
    const emailInput = document.getElementById('signup-email');
    const emailVal = emailInput.value.trim();
    const errEl = document.getElementById('email-error');
    const okEl = document.getElementById('email-success');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (emailVal === '') {
        emailInput.classList.remove('error', 'valid');
        errEl.classList.remove('visible');
        okEl.classList.remove('visible');
        isEmailChecked = false;
        return;
    }

    if (!emailRegex.test(emailVal)) {
        emailInput.classList.add('error');
        emailInput.classList.remove('valid');
        errEl.textContent = '올바른 이메일 형식을 입력해주세요.';
        errEl.classList.add('visible');
        okEl.classList.remove('visible');
        isEmailChecked = false;
        return;
    }

    try {
        const res = await fetch('/api/check-email?email=' + encodeURIComponent(emailVal));
        const data = await res.json();
        if (res.ok) {
            if (data.exists) {
                emailInput.classList.add('error');
                emailInput.classList.remove('valid');
                errEl.textContent = data.message;
                errEl.classList.add('visible');
                okEl.classList.remove('visible');
                isEmailChecked = false;
            } else {
                emailInput.classList.remove('error');
                emailInput.classList.add('valid');
                errEl.classList.remove('visible');
                okEl.textContent = data.message;
                okEl.classList.add('visible');
                isEmailChecked = true;
            }
        }
    } catch (e) {
        console.error(e);
    }
}

async function checkNicknameDuplicate() {
    const nameInput = document.getElementById('signup-name');
    const nameVal = nameInput.value.trim();
    const errEl = document.getElementById('name-error');
    const okEl = document.getElementById('name-success');

    if (nameVal === '') {
        nameInput.classList.remove('error', 'valid');
        errEl.classList.remove('visible');
        okEl.classList.remove('visible');
        isNicknameChecked = false;
        return;
    }

    if (nameVal.length < 2 || nameVal.length > 12) {
        nameInput.classList.add('error');
        nameInput.classList.remove('valid');
        errEl.textContent = '닉네임은 2자 이상 12자 이하로 입력해주세요.';
        errEl.classList.add('visible');
        okEl.classList.remove('visible');
        isNicknameChecked = false;
        return;
    }

    try {
        const res = await fetch('/api/check-nickname?nickname=' + encodeURIComponent(nameVal));
        const data = await res.json();
        if (res.ok) {
            if (data.exists) {
                nameInput.classList.add('error');
                nameInput.classList.remove('valid');
                errEl.textContent = data.message;
                errEl.classList.add('visible');
                okEl.classList.remove('visible');
                isNicknameChecked = false;
            } else {
                nameInput.classList.remove('error');
                nameInput.classList.add('valid');
                errEl.classList.remove('visible');
                okEl.textContent = data.message;
                okEl.classList.add('visible');
                isNicknameChecked = true;
            }
        }
    } catch (e) {
        console.error(e);
    }
}

document.getElementById('signup-email').addEventListener('blur', checkEmailDuplicate);
document.getElementById('signup-name').addEventListener('blur', checkNicknameDuplicate);

// ─── 폼 제출 유효성 검사 ──────────────────────────────
document.getElementById('signupForm').addEventListener('submit', function (e) {
    e.preventDefault();
    let valid = true;

    const nameVal = document.getElementById('signup-name').value.trim();
    const emailVal = document.getElementById('signup-email').value.trim();
    const pwVal = document.getElementById('signup-password').value;
    const cpwVal = document.getElementById('signup-password-confirm').value;

    // 닉네임
    const nameInput = document.getElementById('signup-name');
    const nameError = document.getElementById('name-error');
    if (nameVal.length < 2 || nameVal.length > 12) {
        nameInput.classList.add('error');
        nameError.classList.add('visible');
        valid = false;
    } else if (!isNicknameChecked) {
        nameInput.classList.add('error');
        nameError.textContent = '닉네임 중복 확인이 필요하거나 이미 사용 중인 닉네임입니다.';
        nameError.classList.add('visible');
        valid = false;
    } else {
        nameInput.classList.remove('error');
        nameError.classList.remove('visible');
    }

    // 이메일
    const emailInput = document.getElementById('signup-email');
    const emailError = document.getElementById('email-error');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailVal)) {
        emailInput.classList.add('error');
        emailError.classList.add('visible');
        valid = false;
    } else if (!isEmailChecked) {
        emailInput.classList.add('error');
        emailError.textContent = '이메일 중복 확인이 필요하거나 이미 가입된 이메일입니다.';
        emailError.classList.add('visible');
        valid = false;
    } else {
        emailInput.classList.remove('error');
        emailError.classList.remove('visible');
    }

    // 비밀번호
    const pwInput = document.getElementById('signup-password');
    const pwError = document.getElementById('password-error');
    const pwValid = /[a-zA-Z]/.test(pwVal) && /[0-9]/.test(pwVal) && pwVal.length >= 8;
    if (!pwValid) {
        pwInput.classList.add('error');
        pwError.classList.add('visible');
        valid = false;
    } else {
        pwInput.classList.remove('error');
        pwError.classList.remove('visible');
    }

    // 비밀번호 확인
    if (pwVal !== cpwVal) {
        valid = false;
        // checkPasswordMatch 이미 표시 중
    }

    // 필수 약관
    const termsError = document.getElementById('terms-error');
    if (!agreeTerms.checked || !agreePrivacy.checked) {
        termsError.style.display = 'block';
        valid = false;
    } else {
        termsError.style.display = 'none';
    }

    if (valid) {
        const signupBtn = document.getElementById('signup-btn');
        signupBtn.disabled = true;
        signupBtn.textContent = '가입 중...';

        fetch('/api/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: emailVal,
                nickname: nameVal,
                password: pwVal
            })
        })
            .then(async res => {
                const data = await res.json();
                if (res.ok && data.success) {
                    alert('회원가입이 완료되었습니다. 로그인 해주세요.');
                    location.href = 'login.html';
                } else {
                    const emailInput = document.getElementById('signup-email');
                    const emailError = document.getElementById('email-error');
                    emailInput.classList.add('error');
                    emailError.textContent = data.detail || '회원가입에 실패했습니다. 다시 시도해주세요.';
                    emailError.classList.add('visible');
                }
            })
            .catch(err => {
                alert('서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.');
            })
            .finally(() => {
                signupBtn.disabled = false;
                signupBtn.textContent = '회원가입';
            });
    }
});

// 입력 시 에러 초기화 및 중복 검사 리셋
document.getElementById('signup-name').addEventListener('input', function () {
    isNicknameChecked = false;
    this.classList.remove('error', 'valid');
    document.getElementById('name-error').classList.remove('visible');
    document.getElementById('name-success').classList.remove('visible');
});
document.getElementById('signup-email').addEventListener('input', function () {
    isEmailChecked = false;
    this.classList.remove('error', 'valid');
    document.getElementById('email-error').classList.remove('visible');
    document.getElementById('email-success').classList.remove('visible');
});
