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
    const labels = ['', i18n.t('auth.strength_weak'), i18n.t('auth.strength_medium'), i18n.t('auth.strength_strong'), i18n.t('auth.very_strong')];
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
        errEl.textContent = i18n.t('auth.please_enter_the_correct_email_format');
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
                errEl.textContent = i18n.server(data.message);
                errEl.classList.add('visible');
                okEl.classList.remove('visible');
                isEmailChecked = false;
            } else {
                emailInput.classList.remove('error');
                emailInput.classList.add('valid');
                errEl.classList.remove('visible');
                okEl.textContent = i18n.server(data.message);
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
        errEl.textContent = i18n.t('common.please_enter_a_nickname_of_at');
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
                errEl.textContent = i18n.server(data.message);
                errEl.classList.add('visible');
                okEl.classList.remove('visible');
                isNicknameChecked = false;
            } else {
                nameInput.classList.remove('error');
                nameInput.classList.add('valid');
                errEl.classList.remove('visible');
                okEl.textContent = i18n.server(data.message);
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
        nameError.textContent = i18n.t('auth.the_nickname_needs_to_be_checked');
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
        emailError.textContent = i18n.t('auth.you_need_to_double_check_your');
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
        termsError.classList.add('visible');
        valid = false;
    } else {
        termsError.classList.remove('visible');
    }

    if (valid) {
        const signupBtn = document.getElementById('signup-btn');
        signupBtn.disabled = true;
        signupBtn.textContent = i18n.t('auth.signing_up');

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
                    alert(i18n.t('auth.membership_registration_has_been_complet'));
                    location.href = '/login';
                } else {
                    const emailInput = document.getElementById('signup-email');
                    const emailError = document.getElementById('email-error');
                    emailInput.classList.add('error');
                    emailError.textContent = i18n.server(data.detail, 'auth.membership_registration_failed_please_tr');
                    emailError.classList.add('visible');
                }
            })
            .catch(err => {
                alert(i18n.t('auth.unable_to_connect_to_server_please'));
            })
            .finally(() => {
                signupBtn.disabled = false;
                signupBtn.textContent = i18n.t('nav.sign_up');
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
