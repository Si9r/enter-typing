from pathlib import Path

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

DB_NAME = "tpdb"

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
    CREATE TABLE IF NOT EXISTS memberregist (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        password VARCHAR(50),
        email VARCHAR(255) UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    conn.commit()
    cursor.close()
    conn.close()
    
class RegisterUser(BaseModel):
    username: str
    password: str
    email: str
    
class LoginUser(BaseModel):
    username: str
    password: str
    
def validate_register(user: RegisterUser) -> tuple[str, str, str]:
    username = (user.username or "").strip()
    password = (user.password or "").strip()
    email = (user.email or "").strip()
    if not username:
        raise HTTPException(status_code=400, detail="ユーザー名を入力してください")
    if not password:
        raise HTTPException(status_code=400, detail="パスワードを入力してください")
    if not email:
        raise HTTPException(status_code=400, detail="メールアドレスを入力してください")
    return username, password, email

def validate_login(user: LoginUser) -> tuple[str, str]:
    username = (user.username or "").strip()
    password = (user.password or "").strip()

    if not username:
        raise HTTPException(
            status_code=400,
            detail="ユーザー名を入力してください"
        )

    if not password:
        raise HTTPException(
            status_code=400,
            detail="パスワードを入力してください"
        )

    return username, password


@app.get("/")
def root():
    return RedirectResponse(url="/TPregister.html")


@app.post("/register", status_code=201)
def register(user: RegisterUser, db=Depends(get_db)):
    conn, cursor = db
    username, password, email = validate_register(user)
    try:
        cursor.execute(
            "INSERT INTO memberregist(username, password, email) VALUES (%s, %s,%s)",
            (username, password, email),
        )
        conn.commit()
    except mysql_errors.IntegrityError as e:
        conn.rollback()
        if e.errno == 1062: 
            raise HTTPException(
                status_code=409,
                detail="このユーザー名はすでに使われています",
            ) from e
        raise HTTPException(status_code=500, detail="データベースエラー") from e
    except mysql_errors.Error as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail="データベースエラー") from e
    return {"message": "登録完了"}

@app.post("/login")
def login(user: LoginUser, db=Depends(get_db)):
    conn, cursor = db
    username, password = validate_login(user)
    try:
        cursor.execute(
            "SELECT * FROM memberregist WHERE username=%s AND password=%s",
            (username, password),
        )
        result = cursor.fetchone()
    except mysql_errors.Error as e:
        raise HTTPException(status_code=500, detail="データベースエラー") from e
    if result:
        return {"message": "ログイン成功"}
    raise HTTPException(status_code=401, detail="ログイン失敗")


# HTML / CSS 配信（APIルートの後に登録）
app.mount("/", StaticFiles(directory=str(BASE_DIR), html=True), name="tp_static")