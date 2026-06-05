from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import mysql.connector

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

DB_NAME = "jsdb"

def get_conn(with_database=True):
    config = {
        "host":"localhost",
        "user":"root",
        "password":"Choi0153"
    }
    
    if with_database:
        config["database"] = DB_NAME
    
    return mysql.connector.connect(**config)

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
    CREATE TABLE IF NOT EXISTS Contents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        topic VARCHAR(100),
        keyword VARCHAR(100),
        text TEXT
    )
    """)
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS Log (
        id INT AUTO_INCREMENT PRIMARY KEY,
        topic VARCHAR(100),
        keyword VARCHAR(100),
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    conn.commit()
    conn.close()
    
class SearchData(BaseModel):
    topic: str
    keyword: str
    
@app.post("search")
def search(data: SearchData):
    conn = get_conn()
    cursor = conn.cursor(dictionary=True)
    
    log_sql = """
    INSERT INTO Log(topic, keyword)
    VALUES (%s,%s)
    """
    cursor.execute(log_sql, (data.topic, data.keyword))
    conn.commit
    
    search_sql = """
    SELECT text FEOM Contents
    WHERE topic=%s OR keywors=%s
    """
    
    cursor.execute(search_sql, (data.topic,data.keyword))
    
    result = cursor.fetchone()
    
    cursor.close()
    conn.close()
    
    if result:
        return{
            "text":result["text"]
        }
    
    return {
        "text":"データが見つかりません"
    }
