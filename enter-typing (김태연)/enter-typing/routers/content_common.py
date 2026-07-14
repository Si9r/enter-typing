"""타이핑/퀴즈 콘텐츠 라우터가 공유하는 헬퍼 함수 모음."""
import json

from fastapi import HTTPException
from sqlalchemy.orm import Session

import models


def get_content_or_404(model, content_id: int, db: Session):
    content = db.query(model).filter(model.id == content_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="콘텐츠를 찾을 수 없습니다.")
    return content


def check_owner_or_403(content, current_user: models.User, message: str = "수정 권한이 없습니다."):
    if content.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail=message)


def creator_nickname(content) -> str:
    return content.creator.nickname if content.creator else "엔터핑"


def increment_play_count(model, content_id: int, db: Session) -> int:
    content = get_content_or_404(model, content_id, db)
    content.play_count = (content.play_count or 0) + 1
    db.commit()
    return content.play_count


def quiz_question_count(content) -> int:
    try:
        return len(json.loads(content.quiz_data)) if content.quiz_data else 0
    except Exception:
        return 0
