import mysql.connector

conn = mysql.connector.connect(
    host = "localhost",
    user = "root",
    password = "Choi0153",
    database = "test_db"
)

cursor = conn.cursor()

username = input("ユーザー名：")
phone_number = input("電話番号：")
gender = input("性別（男、女、その他）：")

sql = """
insert into user_table(username,phone_number,gender)
VALUES (%s,%s,%s) 
"""

cursor.execute(sql,(username,phone_number,gender))

conn.commit()
print("登録完了")

conn.close()