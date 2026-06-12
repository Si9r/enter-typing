from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import smtplib
import random
import string
import os
import re
import json
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv
import time
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session
from backend.database import engine, get_db, SessionLocal
from backend import models
import bcrypt
from jose import jwt, JWTError
import pykakasi
from backend.scoring import (
    calculate_typing_score,
    clamp_number,
    get_quiz_answer_slot_count,
    get_quiz_max_score,
)

kks = pykakasi.kakasi()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PAGES_DIR = os.path.join(BASE_DIR, "pages")
STATIC_DIR = os.path.join(BASE_DIR, "static")

load_dotenv(os.path.join(BASE_DIR, ".env"))

# MySQL에 enterping_db 라는 이름의 데이터베이스 하나만 생성하면 자동으로 컬럼은 생성 됩니다.
# 데이터베이스 테이블 자동 생성
models.Base.metadata.create_all(bind=engine)

def ensure_result_columns():
    inspector = inspect(engine)
    table_columns = {
        table_name: {column["name"] for column in inspector.get_columns(table_name)}
        for table_name in inspector.get_table_names()
    }

    migrations = []
    typing_columns = table_columns.get("typing_histories", set())
    if "content_id" not in typing_columns:
        migrations.append("ALTER TABLE typing_histories ADD COLUMN content_id INTEGER")
    if "score" not in typing_columns:
        migrations.append("ALTER TABLE typing_histories ADD COLUMN score INTEGER NOT NULL DEFAULT 0")
    if "typos" not in typing_columns:
        migrations.append("ALTER TABLE typing_histories ADD COLUMN typos INTEGER NOT NULL DEFAULT 0")
    if "elapsed_seconds" not in typing_columns:
        migrations.append("ALTER TABLE typing_histories ADD COLUMN elapsed_seconds INTEGER NOT NULL DEFAULT 0")
    if "rank_eligible" not in typing_columns:
        migrations.append("ALTER TABLE typing_histories ADD COLUMN rank_eligible BOOLEAN NOT NULL DEFAULT 0")

    quiz_columns = table_columns.get("quiz_histories", set())
    if "content_id" not in quiz_columns:
        migrations.append("ALTER TABLE quiz_histories ADD COLUMN content_id INTEGER")
    if "accuracy" not in quiz_columns:
        migrations.append("ALTER TABLE quiz_histories ADD COLUMN accuracy FLOAT NOT NULL DEFAULT 0")
    if "max_combo" not in quiz_columns:
        migrations.append("ALTER TABLE quiz_histories ADD COLUMN max_combo INTEGER NOT NULL DEFAULT 0")
    if "rank_eligible" not in quiz_columns:
        migrations.append("ALTER TABLE quiz_histories ADD COLUMN rank_eligible BOOLEAN NOT NULL DEFAULT 0")

    if migrations:
        with engine.begin() as conn:
            for migration in migrations:
                conn.execute(text(migration))

