import os
from dotenv import load_dotenv

load_dotenv()

# ── JWT 설정 ──────────────────────────────────
# 기본값을 두지 않는다. 설정이 없거나 예시 값 그대로면 서버가 기동되지 않는다.
SECRET_KEY = os.getenv("JWT_SECRET", "")
_INSECURE_SECRETS = {"change-this-secret", "super-secret-key-enterping-1234!", "secret", "changeme"}
if len(SECRET_KEY) < 32 or SECRET_KEY in _INSECURE_SECRETS:
    raise RuntimeError(
        "JWT_SECRET 이 설정되지 않았거나 안전하지 않습니다. 32자 이상의 랜덤 값을 .env 에 지정하세요. "
        '(예: python -c "import secrets; print(secrets.token_urlsafe(48))")'
    )
ALGORITHM = "HS256"

# ── 이메일(SMTP) 설정 ─────────────────────────
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")        # 발신 Gmail 주소
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")  # Gmail 앱 비밀번호
SENDER_NAME = os.getenv("SENDER_NAME", "엔터핑")

CODE_EXPIRE_SECONDS = 180  # 3분

# ── Redis 설정 ────────────────────────────────
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")  # 비밀번호가 있으면 redis://:비밀번호@host:6379
REDIS_ROOM_TTL = 7200  # 2시간
