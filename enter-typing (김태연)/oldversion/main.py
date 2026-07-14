from fastapi import FastAPI, HTTPException, Depends, Header, WebSocket, WebSocketDisconnect, Query, UploadFile, File
from fastapi.responses import JSONResponse
import asyncio
import redis.asyncio as aioredis
import redis as sync_redis
from typing import Dict, List, Optional
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import smtplib
import random
import string
import os
import re
import json
import uuid
import shutil
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv
import time
from sqlalchemy.orm import Session
from database import engine, get_db
import models
import bcrypt
from jose import jwt, JWTError
import pykakasi
from sqlalchemy import text

kks = pykakasi.kakasi()

load_dotenv()

# MySQL에 enterping_db 라는 이름의 데이터베이스 하나만 생성하면 자동으로 컬럼은 생성 됩니다.
# 데이터베이스 테이블 자동 생성
models.Base.metadata.create_all(bind=engine)

# ── JWT 토큰 설정 및 유틸 ─────────────────────────
SECRET_KEY = os.getenv("JWT_SECRET", "super-secret-key-enterping-1234!")
ALGORITHM = "HS256"

def create_access_token(email: str) -> str:
    # 24시간 동안 유효한 토큰 생성
    expire = time.time() + (60 * 24 * 60)
    payload = {"sub": email, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(authorization: str = Header(None), db: Session = Depends(get_db)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="인증 정보가 올바르지 않습니다.")
        if payload.get("exp") and time.time() > payload.get("exp"):
            raise HTTPException(status_code=401, detail="인증 세션이 만료되었습니다. 다시 로그인해주세요.")
    except JWTError:
        raise HTTPException(status_code=401, detail="인증 세션이 유효하지 않습니다.")
        
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="유저를 찾을 수 없습니다.")
    return user

# 비밀번호 해시를 위한 설정 (bcrypt 직접 사용)
def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

app = FastAPI()

@app.on_event("startup")
def startup_event():
    db = next(get_db())
    
    # DB 스키마 업데이트 (퀴즈 썸네일 컬럼)
    try:
        db.execute(text("ALTER TABLE quiz_contents ADD COLUMN thumbnail_url VARCHAR(255) DEFAULT NULL;"))
        db.commit()
    except Exception as e:
        db.rollback()
        
    if db.query(models.TypingContent).count() == 0:
        # 최초 실행 시에만 기본 데이터를 추가합니다. 기존 데이터는 절대 삭제하지 않습니다.
        
        songs = []
        
        for song in songs:
            content = models.TypingContent(**song)
            db.add(content)
        db.commit()

# ── 정적 파일 서빙 ─────────────────────────────────────────
app.mount("/assets", StaticFiles(directory="assets"), name="assets")

# ── Redis 기반 저장소 (다중 서버 호환) ─
sync_redis_client = sync_redis.Redis.from_url("redis://localhost:6379", decode_responses=True, protocol=2)

# ── 이메일 설정 ────────────────────────────────────────────
SMTP_HOST     = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT     = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER     = os.getenv("SMTP_USER", "")        # 발신 Gmail 주소
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")    # Gmail 앱 비밀번호
SENDER_NAME   = os.getenv("SENDER_NAME", "엔터핑")

CODE_EXPIRE_SECONDS = 180  # 3분


# ── 유틸: 이메일 발송 ──────────────────────────────────────
def send_email(to: str, subject: str, html_body: str):
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = f"{SENDER_NAME} <{SMTP_USER}>"
    msg["To"]      = to
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.ehlo()
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(SMTP_USER, to, msg.as_string())


# ── 유틸: 인증코드 생성 ───────────────────────────────────
def generate_code(length: int = 6) -> str:
    return "".join(random.choices(string.digits, k=length))


# ── 유틸: 임시 비밀번호 생성 ─────────────────────────────
def generate_temp_password(length: int = 12) -> str:
    chars = string.ascii_letters + string.digits + "!@#$%"
    pw = [
        random.choice(string.ascii_uppercase),
        random.choice(string.ascii_lowercase),
        random.choice(string.digits),
        random.choice("!@#$%"),
    ]
    pw += random.choices(chars, k=length - 4)
    random.shuffle(pw)
    return "".join(pw)


# ════════════════════════════════════════════════════════════
# 요청 모델
# ════════════════════════════════════════════════════════════
EMAIL_REGEX = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')

class EmailRequest(BaseModel):
    email: str

class VerifyRequest(BaseModel):
    email: str
    code: str

class LoginRequest(BaseModel):
    email: str
    password: str

class ChangePasswordRequest(BaseModel):
    email: str
    new_password: str

class ChangeNicknameRequest(BaseModel):
    new_nickname: str

class AttendanceRequest(BaseModel):
    date: str  # "YYYY-MM-DD" 형식의 날짜

class DeleteAccountRequest(BaseModel):
    email: str
    password: str

class SignupRequest(BaseModel):
    email: str
    nickname: str
    password: str

class TypingContentCreate(BaseModel):
    title: str
    artist: str
    genre: str
    description: str
    lyrics: str
    hiragana: str
    romaji: str
    timestamps: str | None = None
    difficulty: int = 3
    youtube_id: str | None = None
    best_time: int = 0

class QuizContentCreate(BaseModel):
    title: str
    artist: str
    genre: str
    description: str
    quiz_data: str
    difficulty: int = 3
    youtube_id: str | None = None
    thumbnail_url: str | None = None

class ConvertRequest(BaseModel):
    text: str

class TypingHistoryCreate(BaseModel):
    content_title: str
    genre: str
    wpm: int
    accuracy: float
    text: str

class TypoPayloadItem(BaseModel):
    character: str
    error_count: int

class TotalPayloadItem(BaseModel):
    character: str
    total_count: int

class RomajiPatternItem(BaseModel):
    kana: str
    expected: str
    typed: str
    error_count: int

class TypoStatsRequest(BaseModel):
    typos: List[TypoPayloadItem]
    totals: List[TotalPayloadItem] = []
    romaji_patterns: List[RomajiPatternItem] = []
    content_id: int | None = None

class QuizHistoryCreate(BaseModel):
    quiz_id: Optional[int] = None
    quiz_category: str
    score: int
    total_questions: int

def validate_email(email: str):
    if not EMAIL_REGEX.match(email):
        raise HTTPException(status_code=422, detail="올바른 이메일 형식이 아닙니다.")

# ════════════════════════════════════════════════════════════
# API: 이미지 업로드
# POST /api/upload-image
# ════════════════════════════════════════════════════════════
@app.post("/api/upload-image")
def upload_image(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="이미지 파일만 업로드 가능합니다.")
    
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    filename = f"{uuid.uuid4()}.{ext}"
    filepath = os.path.join("assets", "thumbnails", filename)
    
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    
    try:
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"파일 업로드 실패: {str(e)}")
        
    return {"success": True, "url": f"/assets/thumbnails/{filename}"}


# ════════════════════════════════════════════════════════════
# API: 인증번호 발송
# POST /api/send-verification-code
# ════════════════════════════════════════════════════════════
# ════════════════════════════════════════════════════════════
# API: 회원가입
# POST /api/signup
# ════════════════════════════════════════════════════════════
@app.post("/api/signup")
def signup(req: SignupRequest, db: Session = Depends(get_db)):
    validate_email(req.email)
    
    if len(req.nickname.strip()) < 2 or len(req.nickname.strip()) > 12:
        raise HTTPException(status_code=400, detail="닉네임은 2자 이상 12자 이하로 입력해주세요.")
        
    if len(req.password) < 8:
        raise HTTPException(status_code=400, detail="비밀번호는 8자 이상이어야 합니다.")
        
    # 이메일 중복 체크
    existing_user = db.query(models.User).filter(models.User.email == req.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="이미 가입된 이메일입니다.")
        
    # 닉네임 중복 체크
    existing_nickname = db.query(models.User).filter(models.User.nickname == req.nickname).first()
    if existing_nickname:
        raise HTTPException(status_code=400, detail="이미 사용 중인 닉네임입니다.")
        
    # 새 유저 등록 (비밀번호 해싱)
    hashed_password = get_password_hash(req.password)
    new_user = models.User(
        email=req.email,
        nickname=req.nickname,
        password_hash=hashed_password
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return {"success": True, "message": "회원가입이 완료되었습니다."}


# ════════════════════════════════════════════════════════════
# API: 인증번호 발송
# POST /api/send-verification-code
# ════════════════════════════════════════════════════════════
@app.post("/api/send-verification-code")
def send_verification_code(req: EmailRequest, db: Session = Depends(get_db)):
    validate_email(req.email)
    
    # 가입된 이메일인지 체크
    user = db.query(models.User).filter(models.User.email == req.email).first()
    if not user:
        raise HTTPException(status_code=400, detail="가입되지 않은 이메일입니다.")
        
    code = generate_code()
    expires_at = time.time() + CODE_EXPIRE_SECONDS

    verification_data = {
        "code": code,
        "verified": False,
    }
    sync_redis_client.set(f"verification:{req.email}", json.dumps(verification_data), ex=CODE_EXPIRE_SECONDS)

    html_body = f"""
    <div style="font-family:'Noto Sans KR',sans-serif; max-width:480px; margin:0 auto;
                background:#fff4f3; border-radius:16px; padding:40px 36px;">
      <div style="text-align:center; margin-bottom:28px;">
        <span style="font-size:2rem;">🎵</span>
        <h2 style="font-size:1.5rem; font-weight:900; color:#2C3E50; margin:8px 0 0;">엔터핑</h2>
      </div>
      <h3 style="font-size:1.2rem; font-weight:700; color:#2C3E50; margin-bottom:12px;">
        비밀번호 찾기 인증번호
      </h3>
      <p style="color:#7F8C8D; font-size:0.95rem; line-height:1.6; margin-bottom:24px;">
        아래 인증번호를 입력창에 입력해주세요.<br>
        인증번호는 <strong>3분간</strong> 유효합니다.
      </p>
      <div style="background:#fff; border:2px solid #FFB6C1; border-radius:12px;
                  text-align:center; padding:24px; margin-bottom:24px;">
        <span style="font-size:2.4rem; font-weight:900; letter-spacing:12px; color:#2C3E50;">
          {code}
        </span>
      </div>
      <p style="color:#aaa; font-size:0.82rem; text-align:center;">
        본인이 요청하지 않은 경우 이 이메일을 무시하세요.
      </p>
    </div>
    """

    try:
        send_email(req.email, "[엔터핑] 비밀번호 찾기 인증번호", html_body)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"이메일 발송 실패: {str(e)}")

    return {"success": True, "message": "인증번호가 발송되었습니다."}


