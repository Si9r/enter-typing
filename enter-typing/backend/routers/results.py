from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend import models
from backend.auth import get_current_user
from backend.database import get_db
from backend.scoring import clamp_number


router = APIRouter()


@router.get("/api/my-results")
def get_my_results(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    typing_histories = db.query(models.TypingHistory).filter(
        models.TypingHistory.user_id == current_user.id
    ).all()
    quiz_histories = db.query(models.QuizHistory).filter(
        models.QuizHistory.user_id == current_user.id
    ).all()

    total_typing = len(typing_histories)
    total_quiz = len(quiz_histories)
    total_plays = total_typing + total_quiz

    accuracy_values = [
        h.accuracy for h in typing_histories if h.accuracy is not None
    ] + [
        h.accuracy for h in quiz_histories if h.accuracy is not None
    ]
    avg_accuracy = round(sum(accuracy_values) / len(accuracy_values), 1) if accuracy_values else 0
    avg_wpm = round(sum((h.wpm or 0) for h in typing_histories) / total_typing) if total_typing else 0
    best_wpm = max(((h.wpm or 0) for h in typing_histories), default=0)
    best_typing_score = max(((h.score or 0) for h in typing_histories), default=0)
    best_quiz_score = max(((h.score or 0) for h in quiz_histories), default=0)

    recent_typing = db.query(models.TypingHistory).filter(
        models.TypingHistory.user_id == current_user.id
    ).order_by(models.TypingHistory.played_at.desc()).limit(20).all()
    recent_quiz = db.query(models.QuizHistory).filter(
        models.QuizHistory.user_id == current_user.id
    ).order_by(models.QuizHistory.played_at.desc()).limit(20).all()

    content_ids = {h.content_id for h in recent_quiz if h.content_id}
    quiz_contents = {}
    if content_ids:
        quiz_contents = {
            c.id: c for c in db.query(models.QuizContent).filter(models.QuizContent.id.in_(content_ids)).all()
        }

    recent = []
    for history in recent_typing:
        recent.append({
            "type": "typing",
            "content_id": history.content_id,
            "title": history.content_title,
            "genre": history.genre,
            "wpm": history.wpm,
            "accuracy": history.accuracy,
            "score": history.score,
            "typos": history.typos,
            "elapsed_seconds": history.elapsed_seconds,
            "played_at": history.played_at.isoformat() if history.played_at else None
        })

    for history in recent_quiz:
        content = quiz_contents.get(history.content_id)
        recent.append({
            "type": "quiz",
            "content_id": history.content_id,
            "title": content.title if content else "Quiz",
            "genre": history.quiz_category,
            "score": history.score,
            "total_questions": history.total_questions,
            "accuracy": history.accuracy,
            "max_combo": history.max_combo,
            "played_at": history.played_at.isoformat() if history.played_at else None
        })

    recent.sort(key=lambda item: item["played_at"] or "", reverse=True)

    return {
        "success": True,
        "summary": {
            "total_plays": total_plays,
            "typing_plays": total_typing,
            "quiz_plays": total_quiz,
            "avg_accuracy": avg_accuracy,
            "avg_wpm": avg_wpm,
            "best_wpm": best_wpm,
            "best_typing_score": best_typing_score,
            "best_quiz_score": best_quiz_score
        },
        "recent": recent[:20]
    }


@router.get("/api/rankings")
def get_rankings(mode: str = "all", content_id: int | None = None, limit: int = 50, db: Session = Depends(get_db)):
    safe_limit = clamp_number(int(limit or 50), 1, 100)
    requested_mode = (mode or "all").lower()
    if requested_mode not in {"all", "typing", "quiz"}:
        raise HTTPException(status_code=400, detail="Invalid ranking mode.")

    rows = []

    if requested_mode in {"all", "typing"}:
        typing_query = db.query(models.TypingHistory, models.User).join(
            models.User, models.TypingHistory.user_id == models.User.id
        ).filter(models.TypingHistory.rank_eligible == True)
        if content_id is not None:
            typing_query = typing_query.filter(models.TypingHistory.content_id == content_id)
        typing_histories = typing_query.order_by(
            models.TypingHistory.score.desc(),
            models.TypingHistory.accuracy.desc(),
            models.TypingHistory.wpm.desc()
        ).limit(safe_limit).all()

        for history, user in typing_histories:
            rows.append({
                "type": "typing",
                "nickname": user.nickname,
                "content_id": history.content_id,
                "title": history.content_title,
                "genre": history.genre,
                "score": history.score,
                "accuracy": history.accuracy,
                "wpm": history.wpm,
                "max_combo": None,
                "played_at": history.played_at.isoformat() if history.played_at else None
            })

    if requested_mode in {"all", "quiz"}:
        quiz_query = db.query(models.QuizHistory, models.User).join(
            models.User, models.QuizHistory.user_id == models.User.id
        ).filter(models.QuizHistory.rank_eligible == True)
        if content_id is not None:
            quiz_query = quiz_query.filter(models.QuizHistory.content_id == content_id)
        quiz_histories = quiz_query.order_by(
            models.QuizHistory.score.desc(),
            models.QuizHistory.accuracy.desc(),
            models.QuizHistory.max_combo.desc()
        ).limit(safe_limit).all()

        quiz_content_ids = {history.content_id for history, _ in quiz_histories if history.content_id}
        quiz_contents = {}
        if quiz_content_ids:
            quiz_contents = {
                c.id: c for c in db.query(models.QuizContent).filter(models.QuizContent.id.in_(quiz_content_ids)).all()
            }

        for history, user in quiz_histories:
            content = quiz_contents.get(history.content_id)
            rows.append({
                "type": "quiz",
                "nickname": user.nickname,
                "content_id": history.content_id,
                "title": content.title if content else "Quiz",
                "genre": history.quiz_category,
                "score": history.score,
                "accuracy": history.accuracy,
                "wpm": None,
                "max_combo": history.max_combo,
                "played_at": history.played_at.isoformat() if history.played_at else None
            })

    rows.sort(
        key=lambda row: (
            row["score"] or 0,
            row["accuracy"] or 0,
            row["wpm"] or row["max_combo"] or 0
        ),
        reverse=True
    )
    ranked = rows[:safe_limit]
    for index, row in enumerate(ranked, start=1):
        row["rank"] = index

    return {
        "success": True,
        "mode": requested_mode,
        "content_id": content_id,
        "data": ranked
    }

