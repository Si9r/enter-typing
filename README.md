# 엔터핑

엔터핑은 좋아하는 노래 가사와 엔터테인먼트 콘텐츠를 활용해 타이핑을 연습할 수 있는 웹 플랫폼입니다. 회원가입, 로그인, 출석 체크, 타이핑 콘텐츠 생성, YouTube 영상 연동, 히라가나/로마자 자동 변환 기능을 제공합니다.

## 주요 기능

- 이메일/비밀번호 기반 회원가입 및 로그인
- 다국어(i18n) 지원: 한국어, 영어, 일본어로 UI 실시간 다국어 번역 기능 제공
- JWT 토큰 기반 인증
- 비밀번호 찾기용 이메일 인증번호 및 임시 비밀번호 발급
- 닉네임 변경, 회원 탈퇴, 마이페이지 로그인 상태 관리
- 출석 체크 기록
- 타이핑 콘텐츠 목록 조회, 생성, 수정, 삭제
- YouTube URL 또는 영상 ID 분석 및 임베드 정보 생성
- 일본어 가사 입력 시 히라가나/로마자 자동 변환
- YouTube IFrame API를 활용한 영상 재생 기반 타이핑 화면

## 기술 스택

### Backend

- Python
- FastAPI
- SQLAlchemy
- Pydantic
- bcrypt
- python-jose
- python-dotenv
- PyMySQL
- pykakasi

### Frontend

- HTML
- CSS
- JavaScript
- YouTube IFrame API

### Database

- MySQL
- SQLite도 `DATABASE_URL` 설정을 통해 로컬 개발용으로 사용할 수 있습니다.

## 프로젝트 구조

```text
.
├── main.py                  # FastAPI 앱, API 라우트, 정적 페이지 서빙
├── database.py              # SQLAlchemy DB 연결 설정
├── models.py                # SQLAlchemy 모델 정의
├── requirements.txt         # Python 패키지 의존성
├── index.html               # 메인 페이지
├── login.html               # 로그인 페이지
├── signup.html              # 회원가입 페이지
├── forgot_password.html     # 비밀번호 찾기 페이지
├── change_password.html     # 비밀번호 변경 페이지
├── profile.html             # 마이페이지
├── typing_list.html         # 타이핑 콘텐츠 목록
├── typing_create.html       # 타이핑 콘텐츠 생성/편집
├── typing_detail.html       # 타이핑 콘텐츠 상세
├── typing.html              # 타이핑 플레이 화면
├── navbar.js                # 공통 네비게이션 로그인 상태 관리
├── script.js                # 타이핑 게임 로직
├── style.css                # 공통 스타일
├── typing.css               # 타이핑 화면 스타일
├── i18n.js                  # 다국어 처리 스크립트 (DOM 실시간 번역)
├── locales.json             # 다국어 번역 데이터 딕셔너리
└── assets/                  # 로고 및 이미지 리소스
```

## 실행 방법

### 1. 저장소 이동

```powershell
cd C:\coding\teamPJT_V2
```

### 2. 가상환경 생성 및 활성화

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### 3. 의존성 설치

```powershell
pip install -r requirements.txt
```

### 4. 환경변수 설정

프로젝트 루트에 `.env` 파일을 만들고 아래 값을 설정합니다. 실제 비밀번호, 앱 비밀번호, JWT 시크릿은 외부에 공유하지 마세요.

```env
# 빠른 로컬 실행용 SQLite 예시
DATABASE_URL=sqlite:///./enterping.db

# MySQL 사용 예시
# DATABASE_URL=mysql+pymysql://사용자명:비밀번호@localhost:3306/enterping_db

JWT_SECRET=change-this-secret

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-gmail-app-password
SENDER_NAME=엔터핑
```

MySQL을 사용할 경우 먼저 데이터베이스를 생성합니다.

