import re

from fastapi import HTTPException
from pydantic import BaseModel


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

