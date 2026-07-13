from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models
from core.security import get_current_user
from database import get_db

router = APIRouter(prefix="/api", tags=["typo_stats"])


class TypoPayloadItem(BaseModel):
    character: str
    error_count: int


class TotalPayloadItem(BaseModel):
    character: str
    total_count: int


class RomajiPatternItem(BaseModel):
    kana: str
    expected: str
    typed: str
    error_count: int


class TypoStatsRequest(BaseModel):
    typos: List[TypoPayloadItem]
    totals: List[TotalPayloadItem] = []
    romaji_patterns: List[RomajiPatternItem] = []
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

        # 1. Update totals
        for total_item in req.totals:
            existing = db.query(models.TypoStat).filter(
                models.TypoStat.user_id == current_user.id,
                models.TypoStat.character_typed == total_item.character
            ).first()
            if existing:
                existing.total_count += total_item.total_count
            else:
                db.add(models.TypoStat(
                    user_id=current_user.id,
                    character_typed=total_item.character,
                    error_count=0,
                    total_count=total_item.total_count
                ))
            if req.content_id:
                content_existing = db.query(models.ContentTypoStat).filter(
                    models.ContentTypoStat.user_id == current_user.id,
                    models.ContentTypoStat.content_id == req.content_id,
                    models.ContentTypoStat.character_typed == total_item.character
                ).first()
                if content_existing:
                    content_existing.total_count += total_item.total_count
                else:
                    db.add(models.ContentTypoStat(
                        user_id=current_user.id,
                        content_id=req.content_id,
                        character_typed=total_item.character,
                        error_count=0,
                        total_count=total_item.total_count
                    ))

        db.flush()
        # 2. Update errors
        for typo_item in req.typos:
            existing = db.query(models.TypoStat).filter(
                models.TypoStat.user_id == current_user.id,
                models.TypoStat.character_typed == typo_item.character
            ).first()
            if existing:
                existing.error_count += typo_item.error_count
            else:
                db.add(models.TypoStat(
                    user_id=current_user.id,
                    character_typed=typo_item.character,
                    error_count=typo_item.error_count,
                    total_count=0
                ))
            if req.content_id:
                content_existing = db.query(models.ContentTypoStat).filter(
                    models.ContentTypoStat.user_id == current_user.id,
                    models.ContentTypoStat.content_id == req.content_id,
                    models.ContentTypoStat.character_typed == typo_item.character
                ).first()
                if content_existing:
                    content_existing.error_count += typo_item.error_count
                else:
                    db.add(models.ContentTypoStat(
                        user_id=current_user.id,
                        content_id=req.content_id,
                        character_typed=typo_item.character,
                        error_count=typo_item.error_count,
                        total_count=0
                    ))

        db.flush()
        # 3. Update romaji patterns
        for pattern_item in req.romaji_patterns:
            existing = db.query(models.RomajiMistake).filter(
                models.RomajiMistake.user_id == current_user.id,
                models.RomajiMistake.kana == pattern_item.kana,
                models.RomajiMistake.expected_romaji == pattern_item.expected,
                models.RomajiMistake.typed_romaji == pattern_item.typed
            ).first()
            if existing:
                existing.error_count += pattern_item.error_count
            else:
                db.add(models.RomajiMistake(
                    user_id=current_user.id,
                    kana=pattern_item.kana,
                    expected_romaji=pattern_item.expected,
                    typed_romaji=pattern_item.typed,
                    error_count=pattern_item.error_count
                ))
            if req.content_id:
                content_existing = db.query(models.ContentRomajiMistake).filter(
                    models.ContentRomajiMistake.user_id == current_user.id,
                    models.ContentRomajiMistake.content_id == req.content_id,
                    models.ContentRomajiMistake.kana == pattern_item.kana,
                    models.ContentRomajiMistake.expected_romaji == pattern_item.expected,
                    models.ContentRomajiMistake.typed_romaji == pattern_item.typed
                ).first()
                if content_existing:
                    content_existing.error_count += pattern_item.error_count
                else:
                    db.add(models.ContentRomajiMistake(
                        user_id=current_user.id,
                        content_id=req.content_id,
                        kana=pattern_item.kana,
                        expected_romaji=pattern_item.expected,
                        typed_romaji=pattern_item.typed,
                        error_count=pattern_item.error_count
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
    kana_total_errors = {}
    for stat in stats:
        data.append({
            "kana": stat.character_typed,
            "error_count": stat.error_count,
            "total_count": stat.total_count
        })
        kana_total_errors[stat.character_typed] = stat.error_count

    if content_id:
        romaji_stats = db.query(models.ContentRomajiMistake).filter(
            models.ContentRomajiMistake.user_id == current_user.id,
            models.ContentRomajiMistake.content_id == content_id
        ).all()
    else:
        romaji_stats = db.query(models.RomajiMistake).filter(models.RomajiMistake.user_id == current_user.id).all()
    romaji_patterns = []
    for rm in romaji_stats:
        total_for_kana = kana_total_errors.get(rm.kana, 0)
        pct = int((rm.error_count / total_for_kana * 100)) if total_for_kana > 0 else 0
        romaji_patterns.append({
            "char": rm.kana,
            "correct": rm.expected_romaji,
            "wrong": rm.typed_romaji,
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
        "pairs": [],
        "romaji_patterns": romaji_patterns
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
