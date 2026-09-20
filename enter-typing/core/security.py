import time

import bcrypt
from fastapi import Depends, HTTPException, Request, Response
from jose import ExpiredSignatureError, JWTError, jwt
from sqlalchemy.orm import Session

import models
from core.config import ALGORITHM, SECRET_KEY
from database import get_db


def create_access_token(email: str) -> str:
    # 24시간 동안 유효한 토큰 생성
    expire = time.time() + (60 * 24 * 60)
    payload = {"sub": email, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


SESSION_COOKIE = "ep_session"
SESSION_MAX_AGE = 60 * 24 * 60  # create_access_token 의 유효기간(24시간)과 동일


def _is_https(request) -> bool:
    return request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https"


def set_session_cookie(response: Response, request: Request, token: str) -> None:
    # JS 에서 읽을 수 없는 HttpOnly 쿠키로 토큰을 전달한다. (XSS 로 토큰이 탈취되지 않도록)
    response.set_cookie(
        SESSION_COOKIE, token,
        max_age=SESSION_MAX_AGE, httponly=True, secure=_is_https(request), samesite="lax", path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE, path="/")


def get_user_from_token(token: str, db: Session) -> models.User:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="인증 세션이 만료되었습니다. 다시 로그인해주세요.")
    except JWTError:
        raise HTTPException(status_code=401, detail="인증 세션이 유효하지 않습니다.")

    email = payload.get("sub")
    if email is None:
        raise HTTPException(status_code=401, detail="인증 정보가 올바르지 않습니다.")

    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="유저를 찾을 수 없습니다.")
    return user


def get_current_user(request: Request, db: Session = Depends(get_db)):
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    return get_user_from_token(token, db)


# 관리자 권한: users.is_admin 컬럼으로 관리한다. (기존 id 1~9 유저는 migrate.py 가 최초 1회 승격시킨다)
def is_admin(user: models.User) -> bool:
    return bool(user.is_admin)


# 비밀번호 해시를 위한 설정 (bcrypt 직접 사용)
def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
