import mysql.connector#MySQLを呼ぶ

conn = mysql.connector.connect(
    host="localhost",
    user="root",
    password="Choi0153",
    database="login_db"
)#MySQLに接続
cursor = conn.cursor()
cursor.execute("""
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50),4 
    password VARCHAR(50)
)
""")
#テーブル作成
def create_user():#関数でユーザーとパスワードを登録
    username = input("ユーザー名: ")
    password = input("パスワード: ")

    cursor.execute(
        "INSERT INTO users (username, password) VALUES (%s, %s)",
        (username, password)
    )#これをテーブルに入力する。％sの意味は値の部分を安全に入れるためのもの？
    conn.commit()#データを保存する
    print("登録完了")


def login_user():#合致するかどうか、ログイン
    username = input("ユーザー名: ")
    password = input("パスワード: ")

    cursor.execute(
        "SELECT * FROM users WHERE username=%s AND password=%s",
        (username, password)
    )

    result = cursor.fetchone()

    if result:
        print("ログイン成功")
    else:
        print("ログイン失敗")

#アップデート入力
def update_user():
    username = input("更新したいユーザー名: ")
    new_password = input("新しいパスワード: ")

    cursor.execute(
        "UPDATE users SET password=%s WHERE username=%s",
        (new_password, username)
    )
    conn.commit()
    print("更新完了")

#削除入力
def delete_user():
    username = input("削除したいユーザー名: ")

    cursor.execute(
        "DELETE FROM users WHERE username=%s",
        (username,)
    )
    conn.commit()
    print("削除完了")
#何回もやるためにループにする
while True:
    print("\n1:登録 2:ログイン 3:更新 4:削除 5:終了")
    choice = input("選択: ")

    if choice == "1":
        create_user()
    elif choice == "2":
        login_user()
    elif choice == "3":
        update_user()
    elif choice == "4":
        delete_user()
    elif choice == "5":
        break
    else:
        print("無効な入力")
#閉じる
cursor.close()
conn.close()

