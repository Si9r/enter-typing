from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend import models
from backend.auth import get_current_user
from backend.database import get_db
from backend.schemas import AttendanceRequest


router = APIRouter()


@router.get("/api/attendance")
def get_attendance(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    records = db.query(models.Attendance).filter(models.Attendance.user_id == current_user.id).all()
    # 날짜 문자열 리스트로 변환
    dates = [r.attend_date for r in records]
    return {"success": True, "dates": dates}


@router.post("/api/attendance")
def do_attendance(req: AttendanceRequest, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    # 중복 체크
    existing = db.query(models.Attendance).filter(
        models.Attendance.user_id == current_user.id,
        models.Attendance.attend_date == req.date
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="이미 오늘 출석체크를 완료하셨습니다.")
        
    # 새로운 출석 객체 생성 및 DB 저장
    new_attendance = models.Attendance(
        user_id=current_user.id,
        attend_date=req.date
    )
    db.add(new_attendance)
    db.commit()
    
    return {"success": True, "message": "출석체크가 성공적으로 완료되었습니다!"}

