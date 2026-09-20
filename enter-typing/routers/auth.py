import json
import logging
import os
import re
import secrets
import time
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, Response, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models
from core import rate_limit
from core.redis_client import sync_redis_client
from core.security import (
    clear_session_cookie, create_access_token, get_current_user, get_password_hash, is_admin,
    set_session_cookie, verify_password,
)
from database import get_db
from services.email_service import generate_code, generate_temp_password, send_email
from core.config import CODE_EXPIRE_SECONDS

router = APIRouter(prefix="/api", tags=["auth"])
logger = logging.getLogger(__name__)

MAX_VERIFY_ATTEMPTS = 5

EMAIL_REGEX = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')


def validate_email(email: str):
    if not EMAIL_REGEX.match(email):
        raise HTTPException(status_code=422, detail="올바른 이메일 형식이 아닙니다.")


# ════════════════════════════════════════════════════════════
# 요청 모델
# ════════════════════════════════════════════════════════════
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


# ════════════════════════════════════════════════════════════
# API: 이미지 업로드
# POST /api/upload-image
# ════════════════════════════════════════════════════════════
MAX_UPLOAD_BYTES = 2 * 1024 * 1024  # 2MB
# 확장자 → 파일 시그니처. 클라이언트가 보낸 content-type/파일명은 신뢰하지 않는다. (SVG/HTML 업로드 차단)
_IMAGE_SIGNATURES = {
    "png": (b"\x89PNG\r\n\x1a\n",),
    "jpg": (b"\xff\xd8\xff",),
    "jpeg": (b"\xff\xd8\xff",),
    "gif": (b"GIF87a", b"GIF89a"),
    "webp": (b"RIFF",),
}


@router.post("/upload-image")
def upload_image(
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user),
):
    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else ""
    signatures = _IMAGE_SIGNATURES.get(ext)
    if not signatures:
        raise HTTPException(status_code=400, detail="png, jpg, gif, webp 이미지만 업로드 가능합니다.")

    data = file.file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="이미지는 2MB 이하만 업로드 가능합니다.")
    if not data.startswith(signatures) or (ext == "webp" and data[8:12] != b"WEBP"):
        raise HTTPException(status_code=400, detail="올바른 이미지 파일이 아닙니다.")

    filename = f"{uuid.uuid4()}.{ext}"
    filepath = os.path.join("assets", "thumbnails", filename)
    os.makedirs(os.path.dirname(filepath), exist_ok=True)

    try:
        with open(filepath, "wb") as buffer:
            buffer.write(data)
    except Exception:
        logger.exception("이미지 업로드 실패")
        raise HTTPException(status_code=500, detail="파일 업로드에 실패했습니다.")

    return {"success": True, "url": f"/assets/thumbnails/{filename}"}


# ════════════════════════════════════════════════════════════
# API: 회원가입
# POST /api/signup
# ════════════════════════════════════════════════════════════
@router.post("/signup")
def signup(req: SignupRequest, db: Session = Depends(get_db)):
    validate_email(req.email)

    if len(req.nickname.strip()) < 2 or len(req.nickname.strip()) > 12:
        raise HTTPException(status_code=400, detail="닉네임은 2자 이상 12자 이하로 입력해주세요.")

    if len(req.password) < 8:
        raise HTTPException(status_code=400, detail="비밀번호는 8자 이상이어야 합니다.")

    existing_user = db.query(models.User).filter(models.User.email == req.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="이미 가입된 이메일입니다.")

    existing_nickname = db.query(models.User).filter(models.User.nickname == req.nickname).first()
    if existing_nickname:
        raise HTTPException(status_code=400, detail="이미 사용 중인 닉네임입니다.")

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
@router.post("/send-verification-code")
def send_verification_code(req: EmailRequest, request: Request, db: Session = Depends(get_db)):
    validate_email(req.email)
    rate_limit.hit(f"sendcode:email:{req.email}", 1, 60, "인증번호는 1분에 한 번만 요청할 수 있습니다.")
    rate_limit.hit(f"sendcode:ip:{rate_limit.client_ip(request)}", 10, 3600)

    user = db.query(models.User).filter(models.User.email == req.email).first()
    if not user:
        raise HTTPException(status_code=400, detail="가입되지 않은 이메일입니다.")

    code = generate_code()

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
    except Exception:
        logger.exception("인증번호 이메일 발송 실패")
        raise HTTPException(status_code=500, detail="이메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요.")

    return {"success": True, "message": "인증번호가 발송되었습니다."}


