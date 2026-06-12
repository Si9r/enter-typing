import json

import pykakasi
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend import models
from backend.auth import get_current_user
from backend.database import get_db
from backend.schemas import ConvertRequest, QuizContentCreate, QuizResultCreate
from backend.scoring import get_quiz_answer_slot_count, get_quiz_max_score


router = APIRouter()
kks = pykakasi.kakasi()


@router.get("/api/quiz-contents")
def get_all_quiz_contents(db: Session = Depends(get_db)):
    contents = db.query(models.QuizContent).all()
    result = []
    for c in contents:
        quiz_count = 0
        try:
            quiz_count = len(json.loads(c.quiz_data)) if c.quiz_data else 0
        except Exception:
            pass
        result.append({
            "id": c.id,
            "title": c.title,
            "artist": c.artist,
            "genre": c.genre,
            "description": c.description,
            "creator_nickname": c.creator.nickname if c.creator else "엔터핑",
            "difficulty": c.difficulty,
            "best_score": c.best_score,
            "quiz_count": quiz_count
        })
    return {"success": True, "data": result}


@router.get("/api/my-quiz-contents")
def get_my_quiz_contents(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    contents = db.query(models.QuizContent).filter(models.QuizContent.creator_id == current_user.id).all()
    result = []
    for c in contents:
        quiz_count = 0
        try:
            quiz_count = len(json.loads(c.quiz_data)) if c.quiz_data else 0
        except Exception:
            pass
        result.append({
            "id": c.id,
            "title": c.title,
            "artist": c.artist,
            "genre": c.genre,
            "description": c.description,
            "difficulty": c.difficulty,
            "best_score": c.best_score,
            "play_count": c.play_count,
            "quiz_count": quiz_count
        })
    return {"success": True, "data": result}


@router.post("/api/quiz-contents")
def create_quiz_content(req: QuizContentCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    new_content = models.QuizContent(
        title=req.title,
        artist=req.artist,
        genre=req.genre,
        description=req.description,
        creator_id=current_user.id,
        youtube_id=req.youtube_id,
        quiz_data=req.quiz_data,
        difficulty=req.difficulty,
        play_count=0,
        best_score=0
    )
    db.add(new_content)
    db.commit()
    db.refresh(new_content)
    return {"success": True, "message": "성공적으로 추가되었습니다.", "id": new_content.id}


@router.put("/api/quiz-contents/{content_id}")
def update_quiz_content(content_id: int, req: QuizContentCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    content = db.query(models.QuizContent).filter(models.QuizContent.id == content_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="콘텐츠를 찾을 수 없습니다.")

    if content.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="수정 권한이 없습니다.")

    content.title = req.title
    content.artist = req.artist
    content.genre = req.genre
    content.description = req.description
    content.youtube_id = req.youtube_id
    content.quiz_data = req.quiz_data
    content.difficulty = req.difficulty

    db.commit()
    return {"success": True, "message": "수정되었습니다.", "id": content.id}


@router.get("/api/quiz-content/{content_id}")
def get_quiz_content(content_id: int, db: Session = Depends(get_db)):
    content = db.query(models.QuizContent).filter(models.QuizContent.id == content_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="콘텐츠를 찾을 수 없습니다.")
    
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
        "best_score": content.best_score,
        "quiz_data": content.quiz_data
    }


@router.delete("/api/quiz-contents/{content_id}")
def delete_quiz_content(content_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    content = db.query(models.QuizContent).filter(models.QuizContent.id == content_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="콘텐츠를 찾을 수 없습니다.")

    if content.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="삭제 권한이 없습니다.")
        
    db.delete(content)
    db.commit()
    return {"success": True, "message": "삭제되었습니다."}


@router.post("/api/quiz-results")
def save_quiz_result(req: QuizResultCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    content = db.query(models.QuizContent).filter(models.QuizContent.id == req.content_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="Content not found.")

    try:
        quiz_items = json.loads(content.quiz_data or "[]")
    except Exception:
        quiz_items = []

    expected_questions = len(quiz_items)
    answer_slots = get_quiz_answer_slot_count(content.quiz_data)
    max_score = get_quiz_max_score(content.quiz_data)

    if req.score < 0:
        raise HTTPException(status_code=400, detail="Invalid score.")
    if req.total_questions < 0 or req.total_questions > max(expected_questions, 1):
        raise HTTPException(status_code=400, detail="Invalid question count.")
    if req.correct_count < 0 or req.correct_count > max(expected_questions, 1):
        raise HTTPException(status_code=400, detail="Invalid correct count.")
    if req.accuracy < 0 or req.accuracy > 100:
        raise HTTPException(status_code=400, detail="Invalid accuracy.")
    if req.max_combo < 0 or req.max_combo > max(answer_slots, 1):
        raise HTTPException(status_code=400, detail="Invalid combo.")

    server_score = min(req.score, max_score)
    rank_eligible = (
        expected_questions > 0 and
        req.total_questions == expected_questions and
        req.correct_count == expected_questions and
        req.score <= max_score
    )

    history = models.QuizHistory(
        user_id=current_user.id,
        content_id=content.id,
        quiz_category=content.genre,
        score=server_score,
        total_questions=expected_questions,
        accuracy=req.accuracy,
        max_combo=req.max_combo,
        rank_eligible=rank_eligible
    )
    content.play_count = (content.play_count or 0) + 1
    if rank_eligible and server_score > (content.best_score or 0):
        content.best_score = server_score

    db.add(history)
    db.commit()

    return {
        "success": True,
        "score": server_score,
        "rank_eligible": rank_eligible,
        "best_score": content.best_score
    }


@router.post("/api/convert")
def convert_lyrics(req: ConvertRequest):
    text = req.text
    if not text:
        return {"success": True, "hiragana": "", "romaji": ""}
        
    converted = kks.convert(text)
    
    hiragana = ""
    romaji = ""
    for item in converted:
        h = item['hira']
        r = item['hepburn']
        
        # pykakasi 스테가나 변환 예외 처리 (jie -> je 등)
        if 'じぇ' in h: r = r.replace('jie', 'je')
        if 'しぇ' in h: r = r.replace('shie', 'she')
        if 'ちぇ' in h: r = r.replace('chie', 'che')
        if 'せぁ' in h: r = r.replace('sea', 'sexa')
        if 'せぃ' in h: r = r.replace('sei', 'sexi')
        if 'せぅ' in h: r = r.replace('seu', 'sexu')
        if 'せぇ' in h: r = r.replace('see', 'sexe')
        if 'せぉ' in h: r = r.replace('seo', 'sexo')
        
        hiragana += h
        romaji += r
    
    # romaji may need some cleanup for typing game
    romaji = romaji.replace(" ", "")
    hiragana = hiragana.replace(" ", "")
    
    return {"success": True, "hiragana": hiragana, "romaji": romaji}