ensure_result_columns()

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
    db = SessionLocal()
    try:
        if db.query(models.TypingContent).count() > 0:
            return

        songs = [
            {
                "id": 1,
                "title": "夜に駆ける (밤을 달리다)",
                "artist": "YOASOBI",
                "genre": "JPOP",
                "description": "YOASOBI의 데뷔곡이자 최고 히트곡인 '밤을 달리다'입니다. 빠른 템포와 시적인 가사가 특징이며, 일본어 입력 속도를 높이는 데 아주 좋은 연습 곡입니다. 히라가나와 한자 변환에 유의하며 연습해보세요!",
                "lyrics": "沈むように溶けてゆくように\n二人だけの空が広がる夜に\nさよならだけだった\nその一言で全てが分かった\n日が沈み出した空と君の姿\nフェンス越しに重なっていた",
                "hiragana": "しずむようにとけてゆくように\nふたりだけのそらがひろがるよるに\nさよならだけだった\nそのひとことですべてがわかった\nひがしずみだしたそらときみのすがた\nふぇんすごしにかさなっていた",
                "romaji": "shizumuyounitoketeyukuyouni\nfutaridakenosoragahirogaruyoruni\nsayonaradakedatta\nsonohitokotodesubetegawakatta\nhigashizumidashitasoratokiminosugata\nfensugoshinikasanatteita"
            },
            {
                "id": 2,
                "title": "Lemon",
                "artist": "米津玄師 (Kenshi Yonezu)",
                "genre": "JPOP",
                "description": "국민 히트곡! 요네즈 켄시의 명곡 타이핑",
                "lyrics": "夢ならばどれほどよかったでしょう\n未だにあなたのことを夢にみる\n忘れた物を取りに帰るように\n古びた思い出の埃を払う",
                "hiragana": "ゆめならばどれほどよかったでしょう\nいまだにあなたのことをゆめにみる\nわすれたものをとりにかえるように\nふるびたおもいでのほこりをはらう",
                "romaji": "yumenarabadorehodoyokattadeshou\nimadanianatanokotowoyumenimiru\nwasuretamonowotorinikaeruyouni\nfurubitaomoidenohokoriwoharau"
            },
            {
                "id": 3,
                "title": "マリーゴールド (Marigold)",
                "artist": "あいみょん (Aimyon)",
                "genre": "JPOP",
                "description": "아이묭(Aimyon)의 감성적인 가사 타자 연습",
                "lyrics": "風の強さがちょっと\n心を揺さぶりすぎて\n真面目に見つめた\n君が恋しい",
                "hiragana": "かぜのつよさがちょっと\nこころをゆさぶりすぎて\nまじめにみつめた\nきみがこいしい",
                "romaji": "kazenotsuyosagachotto\nkokorowoyusaburisugite\nmajimenimitsumeta\nkimigakoishii"
            },
            {
                "id": 4,
                "title": "ドライフラワー (Dry Flower)",
                "artist": "優里 (Yuuri)",
                "genre": "JPOP",
                "description": "유우리(Yuuri)의 이별 감성을 담은 명곡",
                "lyrics": "多分私じゃなくていいね\n余裕のない二人だったし\n気付けば喧嘩ばっかりしてさ\nごめんね",
                "hiragana": "たぶんわたしじゃなくていいね\nよゆうのないふたりだったし\nきづけばけんかばっかりしてさ\nごめんね",
                "romaji": "tabunwatashijanakuteiine\nyoyuunonaifutaridattashi\nkidzukebakenkabakkarishitesa\ngomenne"
            }
        ]
        
        for song in songs:
            content = models.TypingContent(**song)
            db.add(content)
        db.commit()
    finally:
        db.close()

# ── 정적 파일 서빙 ─────────────────────────────────────────
app.mount("/assets", StaticFiles(directory=os.path.join(STATIC_DIR, "assets")), name="assets")
app.mount("/images", StaticFiles(directory=os.path.join(STATIC_DIR, "images")), name="images")

# ── 인메모리 저장소 (실제 서비스에서는 DB/Redis 사용 권장) ─
# { email: { "code": "123456", "expires_at": timestamp } }
verification_store: dict = {}

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

class QuizContentCreate(BaseModel):
    title: str
    artist: str
    genre: str
    description: str
    quiz_data: str
    difficulty: int = 3
    youtube_id: str | None = None

class TypingResultCreate(BaseModel):
    content_id: int
    wpm: int
    accuracy: float
    typos: int = 0
    elapsed_seconds: int = 0
    score: int | None = None
    completed: bool = False

class QuizResultCreate(BaseModel):
    content_id: int
    score: int
    correct_count: int = 0
    total_questions: int
    accuracy: float = 0
    max_combo: int = 0

class ConvertRequest(BaseModel):
    text: str

