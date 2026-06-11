from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Text, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

# 1. 회원 정보 테이블
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    nickname = Column(String(50), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # 관계 설정 (한 유저가 여러 기록을 가질 수 있음)
    attendances = relationship("Attendance", back_populates="user", cascade="all, delete-orphan")
    typing_histories = relationship("TypingHistory", back_populates="user", cascade="all, delete-orphan")
    quiz_histories = relationship("QuizHistory", back_populates="user", cascade="all, delete-orphan")
    typo_stats = relationship("TypoStat", back_populates="user", cascade="all, delete-orphan")

# 2. 출석체크 테이블
class Attendance(Base):
    __tablename__ = "attendances"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    attend_date = Column(String(10), nullable=False, index=True) # "YYYY-MM-DD" 형식으로 저장
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="attendances")

# 3. 타이핑 게임 기록 테이블
class TypingHistory(Base):
    __tablename__ = "typing_histories"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content_title = Column(String(255), nullable=False)
    genre = Column(String(50), nullable=False)
    wpm = Column(Integer, nullable=False)
    accuracy = Column(Float, nullable=False)
    played_at = Column(DateTime(timezone=True), server_default=func.now())
    content_id = Column(Integer, ForeignKey("typing_contents.id"), nullable=True) # 어떤 곡을 타이핑했는지 식별

    user = relationship("User", back_populates="typing_histories")
    typing_content = relationship("TypingContent")

# 4. 퀴즈 게임 기록 테이블
class QuizHistory(Base):
    __tablename__ = "quiz_histories"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    quiz_category = Column(String(50), nullable=False)
    score = Column(Integer, nullable=False)
    total_questions = Column(Integer, nullable=False)
    played_at = Column(DateTime(timezone=True), server_default=func.now())
    quiz_id = Column(Integer, ForeignKey("quizzes.id"), nullable=True) # 어떤 퀴즈를 풀었는지 식별

    user = relationship("User", back_populates="quiz_histories")
    quiz = relationship("Quiz")

# 5. 오타 분석 테이블
class TypoStat(Base):
    __tablename__ = "typo_stats"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    character_typed = Column(String(10), nullable=False)
    error_count = Column(Integer, default=0)
    total_count = Column(Integer, default=0)

    user = relationship("User", back_populates="typo_stats")

# 6. 타이핑 콘텐츠 (가사/명대사 등) 테이블
class TypingContent(Base):
    __tablename__ = "typing_contents"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    artist = Column(String(255), nullable=True)
    genre = Column(String(50), nullable=False)
    description = Column(Text, nullable=True)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    youtube_id = Column(String(50), nullable=True)
    lyrics = Column(Text, nullable=False)
    hiragana = Column(Text, nullable=False)
    romaji = Column(Text, nullable=False)
    timestamps = Column(Text, nullable=True)
    difficulty = Column(Integer, default=3, nullable=False)
    play_count = Column(Integer, default=0, nullable=False)
    best_time = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    creator = relationship("User")

# 7. 퀴즈 기본 정보 테이블 (Quiz)
class Quiz(Base):
    __tablename__ = "quizzes"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(50), nullable=False, default="J-POP")
    difficulty = Column(Integer, default=3, nullable=False)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    creator = relationship("User")
    questions = relationship("QuizQuestion", back_populates="quiz", cascade="all, delete-orphan")

# 8. 퀴즈 개별 문제 테이블 (QuizQuestion)
class QuizQuestion(Base):
    __tablename__ = "quiz_questions"

    id = Column(Integer, primary_key=True, index=True)
    quiz_id = Column(Integer, ForeignKey("quizzes.id"), nullable=False)
    question_number = Column(Integer, nullable=False)
    question_text = Column(Text, nullable=False)
    youtube_url = Column(String(255), nullable=True)
    start_time = Column(Integer, nullable=True)
    end_time = Column(Integer, nullable=True)
    answer = Column(String(255), nullable=False)
    alternative_answers = Column(String(255), nullable=True)
    hint = Column(Text, nullable=True)

    quiz = relationship("Quiz", back_populates="questions")

