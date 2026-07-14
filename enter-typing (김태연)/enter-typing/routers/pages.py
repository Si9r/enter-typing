"""정적 HTML/CSS/JS 페이지 라우팅 (클린 URL 포함)."""
import os

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse
from fastapi.templating import Jinja2Templates

router = APIRouter(tags=["pages"])
templates = Jinja2Templates(directory="html")


@router.get("/")
def root():
    return FileResponse("html/index.html")


# 마이페이지는 마크업이 커서 html/partials/ 아래 탭별 조각으로 분리해두고
# Jinja2 {% include %}로 조립한다. 아래 라우트를 범용 /{page}.html 보다
# 먼저 등록해야 그쪽으로 매칭이 가로채이지 않는다.
@router.get("/profile.html")
def profile_page(request: Request):
    return templates.TemplateResponse(request, "profile.html")


@router.get("/{page}.html")
def serve_html(page: str):
    path = f"html/{page}.html"
    if os.path.exists(path):
        return FileResponse(path)
    raise HTTPException(status_code=404, detail="페이지를 찾을 수 없습니다.")


# ── 타이핑 콘텐츠 페이지 (클린 URL) ──────────────────────
@router.get("/typing")
def typing_list_page():
    return FileResponse("html/typing_list.html")


@router.get("/typing/create")
def typing_create_page():
    return FileResponse("html/typing_create.html")


@router.get("/typing/{content_id}/edit")
def typing_edit_page(content_id: int):
    return FileResponse("html/typing_create.html")


@router.get("/typing/{content_id}/play")
def typing_play_page(content_id: int):
    return FileResponse("html/typing.html")


@router.get("/typing/{content_id}")
def typing_detail_page(content_id: int):
    return FileResponse("html/typing_detail.html")


# ── 퀴즈 콘텐츠 페이지 (클린 URL) ────────────────────────
@router.get("/quiz")
def quiz_list_page():
    return FileResponse("html/quiz_list.html")


@router.get("/quiz/create")
def quiz_create_page():
    return FileResponse("html/quiz_create.html")


@router.get("/quiz/{content_id}/edit")
def quiz_edit_page(content_id: int):
    return FileResponse("html/quiz_create.html")


@router.get("/quiz/{content_id}/play")
def quiz_play_page(content_id: int):
    return FileResponse("html/quiz.html")


@router.get("/quiz/{content_id}")
def quiz_detail_page(content_id: int):
    return FileResponse("html/quiz_detail.html")


# ── 실시간 대전 페이지 (클린 URL) ────────────────────────
@router.get("/battle")
def battle_list_page():
    return FileResponse("html/battle_list.html")


@router.get("/battle/{room_code}")
def battle_room_page(room_code: str):
    return FileResponse("html/battle.html")


STATIC_FILE_MAP = {
    "style.css": "css/style.css",
    "typing.css": "css/typing.css",
    "script.js": "js/typing/play.js",
    "navbar.js": "js/shared/navbar.js",
    "battle.js": "js/battle/battle.js",
    "shared_typing_engine.js": "js/shared/typing_engine.js",
    "quiz_engine.js": "js/quiz/detail_engine.js",
    "i18n.js": "i18n.js",
    "locales.json": "locales.json",
}

for _url_name, _disk_path in STATIC_FILE_MAP.items():
    @router.get(f"/{_url_name}")
    def serve_static(filename: str = _disk_path):
        return FileResponse(filename)
