from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PAGES_DIR = os.path.join(BASE_DIR, "pages")
STATIC_DIR = os.path.join(BASE_DIR, "static")

load_dotenv(os.path.join(BASE_DIR, ".env"))

from backend.bootstrap import initialize_database, seed_default_typing_contents
from backend.routers import attendance, quiz, results, typing as typing_router, users

initialize_database()

app = FastAPI()

app.include_router(users.router)
app.include_router(attendance.router)
app.include_router(results.router)
app.include_router(typing_router.router)
app.include_router(quiz.router)


@app.on_event("startup")
def startup_event():
    seed_default_typing_contents()


app.mount("/assets", StaticFiles(directory=os.path.join(STATIC_DIR, "assets")), name="assets")
app.mount("/images", StaticFiles(directory=os.path.join(STATIC_DIR, "images")), name="images")


@app.get("/")
def root():
    return FileResponse(os.path.join(PAGES_DIR, "index.html"))


@app.get("/{page}.html")
def serve_html(page: str):
    path = os.path.join(PAGES_DIR, f"{page}.html")
    if os.path.exists(path):
        return FileResponse(path)
    raise HTTPException(status_code=404, detail="페이지를 찾을 수 없습니다.")


STATIC_FILE_PATHS = {
    "style.css": os.path.join(STATIC_DIR, "css", "style.css"),
    "typing.css": os.path.join(STATIC_DIR, "css", "typing.css"),
    "script.js": os.path.join(STATIC_DIR, "js", "script.js"),
    "quiz.js": os.path.join(STATIC_DIR, "js", "quiz.js"),
    "ranking.js": os.path.join(STATIC_DIR, "js", "ranking.js"),
    "navbar.js": os.path.join(STATIC_DIR, "js", "navbar.js"),
    "hero-bg.jpg": os.path.join(STATIC_DIR, "images", "hero-bg.jpg"),
}


for filename, file_path in STATIC_FILE_PATHS.items():
    @app.get(f"/{filename}")
    def serve_static(path: str = file_path):
        return FileResponse(path)
