# Enter Typing

엔터핑은 타이핑 연습과 음악 퀴즈를 함께 제공하는 FastAPI 기반 웹 프로젝트입니다. 사용자는 타이핑/퀴즈 콘텐츠를 플레이하고 결과를 저장할 수 있으며, 마이페이지와 랭킹 화면에서 점수, 정답률, 콤보, 기록을 확인할 수 있습니다.

## 주요 기능

- 회원가입, 로그인, 이메일 인증, 비밀번호 변경
- 출석 기록 및 마이페이지 결과 조회
- 타이핑 콘텐츠 목록, 상세, 제작, 수정, 삭제
- 타이핑 결과 저장 및 통합 점수 계산
- 음악 퀴즈 콘텐츠 목록, 플레이, 제작, 수정, 삭제
- 퀴즈 점수, 콤보, 정답률 업데이트 및 결과 저장
- 전체/타이핑/퀴즈 랭킹 조회
- 정적 HTML/CSS/JS 기반 프론트엔드 제공

## 프로젝트 구조

```text
enter-typing/
├─ main.py                  # FastAPI 앱 조립, 라우터 등록, HTML/static 라우팅
├─ backend/
│  ├─ __init__.py
│  ├─ auth.py                # JWT, 현재 사용자 조회, 비밀번호 해시
│  ├─ bootstrap.py           # DB 초기화, 컬럼 보강, 기본 콘텐츠 시드
│  ├─ database.py            # SQLAlchemy DB 연결
│  ├─ email_service.py       # 이메일 발송, 인증번호/임시 비밀번호 유틸
│  ├─ models.py              # DB 모델
│  ├─ schemas.py             # API 요청 모델과 입력 검증
│  ├─ scoring.py             # 타이핑/퀴즈 점수 계산 유틸
│  └─ routers/
│     ├─ users.py            # 회원가입, 로그인, 계정/비밀번호/닉네임 API
│     ├─ attendance.py       # 출석 API
│     ├─ results.py          # 마이페이지 결과, 랭킹 API
│     ├─ typing.py           # 타이핑 콘텐츠/결과 API
│     └─ quiz.py             # 퀴즈 콘텐츠/결과, 가사 변환 API
├─ pages/                    # HTML 페이지
│  ├─ index.html
│  ├─ login.html
│  ├─ profile.html
│  ├─ quiz.html
│  ├─ quiz_create.html
│  ├─ quiz_list.html
│  ├─ ranking.html
│  ├─ ranking_all.html
│  ├─ ranking_song.html
│  ├─ typing.html
│  ├─ typing_create.html
│  ├─ typing_detail.html
│  └─ typing_list.html
├─ static/
│  ├─ css/
│  │  ├─ style.css
│  │  └─ typing.css
│  ├─ js/
│  │  ├─ navbar.js
│  │  ├─ quiz.js
│  │  ├─ ranking.js
│  │  └─ script.js
│  ├─ assets/                # 로고/캐릭터 이미지
│  └─ images/                # 배경 이미지
├─ logs/                     # uvicorn 실행 로그
├─ .env                      # 로컬 환경 변수
└─ enterping.db              # 로컬 데이터 파일
```

기존 화면 링크 호환을 위해 HTML에서는 `style.css`, `navbar.js`, `assets/logo_icon.png` 같은 경로를 그대로 사용합니다. FastAPI가 내부적으로 `static/css`, `static/js`, `static/assets` 위치의 파일을 해당 URL로 서빙합니다.

## 실행 환경

- Python 3.10 이상 권장
- MySQL 또는 `DATABASE_URL`로 연결 가능한 SQLAlchemy 지원 DB
- Windows PowerShell 기준 명령 예시

## 설치

프로젝트 루트에서 가상환경을 만들고 필요한 패키지를 설치합니다.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install fastapi uvicorn sqlalchemy pymysql python-dotenv pydantic bcrypt python-jose pykakasi
```

## 환경 변수

`.env` 파일에 아래 값을 설정합니다. 실제 비밀번호나 토큰 값은 저장소에 커밋하지 않습니다.

```env
DATABASE_URL=mysql+pymysql://USER:PASSWORD@localhost:3306/enterping_db?charset=utf8mb4
JWT_SECRET=change-this-secret

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SENDER_NAME=엔터핑
```

`DATABASE_URL`은 필수입니다. MySQL을 사용하는 경우 `enterping_db` 데이터베이스를 먼저 생성하면, 앱 시작 시 SQLAlchemy 모델 기준으로 테이블이 생성됩니다.

## 실행

프로젝트 루트에서 실행합니다.

```powershell
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

