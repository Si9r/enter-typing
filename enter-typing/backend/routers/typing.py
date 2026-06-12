from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend import models
from backend.auth import get_current_user
from backend.database import get_db
from backend.schemas import TypingContentCreate, TypingResultCreate
from backend.scoring import calculate_typing_score


router = APIRouter()


@router.get("/api/typing-contents")
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
            "creator_nickname": c.creator.nickname if c.creator else "엔터핑",
            "difficulty": c.difficulty,
            "best_time": c.best_time
        })
    return {"success": True, "data": result}


@router.get("/api/my-typing-contents")
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


@router.post("/api/typing-contents")
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
        best_time=0
    )
    db.add(new_content)
    db.commit()
    db.refresh(new_content)
    return {"success": True, "message": "성공적으로 추가되었습니다.", "id": new_content.id}


@router.delete("/api/typing-contents/{content_id}")
def delete_typing_content(content_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    content = db.query(models.TypingContent).filter(models.TypingContent.id == content_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="콘텐츠를 찾을 수 없습니다.")

    if content.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="삭제 권한이 없습니다.")
        
    db.delete(content)
    db.commit()
    return {"success": True, "message": "삭제되었습니다."}


@router.put("/api/typing-contents/{content_id}")
def update_typing_content(content_id: int, req: TypingContentCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    content = db.query(models.TypingContent).filter(models.TypingContent.id == content_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="콘텐츠를 찾을 수 없습니다.")
    
    if content.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="수정 권한이 없습니다.")
        
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
    
    db.commit()
    return {"success": True, "message": "수정되었습니다."}


@router.get("/api/typing-content/{content_id}")
def get_typing_content(content_id: int, db: Session = Depends(get_db)):
    content = db.query(models.TypingContent).filter(models.TypingContent.id == content_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="콘텐츠를 찾을 수 없습니다.")
    
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
        "creator_nickname": content.creator.nickname if content.creator else "엔터핑",
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


@router.post("/api/typing-results")
def save_typing_result(req: TypingResultCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    content = db.query(models.TypingContent).filter(models.TypingContent.id == req.content_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="Content not found.")

    if req.wpm < 0 or req.wpm > 600:
        raise HTTPException(status_code=400, detail="Invalid WPM.")
    if req.accuracy < 0 or req.accuracy > 100:
        raise HTTPException(status_code=400, detail="Invalid accuracy.")
    if req.typos < 0 or req.typos > 10000:
        raise HTTPException(status_code=400, detail="Invalid typo count.")
    if req.elapsed_seconds < 0 or req.elapsed_seconds > 7200:
        raise HTTPException(status_code=400, detail="Invalid elapsed time.")

    server_score = calculate_typing_score(req.wpm, req.accuracy, req.typos, content.difficulty)
    rank_eligible = req.completed and req.elapsed_seconds >= 5 and req.accuracy >= 85 and req.wpm <= 500

    history = models.TypingHistory(
        user_id=current_user.id,
        content_id=content.id,
        content_title=content.title,
        genre=content.genre,
        wpm=req.wpm,
        accuracy=req.accuracy,
        score=server_score,
        typos=req.typos,
        elapsed_seconds=req.elapsed_seconds,
        rank_eligible=rank_eligible
    )
    content.play_count = (content.play_count or 0) + 1
    if rank_eligible and req.elapsed_seconds > 0:
        if not content.best_time or req.elapsed_seconds < content.best_time:
            content.best_time = req.elapsed_seconds

    db.add(history)
    db.commit()

    return {
        "success": True,
        "score": server_score,
        "rank_eligible": rank_eligible,
        "best_time": content.best_time
    }

