import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
import redis.asyncio as redis

# .env 파일에서 설정 로드
load_dotenv()

# 환경 변수에서 DB URL 가져오기
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

if not SQLALCHEMY_DATABASE_URL:
    raise ValueError("DATABASE_URL이 .env 파일에 설정되지 않았습니다.")

# MySQL용 DB 엔진 생성
engine = create_engine(SQLALCHEMY_DATABASE_URL)

# 세션 생성기
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 모든 모델의 부모가 될 Base 클래스
Base = declarative_base()

# FastAPI에서 각 요청마다 DB 세션을 생성하고 닫기 위한 의존성 함수
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Redis 연결 풀 설정 (health_check_interval 추가하여 타임아웃 방지)
redis_pool = redis.ConnectionPool.from_url(REDIS_URL, decode_responses=True, health_check_interval=30)

def get_redis() -> redis.Redis:
    return redis.Redis(connection_pool=redis_pool)