```sql
CREATE DATABASE enterping_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

### 5. 서버 실행

```powershell
uvicorn main:app --reload
```

서버가 실행되면 브라우저에서 아래 주소로 접속합니다.

```text
http://127.0.0.1:8000
```

## API 요약

### 인증/회원

| Method | Endpoint | 설명 |
| --- | --- | --- |
| POST | `/api/signup` | 회원가입 |
| POST | `/api/login` | 로그인 및 JWT 발급 |
| GET | `/api/check-email` | 이메일 중복 확인 |
| GET | `/api/check-nickname` | 닉네임 중복 확인 |
| POST | `/api/send-verification-code` | 비밀번호 찾기 인증번호 발송 |
| POST | `/api/verify-code` | 인증번호 확인 및 임시 비밀번호 발급 |
| POST | `/api/change-password` | 비밀번호 변경 |
| POST | `/api/change-nickname` | 닉네임 변경 |
| DELETE | `/api/delete-account` | 회원 탈퇴 |

### 출석

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | `/api/attendance` | 내 출석 기록 조회 |
| POST | `/api/attendance` | 출석 체크 |

### 타이핑 콘텐츠

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | `/api/typing-contents` | 전체 타이핑 콘텐츠 목록 조회 |
| GET | `/api/my-typing-contents` | 내가 만든 타이핑 콘텐츠 목록 조회 |
| POST | `/api/typing-contents` | 타이핑 콘텐츠 생성 |
| GET | `/api/typing-content/{content_id}` | 타이핑 콘텐츠 상세 조회 |
| PUT | `/api/typing-contents/{content_id}` | 타이핑 콘텐츠 수정 |
| DELETE | `/api/typing-contents/{content_id}` | 타이핑 콘텐츠 삭제 |

### 유틸

| Method | Endpoint | 설명 |
| --- | --- | --- |
| POST | `/api/youtube/resolve` | YouTube URL 또는 영상 ID 분석 |
| POST | `/api/convert` | 일본어 텍스트를 히라가나/로마자로 변환 |

## 인증 방식

로그인 성공 시 응답으로 `access_token`이 반환됩니다. 인증이 필요한 API는 아래 형식의 헤더를 포함해야 합니다.

```http
Authorization: Bearer <access_token>
```

프론트엔드는 로그인 정보를 `sessionStorage`에 저장하며, 공통 네비게이션 상태는 `navbar.js`에서 관리합니다.

## 데이터 모델

- `User`: 회원 이메일, 비밀번호 해시, 닉네임
- `Attendance`: 회원별 출석 날짜
- `TypingHistory`: 타이핑 플레이 기록
- `QuizHistory`: 퀴즈 플레이 기록
- `TypoStat`: 오타 통계
- `TypingContent`: 타이핑 콘텐츠, 가사, 히라가나, 로마자, YouTube ID

## 개발 참고

- 앱 시작 시 `models.Base.metadata.create_all(bind=engine)`가 실행되어 정의된 테이블이 자동 생성됩니다.
- 초기 타이핑 콘텐츠가 4개 미만이면 기본 콘텐츠가 자동 등록됩니다.
- 이메일 인증번호는 서버 메모리의 `verification_store`에 저장됩니다. 서버 재시작 시 인증 상태는 초기화됩니다.
- Gmail SMTP를 사용할 경우 일반 계정 비밀번호가 아니라 Google 앱 비밀번호를 사용해야 합니다.
- 정적 HTML, CSS, JS 파일은 FastAPI의 `FileResponse`로 서빙됩니다.

## 보안 주의사항

- `.env` 파일에는 DB 비밀번호, Gmail 앱 비밀번호, JWT 시크릿이 들어가므로 저장소에 공개하지 마세요.
- 운영 환경에서는 `JWT_SECRET`을 반드시 강한 랜덤 문자열로 변경하세요.
- 임시 비밀번호와 인증번호 저장소는 현재 인메모리 방식이므로 운영 환경에서는 Redis 또는 DB 기반 저장소 사용을 권장합니다.
- `DELETE /api/typing-contents/{content_id}`는 현재 관리자 모드 용도로 권한 검사가 완화되어 있으므로 배포 전 권한 검사를 복구해야 합니다.

## 문제 해결

### `DATABASE_URL is not set in the .env file.`

`.env` 파일에 `DATABASE_URL`이 설정되어 있는지 확인합니다.

### MySQL 연결 실패

- MySQL 서버가 실행 중인지 확인합니다.
- `enterping_db` 데이터베이스가 생성되어 있는지 확인합니다.
- 계정명, 비밀번호, 포트 번호가 올바른지 확인합니다.
- 비밀번호에 특수문자가 포함되어 있다면 URL 인코딩 또는 현재 코드의 자동 인코딩 처리 여부를 확인합니다.

### 이메일 발송 실패

- `SMTP_USER`와 `SMTP_PASSWORD`가 올바른지 확인합니다.
- Gmail 계정의 2단계 인증과 앱 비밀번호 설정을 확인합니다.
- 방화벽 또는 네트워크에서 SMTP 포트 `587` 접근이 가능한지 확인합니다.
