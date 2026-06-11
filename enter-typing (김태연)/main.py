from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import smtplib
import random
import string
import os
import re
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv
import time
import re
from sqlalchemy.orm import Session
from database import engine, get_db, SessionLocal
import models
import bcrypt
from jose import jwt, JWTError
import pykakasi
import yt_dlp

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

@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return FileResponse("assets/logo_icon.png")


@app.on_event("startup")
def startup_event():
    db = SessionLocal()
    if db.query(models.TypingContent).count() < 4:
        # 기존 데이터 삭제 (중복 방지용 초기화)
        db.query(models.TypingContent).delete()
        
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

    # 시드 퀴즈 데이터 정의
    seed_quizzes = [
        {
            "title": "클릭으로 노래 맞히기 — YOASOBI",
            "description": "YOASOBI의 어디서 들어본 이 노래일까요? 유튜브 소리를 듣고 노래 제목을 맞춰보세요!",
            "category": "제목맞추기",
            "questions_data": [
                { "question_number": 1, "question_text": "이 노래의 제목은?", "youtube_url": "https://www.youtube.com/watch?v=dy90tA3TT1c", "start_time": 50, "end_time": 55, "answer": "怪物", "alternative_answers": "かいぶつ,カイブツ,monster,kaibutsu", "hint": "2021년 애니메이션 《비스타즈》 시즌 2 OP" },
                { "question_number": 2, "question_text": "이 노래의 제목은?", "youtube_url": "https://www.youtube.com/watch?v=ZRtdQ81jPUQ", "start_time": 60, "end_time": 65, "answer": "アイドル", "alternative_answers": "あいる,idol,aidoru", "hint": "2023년 애니메이션 《최애의 아이》 OP" },
                { "question_number": 3, "question_text": "이 노래의 제목은?", "youtube_url": "https://www.youtube.com/watch?v=Y4nEEZwckuU", "start_time": 45, "end_time": 50, "answer": "群青", "alternative_answers": "ぐんじょう,グンジョウ,gunjou,gunjyo", "hint": "'好き'를 전하지 못한 이야기" },
                { "question_number": 4, "question_text": "이 노래의 제목은?", "youtube_url": "https://www.youtube.com/watch?v=kzdJkT4kp-A", "start_time": 48, "end_time": 53, "answer": "ハルジオン", "alternative_answers": "はるじおん,harujion,haruzione", "hint": "봄에 피는 흰 들꽃 이름" },
                { "question_number": 5, "question_text": "이 노래의 제목은?", "youtube_url": "https://www.youtube.com/watch?v=x8VYWazR5mE", "start_time": 34, "end_time": 39, "answer": "夜に駆ける", "alternative_answers": "よるにかける,ヨルニカケル,yorunikakeru", "hint": "YOASOBI 데뷔곡이자 최고 히트곡" }
            ]
        },
        {
            "title": "애니메이션 OST 제목 맞추기",
            "description": "귀멸의 칼날, 주술회전 등 인기 애니 OST 제목을 맞혀보세요!",
            "category": "제목맞추기",
            "questions_data": [
                { "question_number": 1, "question_text": "준비 중인 문제입니다.", "youtube_url": "https://www.youtube.com/watch?v=dy90tA3TT1c", "start_time": 0, "end_time": 5, "answer": "준비중", "alternative_answers": "", "hint": "아직 문제가 없습니다." }
            ]
        },
        {
            "title": "요네즈 켄시 한자 제목 읽기 (후리가나 퀴즈)",
            "description": "요네즈 켄시의 명곡 중 '한자'로 된 제목의 노래를 듣고, 어떻게 읽는지(히라가나/로마자) 정답을 맞혀보세요! (예: 漢字 -> かんじ)",
            "category": "가사퀴즈",
            "questions_data": [
                { "question_number": 1, "question_text": "이 노래(地球儀)의 후리가나는?", "youtube_url": "https://www.youtube.com/watch?v=VUsURj_OYdA", "start_time": 65, "end_time": 70, "answer": "ちきゅうぎ", "alternative_answers": "地球儀,chikyugi", "hint": "지구본 (애니 '그대들은 어떻게 살 것인가' 주제곡)" },
                { "question_number": 2, "question_text": "이 노래(春雷)의 후리가나는?", "youtube_url": "https://www.youtube.com/watch?v=zkNzxsaCunU", "start_time": 64, "end_time": 69, "answer": "しゅんらい", "alternative_answers": "春雷,shunrai", "hint": "봄철의 우레 (춘뢰)" },
                { "question_number": 3, "question_text": "이 노래(感電)의 후리가나는?", "youtube_url": "https://www.youtube.com/watch?v=UFQEttrn6CQ", "start_time": 86, "end_time": 91, "answer": "かんでん", "alternative_answers": "感電,kanden", "hint": "감전 (드라마 'MIU404' 주제곡)" },
                { "question_number": 4, "question_text": "이 노래(海の幽霊)의 후리가나는?", "youtube_url": "https://www.youtube.com/watch?v=1s84rIhPuhk", "start_time": 73, "end_time": 78, "answer": "うみのゆうれい", "alternative_answers": "海の幽霊,uminoyurei,uminoyourei", "hint": "바다의 유령 (애니 '해수의 아이' 주제곡)" },
                { "question_number": 5, "question_text": "이 노래(打上花火)의 후리가나는?", "youtube_url": "https://www.youtube.com/watch?v=-tKVN2mAKRI", "start_time": 65, "end_time": 70, "answer": "うちあげはなび", "alternative_answers": "打上花火,uchiagehanabi", "hint": "쏘아올린 불꽃" }
            ]
        },
        {
            "title": "초인기 J-POP 가사 빈칸 채우기",
            "description": "일본에서 가장 유명한 메가 히트곡 10곡! 노래를 듣고 다음 빈칸에 들어갈 가사(히라가나/로마자)를 맞춰보세요.",
            "category": "가사퀴즈",
            "questions_data": [
                { "question_number": 1, "question_text": "誰もが目を奪われていく君は完璧で究極の [ ____ ]", "youtube_url": "https://www.youtube.com/watch?v=ZRtdQ81jPUQ", "start_time": 79, "end_time": 84, "answer": "アイドル", "alternative_answers": "あいる,aidoru", "hint": "YOASOBI - 아**** (공식 MV)" },
                { "question_number": 2, "question_text": "夢ならばどれほどよかったでしょう 未だにあなたのことを [ ____ ]", "youtube_url": "https://www.youtube.com/watch?v=SX_ViT4Ra7k", "start_time": 64, "end_time": 71, "answer": "ゆめにみる", "alternative_answers": "夢にみる,yumenimiru", "hint": "Kenshi Yonezu - 꿈에 본다 (공식 MV)" },
                { "question_number": 3, "question_text": "麦わらの帽子の君が 揺れたマリーゴールドに [ ____ ]", "youtube_url": "https://www.youtube.com/watch?v=0xSiBpUdW4E", "start_time": 65, "end_time": 73, "answer": "にてる", "alternative_answers": "似てる,niteru", "hint": "Aimyon - 닮았어 (공식 MV)" },
                { "question_number": 4, "question_text": "声も顔も不器用なとこも 全部全部 [ ____ ]", "youtube_url": "https://www.youtube.com/watch?v=aRQdl694VOA", "start_time": 80, "end_time": 86, "answer": "きらいじゃないの", "alternative_answers": "嫌いじゃないの,kiraijanaino", "hint": "Yuuri - 싫지 않은걸 (공식 MV)" },
                { "question_number": 5, "question_text": "はぁ？うっせぇうっせぇうっせぇわ あなたが思うより [ ____ ]", "youtube_url": "https://www.youtube.com/watch?v=Qp3b-RXtz4w", "start_time": 66, "end_time": 71, "answer": "けんこうです", "alternative_answers": "健康です,kenkoudesu", "hint": "Ado - 건강합니다 (공식 MV)" },
                { "question_number": 6, "question_text": "胸の中に 刻む [ ____ ]", "youtube_url": "https://www.youtube.com/watch?v=jhOVibLEDhA", "start_time": 75, "end_time": 80, "answer": "いきのおと", "alternative_answers": "息の音,ikinooto", "hint": "Hoshino Gen - 숨소리 (공식 MV)" },
                { "question_number": 7, "question_text": "垂れ流しのテレビの音 溜めてしまった洗濯物は [ ____ ]", "youtube_url": "https://www.youtube.com/watch?v=mp2-w15SXms", "start_time": 60, "end_time": 66, "answer": "あしたにしよう", "alternative_answers": "明日にしよう,ashitanishiyou", "hint": "Tani Yuuki - 내일로 하자 (공식 가사 영상)" },
                { "question_number": 8, "question_text": "君の運命のヒトは [ ____ ]", "youtube_url": "https://www.youtube.com/watch?v=DQSAq-Uu_F8", "start_time": 65, "end_time": 68, "answer": "ぼくじゃない", "alternative_answers": "僕じゃない,bokujanai", "hint": "Official Hige Dandism - 내가 아니야" },
                { "question_number": 9, "question_text": "思い出すのは 君の歌 [ ____ ]", "youtube_url": "https://www.youtube.com/watch?v=GDtH6A7w0mQ", "start_time": 61, "end_time": 65, "answer": "うたって", "alternative_answers": "歌って,utatte", "hint": "Vaundy - 노래해" },
                { "question_number": 10, "question_text": "君の前前前世から僕は 君を [ ____ ]", "youtube_url": "https://www.youtube.com/watch?v=PDSkFeMVNFs", "start_time": 65, "end_time": 70, "answer": "さがしていたよ", "alternative_answers": "探していたよ,sagashiteitayo", "hint": "RADWIMPS - 찾고 있었어 (공식 MV)" }
            ]
        }
    ]

    # 시드 데이터 일괄 추가 및 업데이트
    for seed in seed_quizzes:
        existing = db.query(models.Quiz).filter(models.Quiz.title == seed["title"]).first()
        if not existing:
            new_quiz = models.Quiz(
                title=seed["title"],
                description=seed["description"],
                category=seed["category"],
                creator_id=None
            )
            db.add(new_quiz)
            db.flush()
            
            for q in seed["questions_data"]:
                new_q = models.QuizQuestion(
                    quiz_id=new_quiz.id,
                    **q
                )
                db.add(new_q)
        else:
            # 이미 존재하면 메타 정보(설명, 카테고리)만 최신화
            # ※ 질문(questions)은 덮어쓰지 않음 → 사용자가 편집한 내용 유지
            existing.description = seed["description"]
            existing.category = seed["category"]
            # 질문이 하나도 없는 경우(비어있을 때)만 시드 데이터로 채움
            if not db.query(models.QuizQuestion).filter(models.QuizQuestion.quiz_id == existing.id).first():
                for q in seed["questions_data"]:
                    new_q = models.QuizQuestion(
                        quiz_id=existing.id,
                        **q
                    )
                    db.add(new_q)
    
    db.commit()
    db.close()

