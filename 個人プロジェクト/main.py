from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
import mysql.connector
import bcrypt
from typing import Optional, List

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MySQL Configuration
db_config = {
    'host': 'localhost',
    'user': 'root',
    'password': 'Choi0153',
    'database': 'motto_db'
}

# Pydantic models
class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str
    confirm_password: str

class LoginRequest(BaseModel):
    username: str
    password: str

class MovieRequest(BaseModel):
    user_id: int
    movie_title: str

class MovieDeleteRequest(BaseModel):
    user_id: int
    movie_id: int

def get_db_connection():
    try:
        connection = mysql.connector.connect(**db_config)
        return connection
    except mysql.connector.Error as err:
        print(f"Error connecting to MySQL: {err}")
        return None

def create_tables():
    connection = get_db_connection()
    if connection is None:
        return
    
    cursor = connection.cursor()
    
    # Create users table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    """)
    
    # Create favorite_movies table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS favorite_movies (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            movie_title VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)
    
    # Create recently_watched table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS recently_watched (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            movie_title VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)
    
    connection.commit()
    cursor.close()
    connection.close()
    print("Tables created successfully")

@app.on_event("startup")
async def startup_event():
    create_tables()

@app.post("/api/register")
async def register(data: RegisterRequest):
    try:
        # Validation
        if not data.username or not data.email or not data.password or not data.confirm_password:
            raise HTTPException(status_code=400, detail='すべてのフィールドを入力してください')
        
        if data.password != data.confirm_password:
            raise HTTPException(status_code=400, detail='パスワードが一致しません')
        
        if len(data.password) < 6:
            raise HTTPException(status_code=400, detail='パスワードは6文字以上である必要があります')
        
        # Hash password
        password_hash = bcrypt.hashpw(data.password.encode('utf-8'), bcrypt.gensalt())
        
        # Insert user
        connection = get_db_connection()
        if connection is None:
            raise HTTPException(status_code=500, detail='データベース接続エラー')
        
        cursor = connection.cursor()
        
        try:
            cursor.execute(
                "INSERT INTO users (username, email, password_hash) VALUES (%s, %s, %s)",
                (data.username, data.email, password_hash.decode('utf-8'))
            )
            connection.commit()
            cursor.close()
            connection.close()
            
            return {'message': '会員登録が成功しました', 'username': data.username}
        except mysql.connector.IntegrityError as err:
            cursor.close()
            connection.close()
            if 'username' in str(err):
                raise HTTPException(status_code=400, detail='このユーザー名は既に使用されています')
            elif 'email' in str(err):
                raise HTTPException(status_code=400, detail='このメールアドレスは既に使用されています')
            raise HTTPException(status_code=400, detail='登録に失敗しました')
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/login")
async def login(data: LoginRequest):
    try:
        if not data.username or not data.password:
            raise HTTPException(status_code=400, detail='ユーザー名とパスワードを入力してください')
        
        connection = get_db_connection()
        if connection is None:
            raise HTTPException(status_code=500, detail='データベース接続エラー')
        
        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            "SELECT id, username, email, password_hash FROM users WHERE username = %s",
            (data.username,)
        )
        user = cursor.fetchone()
        cursor.close()
        connection.close()
        
        if user and bcrypt.checkpw(data.password.encode('utf-8'), user['password_hash'].encode('utf-8')):
            return {
                'message': 'ログイン成功',
                'user': {
                    'id': user['id'],
                    'username': user['username'],
                    'email': user['email']
                }
            }
        else:
            raise HTTPException(status_code=401, detail='ユーザー名またはパスワードが間違っています')
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/favorite-movies")
async def get_favorite_movies(user_id: int):
    try:
        connection = get_db_connection()
        if connection is None:
            raise HTTPException(status_code=500, detail='データベース接続エラー')
        
        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            "SELECT id, movie_title, created_at FROM favorite_movies WHERE user_id = %s ORDER BY created_at DESC",
            (user_id,)
        )
        movies = cursor.fetchall()
        cursor.close()
        connection.close()
        
        return {'movies': movies}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/favorite-movies")
async def add_favorite_movie(data: MovieRequest):
    try:
        if not data.movie_title:
            raise HTTPException(status_code=400, detail='映画タイトルを入力してください')
        
        connection = get_db_connection()
        if connection is None:
            raise HTTPException(status_code=500, detail='データベース接続エラー')
        
        cursor = connection.cursor()
        cursor.execute(
            "INSERT INTO favorite_movies (user_id, movie_title) VALUES (%s, %s)",
            (data.user_id, data.movie_title)
        )
        connection.commit()
        cursor.close()
        connection.close()
        
        return {'message': '映画を追加しました'}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/favorite-movies")
async def delete_favorite_movie(data: MovieDeleteRequest):
    try:
        connection = get_db_connection()
        if connection is None:
            raise HTTPException(status_code=500, detail='データベース接続エラー')
        
        cursor = connection.cursor()
        cursor.execute(
            "DELETE FROM favorite_movies WHERE id = %s AND user_id = %s",
            (data.movie_id, data.user_id)
        )
        connection.commit()
        cursor.close()
        connection.close()
        
        return {'message': '映画を削除しました'}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/recently-watched")
async def get_recently_watched(user_id: int):
    try:
        connection = get_db_connection()
        if connection is None:
            raise HTTPException(status_code=500, detail='データベース接続エラー')
        
        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            "SELECT id, movie_title, created_at FROM recently_watched WHERE user_id = %s ORDER BY created_at DESC LIMIT 10",
            (user_id,)
        )
        movies = cursor.fetchall()
        cursor.close()
        connection.close()
        
        return {'movies': movies}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/recently-watched")
async def add_recently_watched(data: MovieRequest):
    try:
        if not data.movie_title:
            raise HTTPException(status_code=400, detail='映画タイトルを入力してください')
        
        connection = get_db_connection()
        if connection is None:
            raise HTTPException(status_code=500, detail='データベース接続エラー')
        
        cursor = connection.cursor()
        cursor.execute(
            "INSERT INTO recently_watched (user_id, movie_title) VALUES (%s, %s)",
            (data.user_id, data.movie_title)
        )
        connection.commit()
        cursor.close()
        connection.close()
        
        return {'message': '映画を追加しました'}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

