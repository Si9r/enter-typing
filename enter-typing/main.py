from contextlib import asynccontextmanager
from urllib.parse import urlparse

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

import models
from database import engine
from routers import auth, battle, convert, pages, profile, quiz_content, ranking, typing_content, typo_stats

# 새 테이블만 자동 생성한다. 기존 테이블의 컬럼 변경/삭제는 `python migrate.py` 로 수동 실행한다.
models.Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


# 운영 환경에서 API 명세를 공개하지 않는다.
app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)


@app.middleware("http")
async def csrf_origin_check(request: Request, call_next):
    # 쿠키 인증이므로 다른 사이트에서 온 상태 변경 요청(CSRF)을 Origin/Referer 로 한 번 더 차단한다.
    # (SameSite=Lax 쿠키가 1차 방어. 브라우저가 아닌 클라이언트는 Origin 이 없으므로 통과.)
    if request.method not in ("GET", "HEAD", "OPTIONS"):
        source = request.headers.get("origin") or request.headers.get("referer")
        if source and urlparse(source).netloc != request.headers.get("host"):
            return JSONResponse(status_code=403, content={"detail": "허용되지 않은 요청 출처입니다."})
    return await call_next(request)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    if request.headers.get("x-forwarded-proto") == "https":
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000")
    return response


# ── 정적 파일 서빙 ─────────────────────────────────────────
app.mount("/assets", StaticFiles(directory="assets"), name="assets")
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
