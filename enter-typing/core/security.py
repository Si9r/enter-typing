import time

import bcrypt
from fastapi import Depends, Header, HTTPException
from jose import JWTError, jwt
from sqlalchemy.orm import Session

import models
from core.config import ALGORITHM, SECRET_KEY
from database import get_db


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


# 관리자 권한: id가 한 자리 수(1~9)인 유저에게만 부여 (그 외에는 일절 부여하지 않음)
def is_admin(user: models.User) -> bool:
    return 1 <= user.id <= 9


# 비밀번호 해시를 위한 설정 (bcrypt 직접 사용)
def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
