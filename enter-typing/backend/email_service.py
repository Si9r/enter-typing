import os
import random
import smtplib
import string
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText


verification_store: dict = {}


SMTP_HOST     = os.getenv("SMTP_HOST", "smtp.gmail.com")


SMTP_PORT     = int(os.getenv("SMTP_PORT", "587"))


SMTP_USER     = os.getenv("SMTP_USER", "")        # 발신 Gmail 주소


SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")    # Gmail 앱 비밀번호


SENDER_NAME   = os.getenv("SENDER_NAME", "엔터핑")


CODE_EXPIRE_SECONDS = 180  # 3분


def send_email(to: str, subject: str, html_body: str):
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = f"{SENDER_NAME} <{SMTP_USER}>"
    msg["To"]      = to
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.ehlo()
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(SMTP_USER, to, msg.as_string())


def generate_code(length: int = 6) -> str:
    return "".join(random.choices(string.digits, k=length))


def generate_temp_password(length: int = 12) -> str:
    chars = string.ascii_letters + string.digits + "!@#$%"
    pw = [
        random.choice(string.ascii_uppercase),
        random.choice(string.ascii_lowercase),
        random.choice(string.digits),
        random.choice("!@#$%"),
    ]
    pw += random.choices(chars, k=length - 4)
    random.shuffle(pw)
    return "".join(pw)

