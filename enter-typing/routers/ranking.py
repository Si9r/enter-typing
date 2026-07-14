import time

from fastapi import APIRouter, Depends
from sqlalchemy import case, func
from sqlalchemy.orm import Session

import models
from database import get_db

router = APIRouter(prefix="/api/ranking", tags=["ranking"])

# 랭킹 데이터 인메모리 캐시 (1분 TTL)
ranking_cache = {
    "data": None,
    "timestamp": 0
}
CACHE_TTL = 60  # 60초(1분) 동안 캐시 유지


# ════════════════════════════════════════════════════════════
# API: 전체 랭킹 (타이핑/퀴즈/대전)
# GET /api/ranking/total
# ════════════════════════════════════════════════════════════
@router.get("/total")
def get_total_ranking(db: Session = Depends(get_db)):
    current_time = time.time()
    if ranking_cache["data"] and (current_time - ranking_cache["timestamp"] < CACHE_TTL):
        return ranking_cache["data"]

    # 타이핑 랭킹 (최고 점수 합산 기준)
    typing_subq = db.query(
        models.TypingHistory.user_id,
        models.TypingHistory.content_id,
        models.TypingHistory.content_title,
        func.max(models.TypingHistory.score).label("max_score"),
        func.max(models.TypingHistory.wpm).label("max_wpm"),
        func.max(models.TypingHistory.accuracy).label("max_accuracy")
    ).group_by(models.TypingHistory.user_id, models.TypingHistory.content_id, models.TypingHistory.content_title).subquery()

    typing_histories = db.query(
        typing_subq.c.user_id,
        func.sum(typing_subq.c.max_score).label("total_score"),
        func.avg(typing_subq.c.max_wpm).label("avg_wpm"),
        func.avg(typing_subq.c.max_accuracy).label("avg_accuracy"),
        func.count().label("unique_content_count")
    ).group_by(typing_subq.c.user_id).order_by(func.sum(typing_subq.c.max_score).desc()).limit(100).all()

    typing_ranking = []
    for rank, h in enumerate(typing_histories):
        user = db.query(models.User).filter(models.User.id == h.user_id).first()
        typing_ranking.append({
            "rank": rank + 1,
            "nickname": user.nickname if user else "알 수 없음",
            "total_score": int(h.total_score) if h.total_score else 0,
            "avg_wpm": int(h.avg_wpm) if h.avg_wpm else 0,
            "avg_accuracy": round(h.avg_accuracy, 1) if h.avg_accuracy else 0.0,
            "unique_content_count": int(h.unique_content_count) if h.unique_content_count else 0
        })

    # 퀴즈 랭킹 (최고 점수 합산 기준)
    # 서브쿼리: 각 유저별, 퀴즈별(과거 데이터 호환을 위해 category도 포함)로 가장 높은 점수를 구함
    quiz_subq = db.query(
        models.QuizHistory.user_id,
        models.QuizHistory.quiz_id,
        models.QuizHistory.quiz_category,
        func.max(models.QuizHistory.score).label("max_score")
    ).group_by(models.QuizHistory.user_id, models.QuizHistory.quiz_id, models.QuizHistory.quiz_category).subquery()

    # 메인쿼리: 서브쿼리의 최고 점수들을 합산하고, 참여한 고유 퀴즈 개수(count)를 구함
    quiz_histories = db.query(
        quiz_subq.c.user_id,
        func.sum(quiz_subq.c.max_score).label("total_score"),
        func.count().label("unique_quiz_count")
    ).group_by(quiz_subq.c.user_id).order_by(func.sum(quiz_subq.c.max_score).desc()).limit(100).all()

    quiz_ranking = []
    for rank, h in enumerate(quiz_histories):
        user = db.query(models.User).filter(models.User.id == h.user_id).first()
        quiz_ranking.append({
            "rank": rank + 1,
            "nickname": user.nickname if user else "알 수 없음",
            "total_score": int(h.total_score) if h.total_score else 0,
            "unique_quiz_count": int(h.unique_quiz_count) if h.unique_quiz_count else 0
        })

    # 대전 랭킹 (우승 횟수 기준)
    battle_histories = db.query(
        models.BattleHistory.user_id,
        func.sum(case((models.BattleHistory.rank == 1, 1), else_=0)).label("win_count"),
        func.count(models.BattleHistory.id).label("play_count")
    ).group_by(models.BattleHistory.user_id).order_by(
        func.sum(case((models.BattleHistory.rank == 1, 1), else_=0)).desc(),
        func.count(models.BattleHistory.id).asc()
    ).limit(100).all()

    battle_ranking = []
    for rank_idx, h in enumerate(battle_histories):
        user = db.query(models.User).filter(models.User.id == h.user_id).first()
        win_count = int(h.win_count) if h.win_count else 0
        play_count = int(h.play_count) if h.play_count else 0
        win_rate = round((win_count / play_count) * 100, 1) if play_count > 0 else 0.0

        battle_ranking.append({
            "rank": rank_idx + 1,
            "nickname": user.nickname if user else "알 수 없음",
            "total_score": win_count,  # 프론트엔드 호환성을 위해 total_score 필드에 win_count 매핑
            "play_count": play_count,
            "win_rate": win_rate
        })

    result = {
        "success": True,
        "typing": typing_ranking,
        "quiz": quiz_ranking,
        "battle": battle_ranking
    }

    # 캐시 갱신
    ranking_cache["data"] = result
    ranking_cache["timestamp"] = time.time()

    return result


# ════════════════════════════════════════════════════════════
# API: 특정 타이핑 콘텐츠 랭킹
# GET /api/ranking/content/{content_id}
# ════════════════════════════════════════════════════════════
@router.get("/content/{content_id}")
def get_content_ranking(content_id: int, db: Session = Depends(get_db)):
    histories = db.query(models.TypingHistory).filter(models.TypingHistory.content_id == content_id).order_by(models.TypingHistory.score.desc()).all()
    seen_users = set()
    ranking = []

    for h in histories:
        if h.user_id not in seen_users:
            seen_users.add(h.user_id)
            user = db.query(models.User).filter(models.User.id == h.user_id).first()
            ranking.append({
                "rank": len(ranking) + 1,
                "nickname": user.nickname if user else "알 수 없음",
                "score": h.score,
                "wpm": h.wpm,
                "accuracy": round(h.accuracy, 1),
                "played_at": h.played_at.isoformat() if h.played_at else None
            })
            if len(ranking) >= 100:
                break

    content = db.query(models.TypingContent).filter(models.TypingContent.id == content_id).first()
    content_info = {}
    if content:
        content_info = {
            "title": content.title,
            "artist": content.artist,
            "genre": content.genre,
            "youtube_id": content.youtube_id
        }

    return {
        "success": True,
        "content_info": content_info,
        "ranking": ranking
    }