# ════════════════════════════════════════════════════════════
# API: 인증번호 검증
# POST /api/verify-code
# ════════════════════════════════════════════════════════════
@router.post("/verify-code")
def verify_code(req: VerifyRequest, request: Request, db: Session = Depends(get_db)):
    validate_email(req.email)
    rate_limit.hit(f"verify:ip:{rate_limit.client_ip(request)}", 30, 3600)
    raw = sync_redis_client.get(f"verification:{req.email}")

    if not raw:
        raise HTTPException(status_code=400, detail="인증 요청 내역이 없거나 만료되었습니다. 다시 시도해주세요.")

    entry = json.loads(raw)

    if entry.get("verified") or not secrets.compare_digest(str(entry.get("code", "")), req.code.strip()):
        # 인증번호당 시도 횟수를 제한한다. 초과하면 인증번호를 폐기해 무차별 대입을 막는다.
        attempt_key = f"verify:email:{req.email}"
        try:
            rate_limit.hit(attempt_key, MAX_VERIFY_ATTEMPTS, CODE_EXPIRE_SECONDS)
        except HTTPException:
            sync_redis_client.delete(f"verification:{req.email}")
            rate_limit.clear(attempt_key)
            raise HTTPException(status_code=400, detail="인증 시도 횟수를 초과했습니다. 인증번호를 다시 요청해주세요.")
        raise HTTPException(status_code=400, detail="인증번호가 올바르지 않습니다.")
    rate_limit.clear(f"verify:email:{req.email}")

    # 검증 성공 → 임시 비밀번호 발급
    # Redis 에는 해시만 보관하고, 실제 비밀번호(DB)는 임시 비밀번호로 로그인해 변경할 때까지 건드리지 않는다.
    temp_pw = generate_temp_password()
    entry["verified"] = True
    entry["temp_password_hash"] = get_password_hash(temp_pw)
    entry.pop("code", None)

    # 임시 비밀번호 로그인을 위해 5분간 유지
    sync_redis_client.set(f"verification:{req.email}", json.dumps(entry), ex=300)

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
    except Exception:
        logger.exception("임시 비밀번호 이메일 발송 실패")
        raise HTTPException(status_code=500, detail="임시 비밀번호 발송에 실패했습니다. 잠시 후 다시 시도해주세요.")

    return {"success": True, "message": "임시 비밀번호가 발송되었습니다."}


