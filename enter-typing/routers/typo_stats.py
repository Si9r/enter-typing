from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models
from core.security import get_current_user
from database import get_db

router = APIRouter(prefix="/api", tags=["typo_stats"])


class KeyTypoItem(BaseModel):
    expected_key: str   # 의도했던 키
    typo_key: str       # 실제로 잘못 누른 키
    error_count: int


class KeyTotalItem(BaseModel):
    key: str
    total_count: int


class TypoStatsRequest(BaseModel):
    key_typos: List[KeyTypoItem] = []
    key_totals: List[KeyTotalItem] = []
    content_id: int | None = None


# ════════════════════════════════════════════════════════════
# API: 오타 통계 저장
# POST /api/typo-stats
# ════════════════════════════════════════════════════════════
@router.post("/typo-stats")
def save_typo_stats(req: TypoStatsRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    try:
        if req.content_id:
            # 콘텐츠의 가장 최근 플레이 기록만 유지하도록 기존 통계 삭제
            db.query(models.ContentTypoStat).filter(
                models.ContentTypoStat.user_id == current_user.id,
                models.ContentTypoStat.content_id == req.content_id
            ).delete()
            db.query(models.ContentRomajiMistake).filter(
                models.ContentRomajiMistake.user_id == current_user.id,
                models.ContentRomajiMistake.content_id == req.content_id
            ).delete()
            db.flush()

        # 1. 키별 총 입력 횟수(total_count) 누적 (없으면 error_count=0으로 생성)
        for total_item in req.key_totals:
            existing = db.query(models.TypoStat).filter(
                models.TypoStat.user_id == current_user.id,
                models.TypoStat.key_char == total_item.key
            ).first()
            if existing:
                existing.total_count += total_item.total_count
            else:
                db.add(models.TypoStat(
                    user_id=current_user.id,
                    key_char=total_item.key,
                    error_count=0,
                    total_count=total_item.total_count
                ))
            if req.content_id:
                content_existing = db.query(models.ContentTypoStat).filter(
                    models.ContentTypoStat.user_id == current_user.id,
                    models.ContentTypoStat.content_id == req.content_id,
                    models.ContentTypoStat.key_char == total_item.key
                ).first()
                if content_existing:
                    content_existing.total_count += total_item.total_count
                else:
                    db.add(models.ContentTypoStat(
                        user_id=current_user.id,
                        content_id=req.content_id,
                        key_char=total_item.key,
                        error_count=0,
                        total_count=total_item.total_count
                    ))

        db.flush()
        # 2. 키별 오타 통계 갱신
        #    (a) TypoStat: expected_key(=key_char) 행의 error_count 누적
        #    (b) RomajiMistake: (expected_key, typo_key) 조합의 error_count 누적
        for typo_item in req.key_typos:
            # (a) expected_key 기준 TypoStat error_count 누적
            existing = db.query(models.TypoStat).filter(
                models.TypoStat.user_id == current_user.id,
                models.TypoStat.key_char == typo_item.expected_key
            ).first()
            if existing:
                existing.error_count += typo_item.error_count
            else:
                db.add(models.TypoStat(
                    user_id=current_user.id,
                    key_char=typo_item.expected_key,
                    error_count=typo_item.error_count,
                    total_count=0
                ))
            if req.content_id:
                content_existing = db.query(models.ContentTypoStat).filter(
                    models.ContentTypoStat.user_id == current_user.id,
                    models.ContentTypoStat.content_id == req.content_id,
                    models.ContentTypoStat.key_char == typo_item.expected_key
                ).first()
                if content_existing:
                    content_existing.error_count += typo_item.error_count
                else:
                    db.add(models.ContentTypoStat(
                        user_id=current_user.id,
                        content_id=req.content_id,
                        key_char=typo_item.expected_key,
                        error_count=typo_item.error_count,
                        total_count=0
                    ))

            # (b) (expected_key, typo_key) 조합별 RomajiMistake error_count 누적
            mistake_existing = db.query(models.RomajiMistake).filter(
                models.RomajiMistake.user_id == current_user.id,
                models.RomajiMistake.expected_key == typo_item.expected_key,
                models.RomajiMistake.typo_key == typo_item.typo_key
            ).first()
            if mistake_existing:
                mistake_existing.error_count += typo_item.error_count
            else:
                db.add(models.RomajiMistake(
                    user_id=current_user.id,
                    expected_key=typo_item.expected_key,
                    typo_key=typo_item.typo_key,
                    error_count=typo_item.error_count
                ))
            if req.content_id:
                content_mistake = db.query(models.ContentRomajiMistake).filter(
                    models.ContentRomajiMistake.user_id == current_user.id,
                    models.ContentRomajiMistake.content_id == req.content_id,
                    models.ContentRomajiMistake.expected_key == typo_item.expected_key,
                    models.ContentRomajiMistake.typo_key == typo_item.typo_key
                ).first()
                if content_mistake:
                    content_mistake.error_count += typo_item.error_count
                else:
                    db.add(models.ContentRomajiMistake(
                        user_id=current_user.id,
                        content_id=req.content_id,
                        expected_key=typo_item.expected_key,
                        typo_key=typo_item.typo_key,
                        error_count=typo_item.error_count
                    ))
        db.commit()
        return {"success": True, "message": "오타 통계가 저장되었습니다."}
    except Exception as e:
        db.rollback()
        print(f"Error saving typo stats: {e}")
        raise HTTPException(status_code=500, detail="오타 통계 저장 중 오류가 발생했습니다.")


# ════════════════════════════════════════════════════════════
# API: 오타 통계 조회
# GET /api/typo-stats
# ════════════════════════════════════════════════════════════
@router.get("/typo-stats")
def get_typo_stats(content_id: Optional[int] = None, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if content_id:
        stats = db.query(models.ContentTypoStat).filter(
            models.ContentTypoStat.user_id == current_user.id,
            models.ContentTypoStat.content_id == content_id
        ).all()
    else:
        stats = db.query(models.TypoStat).filter(models.TypoStat.user_id == current_user.id).all()

    total_typos = sum(stat.error_count for stat in stats)
    total_chars = sum(stat.total_count for stat in stats)

    avg_error_rate = (total_typos / total_chars * 100) if total_chars > 0 else 0

    data = []
    key_total_errors = {}
    for stat in stats:
        data.append({
            "key": stat.key_char,
            "error_count": stat.error_count,
            "total_count": stat.total_count
        })
        key_total_errors[stat.key_char] = stat.error_count

    if content_id:
        mistake_stats = db.query(models.ContentRomajiMistake).filter(
            models.ContentRomajiMistake.user_id == current_user.id,
            models.ContentRomajiMistake.content_id == content_id
        ).all()
    else:
        mistake_stats = db.query(models.RomajiMistake).filter(models.RomajiMistake.user_id == current_user.id).all()
    key_patterns = []
    for rm in mistake_stats:
        # expected_key의 총 error_count 대비 이 (expected_key, typo_key) 조합의 비율
        total_for_key = key_total_errors.get(rm.expected_key, 0)
        pct = int((rm.error_count / total_for_key * 100)) if total_for_key > 0 else 0
        key_patterns.append({
            "expected_key": rm.expected_key,
            "typo_key": rm.typo_key,
            "error_count": rm.error_count,
            "pct": pct
        })

    return {
        "success": True,
        "summary": {
            "avg_error_rate": avg_error_rate,
            "total_typos": total_typos,
            "improvement": 0  # Dummy improvement for now
        },
        "data": data,
        "key_patterns": key_patterns
    }


# ════════════════════════════════════════════════════════════
# API: 오타 통계 초기화
# DELETE /api/typo-stats
# ════════════════════════════════════════════════════════════
@router.delete("/typo-stats")
def reset_typo_stats(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    db.query(models.TypoStat).filter(models.TypoStat.user_id == current_user.id).delete()
    db.query(models.RomajiMistake).filter(models.RomajiMistake.user_id == current_user.id).delete()
    db.query(models.ContentTypoStat).filter(models.ContentTypoStat.user_id == current_user.id).delete()
    db.query(models.ContentRomajiMistake).filter(models.ContentRomajiMistake.user_id == current_user.id).delete()
    db.commit()
    return {"success": True, "message": "오타 기록이 초기화되었습니다."}


# ════════════════════════════════════════════════════════════
# API: 오타 분석 대상 콘텐츠 목록 조회
# GET /api/typo-content-list
# ════════════════════════════════════════════════════════════
@router.get("/typo-content-list")
def get_typo_content_list(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    content_ids = db.query(models.ContentTypoStat.content_id).filter(
        models.ContentTypoStat.user_id == current_user.id
    ).distinct().all()

    content_ids = [c[0] for c in content_ids]

    if not content_ids:
        return {"success": True, "contents": []}

    contents = db.query(models.TypingContent).filter(
        models.TypingContent.id.in_(content_ids)
    ).all()

    return {
        "success": True,
        "contents": [{"id": c.id, "title": c.title} for c in contents]
    }
