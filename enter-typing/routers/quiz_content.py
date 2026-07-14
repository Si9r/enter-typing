from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session

import models
from core.security import get_current_user
from database import get_db
from routers.content_common import (
    check_owner_or_403,
    creator_nickname,
    get_content_or_404,
    increment_play_count,
    quiz_question_count,
)

router = APIRouter(prefix="/api", tags=["quiz_content"])


class QuizContentCreate(BaseModel):
    title: str
    artist: str
    genre: str
    description: str
    quiz_data: str
    difficulty: int = 3
    youtube_id: str | None = None
    thumbnail_url: str | None = None


class QuizHistoryCreate(BaseModel):
    quiz_id: Optional[int] = None
    quiz_category: str
    score: int
    total_questions: int


# ════════════════════════════════════════════════════════════
# API: 퀴즈 콘텐츠 재생수 증가 (비로그인 사용자 포함)
# POST /api/quiz-content/{content_id}/play
# ════════════════════════════════════════════════════════════
@router.post("/quiz-content/{content_id}/play")
def increment_quiz_play_count(content_id: int, db: Session = Depends(get_db)):
    return {"success": True, "play_count": increment_play_count(models.QuizContent, content_id, db)}


# ════════════════════════════════════════════════════════════
# API: 퀴즈 콘텐츠 목록 가져오기
# GET /api/quiz-contents
# ════════════════════════════════════════════════════════════
@router.get("/quiz-contents")
def get_all_quiz_contents(db: Session = Depends(get_db)):
    contents = db.query(models.QuizContent).all()
    result = []
    for c in contents:
        result.append({
            "id": c.id,
            "title": c.title,
            "artist": c.artist,
            "genre": c.genre,
            "description": c.description,
            "youtube_id": c.youtube_id,
            "thumbnail_url": c.thumbnail_url,
            "creator_id": c.creator_id,
            "creator_nickname": creator_nickname(c),
            "difficulty": c.difficulty,
            "best_score": c.best_score,
            "play_count": c.play_count,
            "quiz_count": quiz_question_count(c)
        })
    return {"success": True, "data": result}


# ════════════════════════════════════════════════════════════
# API: 내 퀴즈 콘텐츠 목록 가져오기
# GET /api/my-quiz-contents
# ════════════════════════════════════════════════════════════
@router.get("/my-quiz-contents")
def get_my_quiz_contents(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    contents = db.query(models.QuizContent).filter(models.QuizContent.creator_id == current_user.id).all()
    result = []
    for c in contents:
        result.append({
            "id": c.id,
            "title": c.title,
            "artist": c.artist,
            "genre": c.genre,
            "description": c.description,
            "youtube_id": c.youtube_id,
            "thumbnail_url": c.thumbnail_url,
            "difficulty": c.difficulty,
            "best_score": c.best_score,
            "play_count": c.play_count,
            "quiz_count": quiz_question_count(c)
        })
    return {"success": True, "data": result}


# ════════════════════════════════════════════════════════════
# API: 퀴즈 콘텐츠 추가
# POST /api/quiz-contents
# ════════════════════════════════════════════════════════════
@router.post("/quiz-contents")
def create_quiz_content(req: QuizContentCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    new_content = models.QuizContent(
        title=req.title,
        artist=req.artist,
        genre=req.genre,
        description=req.description,
        creator_id=current_user.id,
        youtube_id=req.youtube_id,
        thumbnail_url=req.thumbnail_url,
        quiz_data=req.quiz_data,
        difficulty=req.difficulty,
        play_count=0,
        best_score=0
    )
    db.add(new_content)
    db.commit()
    db.refresh(new_content)
    return {"success": True, "message": "성공적으로 추가되었습니다.", "id": new_content.id}


# ════════════════════════════════════════════════════════════
# API: 퀴즈 콘텐츠 가져오기
# GET /api/quiz-content/{content_id}
# ════════════════════════════════════════════════════════════
@router.get("/quiz-content/{content_id}")
def get_quiz_content(content_id: int, db: Session = Depends(get_db)):
    content = get_content_or_404(models.QuizContent, content_id, db)

    return {
        "success": True,
        "title": content.title,
        "artist": content.artist,
        "genre": content.genre,
        "description": content.description,
        "youtube_id": content.youtube_id,
        "thumbnail_url": content.thumbnail_url,
        "creator_id": content.creator_id,
        "creator_nickname": creator_nickname(content),
        "difficulty": content.difficulty,
        "play_count": content.play_count,
        "best_score": content.best_score,
        "quiz_data": content.quiz_data
    }


# ════════════════════════════════════════════════════════════
# API: 퀴즈 콘텐츠 삭제
# DELETE /api/quiz-contents/{content_id}
# ════════════════════════════════════════════════════════════
@router.delete("/quiz-contents/{content_id}")
def delete_quiz_content(content_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    content = get_content_or_404(models.QuizContent, content_id, db)
    check_owner_or_403(content, current_user, "삭제 권한이 없습니다.")
    db.delete(content)
    db.commit()
    return {"success": True, "message": "삭제되었습니다."}


# ════════════════════════════════════════════════════════════
# API: 퀴즈 콘텐츠 수정
# PUT /api/quiz-contents/{content_id}
# ════════════════════════════════════════════════════════════
@router.put("/quiz-contents/{content_id}")
def update_quiz_content(content_id: int, req: QuizContentCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    content = get_content_or_404(models.QuizContent, content_id, db)
    check_owner_or_403(content, current_user)

    content.title = req.title
    content.artist = req.artist
    content.genre = req.genre
    content.description = req.description
    content.youtube_id = req.youtube_id
    content.thumbnail_url = req.thumbnail_url
    content.quiz_data = req.quiz_data
    content.difficulty = req.difficulty

    db.commit()
    return {"success": True, "message": "수정되었습니다."}


# ════════════════════════════════════════════════════════════
# API: 퀴즈 히스토리 저장
# POST /api/quiz-history
# ════════════════════════════════════════════════════════════
@router.post("/quiz-history")
def save_quiz_history(req: QuizHistoryCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    history = models.QuizHistory(
        user_id=current_user.id,
        quiz_id=req.quiz_id,
        quiz_category=req.quiz_category,
        score=req.score,
        total_questions=req.total_questions
    )
    db.add(history)

    if req.quiz_id:
        quiz_content = db.query(models.QuizContent).filter(models.QuizContent.id == req.quiz_id).first()
        if quiz_content:
            if quiz_content.play_count is None:
                quiz_content.play_count = 0
            quiz_content.play_count += 1
            if req.score > (quiz_content.best_score or 0):
                quiz_content.best_score = req.score

    db.commit()
    return {"message": "퀴즈 기록이 저장되었습니다."}