브라우저에서 다음 주소로 접속합니다.

- 메인: `http://localhost:8000/`
- 타이핑: `http://localhost:8000/typing_list.html`
- 퀴즈: `http://localhost:8000/quiz_list.html`
- 랭킹: `http://localhost:8000/ranking.html`
- 마이페이지: `http://localhost:8000/profile.html`

## 주요 API

| 구분 | 메서드/경로 | 설명 |
| --- | --- | --- |
| 인증 | `POST /api/signup` | 회원가입 |
| 인증 | `POST /api/login` | 로그인 및 JWT 발급 |
| 인증 | `POST /api/send-verification-code` | 이메일 인증 코드 발송 |
| 인증 | `POST /api/verify-code` | 이메일 인증 코드 확인 |
| 인증 | `POST /api/change-password` | 비밀번호 변경 |
| 사용자 | `POST /api/change-nickname` | 닉네임 변경 |
| 사용자 | `DELETE /api/delete-account` | 계정 삭제 |
| 출석 | `GET /api/attendance` | 출석 기록 조회 |
| 출석 | `POST /api/attendance` | 출석 기록 저장 |
| 결과 | `GET /api/my-results` | 내 타이핑/퀴즈 결과 조회 |
| 랭킹 | `GET /api/rankings` | 전체/타이핑/퀴즈 랭킹 조회 |
| 타이핑 | `GET /api/typing-contents` | 타이핑 콘텐츠 목록 |
| 타이핑 | `GET /api/my-typing-contents` | 내가 만든 타이핑 콘텐츠 |
| 타이핑 | `POST /api/typing-contents` | 타이핑 콘텐츠 생성 |
| 타이핑 | `PUT /api/typing-contents/{content_id}` | 타이핑 콘텐츠 수정 |
| 타이핑 | `DELETE /api/typing-contents/{content_id}` | 타이핑 콘텐츠 삭제 |
| 타이핑 | `POST /api/typing-results` | 타이핑 결과 저장 |
| 퀴즈 | `GET /api/quiz-contents` | 퀴즈 콘텐츠 목록 |
| 퀴즈 | `GET /api/my-quiz-contents` | 내가 만든 퀴즈 콘텐츠 |
| 퀴즈 | `POST /api/quiz-contents` | 퀴즈 콘텐츠 생성 |
| 퀴즈 | `PUT /api/quiz-contents/{content_id}` | 퀴즈 콘텐츠 수정 |
| 퀴즈 | `DELETE /api/quiz-contents/{content_id}` | 퀴즈 콘텐츠 삭제 |
| 퀴즈 | `POST /api/quiz-results` | 퀴즈 결과 저장 |
| 변환 | `POST /api/convert` | 일본어 가사 히라가나/로마자 변환 |

## 점수 로직

점수 계산은 `backend/scoring.py`에 모아져 있습니다.

- 타이핑 점수: WPM, 정확도, 오타 수, 난이도를 기반으로 계산합니다.
- 퀴즈 점수: 가수/제목/가사 정답 슬롯과 콤보 보너스를 기반으로 계산합니다.
- 랭킹 반영 여부는 결과 저장 시 서버에서 계산한 값과 검증 조건을 기준으로 처리합니다.

## 개발 확인 명령

```powershell
python -m py_compile .\main.py .\backend\database.py .\backend\models.py .\backend\scoring.py
node --check .\static\js\script.js
node --check .\static\js\quiz.js
node --check .\static\js\ranking.js
node --check .\static\js\navbar.js
```

서버 실행 후 핵심 URL 응답 확인:

```powershell
Invoke-WebRequest http://localhost:8000/ -UseBasicParsing
Invoke-WebRequest http://localhost:8000/style.css -UseBasicParsing
Invoke-WebRequest http://localhost:8000/navbar.js -UseBasicParsing
Invoke-WebRequest http://localhost:8000/assets/logo_icon.png -UseBasicParsing
Invoke-WebRequest "http://localhost:8000/api/rankings?mode=all" -UseBasicParsing
```
