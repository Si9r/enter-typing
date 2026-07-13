import os
from dotenv import load_dotenv

load_dotenv()

# ── JWT 설정 ──────────────────────────────────
SECRET_KEY = os.getenv("JWT_SECRET", "super-secret-key-enterping-1234!")
ALGORITHM = "HS256"

# ── 이메일(SMTP) 설정 ─────────────────────────
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")        # 발신 Gmail 주소
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")  # Gmail 앱 비밀번호
SENDER_NAME = os.getenv("SENDER_NAME", "엔터핑")

CODE_EXPIRE_SECONDS = 180  # 3분

# ── Redis 설정 ────────────────────────────────
REDIS_URL = "redis://localhost:6379"
REDIS_ROOM_TTL = 7200  # 2시간
