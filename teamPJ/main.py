from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import mysql.connector
from mysql.connector import errors as mysql_errors
from fastapi.staticfiles import StaticFiles


app = FastAPI()

app.add_middleware(
CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    )

DB_NAME = "typingdb"

def get_conn(with_database=True):
    config = {
        "host":"localhost",
        "user":"root",
        "password":"Choi0153"
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
    
    conn = get_conn(with_database=False)
    cursor = conn.cursor()
    
    cursor.execute(
        f"CREATE DATABASE IF NOT EXISTS {DB_NAME}"
    )
    
    conn.commit()
    
    cursor.close()
    conn.close()
    
    conn = get_conn()
    cursor = conn.cursor()
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS songs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(100) NOT NULL,
        youtube_id VARCHAR(50)
    )
    """)
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS lyrics(
        id INT AUTO_INCREMENT PRIMARY KEY,
        song_id INT NOT NULL,
        display_time FLOAT NOT NULL,
        lyric_text VARCHAR (255) NOT NULL,
        FOREIGN KEY(song_id) REFERENCES songs(id)
        )"""
    )
    
    conn.commit()
    cursor.close()
    conn.close()
    
class SongCreate(BaseModel):
    title: str
    youtube_id: str
    
@app.post("/songs")
def create_song(
    song: SongCreate,
    db=Depends(get_db)
):
    conn, cursor = db

    cursor.execute(
        """
        INSERT INTO songs(title, youtube_id)
        VALUES(%s, %s)
        """,
        (song.title, song.youtube_id)
    )

    conn.commit()

    return {"message": "登録成功"}

class LyricCreate(BaseModel):
    song_id: int
    display_time: float
    lyric_text: str
    
@app.post("/lyrics")
def create_lyric(
    lyric: LyricCreate,
    db=Depends(get_db)
):
    conn, cursor = db

    cursor.execute(
        """
        INSERT INTO lyrics(
            song_id,
            display_time,
            lyric_text
        )
        VALUES(%s, %s, %s)
        """,
        (
            lyric.song_id,
            lyric.display_time,
            lyric.lyric_text
        )
    )

    conn.commit()

    return {
        "message": "歌詞登録成功"
    }
    
@app.get("/lyrics/{song_id}")
def get_lyrics(
    song_id: int,
    db=Depends(get_db)
):
    conn, cursor = db

    cursor = conn.cursor(dictionary=True)

    cursor.execute(
        """
        SELECT
            display_time,
            lyric_text
        FROM lyrics
        WHERE song_id = %s
        ORDER BY display_time
        """,
        (song_id,)
    )

    lyrics = cursor.fetchall()

    return lyrics

@app.get("/songs")
def get_songs(
    db=Depends(get_db)
):
    conn, cursor = db

    cursor = conn.cursor(dictionary=True)

    cursor.execute("""
        SELECT
            id,
            title,
            youtube_id
        FROM songs
        ORDER BY id
    """)

    songs = cursor.fetchall()

    return songs

app.mount(
    "/static",
    StaticFiles(directory="static"),
    name="static"
)