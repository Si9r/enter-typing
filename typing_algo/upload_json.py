import pymysql
import json
import os

# 1. MySQL 데이터베이스 연결 설정
def get_db_connection():
    return pymysql.connect(
        host="localhost",
        user="root",          # 본인의 MySQL 계정명
        password="1234",  # 본인의 MySQL 비밀번호
        database="typing_db",
        charset="utf8mb4"
    )

def upload_local_json_to_db(file_path, song_title):
    # JSON 파일이 존재하는지 체크
    if not os.path.exists(file_path):
        print(f"❌ 오류: {file_path} 파일을 찾을 수 없습니다. 경로를 확인하세요.")
        return

    # 2. 로컬 JSON 파일 읽기
    with open(file_path, 'r', encoding='utf-8') as file:
        data = json.load(file)
    
    # 3. 읽어온 파이썬 객체(dict/list)를 MySQL에 들어갈 깔끔한 문자열 포맷으로 변환
    json_string = json.dumps(data, ensure_ascii=False)

    # 4. 데이터베이스에 삽입
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            # 테이블의 기존 데이터를 유지하면서 행을 추가합니다.
            # 만약 1번 ID를 완전히 지우고 새로 밀어버리고 싶다면 상단에 TRUNCATE song_lyrics; 쿼리를 추가해도 좋습니다.
            sql = "INSERT INTO song_lyrics (title, lyrics_json) VALUES (%s, %s)"
            cursor.execute(sql, (song_title, json_string))
            
        connection.commit()
        print(f"✨ 성공: '{song_title}' 데이터가 성공적으로 MySQL에 업로드되었습니다!")
        
    except Exception as e:
        connection.rollback()
        print(f"❌ 데이터베이스 업로드 중 에러 발생: {e}")
    finally:
        connection.close()

# 🚀 스크립트 실행 파트
if __name__ == "__main__":
    # 같은 디렉토리에 있는 test.json을 읽어 'Lemon'이라는 제목으로 저장합니다.
    # 위에 명시한 새로운 구조(videoId 포함)로 test.json을 수정하신 뒤 실행해 보세요!
    json_filename = "test.json" 
    song_name = "Lemon"
    
    upload_local_json_to_db(json_filename, song_name)