def validate_email(email: str):
    if not EMAIL_REGEX.match(email):
        raise HTTPException(status_code=422, detail="올바른 이메일 형식이 아닙니다.")


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

    verification_store[req.email] = {
        "code": code,
        "expires_at": expires_at,
        "verified": False,
    }

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
    entry = verification_store.get(req.email)

    if not entry:
        raise HTTPException(status_code=400, detail="인증 요청 내역이 없습니다. 다시 시도해주세요.")

    if time.time() > entry["expires_at"]:
        del verification_store[req.email]
        raise HTTPException(status_code=400, detail="인증번호가 만료되었습니다. 다시 요청해주세요.")

    if entry["code"] != req.code.strip():
        raise HTTPException(status_code=400, detail="인증번호가 올바르지 않습니다.")

    # 검증 성공 → 임시 비밀번호 발급
    temp_pw = generate_temp_password()
    entry["verified"] = True
    entry["temp_password"] = temp_pw

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
        entry = verification_store.get(req.email)
        if not entry or not entry.get("verified"):
            raise HTTPException(status_code=401, detail="비밀번호 변경 권한이 없습니다. 먼저 이메일 인증을 진행해주세요.")
        user = db.query(models.User).filter(models.User.email == req.email).first()
        if not user:
            raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다.")
            
    if len(req.new_password) < 8:
        raise HTTPException(status_code=400, detail="비밀번호는 8자 이상이어야 합니다.")

    # 새 비밀번호 해싱 후 DB 업데이트
    user.password_hash = get_password_hash(req.new_password)
    db.commit()

    # 인메모리 항목 정리
    if req.email in verification_store:
        del verification_store[req.email]

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

    # 인메모리 항목 정리
    if req.email in verification_store:
        del verification_store[req.email]

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

    # verification_store에 해당 이메일의 임시 비밀번호가 있으면 비교
    entry = verification_store.get(req.email)
    is_temp_login = False
    if entry and entry.get("verified") and entry.get("temp_password"):
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
@app.get("/api/my-results")
def get_my_results(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    typing_histories = db.query(models.TypingHistory).filter(
        models.TypingHistory.user_id == current_user.id
    ).all()
    quiz_histories = db.query(models.QuizHistory).filter(
        models.QuizHistory.user_id == current_user.id
    ).all()

    total_typing = len(typing_histories)
    total_quiz = len(quiz_histories)
    total_plays = total_typing + total_quiz

    accuracy_values = [
        h.accuracy for h in typing_histories if h.accuracy is not None
    ] + [
        h.accuracy for h in quiz_histories if h.accuracy is not None
    ]
    avg_accuracy = round(sum(accuracy_values) / len(accuracy_values), 1) if accuracy_values else 0
    avg_wpm = round(sum((h.wpm or 0) for h in typing_histories) / total_typing) if total_typing else 0
    best_wpm = max(((h.wpm or 0) for h in typing_histories), default=0)
    best_typing_score = max(((h.score or 0) for h in typing_histories), default=0)
    best_quiz_score = max(((h.score or 0) for h in quiz_histories), default=0)

    recent_typing = db.query(models.TypingHistory).filter(
        models.TypingHistory.user_id == current_user.id
    ).order_by(models.TypingHistory.played_at.desc()).limit(20).all()
    recent_quiz = db.query(models.QuizHistory).filter(
        models.QuizHistory.user_id == current_user.id
    ).order_by(models.QuizHistory.played_at.desc()).limit(20).all()

    content_ids = {h.content_id for h in recent_quiz if h.content_id}
    quiz_contents = {}
    if content_ids:
        quiz_contents = {
            c.id: c for c in db.query(models.QuizContent).filter(models.QuizContent.id.in_(content_ids)).all()
        }

    recent = []
    for history in recent_typing:
        recent.append({
            "type": "typing",
            "content_id": history.content_id,
            "title": history.content_title,
            "genre": history.genre,
            "wpm": history.wpm,
            "accuracy": history.accuracy,
            "score": history.score,
            "typos": history.typos,
            "elapsed_seconds": history.elapsed_seconds,
            "played_at": history.played_at.isoformat() if history.played_at else None
        })

    for history in recent_quiz:
        content = quiz_contents.get(history.content_id)
        recent.append({
            "type": "quiz",
            "content_id": history.content_id,
            "title": content.title if content else "Quiz",
            "genre": history.quiz_category,
            "score": history.score,
            "total_questions": history.total_questions,
            "accuracy": history.accuracy,
            "max_combo": history.max_combo,
            "played_at": history.played_at.isoformat() if history.played_at else None
        })

    recent.sort(key=lambda item: item["played_at"] or "", reverse=True)

    return {
        "success": True,
        "summary": {
            "total_plays": total_plays,
            "typing_plays": total_typing,
            "quiz_plays": total_quiz,
            "avg_accuracy": avg_accuracy,
            "avg_wpm": avg_wpm,
            "best_wpm": best_wpm,
            "best_typing_score": best_typing_score,
            "best_quiz_score": best_quiz_score
        },
        "recent": recent[:20]
    }

@app.get("/api/rankings")
def get_rankings(mode: str = "all", content_id: int | None = None, limit: int = 50, db: Session = Depends(get_db)):
    safe_limit = clamp_number(int(limit or 50), 1, 100)
    requested_mode = (mode or "all").lower()
    if requested_mode not in {"all", "typing", "quiz"}:
        raise HTTPException(status_code=400, detail="Invalid ranking mode.")

    rows = []

    if requested_mode in {"all", "typing"}:
        typing_query = db.query(models.TypingHistory, models.User).join(
            models.User, models.TypingHistory.user_id == models.User.id
        ).filter(models.TypingHistory.rank_eligible == True)
        if content_id is not None:
            typing_query = typing_query.filter(models.TypingHistory.content_id == content_id)
        typing_histories = typing_query.order_by(
            models.TypingHistory.score.desc(),
            models.TypingHistory.accuracy.desc(),
            models.TypingHistory.wpm.desc()
        ).limit(safe_limit).all()

        for history, user in typing_histories:
            rows.append({
                "type": "typing",
                "nickname": user.nickname,
                "content_id": history.content_id,
                "title": history.content_title,
                "genre": history.genre,
                "score": history.score,
                "accuracy": history.accuracy,
                "wpm": history.wpm,
                "max_combo": None,
                "played_at": history.played_at.isoformat() if history.played_at else None
            })

    if requested_mode in {"all", "quiz"}:
        quiz_query = db.query(models.QuizHistory, models.User).join(
            models.User, models.QuizHistory.user_id == models.User.id
        ).filter(models.QuizHistory.rank_eligible == True)
        if content_id is not None:
            quiz_query = quiz_query.filter(models.QuizHistory.content_id == content_id)
        quiz_histories = quiz_query.order_by(
            models.QuizHistory.score.desc(),
            models.QuizHistory.accuracy.desc(),
            models.QuizHistory.max_combo.desc()
        ).limit(safe_limit).all()

        quiz_content_ids = {history.content_id for history, _ in quiz_histories if history.content_id}
        quiz_contents = {}
        if quiz_content_ids:
            quiz_contents = {
                c.id: c for c in db.query(models.QuizContent).filter(models.QuizContent.id.in_(quiz_content_ids)).all()
            }

        for history, user in quiz_histories:
            content = quiz_contents.get(history.content_id)
            rows.append({
                "type": "quiz",
                "nickname": user.nickname,
                "content_id": history.content_id,
                "title": content.title if content else "Quiz",
                "genre": history.quiz_category,
                "score": history.score,
                "accuracy": history.accuracy,
                "wpm": None,
                "max_combo": history.max_combo,
                "played_at": history.played_at.isoformat() if history.played_at else None
            })

    rows.sort(
        key=lambda row: (
            row["score"] or 0,
            row["accuracy"] or 0,
            row["wpm"] or row["max_combo"] or 0
        ),
        reverse=True
    )
    ranked = rows[:safe_limit]
    for index, row in enumerate(ranked, start=1):
        row["rank"] = index

    return {
        "success": True,
        "mode": requested_mode,
        "content_id": content_id,
        "data": ranked
    }

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
            "best_time": c.best_time
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
        best_time=0
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
def delete_typing_content(content_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    content = db.query(models.TypingContent).filter(models.TypingContent.id == content_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="콘텐츠를 찾을 수 없습니다.")

    if content.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="삭제 권한이 없습니다.")
        
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

@app.post("/api/typing-results")
def save_typing_result(req: TypingResultCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    content = db.query(models.TypingContent).filter(models.TypingContent.id == req.content_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="Content not found.")

    if req.wpm < 0 or req.wpm > 600:
        raise HTTPException(status_code=400, detail="Invalid WPM.")
    if req.accuracy < 0 or req.accuracy > 100:
        raise HTTPException(status_code=400, detail="Invalid accuracy.")
    if req.typos < 0 or req.typos > 10000:
        raise HTTPException(status_code=400, detail="Invalid typo count.")
    if req.elapsed_seconds < 0 or req.elapsed_seconds > 7200:
        raise HTTPException(status_code=400, detail="Invalid elapsed time.")

    server_score = calculate_typing_score(req.wpm, req.accuracy, req.typos, content.difficulty)
    rank_eligible = req.completed and req.elapsed_seconds >= 5 and req.accuracy >= 85 and req.wpm <= 500

    history = models.TypingHistory(
        user_id=current_user.id,
        content_id=content.id,
        content_title=content.title,
        genre=content.genre,
        wpm=req.wpm,
        accuracy=req.accuracy,
        score=server_score,
        typos=req.typos,
        elapsed_seconds=req.elapsed_seconds,
        rank_eligible=rank_eligible
    )
    content.play_count = (content.play_count or 0) + 1
    if rank_eligible and req.elapsed_seconds > 0:
        if not content.best_time or req.elapsed_seconds < content.best_time:
            content.best_time = req.elapsed_seconds

    db.add(history)
    db.commit()

    return {
        "success": True,
        "score": server_score,
        "rank_eligible": rank_eligible,
        "best_time": content.best_time
    }

# ════════════════════════════════════════════════════════════
# API: 퀴즈 콘텐츠 API
# ════════════════════════════════════════════════════════════
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
            "creator_nickname": c.creator.nickname if c.creator else "엔터핑",
            "difficulty": c.difficulty,
            "best_score": c.best_score,
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
        quiz_data=req.quiz_data,
        difficulty=req.difficulty,
        play_count=0,
        best_score=0
    )
    db.add(new_content)
    db.commit()
    db.refresh(new_content)
    return {"success": True, "message": "성공적으로 추가되었습니다.", "id": new_content.id}

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
    content.quiz_data = req.quiz_data
    content.difficulty = req.difficulty

    db.commit()
    return {"success": True, "message": "수정되었습니다.", "id": content.id}

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
        "creator_nickname": content.creator.nickname if content.creator else "엔터핑",
        "difficulty": content.difficulty,
        "play_count": content.play_count,
        "best_score": content.best_score,
        "quiz_data": content.quiz_data
    }

