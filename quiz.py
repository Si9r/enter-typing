from pathlib import Path
import random
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import mysql.connector
from mysql.connector import errors as mysql_errors

BASE_DIR = Path(__file__).resolve().parent

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_NAME = "quizdb"

def get_conn(with_database=True):
    config = {
        "host": "localhost",
        "user": "root",
        "password": "Choi0153"
    }
    if with_database:
        config["database"] = DB_NAME
    return mysql.connector.connect(**config)

def get_db():
    conn = get_conn()
    cursor = conn.cursor()
    try:
        yield conn, cursor
    finally:
        cursor.close()
        conn.close()

@app.on_event("startup")
def init_db():
    # 1. Create DB if not exists
    conn = get_conn(with_database=False)
    cursor = conn.cursor()
    cursor.execute(f"CREATE DATABASE IF NOT EXISTS {DB_NAME}")
    conn.commit()
    cursor.close()
    conn.close()

    # 2. Create tables
    conn = get_conn()
    cursor = conn.cursor()
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS quiz_songs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        official_title VARCHAR(100) NOT NULL,
        youtube_id VARCHAR(50) NOT NULL,
        start_time FLOAT NOT NULL DEFAULT 0.0,
        duration FLOAT NOT NULL DEFAULT 20.0
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS acceptable_answers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        song_id INT NOT NULL,
        answer_text VARCHAR(100) NOT NULL,
        FOREIGN KEY (song_id) REFERENCES quiz_songs(id) ON DELETE CASCADE
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS quiz_scores (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL,
        score INT NOT NULL,
        played_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    """)

    conn.commit()

    # 3. Seed popular J-Pop songs one-by-one if not exists
    songs_data = [
        # (Official Title, YouTube ID, Start Time, Duration, [List of Acceptable Answers])
        ("Lemon", "j_rM7SpA-Gg", 70.0, 45.0, ["lemon", "れもん", "レモン"]),
        ("ハルカ", "vd3IlOjSUGQ", 52.0, 45.0, ["ハルカ", "はるか", "haruka"]),
        ("マリーゴールド", "0xSiBpUdW4E", 80.0, 45.0, ["マリーゴールド", "まりーごーるど", "marigold", "マリー ゴールド"]),
        ("夜に駆ける", "by4SYYWlhEs", 60.0, 45.0, ["夜に駆ける", "よるにかける", "yoru ni kakeru", "yorunikakeru", "racing into the night", "夜にかける"]),
        ("Pretender", "TQ8WlA2GXbk", 90.0, 45.0, ["pretender", "プリテンダー", "ぷりてんだー"]),
        ("白日", "ony53KuCwMc", 95.0, 45.0, ["白日", "はくじつ", "hakujitsu"])
    ]
    
    for official_title, youtube_id, start_time, duration, answers in songs_data:
        cursor.execute("SELECT id FROM quiz_songs WHERE official_title = %s", (official_title,))
        row = cursor.fetchone()
        if not row:
            cursor.execute(
                "INSERT INTO quiz_songs (official_title, youtube_id, start_time, duration) VALUES (%s, %s, %s, %s)",
                (official_title, youtube_id, start_time, duration)
            )
            song_id = cursor.lastrowid
            
            # Seed acceptable answers (always store normalized lower-case)
            for ans in answers:
                cursor.execute(
                    "INSERT INTO acceptable_answers (song_id, answer_text) VALUES (%s, %s)",
                    (song_id, ans.strip().lower())
                )
        else:
            cursor.execute(
                "UPDATE quiz_songs SET youtube_id = %s, start_time = %s, duration = %s WHERE official_title = %s",
                (youtube_id, start_time, duration, official_title)
            )
    conn.commit()

    cursor.close()
    conn.close()

# Pydantic schemas
class GuessSubmit(BaseModel):
    song_id: int
    guess: str

class ScoreSubmit(BaseModel):
    username: str
    score: int

# API routes

@app.get("/api/quiz/questions")
def get_questions(db=Depends(get_db)):
    conn, cursor = db
    # Fetch all songs without the official_title to prevent cheating via API responses
    cursor.execute("SELECT id, youtube_id, start_time, duration FROM quiz_songs")
    rows = cursor.fetchall()
    
    questions = [{"id": r[0], "youtube_id": r[1], "start_time": r[2], "duration": r[3]} for r in rows]
    # Return questions shuffled
    random.shuffle(questions)
    return questions

@app.post("/api/quiz/check")
def check_answer(data: GuessSubmit, db=Depends(get_db)):
    conn, cursor = db
    
    # 1. Fetch acceptable answers for this song
    cursor.execute("SELECT answer_text FROM acceptable_answers WHERE song_id = %s", (data.song_id,))
    acceptable = [r[0] for r in cursor.fetchall()]
    
    # Fetch official title to return on answer
    cursor.execute("SELECT official_title FROM quiz_songs WHERE id = %s", (data.song_id,))
    title_row = cursor.fetchone()
    if not title_row:
        raise HTTPException(status_code=404, detail="Song not found")
    official_title = title_row[0]

    # Normalize user's guess (lowercase, trimmed)
    user_guess = data.guess.strip().lower()
    
    # Helper normalization (removing spaces to handle spaces variations)
    user_guess_no_space = user_guess.replace(" ", "").replace("　", "")
    
    correct = False
    for ans in acceptable:
        # Match exact normalized or space-stripped
        ans_no_space = ans.replace(" ", "").replace("　", "")
        if user_guess == ans or user_guess_no_space == ans_no_space:
            correct = True
            break
            
    return {
        "correct": correct,
        "official_title": official_title
    }

@app.post("/api/quiz/scores", status_code=201)
def submit_score(score_data: ScoreSubmit, db=Depends(get_db)):
    conn, cursor = db
    try:
        cursor.execute(
            "INSERT INTO quiz_scores (username, score) VALUES (%s, %s)",
            (score_data.username, score_data.score)
        )
        conn.commit()
    except mysql_errors.Error as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    return {"message": "Score saved successfully"}

@app.get("/api/quiz/scores")
def get_scores(db=Depends(get_db)):
    conn, cursor = db
    cursor.execute(
        "SELECT username, score, played_at FROM quiz_scores ORDER BY score DESC, played_at DESC LIMIT 10"
    )
    rows = cursor.fetchall()
    return [
        {
            "username": r[0],
            "score": r[1],
            "played_at": r[2].isoformat() if r[2] else None
        }
        for r in rows
    ]

# Serve static files from workspace root
app.mount("/", StaticFiles(directory=str(BASE_DIR), html=True), name="static")