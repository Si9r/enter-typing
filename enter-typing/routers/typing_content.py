from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models
from core.security import get_current_user
from database import get_db
from routers.content_common import check_owner_or_403, creator_nickname, get_content_or_404, increment_play_count

router = APIRouter(prefix="/api", tags=["typing_content"])


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
    best_time: int = 0


class TypingHistoryCreate(BaseModel):
    content_title: str
    genre: str
    wpm: int
    accuracy: float
    text: str


# ════════════════════════════════════════════════════════════
# API: 타이핑 콘텐츠 목록 가져오기
# GET /api/typing-contents
# ════════════════════════════════════════════════════════════
@router.get("/typing-contents")
def get_all_typing_contents(db: Session = Depends(get_db)):
    contents = db.query(models.TypingContent).all()
    result = []
    for c in contents:
        result.append({
            "id": c.id,
            "title": c.title,
            "artist": c.artist,
            "genre": c.genre,
            "description": c.description,
            "creator_id": c.creator_id,
            "creator_nickname": creator_nickname(c),
            "difficulty": c.difficulty,
            "best_time": c.best_time,
            "play_count": c.play_count,
            "lyrics": c.lyrics,
            "hiragana": c.hiragana,
            "romaji": c.romaji,
            "youtube_id": c.youtube_id,
            "timestamps": c.timestamps
        })
    return {"success": True, "data": result}


# ════════════════════════════════════════════════════════════
# API: 내 타이핑 콘텐츠 목록 가져오기
# GET /api/my-typing-contents
# ════════════════════════════════════════════════════════════
@router.get("/my-typing-contents")
def get_my_typing_contents(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    contents = db.query(models.TypingContent).filter(models.TypingContent.creator_id == current_user.id).all()
    result = []
    for c in contents:
        result.append({
            "id": c.id,
            "title": c.title,
            "artist": c.artist,
            "genre": c.genre,
            "description": c.description,
            "difficulty": c.difficulty,
            "best_time": c.best_time,
            "play_count": c.play_count
        })
    return {"success": True, "data": result}


# ════════════════════════════════════════════════════════════
# API: 타이핑 콘텐츠 추가
# POST /api/typing-contents
# ════════════════════════════════════════════════════════════
@router.post("/typing-contents")
def create_typing_content(req: TypingContentCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    new_content = models.TypingContent(
        title=req.title,
        artist=req.artist,
        genre=req.genre,
        description=req.description,
        creator_id=current_user.id,
        youtube_id=req.youtube_id,
        lyrics=req.lyrics,
        hiragana=req.hiragana,
        romaji=req.romaji,
        timestamps=req.timestamps,
        difficulty=req.difficulty,
        play_count=0,
        best_time=req.best_time
    )
    db.add(new_content)
    db.commit()
    db.refresh(new_content)
    return {"success": True, "message": "성공적으로 추가되었습니다.", "id": new_content.id}


# ════════════════════════════════════════════════════════════
# API: 타이핑 콘텐츠 삭제
# DELETE /api/typing-contents/{content_id}
# ════════════════════════════════════════════════════════════
@router.delete("/typing-contents/{content_id}")
def delete_typing_content(content_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    content = get_content_or_404(models.TypingContent, content_id, db)
    check_owner_or_403(content, current_user, "삭제 권한이 없습니다.")
    db.delete(content)
    db.commit()
    return {"success": True, "message": "삭제되었습니다."}


# ════════════════════════════════════════════════════════════
# API: 타이핑 콘텐츠 수정
# PUT /api/typing-contents/{content_id}
# ════════════════════════════════════════════════════════════
@router.put("/typing-contents/{content_id}")
def update_typing_content(content_id: int, req: TypingContentCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    content = get_content_or_404(models.TypingContent, content_id, db)
    check_owner_or_403(content, current_user, "수정 권한이 없습니다.")

    content.title = req.title
    content.artist = req.artist
    content.genre = req.genre
    content.description = req.description
    content.youtube_id = req.youtube_id
    content.lyrics = req.lyrics
    content.hiragana = req.hiragana
    content.romaji = req.romaji
    content.timestamps = req.timestamps
    content.difficulty = req.difficulty
    content.best_time = req.best_time

    db.commit()
    return {"success": True, "message": "수정되었습니다."}


# ════════════════════════════════════════════════════════════
# API: 타이핑 콘텐츠 가져오기
# GET /api/typing-content/{content_id}
# ════════════════════════════════════════════════════════════
@router.get("/typing-content/{content_id}")
def get_typing_content(content_id: int, db: Session = Depends(get_db)):
    content = get_content_or_404(models.TypingContent, content_id, db)

    lines = [line.strip().replace(" ", "") for line in content.lyrics.split('\n') if line.strip()]
    hiragana_lines = [line.strip().replace(" ", "") for line in content.hiragana.split('\n') if line.strip()]
    romaji_lines = [line.strip().replace(" ", "") for line in content.romaji.split('\n') if line.strip()]
    return {
        "success": True,
        "title": content.title,
        "artist": content.artist,
        "genre": content.genre,
        "description": content.description,
        "youtube_id": content.youtube_id,
        "creator_id": content.creator_id,
        "creator_nickname": creator_nickname(content),
        "difficulty": content.difficulty,
        "play_count": content.play_count,
        "best_time": content.best_time,
        "lines": lines,
        "hiragana_lines": hiragana_lines,
        "romaji_lines": romaji_lines,
        "timestamps": content.timestamps,
        "raw_lyrics": content.lyrics,
        "raw_hiragana": content.hiragana,
        "raw_romaji": content.romaji
    }


# ════════════════════════════════════════════════════════════
# API: 타이핑 콘텐츠 재생수 증가 (비로그인 사용자 포함)
# POST /api/typing-content/{content_id}/play
# ════════════════════════════════════════════════════════════
@router.post("/typing-content/{content_id}/play")
def increment_typing_play_count(content_id: int, db: Session = Depends(get_db)):
    return {"success": True, "play_count": increment_play_count(models.TypingContent, content_id, db)}


# ════════════════════════════════════════════════════════════
# API: 타이핑 히스토리 저장 (오직 "타이핑" 장르에서만 오타 통계 반영)
# POST /api/typing-history
# ════════════════════════════════════════════════════════════
@router.post("/typing-history")
def save_typing_history(req: TypingHistoryCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # 1. 곡(Content) 조회하여 ID 매핑
    content = db.query(models.TypingContent).filter(models.TypingContent.title == req.content_title).first()
    content_id = content.id if content else None

    history = models.TypingHistory(
        user_id=current_user.id,
        content_id=content_id,
        content_title=req.content_title,
        genre=req.genre,
        wpm=req.wpm,
        accuracy=req.accuracy
    )
    db.add(history)

    db.commit()
    return {"message": "기록이 저장되었습니다."}
