from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pymysql
import json

app = FastAPI()

# 🌟 중요: 프론트엔드(Live Server 등)에서 백엔드 API에 접근할 수 있도록 CORS 설정을 허용합니다.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 실제 서비스 시에는 특정 도메인만 지정하는 것이 안전합니다.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MySQL 데이터베이스 연결 함수
def get_db_connection():
    return pymysql.connect(
        host="localhost",
        user="root",          # 본인의 MySQL 계정명
        password="1234",  # 본인의 MySQL 비밀번호
        database="typing_db",
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor  # 딕셔너리 형태로 결과를 받기 위함
    )

@app.get("/api/lyrics/{song_id}")
async def get_lyrics(song_id: int):
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            sql = "SELECT lyrics_json FROM song_lyrics WHERE id = %s"
            cursor.execute(sql, (song_id,))
            result = cursor.fetchone()
            
            if not result:
                raise HTTPException(status_code=404, detail="Song not found")
            
            lyrics_data = result['lyrics_json']
            
            # 🌟 [안전장치] 데이터가 문자열(str)인지 객체(dict/list)인지 정확히 체크
            if isinstance(lyrics_data, str):
                lyrics_data = json.loads(lyrics_data)
            elif isinstance(lyrics_data, (list, dict)):
                # 이미 객체 상태라면 파싱 없이 그대로 사용합니다.
                pass
                
            return lyrics_data  
            
    except Exception as e:
        # 🌟 터미널에 정확히 무슨 에러가 났는지 구체적으로 출력하도록 로그 추가
        print(f"❌ 백엔드 에러 발생 원인: {type(e).__name__} - {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        connection.close()

# 실행 방법: 터미널에 `uvicorn main:app --reload` 입력