# ════════════════════════════════════════════════════════════
# API: 인증번호 검증
# POST /api/verify-code
# ════════════════════════════════════════════════════════════
@app.post("/api/verify-code")
def verify_code(req: VerifyRequest, db: Session = Depends(get_db)):
    validate_email(req.email)
    raw = sync_redis_client.get(f"verification:{req.email}")

    if not raw:
        raise HTTPException(status_code=400, detail="인증 요청 내역이 없거나 만료되었습니다. 다시 시도해주세요.")
        
    entry = json.loads(raw)

    if entry.get("code") != req.code.strip():
        raise HTTPException(status_code=400, detail="인증번호가 올바르지 않습니다.")

    # 검증 성공 → 임시 비밀번호 발급
    temp_pw = generate_temp_password()
    entry["verified"] = True
    entry["temp_password"] = temp_pw
    
    # 임시 비밀번호 로그인 및 비밀번호 변경을 위해 5분간 유지
    sync_redis_client.set(f"verification:{req.email}", json.dumps(entry), ex=300)

    # DB에서 해당 유저의 비밀번호를 임시 비밀번호의 해시로 업데이트
    user = db.query(models.User).filter(models.User.email == req.email).first()
    if user:
        user.password_hash = get_password_hash(temp_pw)
        db.commit()

    html_body = f"""
    <div style="font-family:'Noto Sans KR',sans-serif; max-width:480px; margin:0 auto;
                background:#fff4f3; border-radius:16px; padding:40px 36px;">
      <div style="text-align:center; margin-bottom:28px;">
        <span style="font-size:2rem;">🎵</span>
        <h2 style="font-size:1.5rem; font-weight:900; color:#2C3E50; margin:8px 0 0;">엔터핑</h2>
      </div>
      <h3 style="font-size:1.2rem; font-weight:700; color:#2C3E50; margin-bottom:12px;">
        임시 비밀번호 안내
      </h3>
      <p style="color:#7F8C8D; font-size:0.95rem; line-height:1.6; margin-bottom:24px;">
        아래 임시 비밀번호로 로그인 후 반드시 새 비밀번호로 변경해주세요.
      </p>
      <div style="background:#fff; border:2px solid #FFB6C1; border-radius:12px;
                  text-align:center; padding:24px; margin-bottom:24px;">
        <span style="font-size:1.6rem; font-weight:900; letter-spacing:4px; color:#2C3E50;">
          {temp_pw}
        </span>
      </div>
      <p style="color:#e74c3c; font-size:0.88rem; font-weight:700; text-align:center;">
        ⚠️ 로그인 후 즉시 비밀번호를 변경하세요.
      </p>
      <p style="color:#aaa; font-size:0.82rem; text-align:center; margin-top:16px;">
        본인이 요청하지 않은 경우 고객센터에 즉시 연락해주세요.
      </p>
    </div>
    """

    try:
        send_email(req.email, "[엔터핑] 임시 비밀번호 안내", html_body)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"임시 비밀번호 발송 실패: {str(e)}")

    return {"success": True, "message": "임시 비밀번호가 발송되었습니다."}


# ════════════════════════════════════════════════════════════
# API: 비밀번호 변경
# POST /api/change-password
# ════════════════════════════════════════════════════════════
@app.post("/api/change-password")
def change_password(req: ChangePasswordRequest, authorization: str = Header(None), db: Session = Depends(get_db)):
    validate_email(req.email)
    
    # 1. 만약 Authorization 헤더가 제공되었다면 로그인 토큰 검증
    if authorization and authorization.startswith("Bearer "):
        current_user = get_current_user(authorization, db)
        if current_user.email != req.email:
            raise HTTPException(status_code=403, detail="본인 계정의 비밀번호만 변경할 수 있습니다.")
        user = current_user
    else:
        # 2. 토큰이 없다면 임시 비밀번호 찾기(이메일 인증) 검증 세션이 유효한지 확인
        raw = sync_redis_client.get(f"verification:{req.email}")
        if not raw:
            raise HTTPException(status_code=401, detail="비밀번호 변경 권한이 없습니다. 먼저 이메일 인증을 진행해주세요.")
        entry = json.loads(raw)
        if not entry.get("verified"):
            raise HTTPException(status_code=401, detail="비밀번호 변경 권한이 없습니다. 먼저 이메일 인증을 진행해주세요.")
        user = db.query(models.User).filter(models.User.email == req.email).first()
        if not user:
            raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다.")
            
    if len(req.new_password) < 8:
        raise HTTPException(status_code=400, detail="비밀번호는 8자 이상이어야 합니다.")

    # 새 비밀번호 해싱 후 DB 업데이트
    user.password_hash = get_password_hash(req.new_password)
    db.commit()

    # Redis 항목 정리
    sync_redis_client.delete(f"verification:{req.email}")

    return {"success": True, "message": "비밀번호가 변경되었습니다."}


# ════════════════════════════════════════════════════════════
# API: 닉네임 변경
# POST /api/change-nickname
# ════════════════════════════════════════════════════════════
@app.post("/api/change-nickname")
def change_nickname(req: ChangeNicknameRequest, authorization: str = Header(None), db: Session = Depends(get_db)):
    current_user = get_current_user(authorization, db)
    
    nickname_strip = req.new_nickname.strip()
    if len(nickname_strip) < 2 or len(nickname_strip) > 12:
        raise HTTPException(status_code=400, detail="닉네임은 2자 이상 12자 이하로 입력해주세요.")
        
    # 닉네임 중복 체크 (본인 제외)
    existing = db.query(models.User).filter(models.User.nickname == nickname_strip).first()
    if existing and existing.id != current_user.id:
        raise HTTPException(status_code=400, detail="이미 사용 중인 닉네임입니다.")
        
    current_user.nickname = nickname_strip
    db.commit()
    return {"success": True, "message": "닉네임이 변경되었습니다.", "nickname": nickname_strip}


# ════════════════════════════════════════════════════════════
# API: 회원 탈퇴
# DELETE /api/delete-account
# ════════════════════════════════════════════════════════════
@app.delete("/api/delete-account")
def delete_account(req: DeleteAccountRequest, authorization: str = Header(None), db: Session = Depends(get_db)):
    validate_email(req.email)

    current_user = get_current_user(authorization, db)
    if current_user.email != req.email:
        raise HTTPException(status_code=403, detail="본인 계정만 탈퇴할 수 있습니다.")

    # 비밀번호 확인
    if not verify_password(req.password, current_user.password_hash):
        raise HTTPException(status_code=401, detail="비밀번호가 올바르지 않습니다.")

    # 유저 삭제 (cascade로 관련 데이터 자동 삭제)
    db.delete(current_user)
    db.commit()

    # Redis 항목 정리
    sync_redis_client.delete(f"verification:{req.email}")

    return {"success": True, "message": "회원 탈퇴가 완료되었습니다."}


