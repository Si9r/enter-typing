# パソコンのOSを操作するために機能　ファイル確認、フォルダ作成、環境変化取得、ファイルパス取得
import os
#Dependsは共通処理を使い回す機能（）の中を先に実行して、その結果を使う
#HTTPExceptionはエラーを返す機能
from fastapi import Depends, FastAPI, HTTPException
#CORSMiddlewareはこの通信許可をブラウザに伝えている
from fastapi.middleware.cors import CORSMiddleware
#RedirectResponseは別ページに移動させるもの
from fastapi.responses import RedirectResponse
#StaticFilesはHTML/CSS/JS画像を配信する機能
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import mysql.connector
#MYSQLのエラー集　mysql.connector.errorsだと名前が長いから変更
from mysql.connector import errors as mysql_errors
import secrets
import random
import string
from datetime import datetime, timedelta
import smtplib
from email.mime.text import MIMEText

# FastAPIアプリ開始、サーバーを作る
app = FastAPI()
# ミドルウェアとはリクエスト途中で動く機能のこと
app.add_middleware(
    CORSMiddleware,
    #全部の通信許可
    allow_origins=["*"],
    #Cookieやログイン情報許可
    allow_credentials=True,
    #HTTPメソッド（GPPD）許可
    allow_methods=["*"],
    #ヘッダー許可、通信時の追加情報
    allow_headers=["*"],
)

# --- DB設定---
DB_HOST = "localhost"
DB_USER = "root"
DB_PASSWORD = "Choi0153"
DB_NAME = "memberregist_db"

#データベース接続関数
#wih_database:bool = true
#boolが真偽値
def get_conn(with_database: bool = True):
    if with_database:
        return mysql.connector.connect(
            host=DB_HOST,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
        )
    return mysql.connector.connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASSWORD,
    )

#DB接続管理関数
def get_db():
    conn = get_conn(with_database=True)
    cursor = conn.cursor()
    try:
        #yieldは関数を一時的に停止させることができる
        yield conn, cursor
    finally:
        #何が何でも最終的にはここに辿り着く
        cursor.close()
        conn.close()

#DB初期化関数
@app.on_event("startup")
def init_db():
    # DBが無いと database=... で接続できないので、先にDBなしで作成
    conn = get_conn(with_database=False)
    cursor = conn.cursor()
    try:
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS {DB_NAME}")
        conn.commit()
    finally:
        cursor.close()
        conn.close()

    conn2 = get_conn(with_database=True)
    cursor2 = conn2.cursor()
    try:
        cursor2.execute(
            """
            CREATE TABLE IF NOT EXISTS members(
                id INT PRIMARY KEY AUTO_INCREMENT,
                username VARCHAR(50) NOT NULL UNIQUE,
                password VARCHAR(50),
                email VARCHAR(255) UNIQUE,
                reset_token VARCHAR(255),
                token_expire DATETIME,
                temporary_password BOOLEAN DEFAULT FALSE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )    
            """
        )
        
        
        conn2.commit()

 
        
    finally:
        cursor2.close()
        conn2.close()


# クラス、ユーザーデータの型を作成
class User(BaseModel):
    username: str
    password: str
    email: str
    
class EmailRequest(BaseModel):
    email: str


def validate_user(user: User) -> tuple[str, str]:
    """空入力を弾く（パスワードのハッシュ化は別話題）。"""
    username = (user.username or "").strip()
    password = user.password or ""
    if not username:
        raise HTTPException(status_code=400, detail="ユーザー名を入力してください")
    if not password:
        raise HTTPException(status_code=400, detail="パスワードを入力してください")
    return username, password


# ここからregister API作成、今回はサーバー送信をしないといけないからPOST
# またGETはURLに名前としてついてしまうため、個人情報などが危険
@app.post("/register", status_code=201)
def register(user: User, db=Depends(get_db)):
    conn, cursor = db
    username, password = validate_user(user)
    email = user.email.strip()
    try:
        cursor.execute(
            "INSERT INTO members (username, password, email) VALUES (%s, %s,%s)",
            (username, password, email),
        )
        conn.commit()
    except mysql_errors.IntegrityError as e:
        conn.rollback()
        if e.errno == 1062:  # Duplicate entry
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
def login(user: User, db=Depends(get_db)):
    conn, cursor = db
    username, password = validate_user(user)
    try:
        cursor.execute(
            "SELECT * FROM members WHERE username=%s AND password=%s",
            (username, password),
        )
        result = cursor.fetchone()
    except mysql_errors.Error as e:
        raise HTTPException(status_code=500, detail="データベースエラー") from e
    if result:
        return {"message": "ログイン成功"}
    raise HTTPException(status_code=401, detail="ログイン失敗")



@app.get("/")
def root():
    return RedirectResponse("/web/member-app.html")


_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app.mount(
    "/web",
    StaticFiles(directory=os.path.join(_BASE_DIR, "web")),
    name="web",
)

@app.get("/reset-password")
def reset_password(token:str,db = Depends(get_db)):
    
    conn, cursor = db
    
    cursor.execute(
        "SELECT * FROM members WHERE reset_token=%s",
        (token,)
    ) 
    
    user = cursor.fetchone()
    
    if user:
        expire_time = user[6]
        
        if datetime.now() > expire_time:
            raise HTTPException(
                status_code=400,
                detail="トークンの有効期限が切れてます"
            )
        temp_password = ''.join(
            random.choices(
                string.ascii_letters + string.digits,
                k=10
            )
        )

        cursor.execute(
            """
            UPDATE members
            SET password=%s,
                temporary_password=TRUE
            WHERE reset_token=%s
            """,
            (temp_password, token)
        )

        conn.commit()
        return {"message":"仮パスワード発行","temp_password": temp_password}
    
    raise HTTPException(
        status_code = 404,
        detail = "無効なトークン"
    )
    
@app.post("/forgot-password")
def forgot_password(data: EmailRequest, db=Depends(get_db)):

    conn, cursor = db

    email = data.email.strip()

    # メールアドレス存在確認
    cursor.execute(
        "SELECT * FROM members WHERE email=%s",
        (email,)
    )

    user = cursor.fetchone()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="メールアドレスが存在しません"
        )

    # token生成
    token = secrets.token_urlsafe(32)

    # 有効期限
    expire_time = datetime.now() + timedelta(minutes=30)

    # DB保存
    cursor.execute(
        """
        UPDATE members
        SET reset_token=%s,
            token_expire=%s
        WHERE email=%s
        """,
        (token, expire_time, email)
    )

    conn.commit()
    send_reset_email(email, token)

    return {
    "message": "メール送信完了"
    }

def send_reset_email(to_email: str, token: str):

    gmail = "あなたのgmail@gmail.com"
    app_password = "アプリパスワード"

    reset_link = f"http://localhost:8000/reset-password?token={token}"

    body = f"""
パスワード再設定リンクです。

以下をクリックしてください。

{reset_link}
"""

    msg = MIMEText(body)

    msg["Subject"] = "パスワード再設定"
    msg["From"] = gmail
    msg["To"] = to_email

    server = smtplib.SMTP("smtp.gmail.com", 587)

    server.starttls()

    server.login(gmail, app_password)

    server.send_message(msg)

    server.quit()


"""
API
種類	役割
GET	データ取得
POST	データ送信
PUT	更新
DELETE	削除

CRUDの場合
CRUD	API
Create	POST
Read	GET
Update	PUT
Delete	DELETE
"""
