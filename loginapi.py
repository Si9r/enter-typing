#FastAPIを呼ぶ
from fastapi import FastAPI
#Pydanticを呼ぶ、その中のベースモジュール
from pydantic import BaseModel
#アプリの名前つけ
app = FastAPI()
#ログインデータの方を作る
class LoginRequest(BaseModel):#BaseModelで型が合ってるかどうか確認
    id:str#文字列
    pw:str#文字列
    
@app.post("/login")#/loginでアプリが反応し機能する
def login(data:LoginRequest):#引数はさっきの型
    if data.id == "test" and data.pw == "test1234":
        return{"結果":"ログイン成功"}
    else:
        return{"結果":"ログイン失敗"}
    
"""
実行はターミナルでuvicorn loginapi:app --reload でできる
                    　ファイル名：アプリの名前

"""