@app.delete("/api/quiz-contents/{content_id}")
def delete_quiz_content(content_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    content = db.query(models.QuizContent).filter(models.QuizContent.id == content_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="콘텐츠를 찾을 수 없습니다.")

    if content.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="삭제 권한이 없습니다.")
        
    db.delete(content)
    db.commit()
    return {"success": True, "message": "삭제되었습니다."}

# ════════════════════════════════════════════════════════════
# API: 가사 자동 변환 (히라가나, 로마자)
# POST /api/convert
# ════════════════════════════════════════════════════════════
@app.post("/api/quiz-results")
def save_quiz_result(req: QuizResultCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    content = db.query(models.QuizContent).filter(models.QuizContent.id == req.content_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="Content not found.")

    try:
        quiz_items = json.loads(content.quiz_data or "[]")
    except Exception:
        quiz_items = []

    expected_questions = len(quiz_items)
    answer_slots = get_quiz_answer_slot_count(content.quiz_data)
    max_score = get_quiz_max_score(content.quiz_data)

    if req.score < 0:
        raise HTTPException(status_code=400, detail="Invalid score.")
    if req.total_questions < 0 or req.total_questions > max(expected_questions, 1):
        raise HTTPException(status_code=400, detail="Invalid question count.")
    if req.correct_count < 0 or req.correct_count > max(expected_questions, 1):
        raise HTTPException(status_code=400, detail="Invalid correct count.")
    if req.accuracy < 0 or req.accuracy > 100:
        raise HTTPException(status_code=400, detail="Invalid accuracy.")
    if req.max_combo < 0 or req.max_combo > max(answer_slots, 1):
        raise HTTPException(status_code=400, detail="Invalid combo.")

    server_score = min(req.score, max_score)
    rank_eligible = (
        expected_questions > 0 and
        req.total_questions == expected_questions and
        req.correct_count == expected_questions and
        req.score <= max_score
    )

    history = models.QuizHistory(
        user_id=current_user.id,
        content_id=content.id,
        quiz_category=content.genre,
        score=server_score,
        total_questions=expected_questions,
        accuracy=req.accuracy,
        max_combo=req.max_combo,
        rank_eligible=rank_eligible
    )
    content.play_count = (content.play_count or 0) + 1
    if rank_eligible and server_score > (content.best_score or 0):
        content.best_score = server_score

    db.add(history)
    db.commit()

    return {
        "success": True,
        "score": server_score,
        "rank_eligible": rank_eligible,
        "best_score": content.best_score
    }

@app.post("/api/convert")
def convert_lyrics(req: ConvertRequest):
    text = req.text
    if not text:
        return {"success": True, "hiragana": "", "romaji": ""}
        
    converted = kks.convert(text)
    
    hiragana = ""
    romaji = ""
    for item in converted:
        h = item['hira']
        r = item['hepburn']
        
        # pykakasi 스테가나 변환 예외 처리 (jie -> je 등)
        if 'じぇ' in h: r = r.replace('jie', 'je')
        if 'しぇ' in h: r = r.replace('shie', 'she')
        if 'ちぇ' in h: r = r.replace('chie', 'che')
        if 'せぁ' in h: r = r.replace('sea', 'sexa')
        if 'せぃ' in h: r = r.replace('sei', 'sexi')
        if 'せぅ' in h: r = r.replace('seu', 'sexu')
        if 'せぇ' in h: r = r.replace('see', 'sexe')
        if 'せぉ' in h: r = r.replace('seo', 'sexo')
        
        hiragana += h
        romaji += r
    
    # romaji may need some cleanup for typing game
    romaji = romaji.replace(" ", "")
    hiragana = hiragana.replace(" ", "")
    
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
    return FileResponse(os.path.join(PAGES_DIR, "index.html"))

@app.get("/{page}.html")
def serve_html(page: str):
    path = os.path.join(PAGES_DIR, f"{page}.html")
    if os.path.exists(path):
        return FileResponse(path)
    raise HTTPException(status_code=404, detail="페이지를 찾을 수 없습니다.")

STATIC_FILE_PATHS = {
    "style.css": os.path.join(STATIC_DIR, "css", "style.css"),
    "typing.css": os.path.join(STATIC_DIR, "css", "typing.css"),
    "script.js": os.path.join(STATIC_DIR, "js", "script.js"),
    "quiz.js": os.path.join(STATIC_DIR, "js", "quiz.js"),
    "ranking.js": os.path.join(STATIC_DIR, "js", "ranking.js"),
    "navbar.js": os.path.join(STATIC_DIR, "js", "navbar.js"),
    "hero-bg.jpg": os.path.join(STATIC_DIR, "images", "hero-bg.jpg"),
}

for filename, file_path in STATIC_FILE_PATHS.items():
    @app.get(f"/{filename}")
    def serve_static(path: str = file_path):
        return FileResponse(path)
