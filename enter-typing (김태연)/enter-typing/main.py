from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

import models
from database import engine, get_db
from routers import auth, battle, convert, pages, profile, quiz_content, ranking, typing_content, typo_stats

# 데이터베이스 테이블 자동 생성
# MySQL에 enterping_db 라는 이름의 데이터베이스 하나만 생성하면 자동으로 컬럼은 생성 됩니다.
models.Base.metadata.create_all(bind=engine)

app = FastAPI()


@app.on_event("startup")
def startup_event():
    db = next(get_db())

    # DB 스키마 업데이트 (퀴즈 썸네일 컬럼)
    try:
        db.execute(text("ALTER TABLE quiz_contents ADD COLUMN thumbnail_url VARCHAR(255) DEFAULT NULL;"))
        db.commit()
    except Exception:
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
app.mount("/css", StaticFiles(directory="css"), name="css")
# 인라인 스크립트에서 뽑아낸 페이지별 JS는 /js/{feature}/{file}.js 로 직접 참조합니다.
app.mount("/js", StaticFiles(directory="js"), name="js")

# ── 기능별 라우터 등록 ────────────────────────────────────
app.include_router(auth.router)
app.include_router(typing_content.router)
app.include_router(quiz_content.router)
app.include_router(ranking.router)
app.include_router(convert.router)
app.include_router(typo_stats.router)
app.include_router(profile.router)
app.include_router(battle.router)
app.include_router(pages.router)  # 페이지 라우팅은 가장 마지막에 등록 (범용 /{page}.html 라우트 포함)
