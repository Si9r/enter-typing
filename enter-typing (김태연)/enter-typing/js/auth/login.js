document.getElementById('loginForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    let valid = true;

    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    const emailError = document.getElementById('email-error');
    const passwordError = document.getElementById('password-error');
    const loginBtn = document.getElementById('login-btn');

    // 이메일 유효성 검사
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailInput.value.trim())) {
        emailInput.classList.add('error');
        emailError.classList.add('visible');
        valid = false;
    } else {
        emailInput.classList.remove('error');
        emailError.classList.remove('visible');
    }

    // 비밀번호 유효성 검사
    if (passwordInput.value.trim() === '') {
        passwordInput.classList.add('error');
        passwordError.classList.add('visible');
        valid = false;
    } else {
        passwordInput.classList.remove('error');
        passwordError.classList.remove('visible');
    }

    if (!valid) return;

    loginBtn.disabled = true;
    loginBtn.textContent = '로그인 중...';

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: emailInput.value.trim(),
                password: passwordInput.value
            })
        });
        const data = await res.json();

        if (res.ok && data.success) {
            // 로그인 상태 저장 (navbar.js?v=2.0.0가 이 정보를 읽어 프로필 아이콘 표시)
            const nickname = data.nickname || emailInput.value.trim().split('@')[0];
            NavAuth.setUser({
                email: emailInput.value.trim(),
                nickname: nickname,
                token: data.access_token
            });

            if (data.requires_password_change) {
                // 임시 비밀번호 로그인 → 강제 비밀번호 변경
                sessionStorage.setItem('change_pw_email', emailInput.value.trim());
                location.href = 'change_password.html';
            } else {
                location.href = 'index.html';
            }
        } else {
            passwordInput.classList.add('error');
            passwordError.textContent = data.detail || '이메일 또는 비밀번호가 올바르지 않습니다.';
            passwordError.classList.add('visible');
        }
    } catch (err) {
        passwordError.textContent = '서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.';
        passwordError.classList.add('visible');
    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = '로그인';
    }
});

// 입력 시 에러 초기화
document.getElementById('login-email').addEventListener('input', function () {
    this.classList.remove('error');
    document.getElementById('email-error').classList.remove('visible');
});
document.getElementById('login-password').addEventListener('input', function () {
    this.classList.remove('error');
    document.getElementById('password-error').classList.remove('visible');
});