# ── 정적 파일 서빙 ─────────────────────────────────────────
app.mount("/assets", StaticFiles(directory="assets"), name="assets")

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

class ConvertRequest(BaseModel):
    text: str

class QuizQuestionCreate(BaseModel):
    question_number: int
    question_text: str
    youtube_url: str | None = None
    start_time: int | None = None
    end_time: int | None = None
    answer: str
    alternative_answers: str | None = None
    hint: str | None = None

class QuizCreate(BaseModel):
    title: str
    description: str | None = None
    category: str = "제목맞추기"
    difficulty: int = 3
    questions: list[QuizQuestionCreate]

class QuizHistoryCreate(BaseModel):
    quiz_category: str
    score: int
    total_questions: int

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
# API: 내 퀴즈 콘텐츠 목록 가져오기
# GET /api/my-quizzes
# ════════════════════════════════════════════════════════════
@app.get("/api/my-quizzes")
def get_my_quizzes(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    quizzes = db.query(models.Quiz).filter(models.Quiz.creator_id == current_user.id).all()
    result = []
    for quiz in quizzes:
        result.append({
            "id": quiz.id,
            "title": quiz.title,
            "description": quiz.description,
            "category": quiz.category,
            "difficulty": quiz.difficulty,
            "question_count": len(quiz.questions) if quiz.questions else 0,
            "created_at": str(quiz.created_at)
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
def delete_typing_content(content_id: int, db: Session = Depends(get_db)):
    content = db.query(models.TypingContent).filter(models.TypingContent.id == content_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="콘텐츠를 찾을 수 없습니다.")
    
    # 임시 관리자 모드: 작성자 권한 체크를 무시하고 모두 삭제 허용
    # if content.creator_id != current_user.id:
    #     raise HTTPException(status_code=403, detail="삭제 권한이 없습니다.")
        
    # 연관된 히스토리 기록 먼저 삭제 (외래 키 제약 조건 방지)
    db.query(models.TypingHistory).filter(models.TypingHistory.content_id == content_id).delete()
    
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

# ════════════════════════════════════════════════════════════
# API: 퀴즈 추가 (Quiz Create)
# POST /api/quizzes
# ════════════════════════════════════════════════════════════
@app.post("/api/quizzes")
def create_quiz(req: QuizCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if len(req.questions) not in [1, 5, 10, 15]:
        raise HTTPException(status_code=400, detail="문제 수는 1개, 5개, 10개, 또는 15개여야 합니다.")

    new_quiz = models.Quiz(
        title=req.title,
        description=req.description,
        category=req.category,
        difficulty=req.difficulty,
        creator_id=current_user.id
    )
    db.add(new_quiz)
    db.flush()
    
    for q in req.questions:
        if re.search(r'[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]', q.answer):
            raise HTTPException(status_code=400, detail="정답에 한국어를 사용할 수 없습니다. 일본어 또는 영어로 입력해주세요.")
        if q.alternative_answers and re.search(r'[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]', q.alternative_answers):
            raise HTTPException(status_code=400, detail="복수 정답에 한국어를 사용할 수 없습니다. 일본어 또는 영어로 입력해주세요.")
            
        new_q = models.QuizQuestion(
            quiz_id=new_quiz.id,
            question_number=q.question_number,
            question_text=q.question_text,
            youtube_url=q.youtube_url,
            start_time=q.start_time,
            end_time=q.end_time,
            answer=q.answer,
            alternative_answers=q.alternative_answers,
            hint=q.hint
        )
        db.add(new_q)

    db.commit()
    db.refresh(new_quiz)
    return {"success": True, "message": "퀴즈가 성공적으로 생성되었습니다.", "quiz_id": new_quiz.id}

# ════════════════════════════════════════════════════════════
# API: 퀴즈 목록 가져오기
# GET /api/quizzes
# ════════════════════════════════════════════════════════════
@app.get("/api/quizzes")
def get_all_quizzes(db: Session = Depends(get_db)):
    quizzes = db.query(models.Quiz).all()
    result = []
    for quiz in quizzes:
        result.append({
            "id": quiz.id,
            "title": quiz.title,
            "description": quiz.description,
            "category": quiz.category,
            "difficulty": quiz.difficulty,
            "creator_nickname": quiz.creator.nickname if quiz.creator else "엔터핑",
            "question_count": len(quiz.questions) if quiz.questions else 0,
            "created_at": str(quiz.created_at)
        })
    return {"success": True, "data": result}

# ════════════════════════════════════════════════════════════
# API: 퀴즈 수정 (Quiz Update)
# PUT /api/quizzes/{quiz_id}
# ════════════════════════════════════════════════════════════
@app.put("/api/quizzes/{quiz_id}")
def update_quiz(quiz_id: int, req: QuizCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    quiz = db.query(models.Quiz).filter(models.Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="퀴즈를 찾을 수 없습니다.")
    
    if quiz.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="수정 권한이 없습니다.")

    quiz.title = req.title
    quiz.description = req.description
    quiz.category = req.category
    quiz.difficulty = req.difficulty
    
    # 기존 문제들 삭제
    db.query(models.QuizQuestion).filter(models.QuizQuestion.quiz_id == quiz_id).delete()
    db.flush()

    # 새 문제 추가
    for q in req.questions:
        if re.search(r'[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]', q.answer):
            raise HTTPException(status_code=400, detail="정답에 한국어를 사용할 수 없습니다. 일본어 또는 영어로 입력해주세요.")
        if q.alternative_answers and re.search(r'[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]', q.alternative_answers):
            raise HTTPException(status_code=400, detail="복수 정답에 한국어를 사용할 수 없습니다. 일본어 또는 영어로 입력해주세요.")
            
        new_q = models.QuizQuestion(
            quiz_id=quiz.id,
            question_number=q.question_number,
            question_text=q.question_text,
            youtube_url=q.youtube_url,
            start_time=q.start_time,
            end_time=q.end_time,
            answer=q.answer,
            alternative_answers=q.alternative_answers,
            hint=q.hint
        )
        db.add(new_q)

    db.commit()
    return {"success": True, "message": "퀴즈가 수정되었습니다."}

# ════════════════════════════════════════════════════════════
# API: 퀴즈 상세 조회 (포함 전체 문제)
# GET /api/quizzes/{quiz_id}
# ════════════════════════════════════════════════════════════
@app.get("/api/quizzes/{quiz_id}")
def get_quiz(quiz_id: int, db: Session = Depends(get_db)):
    quiz = db.query(models.Quiz).filter(models.Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="퀴즈를 찾을 수 없습니다.")

    questions_data = []
    for q in sorted(quiz.questions, key=lambda x: x.question_number):
        questions_data.append({
            "id": q.id,
            "question_number": q.question_number,
            "question_text": q.question_text,
            "youtube_url": q.youtube_url,
            "start_time": q.start_time,
            "end_time": q.end_time,
            "answer": q.answer,
            "alternative_answers": q.alternative_answers,
            "hint": q.hint
        })

    return {
        "success": True,
        "id": quiz.id,
        "title": quiz.title,
        "description": quiz.description,
        "category": quiz.category,
        "difficulty": quiz.difficulty,
        "creator_nickname": quiz.creator.nickname if quiz.creator else "엔터핑",
        "question_count": len(questions_data),
        "questions": questions_data
    }

# ════════════════════════════════════════════════════════════
# API: 퀴즈 삭제
# DELETE /api/quizzes/{quiz_id}
# ════════════════════════════════════════════════════════════
@app.delete("/api/quizzes/{quiz_id}")
def delete_quiz(quiz_id: int, db: Session = Depends(get_db)):
    quiz = db.query(models.Quiz).filter(models.Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="퀴즈를 찾을 수 없습니다.")
    
    # 임시 관리자 모드: 작성자 권한 체크를 무시하고 모두 삭제 허용
    # if quiz.creator_id != current_user.id:
    #     raise HTTPException(status_code=403, detail="삭제 권한이 없습니다.")
        
    # 연관된 히스토리 기록 먼저 삭제 (외래 키 제약 조건 방지)
    db.query(models.QuizHistory).filter(models.QuizHistory.quiz_id == quiz_id).delete()
    
    db.delete(quiz)
    db.commit()
    return {"success": True, "message": "퀴즈가 삭제되었습니다."}

# ════════════════════════════════════════════════════════════
# API: 퀴즈 점수 저장 (Quiz History)
# POST /api/quiz-history
# ════════════════════════════════════════════════════════════
@app.post("/api/quiz-history")
def save_quiz_history(req: QuizHistoryCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    history = models.QuizHistory(
        user_id=current_user.id,
        quiz_category=req.quiz_category,
        score=req.score,
        total_questions=req.total_questions
    )
    db.add(history)
    db.commit()
    return {"success": True, "message": "점수가 기록되었습니다."}

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
    
    hiragana = ""
    for item in converted:
        hiragana += item['hira']
        
    hiragana = hiragana.replace(" ", "")
    romaji = hiragana_to_romaji(hiragana)
    
    return {"success": True, "hiragana": hiragana, "romaji": romaji}

# ════════════════════════════════════════════════════════════
# API: 유튜브 오디오 스트림 URL 직접 추출 (임베드 차단 우회)
# GET /api/youtube-audio/{video_id}
# ════════════════════════════════════════════════════════════
@app.get("/api/youtube-audio/{video_id}")
def get_youtube_audio_url(video_id: str):
    try:
        ydl_opts = {
            'format': 'bestaudio/best',
            'quiet': True,
            'no_warnings': True,
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
            return {"success": True, "url": info['url']}
    except Exception as e:
        print(f"yt-dlp error: {e}")
        raise HTTPException(status_code=400, detail=f"오디오 추출 실패: {str(e)}")

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

for f in ["style.css", "typing.css", "script.js", "navbar.js", "quiz_engine.js"]:
    @app.get(f"/{f}")
    def serve_static(filename: str = f):
        return FileResponse(filename)