# ════════════════════════════════════════════════════════════
# API: 비밀번호 변경
# POST /api/change-password
# ════════════════════════════════════════════════════════════
@router.post("/change-password")
def change_password(req: ChangePasswordRequest, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    validate_email(req.email)

    # 로그인 토큰(임시 비밀번호 로그인 포함)으로만 변경할 수 있다.
    # 이메일만으로 변경하는 경로는 인증 직후 누구나 계정을 가로챌 수 있어 제거했다.
    if current_user.email != req.email:
        raise HTTPException(status_code=403, detail="본인 계정의 비밀번호만 변경할 수 있습니다.")
    user = current_user

    if len(req.new_password) < 8:
        raise HTTPException(status_code=400, detail="비밀번호는 8자 이상이어야 합니다.")

    user.password_hash = get_password_hash(req.new_password)
    db.commit()

    sync_redis_client.delete(f"verification:{req.email}")

    return {"success": True, "message": "비밀번호가 변경되었습니다."}


# ════════════════════════════════════════════════════════════
# API: 닉네임 변경
# POST /api/change-nickname
# ════════════════════════════════════════════════════════════
@router.post("/change-nickname")
def change_nickname(req: ChangeNicknameRequest, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):

    nickname_strip = req.new_nickname.strip()
    if len(nickname_strip) < 2 or len(nickname_strip) > 12:
        raise HTTPException(status_code=400, detail="닉네임은 2자 이상 12자 이하로 입력해주세요.")

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
@router.delete("/delete-account")
def delete_account(req: DeleteAccountRequest, response: Response, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    validate_email(req.email)

    if current_user.email != req.email:
        raise HTTPException(status_code=403, detail="본인 계정만 탈퇴할 수 있습니다.")

    if not verify_password(req.password, current_user.password_hash):
        raise HTTPException(status_code=401, detail="비밀번호가 올바르지 않습니다.")

    db.delete(current_user)
    db.commit()

    sync_redis_client.delete(f"verification:{req.email}")
    clear_session_cookie(response)

    return {"success": True, "message": "회원 탈퇴가 완료되었습니다."}


# ════════════════════════════════════════════════════════════
# API: 로그인
# POST /api/login
# ════════════════════════════════════════════════════════════
@router.post("/login")
def login(req: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    validate_email(req.email)
    ip = rate_limit.client_ip(request)
    rate_limit.hit(f"login:ip:{ip}", 30, 600, "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.")
    rate_limit.hit(f"login:email:{req.email}", 10, 600, "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.")

    user = db.query(models.User).filter(models.User.email == req.email).first()
    if not user:
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 일치하지 않습니다.")

    raw = sync_redis_client.get(f"verification:{req.email}")
    is_temp_login = False
    if raw:
        entry = json.loads(raw)
        if entry.get("verified") and entry.get("temp_password_hash"):
            if verify_password(req.password, entry["temp_password_hash"]):
                is_temp_login = True
                # 임시 비밀번호는 1회용이다.
                sync_redis_client.delete(f"verification:{req.email}")

    if not is_temp_login:
        if not verify_password(req.password, user.password_hash):
            raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 일치하지 않습니다.")

    # 토큰은 응답 본문이 아니라 HttpOnly 쿠키로만 전달한다.
    set_session_cookie(response, request, create_access_token(user.email))

    return {
        "success": True,
        "requires_password_change": is_temp_login,
        "id": user.id,
        "nickname": user.nickname,
        "email": user.email,
        "is_admin": is_admin(user),
        "message": "로그인 성공"
    }


# ════════════════════════════════════════════════════════════
# API: 로그아웃 / 세션 확인
# POST /api/logout, GET /api/me
# ════════════════════════════════════════════════════════════
@router.post("/logout")
def logout(response: Response):
    clear_session_cookie(response)
    return {"success": True}


@router.get("/me")
def me(current_user: models.User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "nickname": current_user.nickname,
        "is_admin": is_admin(current_user),
    }


# ════════════════════════════════════════════════════════════
# API: 이메일 중복 체크
# GET /api/check-email
# ════════════════════════════════════════════════════════════
@router.get("/check-email")
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
@router.get("/check-nickname")
def check_nickname(nickname: str, db: Session = Depends(get_db)):
    nickname_strip = nickname.strip()
    if len(nickname_strip) < 2 or len(nickname_strip) > 12:
        raise HTTPException(status_code=400, detail="닉네임은 2자 이상 12자 이하로 입력해주세요.")

    existing_nickname = db.query(models.User).filter(models.User.nickname == nickname_strip).first()
    if existing_nickname:
        return {"exists": True, "message": "이미 사용 중인 닉네임입니다."}
    return {"exists": False, "message": "사용 가능한 닉네임입니다."}


# ════════════════════════════════════════════════════════════
# API: 출석 데이터 가져오기 / 등록
# GET, POST /api/attendance
# ════════════════════════════════════════════════════════════
@router.get("/attendance")
def get_attendance(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    records = db.query(models.Attendance).filter(models.Attendance.user_id == current_user.id).all()
    dates = [r.attend_date for r in records]
    return {"success": True, "dates": dates}


@router.post("/attendance")
def do_attendance(req: AttendanceRequest, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    existing = db.query(models.Attendance).filter(
        models.Attendance.user_id == current_user.id,
        models.Attendance.attend_date == req.date
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="이미 오늘 출석체크를 완료하셨습니다.")

    new_attendance = models.Attendance(
        user_id=current_user.id,
        attend_date=req.date
    )
    db.add(new_attendance)
    db.commit()

    return {"success": True, "message": "출석체크가 성공적으로 완료되었습니다!"}
