"""수동 DB 마이그레이션. 배포 시 서버를 재시작하기 전에 `python migrate.py` 를 한 번 실행한다.

여러 번 실행해도 안전하도록 각 단계가 현재 스키마를 확인한 뒤에만 변경한다.
(예전에는 앱 시작 때마다 ALTER/DROP 을 실행하며 예외를 삼켰는데, 운영 데이터 유실 위험이 있어 분리했다.)
"""
from sqlalchemy import inspect, text

import models
from database import engine


def columns(table: str) -> set:
    return {c["name"] for c in inspect(engine).get_columns(table)}


def main():
    # 새 테이블 생성 (기존 테이블은 건드리지 않는다)
    models.Base.metadata.create_all(bind=engine)

    with engine.begin() as conn:
        if "thumbnail_url" not in columns("quiz_contents"):
            conn.execute(text("ALTER TABLE quiz_contents ADD COLUMN thumbnail_url VARCHAR(255) DEFAULT NULL"))
            print("quiz_contents.thumbnail_url 추가")

        if "allow_split_sokuon" in columns("users"):
            conn.execute(text("ALTER TABLE users DROP COLUMN allow_split_sokuon"))
            print("users.allow_split_sokuon 제거")

        if "is_admin" not in columns("users"):
            conn.execute(text("ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT 0"))
            # 기존 규칙(id 1~9 = 관리자)을 최초 1회만 컬럼으로 옮긴다.
            conn.execute(text("UPDATE users SET is_admin = 1 WHERE id BETWEEN 1 AND 9"))
            print("users.is_admin 추가 (id 1~9 유저를 관리자로 승격)")

    print("마이그레이션 완료")


if __name__ == "__main__":
    main()
