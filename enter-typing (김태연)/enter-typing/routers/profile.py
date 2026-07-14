from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

import models
from core.security import get_current_user
from database import get_db

router = APIRouter(prefix="/api", tags=["profile"])


# ════════════════════════════════════════════════════════════
# API: 내 플레이 히스토리 조회
# GET /api/my-history
# ════════════════════════════════════════════════════════════
@router.get("/my-history")
def get_my_history(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    try:
        typing_histories = db.query(models.TypingHistory).filter(
            models.TypingHistory.user_id == current_user.id
        ).order_by(models.TypingHistory.played_at.desc()).limit(20).all()

        quiz_histories = db.query(models.QuizHistory).filter(
            models.QuizHistory.user_id == current_user.id
        ).order_by(models.QuizHistory.played_at.desc()).limit(20).all()

        battle_histories = db.query(models.BattleHistory).filter(
            models.BattleHistory.user_id == current_user.id
        ).order_by(models.BattleHistory.played_at.desc()).limit(20).all()

        created_typing_contents = db.query(models.TypingContent).filter(
            models.TypingContent.creator_id == current_user.id
        ).order_by(models.TypingContent.created_at.desc()).limit(20).all()

        created_quiz_contents = db.query(models.QuizContent).filter(
            models.QuizContent.creator_id == current_user.id
        ).order_by(models.QuizContent.created_at.desc()).limit(20).all()

        import datetime as dt
        fallback_date = dt.datetime.now(dt.timezone.utc)

        combined = []
        for th in typing_histories:
            p_time = th.played_at if th.played_at else fallback_date
            combined.append({
                "type": "typing",
                "content_id": th.content_id,
                "title": th.content_title,
                "genre": th.genre,
                "wpm": th.wpm,
                "accuracy": th.accuracy,
                "score_str": f"{th.score}점 · {th.wpm} WPM · {int(th.accuracy)}%",
                "played_at": p_time.isoformat(),
                "_raw_date": p_time
            })

        for qh in quiz_histories:
            p_time = qh.played_at if qh.played_at else fallback_date
            combined.append({
                "type": "quiz",
                "content_id": qh.quiz_id,
                "title": qh.quiz_category,
                "genre": "퀴즈",
                "score": qh.score,
                "total_questions": qh.total_questions,
                "score_str": f"{qh.score} / {qh.total_questions} 정답",
                "played_at": p_time.isoformat(),
                "_raw_date": p_time
            })

        for bh in battle_histories:
            song_title = "알 수 없음"
            if bh.content_id:
                content = db.query(models.TypingContent).filter(models.TypingContent.id == bh.content_id).first()
                if content:
                    song_title = content.title
            rank_labels = {1: "🥇 1위", 2: "🥈 2위", 3: "🥉 3위"}
            rank_str = rank_labels.get(bh.rank, f"{bh.rank}위")
            p_time = bh.played_at if bh.played_at else fallback_date
            combined.append({
                "type": "battle",
                "content_id": bh.content_id,
                "title": song_title,
                "genre": "실시간 대전",
                "rank": bh.rank,
                "wpm": bh.wpm,
                "accuracy": bh.accuracy,
                "score": bh.score,
                "room_code": bh.room_code,
                "score_str": f"{rank_str} · {bh.score}점 · {bh.wpm} WPM · {int(bh.accuracy)}%",
                "played_at": p_time.isoformat(),
                "_raw_date": p_time
            })

        for tc in created_typing_contents:
            c_time = tc.created_at if tc.created_at else fallback_date
            combined.append({
                "type": "create_typing",
                "content_id": tc.id,
                "title": tc.title,
                "genre": tc.genre or "알 수 없음",
                "score_str": "타이핑 콘텐츠 등록",
                "played_at": c_time.isoformat(),
                "_raw_date": c_time
            })

        for qc in created_quiz_contents:
            c_time = qc.created_at if qc.created_at else fallback_date
            combined.append({
                "type": "create_quiz",
                "content_id": qc.id,
                "title": qc.title,
                "genre": "퀴즈",
                "score_str": "퀴즈 콘텐츠 등록",
                "played_at": c_time.isoformat(),
                "_raw_date": c_time
            })

        combined.sort(key=lambda x: x["_raw_date"].timestamp() if hasattr(x["_raw_date"], "timestamp") else 0, reverse=True)

        for item in combined:
            if "_raw_date" in item:
                del item["_raw_date"]

        return {"success": True, "data": combined}
    except Exception as e:
        import traceback
        err_msg = traceback.format_exc()
        print("ERROR IN /api/my-history:", err_msg)
        return JSONResponse(status_code=500, content={"success": False, "detail": err_msg})


# ════════════════════════════════════════════════════════════
# API: 프로필 분석 통계 조회
# GET /api/profile-analysis
# ════════════════════════════════════════════════════════════
@router.get("/profile-analysis")
def get_profile_analysis(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    now = datetime.now(timezone.utc)

    # 1. 타이핑 통계
    typing_records = db.query(models.TypingHistory).filter(models.TypingHistory.user_id == current_user.id).all()

    total_wpm = 0
    week_wpm = 0; week_cnt = 0
    last_week_wpm = 0; last_week_cnt = 0
    month_wpm = 0; month_cnt = 0
    play_typing = len(typing_records)

    for r in typing_records:
        total_wpm += r.wpm
        played_time = r.played_at
        if played_time.tzinfo is None:
            played_time = played_time.replace(tzinfo=timezone.utc)

        diff_days = (now - played_time).days
        if diff_days <= 7:
            week_wpm += r.wpm
            week_cnt += 1
        if 7 < diff_days <= 14:
            last_week_wpm += r.wpm
            last_week_cnt += 1
        if diff_days <= 30:
            month_wpm += r.wpm
            month_cnt += 1

    avg_wpm = total_wpm // play_typing if play_typing > 0 else 0
    avg_week_wpm = week_wpm // week_cnt if week_cnt > 0 else 0
    avg_last_week_wpm = last_week_wpm // last_week_cnt if last_week_cnt > 0 else 0
    avg_month_wpm = month_wpm // month_cnt if month_cnt > 0 else 0

    # 2. 퀴즈 통계
    quiz_records = db.query(models.QuizHistory).filter(models.QuizHistory.user_id == current_user.id).all()
    play_quiz = len(quiz_records)
    quiz_correct = sum(q.score for q in quiz_records)
    quiz_total = sum(q.total_questions for q in quiz_records)
    quiz_correct_rate = int((quiz_correct / quiz_total) * 100) if quiz_total > 0 else 0

    # 3. 실시간 대전 통계
    battle_records = db.query(models.BattleHistory).filter(models.BattleHistory.user_id == current_user.id).all()
    play_battle = len(battle_records)
    battle_wpm_total = 0
    battle_wins = 0
    for b in battle_records:
        battle_wpm_total += b.wpm
        if b.rank == 1:
            battle_wins += 1

    avg_battle_wpm = battle_wpm_total // play_battle if play_battle > 0 else 0
    battle_win_rate = int((battle_wins / play_battle) * 100) if play_battle > 0 else 0

    return {
        "success": True,
        "avg_wpm": avg_wpm,
        "wpm_week": avg_week_wpm,
        "wpm_lastweek": avg_last_week_wpm,
        "wpm_month": avg_month_wpm,
        "play_typing": play_typing,
        "play_quiz": play_quiz,
        "quiz_correct_rate": quiz_correct_rate,
        "quiz_total_correct": quiz_correct,
        "play_battle": play_battle,
        "battle_win_rate": battle_win_rate,
        "battle_avg_wpm": avg_battle_wpm
    }