# ════════════════════════════════════════════════════════════
# API: 로그인
# POST /api/login
# ════════════════════════════════════════════════════════════
@app.post("/api/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    validate_email(req.email)

    user = db.query(models.User).filter(models.User.email == req.email).first()
    if not user:
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 일치하지 않습니다.")

    # Redis에 해당 이메일의 임시 비밀번호가 있으면 비교
    raw = sync_redis_client.get(f"verification:{req.email}")
    is_temp_login = False
    if raw:
        entry = json.loads(raw)
        if entry.get("verified") and entry.get("temp_password"):
            if req.password == entry["temp_password"]:
                is_temp_login = True

    # 임시 비밀번호 로그인이 아닌 경우 해시 비밀번호 대조 검증
    if not is_temp_login:
        if not verify_password(req.password, user.password_hash):
            raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 일치하지 않습니다.")

    # 로그인 성공 시 안전한 JWT 토큰 발급
    access_token = create_access_token(user.email)

    return {
        "success": True,
        "requires_password_change": is_temp_login,
        "nickname": user.nickname,
        "email": user.email,
        "access_token": access_token,
        "token_type": "bearer",
        "message": "로그인 성공"
    }


# ════════════════════════════════════════════════════════════
# API: 이메일 중복 체크
# GET /api/check-email
# ════════════════════════════════════════════════════════════
@app.get("/api/check-email")
def check_email(email: str, db: Session = Depends(get_db)):
    validate_email(email)
    existing_user = db.query(models.User).filter(models.User.email == email).first()
    if existing_user:
        return {"exists": True, "message": "이미 등록된 이메일입니다."}
    return {"exists": False, "message": "사용 가능한 이메일입니다."}


# ════════════════════════════════════════════════════════════
# API: 닉네임 중복 체크
# GET /api/check-nickname
# ════════════════════════════════════════════════════════════
@app.get("/api/check-nickname")
def check_nickname(nickname: str, db: Session = Depends(get_db)):
    nickname_strip = nickname.strip()
    if len(nickname_strip) < 2 or len(nickname_strip) > 12:
        raise HTTPException(status_code=400, detail="닉네임은 2자 이상 12자 이하로 입력해주세요.")
        
    existing_nickname = db.query(models.User).filter(models.User.nickname == nickname_strip).first()
    if existing_nickname:
        return {"exists": True, "message": "이미 사용 중인 닉네임입니다."}
    return {"exists": False, "message": "사용 가능한 닉네임입니다."}


# ════════════════════════════════════════════════════════════
# API: 출석 데이터 가져오기
# GET /api/attendance
# ════════════════════════════════════════════════════════════
@app.get("/api/attendance")
def get_attendance(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    records = db.query(models.Attendance).filter(models.Attendance.user_id == current_user.id).all()
    # 날짜 문자열 리스트로 변환
    dates = [r.attend_date for r in records]
    return {"success": True, "dates": dates}


# ════════════════════════════════════════════════════════════
# API: 출석 체크 등록
# POST /api/attendance
# ════════════════════════════════════════════════════════════
@app.post("/api/attendance")
def do_attendance(req: AttendanceRequest, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    # 중복 체크
    existing = db.query(models.Attendance).filter(
        models.Attendance.user_id == current_user.id,
        models.Attendance.attend_date == req.date
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="이미 오늘 출석체크를 완료하셨습니다.")
        
    # 새로운 출석 객체 생성 및 DB 저장
    new_attendance = models.Attendance(
        user_id=current_user.id,
        attend_date=req.date
    )
    db.add(new_attendance)
    db.commit()
    
    return {"success": True, "message": "출석체크가 성공적으로 완료되었습니다!"}


# ════════════════════════════════════════════════════════════
# API: 타이핑 콘텐츠 목록 가져오기
# GET /api/typing-contents
# ════════════════════════════════════════════════════════════
@app.get("/api/typing-contents")
def get_all_typing_contents(db: Session = Depends(get_db)):
    contents = db.query(models.TypingContent).all()
    result = []
    for c in contents:
        result.append({
            "id": c.id,
            "title": c.title,
            "artist": c.artist,
            "genre": c.genre,
            "description": c.description,
            "creator_nickname": c.creator.nickname if c.creator else "엔터핑",
            "difficulty": c.difficulty,
            "best_time": c.best_time,
            "play_count": c.play_count,
            "lyrics": c.lyrics,
            "hiragana": c.hiragana,
            "romaji": c.romaji,
            "youtube_id": c.youtube_id,
            "timestamps": c.timestamps
        })
    return {"success": True, "data": result}

# ════════════════════════════════════════════════════════════
# API: 내 타이핑 콘텐츠 목록 가져오기
# GET /api/my-typing-contents
# ════════════════════════════════════════════════════════════
@app.get("/api/my-typing-contents")
def get_my_typing_contents(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    contents = db.query(models.TypingContent).filter(models.TypingContent.creator_id == current_user.id).all()
    result = []
    for c in contents:
        result.append({
            "id": c.id,
            "title": c.title,
            "artist": c.artist,
            "genre": c.genre,
            "description": c.description,
            "difficulty": c.difficulty,
            "best_time": c.best_time,
            "play_count": c.play_count
        })
    return {"success": True, "data": result}

# ════════════════════════════════════════════════════════════
# API: 타이핑 콘텐츠 추가
# POST /api/typing-contents
# ════════════════════════════════════════════════════════════
@app.post("/api/typing-contents")
def create_typing_content(req: TypingContentCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    new_content = models.TypingContent(
        title=req.title,
        artist=req.artist,
        genre=req.genre,
        description=req.description,
        creator_id=current_user.id,
        youtube_id=req.youtube_id,
        lyrics=req.lyrics,
        hiragana=req.hiragana,
        romaji=req.romaji,
        timestamps=req.timestamps,
        difficulty=req.difficulty,
        play_count=0,
        best_time=req.best_time
    )
    db.add(new_content)
    db.commit()
    db.refresh(new_content)
    return {"success": True, "message": "성공적으로 추가되었습니다.", "id": new_content.id}

# ════════════════════════════════════════════════════════════
# API: 타이핑 콘텐츠 삭제
# DELETE /api/typing-contents/{content_id}
# ════════════════════════════════════════════════════════════
@app.delete("/api/typing-contents/{content_id}")
def delete_typing_content(content_id: int, db: Session = Depends(get_db)):
    content = db.query(models.TypingContent).filter(models.TypingContent.id == content_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="콘텐츠를 찾을 수 없습니다.")
    
    # 임시 관리자 모드: 작성자 권한 체크를 무시하고 모두 삭제 허용
    # if content.creator_id != current_user.id:
    #     raise HTTPException(status_code=403, detail="삭제 권한이 없습니다.")
        
    db.delete(content)
    db.commit()
    return {"success": True, "message": "삭제되었습니다."}

# ════════════════════════════════════════════════════════════
# API: 타이핑 콘텐츠 수정
# PUT /api/typing-contents/{content_id}
# ════════════════════════════════════════════════════════════
@app.put("/api/typing-contents/{content_id}")
def update_typing_content(content_id: int, req: TypingContentCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    content = db.query(models.TypingContent).filter(models.TypingContent.id == content_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="콘텐츠를 찾을 수 없습니다.")
    
    if content.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="수정 권한이 없습니다.")
        
    content.title = req.title
    content.artist = req.artist
    content.genre = req.genre
    content.description = req.description
    content.youtube_id = req.youtube_id
    content.lyrics = req.lyrics
    content.hiragana = req.hiragana
    content.romaji = req.romaji
    content.timestamps = req.timestamps
    content.difficulty = req.difficulty
    content.best_time = req.best_time
    
    db.commit()
    return {"success": True, "message": "수정되었습니다."}

# ════════════════════════════════════════════════════════════
# API: 타이핑 콘텐츠 가져오기
# GET /api/typing-content/{content_id}
# ════════════════════════════════════════════════════════════
@app.get("/api/typing-content/{content_id}")
def get_typing_content(content_id: int, db: Session = Depends(get_db)):
    content = db.query(models.TypingContent).filter(models.TypingContent.id == content_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="콘텐츠를 찾을 수 없습니다.")
    
    lines = [line.strip().replace(" ", "") for line in content.lyrics.split('\n') if line.strip()]
    hiragana_lines = [line.strip().replace(" ", "") for line in content.hiragana.split('\n') if line.strip()]
    romaji_lines = [line.strip().replace(" ", "") for line in content.romaji.split('\n') if line.strip()]
    return {
        "success": True,
        "title": content.title,
        "artist": content.artist,
        "genre": content.genre,
        "description": content.description,
        "youtube_id": content.youtube_id,
        "creator_nickname": content.creator.nickname if content.creator else "엔터핑",
        "difficulty": content.difficulty,
        "play_count": content.play_count,
        "best_time": content.best_time,
        "lines": lines,
        "hiragana_lines": hiragana_lines,
        "romaji_lines": romaji_lines,
        "timestamps": content.timestamps,
        "raw_lyrics": content.lyrics,
        "raw_hiragana": content.hiragana,
        "raw_romaji": content.romaji
    }

# ════════════════════════════════════════════════════════════
# API: 퀴즈 콘텐츠 API
# ════════════════════════════════════════════════════════════
@app.post("/api/typing-content/{content_id}/play")
def increment_typing_play_count(content_id: int, db: Session = Depends(get_db)):
    """인증 없이 플레이 수를 1 증가시키는 경량 엔드포인트 (비로그인 사용자 포함)"""
    content = db.query(models.TypingContent).filter(models.TypingContent.id == content_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="콘텐츠를 찾을 수 없습니다.")
    if content.play_count is None:
        content.play_count = 0
    content.play_count += 1
    db.commit()
    return {"success": True, "play_count": content.play_count}

@app.post("/api/quiz-content/{content_id}/play")
def increment_quiz_play_count(content_id: int, db: Session = Depends(get_db)):
    """인증 없이 퀴즈 플레이 수를 1 증가시키는 경량 엔드포인트"""
    content = db.query(models.QuizContent).filter(models.QuizContent.id == content_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="콘텐츠를 찾을 수 없습니다.")
    if content.play_count is None:
        content.play_count = 0
    content.play_count += 1
    db.commit()
    return {"success": True, "play_count": content.play_count}


@app.get("/api/quiz-contents")
def get_all_quiz_contents(db: Session = Depends(get_db)):
    contents = db.query(models.QuizContent).all()
    result = []
    for c in contents:
        quiz_count = 0
        try:
            quiz_count = len(json.loads(c.quiz_data)) if c.quiz_data else 0
        except Exception:
            pass
        result.append({
            "id": c.id,
            "title": c.title,
            "artist": c.artist,
            "genre": c.genre,
            "description": c.description,
            "thumbnail_url": c.thumbnail_url,
            "creator_nickname": c.creator.nickname if c.creator else "엔터핑",
            "difficulty": c.difficulty,
            "best_score": c.best_score,
            "play_count": c.play_count,
            "quiz_count": quiz_count
        })
    return {"success": True, "data": result}

@app.get("/api/my-quiz-contents")
def get_my_quiz_contents(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    contents = db.query(models.QuizContent).filter(models.QuizContent.creator_id == current_user.id).all()
    result = []
    for c in contents:
        quiz_count = 0
        try:
            quiz_count = len(json.loads(c.quiz_data)) if c.quiz_data else 0
        except Exception:
            pass
        result.append({
            "id": c.id,
            "title": c.title,
            "artist": c.artist,
            "genre": c.genre,
            "description": c.description,
            "thumbnail_url": c.thumbnail_url,
            "difficulty": c.difficulty,
            "best_score": c.best_score,
            "play_count": c.play_count,
            "quiz_count": quiz_count
        })
    return {"success": True, "data": result}

@app.post("/api/quiz-contents")
def create_quiz_content(req: QuizContentCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    new_content = models.QuizContent(
        title=req.title,
        artist=req.artist,
        genre=req.genre,
        description=req.description,
        creator_id=current_user.id,
        youtube_id=req.youtube_id,
        thumbnail_url=req.thumbnail_url,
        quiz_data=req.quiz_data,
        difficulty=req.difficulty,
        play_count=0,
        best_score=0
    )
    db.add(new_content)
    db.commit()
    db.refresh(new_content)
    return {"success": True, "message": "성공적으로 추가되었습니다.", "id": new_content.id}

@app.get("/api/quiz-content/{content_id}")
def get_quiz_content(content_id: int, db: Session = Depends(get_db)):
    content = db.query(models.QuizContent).filter(models.QuizContent.id == content_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="콘텐츠를 찾을 수 없습니다.")
    
    return {
        "success": True,
        "title": content.title,
        "artist": content.artist,
        "genre": content.genre,
        "description": content.description,
        "youtube_id": content.youtube_id,
        "thumbnail_url": content.thumbnail_url,
        "creator_nickname": content.creator.nickname if content.creator else "엔터핑",
        "difficulty": content.difficulty,
        "play_count": content.play_count,
        "best_score": content.best_score,
        "quiz_data": content.quiz_data
    }

@app.delete("/api/quiz-contents/{content_id}")
def delete_quiz_content(content_id: int, db: Session = Depends(get_db)):
    content = db.query(models.QuizContent).filter(models.QuizContent.id == content_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="콘텐츠를 찾을 수 없습니다.")
        
    db.delete(content)
    db.commit()
    return {"success": True, "message": "삭제되었습니다."}

@app.put("/api/quiz-contents/{content_id}")
def update_quiz_content(content_id: int, req: QuizContentCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    content = db.query(models.QuizContent).filter(models.QuizContent.id == content_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="콘텐츠를 찾을 수 없습니다.")
    
    if content.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="수정 권한이 없습니다.")
        
    content.title = req.title
    content.artist = req.artist
    content.genre = req.genre
    content.description = req.description
    content.youtube_id = req.youtube_id
    content.thumbnail_url = req.thumbnail_url
    content.quiz_data = req.quiz_data
    content.difficulty = req.difficulty
    
    db.commit()
    return {"success": True, "message": "수정되었습니다."}
# ════════════════════════════════════════════════════════════
# API: 랭킹 시스템
# ════════════════════════════════════════════════════════════
from sqlalchemy import func

@app.get("/api/ranking/total")
def get_total_ranking(db: Session = Depends(get_db)):
    # 타이핑 랭킹 (누적 점수 기준)
    typing_histories = db.query(
        models.TypingHistory.user_id,
        func.sum(models.TypingHistory.score).label("total_score"),
        func.avg(models.TypingHistory.wpm).label("avg_wpm"),
        func.avg(models.TypingHistory.accuracy).label("avg_accuracy")
    ).group_by(models.TypingHistory.user_id).order_by(func.sum(models.TypingHistory.score).desc()).limit(100).all()
    
    typing_ranking = []
    for rank, h in enumerate(typing_histories):
        user = db.query(models.User).filter(models.User.id == h.user_id).first()
        typing_ranking.append({
            "rank": rank + 1,
            "nickname": user.nickname if user else "알 수 없음",
            "total_score": int(h.total_score) if h.total_score else 0,
            "avg_wpm": int(h.avg_wpm) if h.avg_wpm else 0,
            "avg_accuracy": round(h.avg_accuracy, 1) if h.avg_accuracy else 0.0
        })

    # 퀴즈 랭킹 (누적 점수 기준)
    quiz_histories = db.query(
        models.QuizHistory.user_id,
        func.sum(models.QuizHistory.score).label("total_score"),
        func.sum(models.QuizHistory.total_questions).label("total_questions")
    ).group_by(models.QuizHistory.user_id).order_by(func.sum(models.QuizHistory.score).desc()).limit(100).all()

    quiz_ranking = []
    for rank, h in enumerate(quiz_histories):
        user = db.query(models.User).filter(models.User.id == h.user_id).first()
        quiz_ranking.append({
            "rank": rank + 1,
            "nickname": user.nickname if user else "알 수 없음",
            "total_score": int(h.total_score) if h.total_score else 0,
            "total_questions": int(h.total_questions) if h.total_questions else 0
        })

    # 대전 랭킹 (누적 점수 기준)
    battle_histories = db.query(
        models.BattleHistory.user_id,
        func.sum(models.BattleHistory.score).label("total_score"),
        func.count(models.BattleHistory.id).label("play_count")
    ).group_by(models.BattleHistory.user_id).order_by(func.sum(models.BattleHistory.score).desc()).limit(100).all()

    battle_ranking = []
    for rank, h in enumerate(battle_histories):
        user = db.query(models.User).filter(models.User.id == h.user_id).first()
        battle_ranking.append({
            "rank": rank + 1,
            "nickname": user.nickname if user else "알 수 없음",
            "total_score": int(h.total_score) if h.total_score else 0,
            "play_count": int(h.play_count) if h.play_count else 0
        })

    return {
        "success": True,
        "typing": typing_ranking,
        "quiz": quiz_ranking,
        "battle": battle_ranking
    }

@app.get("/api/ranking/content/{content_id}")
def get_content_ranking(content_id: int, db: Session = Depends(get_db)):
    # 특정 타이핑 콘텐츠의 랭킹 (최고 점수 기준)
    histories = db.query(models.TypingHistory).filter(models.TypingHistory.content_id == content_id).order_by(models.TypingHistory.score.desc()).all()
    seen_users = set()
    ranking = []
    
    for h in histories:
        if h.user_id not in seen_users:
            seen_users.add(h.user_id)
            user = db.query(models.User).filter(models.User.id == h.user_id).first()
            ranking.append({
                "rank": len(ranking) + 1,
                "nickname": user.nickname if user else "알 수 없음",
                "score": h.score,
                "wpm": h.wpm,
                "accuracy": round(h.accuracy, 1),
                "played_at": h.played_at.isoformat() if h.played_at else None
            })
            if len(ranking) >= 100:
                break
                
    # 만약 곡 정보도 필요하다면
    content = db.query(models.TypingContent).filter(models.TypingContent.id == content_id).first()
    content_info = {}
    if content:
        content_info = {
            "title": content.title,
            "artist": content.artist,
            "genre": content.genre
        }

    return {
        "success": True,
        "content_info": content_info,
        "ranking": ranking
    }

# ════════════════════════════════════════════════════════════
# API: 가사 자동 변환 (히라가나, 로마자)
# POST /api/convert
# ════════════════════════════════════════════════════════════
ROMAJI_TABLE = {
    "あ": "a", "い": "i", "う": "u", "え": "e", "お": "o",
    "か": "ka", "き": "ki", "く": "ku", "け": "ke", "こ": "ko",
    "さ": "sa", "し": "shi", "す": "su", "せ": "se", "そ": "so",
    "た": "ta", "ち": "chi", "つ": "tsu", "て": "te", "と": "to",
    "な": "na", "に": "ni", "ぬ": "nu", "ね": "ne", "の": "no",
    "は": "ha", "ひ": "hi", "ふ": "fu", "へ": "he", "ほ": "ho",
    "ま": "ma", "み": "mi", "む": "mu", "め": "me", "も": "mo",
    "や": "ya", "ゆ": "yu", "よ": "yo",
    "ら": "ra", "り": "ri", "る": "ru", "れ": "re", "ろ": "ro",
    "わ": "wa", "を": "wo", "ん": "nn",
    "が": "ga", "ぎ": "gi", "ぐ": "gu", "げ": "ge", "ご": "go",
    "ざ": "za", "じ": "zi", "ず": "zu", "ぜ": "ze", "ぞ": "zo",
    "だ": "da", "ぢ": "di", "づ": "du", "で": "de", "ど": "do",
    "ば": "ba", "び": "bi", "ぶ": "bu", "べ": "be", "ぼ": "bo",
    "ぱ": "pa", "ぴ": "pi", "ぷ": "pu", "ぺ": "pe", "ぽ": "po",
    "ぁ": "xa", "ぃ": "xi", "ぅ": "xu", "ぇ": "xe", "ぉ": "xo",
    "っ": "xtsu",
    "ゃ": "xya", "ゅ": "xyu", "ょ": "xyo", "ゎ": "xwa",
    " ": " ", "、": ",", "。": ".", "?": "?", "!": "!",
    "？": "?", "！": "!", "〜": "~", "~": "~"
}

COMBINATION_RULES = {
    "きゃ": "kya", "きゅ": "kyu", "きょ": "kyo",
    "しゃ": "sha", "しゅ": "shu", "しぇ": "she", "しょ": "sho",
    "ちゃ": "cha", "ちゅ": "chu", "ちぇ": "che", "ちょ": "cho",
    "にゃ": "nya", "にゅ": "nyu", "にょ": "nyo",
    "ひゃ": "hya", "ひゅ": "hyu", "ひょ": "hyo",
    "みゃ": "mya", "みゅ": "myu", "みょ": "myo",
    "りゃ": "rya", "りゅ": "ryu", "りょ": "ryo",
    "ぎゃ": "gya", "ぎゅ": "gyu", "ぎょ": "gyo",
    "じゃ": "ja", "じゅ": "ju", "じぇ": "je", "じょ": "jo",
    "ぢゃ": "dya", "ぢゅ": "dyu", "ぢょ": "dyo",
    "びゃ": "bya", "びゅ": "byu", "びょ": "byo",
    "ぴゃ": "pya", "ぴゅ": "pyu", "ぴょ": "pyo"
}

def hiragana_to_romaji(hira_str: str) -> str:
    romaji = ""
    i = 0
    while i < len(hira_str):
        char = hira_str[i]
        next_char = hira_str[i+1] if i + 1 < len(hira_str) else None
        
        if char == "っ" and next_char and next_char in ROMAJI_TABLE:
            next_romaji = ROMAJI_TABLE[next_char]
            romaji += next_romaji[0]
            i += 1
            continue
            
        if next_char and (char + next_char) in COMBINATION_RULES:
            romaji += COMBINATION_RULES[char + next_char]
            i += 2
            continue
            
        if char in ROMAJI_TABLE:
            romaji += ROMAJI_TABLE[char]
        else:
            romaji += char
        i += 1
        
    return romaji

@app.post("/api/convert")
def convert_lyrics(req: ConvertRequest):
    text = req.text
    if not text:
        return {"success": True, "hiragana": "", "romaji": ""}
        
    converted = kks.convert(text)
    
    # pykakasi로 한자 → 히라가나 변환만 수행
    hiragana = ""
    for item in converted:
        hiragana += item['hira']
    
    hiragana = hiragana.replace(" ", "")
    
    # romaji는 히라가나 → 로마자 변환 함수로 일관성 있게 처리
    romaji = hiragana_to_romaji(hiragana)
    
    return {"success": True, "hiragana": hiragana, "romaji": romaji}

# ════════════════════════════════════════════════════════════
# 페이지 라우팅
# ════════════════════════════════════════════════════════════
HTML_FILES = [
    "index", "login", "signup", "forgot_password", "change_password",
    "ranking", "notice", "search", "profile", "quiz", "typing_list",
]

@app.get("/")
def root():
    return FileResponse("index.html")

@app.get("/{page}.html")
def serve_html(page: str):
    path = f"{page}.html"
    if os.path.exists(path):
        return FileResponse(path)
    raise HTTPException(status_code=404, detail="페이지를 찾을 수 없습니다.")

for f in ["style.css", "typing.css", "script.js", "navbar.js", "battle.js", "shared_typing_engine.js", "i18n.js", "locales.json"]:
    @app.get(f"/{f}")
    def serve_static(filename: str = f):
        return FileResponse(filename)

# ── 가나 파서 구현 ───────────────────────────────────
def parse_kana_to_units(kana_str: str) -> list[str]:
    units = []
    chars = list(kana_str)
    i = 0
    small_kana = {"ぁ", "ぃ", "ぅ", "ぇ", "ぉ", "ゃ", "ゅ", "ょ", "ゎ"}
    combination_rules = {
        "き": {"ゃ", "ゅ", "ょ"},
        "し": {"ゃ", "ゅ", "ょ"},
        "せ": {"ぃ"},
        "ち": {"ゃ", "ゅ", "ょ"},
        "に": {"ゃ", "ゅ", "ょ"},
        "ひ": {"ゃ", "ゅ", "ょ"},
        "み": {"ゃ", "ゅ", "ょ"},
        "り": {"ゃ", "ゅ", "ょ"},
        "ぎ": {"ゃ", "ゅ", "ょ"},
        "じ": {"ゃ", "ゅ", "ょ"},
        "ぢ": {"ゃ", "ゅ", "ょ"},
        "び": {"ゃ", "ゅ", "ょ"},
        "ぴ": {"ゃ", "ゅ", "ょ"},
    }
    
    while i < len(chars):
        char = chars[i]
        next_char = chars[i + 1] if i + 1 < len(chars) else None
        
        if char in ["\n", "\r", " "]:
            i += 1
            continue
            
        # 1. 촉음(っ) 결합
        if char == "っ" and next_char and next_char not in ["\n", "\r", " "]:
            units.append(char + next_char)
            i += 2
            continue
            
        # 2. 요음 combination rules
        if char in combination_rules and next_char in combination_rules[char]:
            units.append(char + next_char)
            i += 2
            continue
            
        # 3. 기타 작은 가나 결합
        if next_char in small_kana:
            units.append(char + next_char)
            i += 2
            continue
            
        # 4. 단일 문자
        units.append(char)
        i += 1
        
    return units

# API: 타이핑 히스토리 저장 (오직 "타이핑" 장르에서만 오타 통계 반영)
# POST /api/typing-history
# ════════════════════════════════════════════════════════════
@app.post("/api/typing-history")
def save_typing_history(req: TypingHistoryCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # 1. 곡(Content) 조회하여 ID 매핑
    content = db.query(models.TypingContent).filter(models.TypingContent.title == req.content_title).first()
    content_id = content.id if content else None

    history = models.TypingHistory(
        user_id=current_user.id,
        content_id=content_id,
        content_title=req.content_title,
        genre=req.genre,
        wpm=req.wpm,
        accuracy=req.accuracy
    )
    db.add(history)

    db.commit()
    return {"message": "기록이 저장되었습니다."}
# API: 퀴즈 히스토리 저장
# POST /api/quiz-history
# ════════════════════════════════════════════════════════════
@app.post("/api/quiz-history")
def save_quiz_history(req: QuizHistoryCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    history = models.QuizHistory(
        user_id=current_user.id,
        quiz_id=req.quiz_id,
        quiz_category=req.quiz_category,
        score=req.score,
        total_questions=req.total_questions
    )
    db.add(history)
    
    if req.quiz_id:
        quiz_content = db.query(models.QuizContent).filter(models.QuizContent.id == req.quiz_id).first()
        if quiz_content:
            if quiz_content.play_count is None:
                quiz_content.play_count = 0
            quiz_content.play_count += 1
            if req.score > (quiz_content.best_score or 0):
                quiz_content.best_score = req.score

    db.commit()
    return {"message": "퀴즈 기록이 저장되었습니다."}

# ════════════════════════════════════════════════════════════
# API: 오타 통계 저장
# POST /api/typo-stats
# ════════════════════════════════════════════════════════════
@app.post("/api/typo-stats")
def save_typo_stats(req: TypoStatsRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    try:
        if req.content_id:
            # 콘텐츠의 가장 최근 플레이 기록만 유지하도록 기존 통계 삭제
            db.query(models.ContentTypoStat).filter(
                models.ContentTypoStat.user_id == current_user.id,
                models.ContentTypoStat.content_id == req.content_id
            ).delete()
            db.query(models.ContentRomajiMistake).filter(
                models.ContentRomajiMistake.user_id == current_user.id,
                models.ContentRomajiMistake.content_id == req.content_id
            ).delete()
            db.flush()

        # 1. Update totals
        for total_item in req.totals:
            existing = db.query(models.TypoStat).filter(
                models.TypoStat.user_id == current_user.id,
                models.TypoStat.character_typed == total_item.character
            ).first()
            if existing:
                existing.total_count += total_item.total_count
            else:
                db.add(models.TypoStat(
                    user_id=current_user.id,
                    character_typed=total_item.character,
                    error_count=0,
                    total_count=total_item.total_count
                ))
            # 콘텐츠별 기록
            if req.content_id:
                content_existing = db.query(models.ContentTypoStat).filter(
                    models.ContentTypoStat.user_id == current_user.id,
                    models.ContentTypoStat.content_id == req.content_id,
                    models.ContentTypoStat.character_typed == total_item.character
                ).first()
                if content_existing:
                    content_existing.total_count += total_item.total_count
                else:
                    db.add(models.ContentTypoStat(
                        user_id=current_user.id,
                        content_id=req.content_id,
                        character_typed=total_item.character,
                        error_count=0,
                        total_count=total_item.total_count
                    ))
                
        db.flush()
        # 2. Update errors
        for typo_item in req.typos:
            existing = db.query(models.TypoStat).filter(
                models.TypoStat.user_id == current_user.id,
                models.TypoStat.character_typed == typo_item.character
            ).first()
            if existing:
                existing.error_count += typo_item.error_count
            else:
                db.add(models.TypoStat(
                    user_id=current_user.id,
                    character_typed=typo_item.character,
                    error_count=typo_item.error_count,
                    total_count=0
                ))
            # 콘텐츠별 기록
            if req.content_id:
                content_existing = db.query(models.ContentTypoStat).filter(
                    models.ContentTypoStat.user_id == current_user.id,
                    models.ContentTypoStat.content_id == req.content_id,
                    models.ContentTypoStat.character_typed == typo_item.character
                ).first()
                if content_existing:
                    content_existing.error_count += typo_item.error_count
                else:
                    db.add(models.ContentTypoStat(
                        user_id=current_user.id,
                        content_id=req.content_id,
                        character_typed=typo_item.character,
                        error_count=typo_item.error_count,
                        total_count=0
                    ))

        db.flush()
        # 3. Update romaji patterns
        for pattern_item in req.romaji_patterns:
            existing = db.query(models.RomajiMistake).filter(
                models.RomajiMistake.user_id == current_user.id,
                models.RomajiMistake.kana == pattern_item.kana,
                models.RomajiMistake.expected_romaji == pattern_item.expected,
                models.RomajiMistake.typed_romaji == pattern_item.typed
            ).first()
            if existing:
                existing.error_count += pattern_item.error_count
            else:
                db.add(models.RomajiMistake(
                    user_id=current_user.id,
                    kana=pattern_item.kana,
                    expected_romaji=pattern_item.expected,
                    typed_romaji=pattern_item.typed,
                    error_count=pattern_item.error_count
                ))
            # 콘텐츠별 기록
            if req.content_id:
                content_existing = db.query(models.ContentRomajiMistake).filter(
                    models.ContentRomajiMistake.user_id == current_user.id,
                    models.ContentRomajiMistake.content_id == req.content_id,
                    models.ContentRomajiMistake.kana == pattern_item.kana,
                    models.ContentRomajiMistake.expected_romaji == pattern_item.expected,
                    models.ContentRomajiMistake.typed_romaji == pattern_item.typed
                ).first()
                if content_existing:
                    content_existing.error_count += pattern_item.error_count
                else:
                    db.add(models.ContentRomajiMistake(
                        user_id=current_user.id,
                        content_id=req.content_id,
                        kana=pattern_item.kana,
                        expected_romaji=pattern_item.expected,
                        typed_romaji=pattern_item.typed,
                        error_count=pattern_item.error_count
                    ))
        db.commit()
        return {"success": True, "message": "오타 통계가 저장되었습니다."}
    except Exception as e:
        db.rollback()
        print(f"Error saving typo stats: {e}")
        raise HTTPException(status_code=500, detail="오타 통계 저장 중 오류가 발생했습니다.")

# ════════════════════════════════════════════════════════════
# API: 오타 통계 조회
# GET /api/typo-stats
# ════════════════════════════════════════════════════════════
@app.get("/api/typo-stats")
def get_typo_stats(content_id: Optional[int] = None, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if content_id:
        stats = db.query(models.ContentTypoStat).filter(
            models.ContentTypoStat.user_id == current_user.id,
            models.ContentTypoStat.content_id == content_id
        ).all()
    else:
        stats = db.query(models.TypoStat).filter(models.TypoStat.user_id == current_user.id).all()
    
    total_typos = sum(stat.error_count for stat in stats)
    total_chars = sum(stat.total_count for stat in stats)
    
    avg_error_rate = (total_typos / total_chars * 100) if total_chars > 0 else 0
    
    data = []
    kana_total_errors = {}
    for stat in stats:
        data.append({
            "kana": stat.character_typed,
            "error_count": stat.error_count,
            "total_count": stat.total_count
        })
        kana_total_errors[stat.character_typed] = stat.error_count
        
    if content_id:
        romaji_stats = db.query(models.ContentRomajiMistake).filter(
            models.ContentRomajiMistake.user_id == current_user.id,
            models.ContentRomajiMistake.content_id == content_id
        ).all()
    else:
        romaji_stats = db.query(models.RomajiMistake).filter(models.RomajiMistake.user_id == current_user.id).all()
    romaji_patterns = []
    for rm in romaji_stats:
        total_for_kana = kana_total_errors.get(rm.kana, 0)
        pct = int((rm.error_count / total_for_kana * 100)) if total_for_kana > 0 else 0
        romaji_patterns.append({
            "char": rm.kana,
            "correct": rm.expected_romaji,
            "wrong": rm.typed_romaji,
            "error_count": rm.error_count,
            "pct": pct
        })
        
    return {
        "success": True,
        "summary": {
            "avg_error_rate": avg_error_rate,
            "total_typos": total_typos,
            "improvement": 0  # Dummy improvement for now
        },
        "data": data,
        "pairs": [],
        "romaji_patterns": romaji_patterns
    }

# ════════════════════════════════════════════════════════════
# API: 오타 통계 초기화
# DELETE /api/typo-stats
# ════════════════════════════════════════════════════════════
@app.delete("/api/typo-stats")
def reset_typo_stats(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    db.query(models.TypoStat).filter(models.TypoStat.user_id == current_user.id).delete()
    db.query(models.RomajiMistake).filter(models.RomajiMistake.user_id == current_user.id).delete()
    db.query(models.ContentTypoStat).filter(models.ContentTypoStat.user_id == current_user.id).delete()
    db.query(models.ContentRomajiMistake).filter(models.ContentRomajiMistake.user_id == current_user.id).delete()
    db.commit()
    return {"success": True, "message": "오타 기록이 초기화되었습니다."}
# ════════════════════════════════════════════════════════════
# API: 오타 분석 대상 콘텐츠 목록 조회
# GET /api/typo-content-list
# ════════════════════════════════════════════════════════════
@app.get("/api/typo-content-list")
def get_typo_content_list(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # 사용자가 플레이하여 오타 기록이 있는 고유한 content_id 추출
    content_ids = db.query(models.ContentTypoStat.content_id).filter(
        models.ContentTypoStat.user_id == current_user.id
    ).distinct().all()
    
    content_ids = [c[0] for c in content_ids]
    
    if not content_ids:
        return {"success": True, "contents": []}
        
    # 해당 콘텐츠의 제목 가져오기
    contents = db.query(models.TypingContent).filter(
        models.TypingContent.id.in_(content_ids)
    ).all()
    
    return {
        "success": True, 
        "contents": [{"id": c.id, "title": c.title} for c in contents]
    }

# ════════════════════════════════════════════════════════════
# API: 내 플레이 히스토리 조회
# GET /api/my-history
# ════════════════════════════════════════════════════════════
@app.get("/api/my-history")
def get_my_history(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    try:
        typing_histories = db.query(models.TypingHistory).filter(
            models.TypingHistory.user_id == current_user.id
        ).order_by(models.TypingHistory.played_at.desc()).limit(20).all()
    
        quiz_histories = db.query(models.QuizHistory).filter(
            models.QuizHistory.user_id == current_user.id
        ).order_by(models.QuizHistory.played_at.desc()).limit(20).all()

        battle_histories = db.query(models.BattleHistory).filter(
            models.BattleHistory.user_id == current_user.id
        ).order_by(models.BattleHistory.played_at.desc()).limit(20).all()
    
        created_typing_contents = db.query(models.TypingContent).filter(
            models.TypingContent.creator_id == current_user.id
        ).order_by(models.TypingContent.created_at.desc()).limit(20).all()
    
        created_quiz_contents = db.query(models.QuizContent).filter(
            models.QuizContent.creator_id == current_user.id
        ).order_by(models.QuizContent.created_at.desc()).limit(20).all()
    
        import datetime
        fallback_date = datetime.datetime.now(datetime.timezone.utc)

        combined = []
        for th in typing_histories:
            p_time = th.played_at if th.played_at else fallback_date
            combined.append({
                "type": "typing",
                "content_id": th.content_id,
                "title": th.content_title,
                "genre": th.genre,
                "wpm": th.wpm,
                "accuracy": th.accuracy,
                "score_str": f"{th.score}점 · {th.wpm} WPM · {int(th.accuracy)}%",
                "played_at": p_time.isoformat(),
                "_raw_date": p_time
            })
        
        for qh in quiz_histories:
            p_time = qh.played_at if qh.played_at else fallback_date
            combined.append({
                "type": "quiz",
                "content_id": qh.quiz_id,
                "title": qh.quiz_category,
                "genre": "퀴즈",
                "score": qh.score,
                "total_questions": qh.total_questions,
                "score_str": f"{qh.score} / {qh.total_questions} 정답",
                "played_at": p_time.isoformat(),
                "_raw_date": p_time
            })

        for bh in battle_histories:
            song_title = "알 수 없음"
            if bh.content_id:
                content = db.query(models.TypingContent).filter(models.TypingContent.id == bh.content_id).first()
                if content:
                    song_title = content.title
            rank_labels = {1: "🥇 1위", 2: "🥈 2위", 3: "🥉 3위"}
            rank_str = rank_labels.get(bh.rank, f"{bh.rank}위")
            p_time = bh.played_at if bh.played_at else fallback_date
            combined.append({
                "type": "battle",
                "content_id": bh.content_id,
                "title": song_title,
                "genre": "실시간 대전",
                "rank": bh.rank,
                "wpm": bh.wpm,
                "accuracy": bh.accuracy,
                "score": bh.score,
                "room_code": bh.room_code,
                "score_str": f"{rank_str} · {bh.score}점 · {bh.wpm} WPM · {int(bh.accuracy)}%",
                "played_at": p_time.isoformat(),
                "_raw_date": p_time
            })
        
        # fallback_date was moved to the top of the combined loop

        for tc in created_typing_contents:
            c_time = tc.created_at if tc.created_at else fallback_date
            combined.append({
                "type": "create_typing",
                "content_id": tc.id,
                "title": tc.title,
                "genre": tc.genre or "알 수 없음",
                "score_str": "타이핑 콘텐츠 등록",
                "played_at": c_time.isoformat(),
                "_raw_date": c_time
            })

        for qc in created_quiz_contents:
            c_time = qc.created_at if qc.created_at else fallback_date
            combined.append({
                "type": "create_quiz",
                "content_id": qc.id,
                "title": qc.title,
                "genre": "퀴즈",
                "score_str": "퀴즈 콘텐츠 등록",
                "played_at": c_time.isoformat(),
                "_raw_date": c_time
            })
        
        # Sort descending by raw datetime timestamp to avoid naive/aware comparison errors
        combined.sort(key=lambda x: x["_raw_date"].timestamp() if hasattr(x["_raw_date"], "timestamp") else 0, reverse=True)
    
        # Remove raw_date
        for item in combined:
            if "_raw_date" in item:
                del item["_raw_date"]
        
        return {"success": True, "data": combined}
    except Exception as e:
        import traceback
        err_msg = traceback.format_exc()
        print("ERROR IN /api/my-history:", err_msg)
        return JSONResponse(status_code=500, content={"success": False, "detail": err_msg})

# ════════════════════════════════════════════════════════════
# API: 프로필 분석 통계 조회
# GET /api/profile-analysis
# ════════════════════════════════════════════════════════════
from datetime import datetime, timezone

@app.get("/api/profile-analysis")
def get_profile_analysis(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    
    # 1. 타이핑 통계
    typing_records = db.query(models.TypingHistory).filter(models.TypingHistory.user_id == current_user.id).all()
    
    total_wpm = 0
    week_wpm = 0; week_cnt = 0
    last_week_wpm = 0; last_week_cnt = 0
    month_wpm = 0; month_cnt = 0
    play_typing = len(typing_records)
    
    for r in typing_records:
        total_wpm += r.wpm
        # aware/naive datetime 처리
        played_time = r.played_at
        if played_time.tzinfo is None:
            played_time = played_time.replace(tzinfo=timezone.utc)
            
        diff_days = (now - played_time).days
        if diff_days <= 7:
            week_wpm += r.wpm
            week_cnt += 1
        if 7 < diff_days <= 14:
            last_week_wpm += r.wpm
            last_week_cnt += 1
        if diff_days <= 30:
            month_wpm += r.wpm
            month_cnt += 1

    avg_wpm = total_wpm // play_typing if play_typing > 0 else 0
    avg_week_wpm = week_wpm // week_cnt if week_cnt > 0 else 0
    avg_last_week_wpm = last_week_wpm // last_week_cnt if last_week_cnt > 0 else 0
    avg_month_wpm = month_wpm // month_cnt if month_cnt > 0 else 0

    # 2. 퀴즈 통계
    quiz_records = db.query(models.QuizHistory).filter(models.QuizHistory.user_id == current_user.id).all()
    play_quiz = len(quiz_records)
    quiz_correct = sum(q.score for q in quiz_records)
    quiz_total = sum(q.total_questions for q in quiz_records)
    quiz_correct_rate = int((quiz_correct / quiz_total) * 100) if quiz_total > 0 else 0

    # 3. 실시간 대전 통계
    battle_records = db.query(models.BattleHistory).filter(models.BattleHistory.user_id == current_user.id).all()
    play_battle = len(battle_records)
    battle_wpm_total = 0
    battle_wins = 0
    for b in battle_records:
        battle_wpm_total += b.wpm
        if b.rank == 1:
            battle_wins += 1
            
    avg_battle_wpm = battle_wpm_total // play_battle if play_battle > 0 else 0
    battle_win_rate = int((battle_wins / play_battle) * 100) if play_battle > 0 else 0

    return {
        "success": True,
        "avg_wpm": avg_wpm,
        "wpm_week": avg_week_wpm,
        "wpm_lastweek": avg_last_week_wpm,
        "wpm_month": avg_month_wpm,
        "play_typing": play_typing,
        "play_quiz": play_quiz,
        "quiz_correct_rate": quiz_correct_rate,
        "quiz_total_correct": quiz_correct,
        "play_battle": play_battle,
        "battle_win_rate": battle_win_rate,
        "battle_avg_wpm": avg_battle_wpm
    }

# ════════════════════════════════════════════════════════════
# 실시간 대전 시스템 - Redis + WebSocket
# ════════════════════════════════════════════════════════════

# Redis 연결
redis_client: Optional[aioredis.Redis] = None

async def get_redis() -> aioredis.Redis:
    global redis_client
    if redis_client is None:
        redis_client = aioredis.from_url("redis://localhost:6379", decode_responses=True, protocol=2)
    return redis_client


# WebSocket 연결 관리자
class BattleConnectionManager:
    def __init__(self):
        # room_code → list of (websocket, nickname)
        self.rooms: Dict[str, List[tuple]] = {}

    async def connect(self, room_code: str, ws: WebSocket, nickname: str):
        await ws.accept()
        if room_code not in self.rooms:
            self.rooms[room_code] = []
        self.rooms[room_code].append((ws, nickname))

    def disconnect(self, room_code: str, ws: WebSocket):
        if room_code in self.rooms:
            self.rooms[room_code] = [(w, n) for w, n in self.rooms[room_code] if w != ws]
            if not self.rooms[room_code]:
                del self.rooms[room_code]

    async def broadcast(self, room_code: str, message: dict, exclude: WebSocket = None):
        if room_code not in self.rooms:
            return
        dead = []
        for ws, nick in self.rooms[room_code]:
            if ws == exclude:
                continue
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(room_code, ws)

    async def broadcast_all(self, room_code: str, message: dict):
        await self.broadcast(room_code, message, exclude=None)

    def get_connections(self, room_code: str) -> int:
        return len(self.rooms.get(room_code, []))


battle_manager = BattleConnectionManager()
lobby_manager = BattleConnectionManager()

REDIS_ROOM_TTL = 7200  # 2시간


async def get_room_data(redis: aioredis.Redis, room_code: str) -> Optional[dict]:
    raw = await redis.get(f"battle:room:{room_code}")
    if raw:
        return json.loads(raw)
    return None


async def save_room_data(redis: aioredis.Redis, room_code: str, data: dict):
    await redis.set(f"battle:room:{room_code}", json.dumps(data, ensure_ascii=False), ex=REDIS_ROOM_TTL)


async def delete_room(redis: aioredis.Redis, room_code: str):
    await redis.delete(f"battle:room:{room_code}")
    await lobby_manager.broadcast_all("lobby", {"type": "lobby_update"})


# ── 방 생성 API ────────────────────────────────────────────
class BattleRoomCreate(BaseModel):
    title: str
    song_id: int
    mode: str = "typing"  # "typing" or "quiz"
    max_players: int = 4


@app.post("/api/battle/rooms")
async def create_battle_room(req: BattleRoomCreate, authorization: str = Header(None), db: Session = Depends(get_db)):
    current_user = get_current_user(authorization, db)
    redis = await get_redis()

    # 4자리 방 코드 생성 (중복 방지)
    for _ in range(10):
        code = str(random.randint(1000, 9999))
        existing = await redis.get(f"battle:room:{code}")
        if not existing:
            break

    # 콘텐츠 정보 조회
    content = None
    if req.mode == "quiz":
        content = db.query(models.QuizContent).filter(models.QuizContent.id == req.song_id).first()
    else:
        content = db.query(models.TypingContent).filter(models.TypingContent.id == req.song_id).first()
        
    if not content:
        raise HTTPException(status_code=404, detail="콘텐츠를 찾을 수 없습니다.")

    room_data = {
        "code": code,
        "mode": req.mode,
        "title": req.title,
        "host": current_user.nickname,
        "song_id": content.id,
        "song_title": content.title,
        "song_artist": content.artist if hasattr(content, "artist") else "알 수 없음",
        "max_players": min(req.max_players, 4),
        "status": "waiting",  # waiting | countdown | playing | finished
        "players": {}
    }

    await save_room_data(redis, code, room_data)
    await lobby_manager.broadcast_all("lobby", {"type": "lobby_update"})
    return {"success": True, "room_code": code, "room": room_data}


@app.get("/api/battle/rooms")
async def list_battle_rooms():
    redis = await get_redis()
    keys = await redis.keys("battle:room:*")
    rooms = []
    for key in keys:
        raw = await redis.get(key)
        if raw:
            room = json.loads(raw)
            if room.get("status") in ("waiting", "playing"):
                rooms.append({
                    "code": room["code"],
                    "title": room["title"],
                    "host": room["host"],
                    "song_title": room["song_title"],
                    "song_artist": room["song_artist"],
                    "player_count": len(room.get("players", {})),
                    "max_players": room["max_players"],
                    "status": room["status"]
                })
    return {"success": True, "rooms": rooms}

@app.websocket("/ws/lobby")
async def lobby_websocket(websocket: WebSocket):
    await lobby_manager.connect("lobby", websocket, "guest")
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        lobby_manager.disconnect("lobby", websocket)


# ── 대전 기록 저장 (내부 함수) ─────────────────────────────
async def save_battle_results(room_data: dict, db: Session):
    """게임 종료 시 MySQL에 대전 기록 저장"""
    players = room_data.get("players", {})
    song_id = room_data.get("song_id")
    room_code = room_data.get("code", "")

    # 점수 기준 순위 정렬
    sorted_players = sorted(
        players.items(),
        key=lambda x: x[1].get("score", 0),
        reverse=True
    )

    for rank, (nickname, pdata) in enumerate(sorted_players, start=1):
        user_id = pdata.get("user_id")
        if not user_id:
            continue
        # mode 분기 (타이핑 vs 퀴즈)
        mode = room_data.get("mode", "typing")
        content_id_val = song_id if mode == "typing" else None
        quiz_id_val = song_id if mode == "quiz" else None

        history = models.BattleHistory(
            room_code=room_code,
            user_id=user_id,
            content_id=content_id_val,
            quiz_id=quiz_id_val,
            rank=rank,
            score=pdata.get("score", 0),
            wpm=pdata.get("wpm", 0),
            accuracy=pdata.get("accuracy", 100.0)
        )
        db.add(history)
    db.commit()


# ── WebSocket 대전 엔드포인트 ──────────────────────────────
@app.websocket("/ws/battle/{room_code}")
async def battle_websocket(
    websocket: WebSocket,
    room_code: str,
    token: str = Query(...),
    db: Session = Depends(get_db)
):
    # 1. JWT 토큰 검증
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if not email:
            await websocket.close(code=4001)
            return
    except JWTError:
        await websocket.close(code=4001)
        return

    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        await websocket.close(code=4001)
        return

    nickname = user.nickname
    redis = await get_redis()

    # 2. 방 상태 로드 (Lock 적용)
    async with redis.lock(f"battle:lock:{room_code}", timeout=5):
        room_data = await get_room_data(redis, room_code)
        if not room_data:
            await websocket.close(code=4004)
            return

        # 3. 인원 초과 체크
        if len(room_data["players"]) >= room_data["max_players"] and nickname not in room_data["players"]:
            await websocket.close(code=4003)
            return

        # 4. WebSocket 수락 및 방 입장
        await battle_manager.connect(room_code, websocket, nickname)

        # 플레이어 등록 (재접속 시 기존 데이터 유지)
        if nickname not in room_data["players"]:
            room_data["players"][nickname] = {
                "user_id": user.id,
                "ready": False,
                "score": 0,
                "progress": 0.0,
                "wpm": 0,
                "accuracy": 100.0,
                "finished": False,
                "is_host": nickname == room_data["host"]
            }
            await save_room_data(redis, room_code, room_data)

    # 입장한 플레이어에게 현재 방 상태 전송
    await websocket.send_json({"type": "room_state", "room": room_data})

    # 나머지 플레이어에게 입장 알림
    await battle_manager.broadcast(room_code, {
        "type": "player_joined",
        "nickname": nickname,
        "players": room_data["players"]
    }, exclude=websocket)
    
    # 로비에도 인원 변동 알림
    await lobby_manager.broadcast_all("lobby", {"type": "lobby_update"})

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            # ── 준비 상태 변경 ──────────────────────────────
            if msg_type == "ready":
                async with redis.lock(f"battle:lock:{room_code}", timeout=5):
                    room_data = await get_room_data(redis, room_code)
                    if room_data and nickname in room_data["players"]:
                        room_data["players"][nickname]["ready"] = data.get("ready", True)
                        await save_room_data(redis, room_code, room_data)
                
                if room_data and nickname in room_data["players"]:
                    await battle_manager.broadcast_all(room_code, {
                        "type": "player_update",
                        "nickname": nickname,
                        "data": room_data["players"][nickname],
                        "players": room_data["players"]
                    })

            # ── 방장이 시작 ─────────────────────────────────
            elif msg_type == "start":
                room_data = await get_room_data(redis, room_code)
                if not room_data:
                    continue
                if nickname != room_data["host"]:
                    await websocket.send_json({"type": "error", "message": "방장만 시작할 수 있습니다."})
                    continue

                # 모두 레디 체크 (퇴장한 유저 제외)
                non_host_players = {n: p for n, p in room_data["players"].items() if n != room_data["host"] and not p.get("disconnected")}
                if non_host_players and not all(p["ready"] for p in non_host_players.values()):
                    await websocket.send_json({"type": "error", "message": "아직 준비가 안 된 플레이어가 있습니다."})
                    continue

                async def sync_and_start(r_code):
                    sync_timeout = 10.0
                    checked_time = 0.0
                    while checked_time < sync_timeout:
                        r_data = await get_room_data(redis, r_code)
                        if not r_data or r_data.get("status") != "syncing":
                            return
                        active_players = {n: p for n, p in r_data["players"].items() if not p.get("disconnected")}
                        if active_players and all(p.get("sync_ready") for p in active_players.values()):
                            break
                        await asyncio.sleep(0.5)
                        checked_time += 0.5
                    
                    r_data = await get_room_data(redis, r_code)
                    if r_data and r_data.get("status") == "syncing":
                        r_data["status"] = "countdown"
                        await save_room_data(redis, r_code, r_data)

                        for count in range(5, 0, -1):
                            await battle_manager.broadcast_all(r_code, {"type": "countdown", "count": count})
                            await asyncio.sleep(1)

                        f_data = await get_room_data(redis, r_code)
                        if f_data:
                            f_data["status"] = "playing"
                            f_data["start_time"] = time.time()
                            for p in f_data["players"].values():
                                p["score"] = 0
                                p["progress"] = 0.0
                                p["wpm"] = 0
                                p["accuracy"] = 100.0
                                p["finished"] = False
                            await save_room_data(redis, r_code, f_data)
                            await battle_manager.broadcast_all(r_code, {
                                "type": "game_start",
                                "song_id": f_data["song_id"],
                                "players": f_data["players"]
                            })

                room_data["status"] = "syncing"
                for p in room_data["players"].values():
                    if not p.get("disconnected"):
                        p["sync_ready"] = False
                await save_room_data(redis, room_code, room_data)

                await battle_manager.broadcast_all(room_code, {"type": "sync_check"})
                asyncio.create_task(sync_and_start(room_code))

            # ── 동기화 완료 신호 ─────────────────────────────
            elif msg_type == "sync_ready":
                async with redis.lock(f"battle:lock:{room_code}", timeout=5):
                    room_data = await get_room_data(redis, room_code)
                    if room_data and room_data.get("status") == "syncing" and nickname in room_data["players"]:
                        room_data["players"][nickname]["sync_ready"] = True
                        await save_room_data(redis, room_code, room_data)

            # ── 채팅 메시지 ─────────────────────────────────
            elif msg_type == "chat":
                await battle_manager.broadcast(room_code, {
                    "type": "chat",
                    "nickname": nickname,
                    "message": data.get("message", "")
                }, exclude=websocket)

            # ── 퀴즈 정답 브로드캐스트 ──────────────────────
            elif msg_type == "quiz_answer":
                # 점수를 Redis에 즉시 반영
                async with redis.lock(f"battle:lock:{room_code}", timeout=5):
                    room_data = await get_room_data(redis, room_code)
                    if room_data and nickname in room_data["players"]:
                        new_score = data.get("score", 0)
                        room_data["players"][nickname]["score"] = new_score
                        await save_room_data(redis, room_code, room_data)

                # 다른 플레이어들에게 정답 브로드캐스트 (본인 제외)
                await battle_manager.broadcast(room_code, {
                    "type": "quiz_answer",
                    "nickname": nickname,
                    "question_key": data.get("question_key"),
                    "answer_index": data.get("answer_index"),
                    "answer_text": data.get("answer_text", ""),
                    "score": data.get("score", 0),
                    "message": data.get("message", "")
                }, exclude=websocket)

            # ── 퀴즈 채팅 메시지 ─────────────────────────────
            elif msg_type == "quiz_chat":
                await battle_manager.broadcast(room_code, {
                    "type": "quiz_chat",
                    "nickname": nickname,
                    "message": data.get("message", "")
                }, exclude=websocket)

            # ── 타이핑 진행도 업데이트 ──────────────────────
            elif msg_type == "progress":
                async with redis.lock(f"battle:lock:{room_code}", timeout=5):
                    room_data = await get_room_data(redis, room_code)
                    if room_data and nickname in room_data["players"]:
                        room_data["players"][nickname]["score"] = data.get("score", 0)
                        room_data["players"][nickname]["progress"] = data.get("progress", 0.0)
                        room_data["players"][nickname]["wpm"] = data.get("wpm", 0)
                        room_data["players"][nickname]["accuracy"] = data.get("accuracy", 100.0)
                        await save_room_data(redis, room_code, room_data)
                
                if room_data and nickname in room_data["players"]:
                    # 나머지 플레이어에게 브로드캐스트 (본인 제외)
                    await battle_manager.broadcast(room_code, {
                        "type": "player_update",
                        "nickname": nickname,
                        "score": room_data["players"][nickname]["score"],
                        "progress": room_data["players"][nickname]["progress"],
                        "wpm": room_data["players"][nickname]["wpm"],
                    }, exclude=websocket)

            # ── 게임 완료 ───────────────────────────────────
            elif msg_type == "finish":
                async with redis.lock(f"battle:lock:{room_code}", timeout=5):
                    room_data = await get_room_data(redis, room_code)
                    if room_data and nickname in room_data["players"]:
                        room_data["players"][nickname]["finished"] = True
                        if room_data.get("mode") == "quiz":
                            room_data["players"][nickname]["score"] = data.get("score", room_data["players"][nickname].get("score", 0))
                            room_data["players"][nickname]["wpm"] = 0
                            room_data["players"][nickname]["accuracy"] = 0.0
                        else:
                            room_data["players"][nickname]["score"] = data.get("score", 0)
                            room_data["players"][nickname]["wpm"] = data.get("wpm", 0)
                            room_data["players"][nickname]["accuracy"] = data.get("accuracy", 100.0)
                        room_data["players"][nickname]["progress"] = 1.0
                        
                        all_finished = all(p["finished"] for p in room_data["players"].values())
                        if all_finished and room_data.get("status") != "finished":
                            room_data["status"] = "finished"
                            
                        await save_room_data(redis, room_code, room_data)
                        
                if room_data and nickname in room_data["players"]:
                    # 완료 알림 브로드캐스트
                    await battle_manager.broadcast_all(room_code, {
                        "type": "player_finished",
                        "nickname": nickname,
                        "players": room_data["players"]
                    })

                    if room_data.get("status") == "finished":
                        # 순위 계산
                        sorted_players = sorted(
                            room_data["players"].items(),
                            key=lambda x: x[1].get("score", 0),
                            reverse=True
                        )
                        results = [
                            {"rank": i+1, "nickname": n, **p}
                            for i, (n, p) in enumerate(sorted_players)
                        ]

                        await battle_manager.broadcast_all(room_code, {
                            "type": "game_end",
                            "results": results
                        })

                        # MySQL에 기록 저장
                        try:
                            await save_battle_results(room_data, db)
                        except Exception as e:
                            print(f"Battle history save error: {e}")

                        # 방 정리 (10분 후)
                        await asyncio.sleep(600)
                        await delete_room(redis, room_code)

    except WebSocketDisconnect:
        battle_manager.disconnect(room_code, websocket)
        async with redis.lock(f"battle:lock:{room_code}", timeout=10):
            room_data = await get_room_data(redis, room_code)
            if room_data and nickname in room_data["players"]:
                if room_data.get("status") in ["playing", "countdown", "finished"]:
                    room_data["players"][nickname]["disconnected"] = True
                    room_data["players"][nickname]["finished"] = True
                    
                    # 방장이 나갔으면 다음 사람에게 양도
                    if nickname == room_data["host"]:
                        active_players = [n for n, p in room_data["players"].items() if not p.get("disconnected")]
                        if active_players:
                            room_data["host"] = active_players[0]
                            
                    await save_room_data(redis, room_code, room_data)
                    
                    await battle_manager.broadcast_all(room_code, {
                        "type": "player_disconnected",
                        "nickname": nickname,
                        "players": room_data["players"],
                        "new_host": room_data["host"]
                    })
                    
                    # 남은 사람들이 모두 완료했는지 체크
                    active_players_dict = {n: p for n, p in room_data["players"].items() if not p.get("disconnected")}
                    if active_players_dict:
                        all_finished = all(p.get("finished") for p in active_players_dict.values())
                        if all_finished and room_data["status"] != "finished":
                            room_data["status"] = "finished"
                            await save_room_data(redis, room_code, room_data)
                            
                            sorted_players = sorted(
                                room_data["players"].items(),
                                key=lambda x: x[1].get("score", 0),
                                reverse=True
                            )
                            results = [
                                {"rank": i+1, "nickname": n, **p}
                                for i, (n, p) in enumerate(sorted_players)
                            ]
                            await battle_manager.broadcast_all(room_code, {
                                "type": "game_end",
                                "results": results
                            })
                            try:
                                await save_battle_results(room_data, db)
                            except Exception as e:
                                print(f"Battle history save error: {e}")
                            await asyncio.sleep(600)
                            await delete_room(redis, room_code)
                    else:
                        await delete_room(redis, room_code)
                else:
                    del room_data["players"][nickname]
                    if not room_data["players"]:
                        await delete_room(redis, room_code)
                    else:
                        if nickname == room_data["host"] and room_data["players"]:
                            room_data["host"] = next(iter(room_data["players"]))
                        await save_room_data(redis, room_code, room_data)
                        await battle_manager.broadcast_all(room_code, {
                            "type": "player_left",
                            "nickname": nickname,
                            "players": room_data["players"],
                            "new_host": room_data["host"]
                        })
                    await lobby_manager.broadcast_all("lobby", {"type": "lobby_update"})
    except Exception as e:
        print(f"WebSocket error: {e}")
        battle_manager.disconnect(room_code, websocket)


# ──────────────────────────────────────────
# 오타 통계 API
# ──────────────────────────────────────────




