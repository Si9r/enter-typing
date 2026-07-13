# 엔터핑

엔터핑은 일본 노래 가사를 활용해 타이핑을 연습하고, 관련 퀴즈를 풀고, 다른 사용자와 실시간으로 대전할 수 있는 웹 플랫폼입니다. 프로젝트 루트는 `enter-typing/` 입니다.

## 주요 기능

- 이메일/비밀번호 기반 회원가입, 이메일 인증, 로그인 (JWT 토큰)
- 비밀번호 찾기용 이메일 인증번호 발송 및 임시 비밀번호 발급
- 닉네임 변경, 회원 탈퇴
- 출석 체크 및 연속 출석 통계
- 타이핑 콘텐츠 목록 조회/검색, 생성, 수정, 삭제, 플레이
- 퀴즈 콘텐츠 목록 조회/검색, 생성, 수정, 삭제, 플레이
- YouTube 영상 연동 및 IFrame API 기반 재생
- 일본어 가사 입력 시 히라가나/로마자 자동 변환
- 실시간 대전 (방 생성/입장, 콘텐츠 선택, 타이핑·퀴즈 동시 플레이, 채팅, 결과 집계)
- 종합/곡별 랭킹
- 마이페이지 (플레이 히스토리, 통계, 오타 분석, 획득 뱃지)

## 기술 스택

### Backend

- Python, FastAPI, Uvicorn
- SQLAlchemy + PyMySQL (MySQL)
- Redis (실시간 대전 상태, 이메일 인증번호 저장)
- Jinja2 (마이페이지 템플릿 조립)
- Pydantic, bcrypt, python-jose(JWT), python-dotenv, pykakasi(한자→히라가나)
- WebSocket (실시간 대전)

### Frontend

- HTML, CSS, JavaScript (프레임워크 없이 순수 코드로 작성)
- YouTube IFrame API

### Database

- MySQL (영속 데이터: 회원, 콘텐츠, 플레이 기록, 랭킹 등)
- Redis (실시간 대전 방 상태, 이메일 인증번호 — 휘발성 데이터)

## 프로젝트 구조

폴더/파일별 상세 설명은 [`PROJECT_STRUCTURE.md`](./PROJECT_STRUCTURE.md)를 참고하세요. 최상위 구성은 다음과 같습니다.

```text
enter-typing/
├── main.py           # FastAPI 앱 생성, 라우터 등록
├── database.py       # SQLAlchemy 엔진/세션 설정
├── models.py         # ORM 모델 전체 정의
├── requirements.txt  # Python 의존성 목록
├── .env              # 환경변수 (gitignore 대상, 직접 생성 필요)
├── core/              # JWT, 비밀번호 해시, Redis 클라이언트
├── services/          # 이메일 발송, 가나→로마자 변환 등 유틸
├── routers/           # 기능별 API 라우터 + 페이지 라우팅
├── html/              # 페이지 마크업 (html/partials/ 는 마이페이지 조각)
├── css/                # 전역/화면별 스타일
└── js/                 # 기능별 프론트엔드 로직
```

## 실행 방법

### 1. 저장소 이동

```powershell
cd 프로젝트를_받은_경로\enter-typing
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

### 4. MySQL 준비

로컬에 MySQL 서버를 설치하고, 아래 명령으로 데이터베이스를 생성합니다. 테이블은 서버를 처음 실행할 때 자동으로 생성됩니다.

```sql
CREATE DATABASE enterping_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

### 5. Redis 준비

실시간 대전 기능과 이메일 인증번호 저장에 Redis를 사용합니다. 로컬에 Redis 서버를 설치하고 기본 포트(6379)로 실행해 둡니다. Redis가 꺼져 있으면 로그인/회원가입을 포함한 대부분의 기능이 정상 동작하지 않습니다.

### 6. 환경변수 설정

프로젝트 루트(`enter-typing/`)에 `.env` 파일을 만들고 아래 값을 채웁니다. `.env`는 비밀번호와 시크릿 키가 들어가므로 절대 저장소에 커밋하지 않습니다.

```env
DATABASE_URL=mysql+pymysql://사용자명:비밀번호@127.0.0.1:3306/enterping_db
JWT_SECRET=change-this-secret

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-gmail-app-password
SENDER_NAME=엔터핑
```

### 7. 서버 실행

```powershell
uvicorn main:app --reload
```

서버가 실행되면 브라우저에서 아래 주소로 접속합니다.

```text
http://127.0.0.1:8000
```

## API 요약

전체 엔드포인트 목록은 [`PROJECT_STRUCTURE.md`](./PROJECT_STRUCTURE.md)의 `routers/` 표를 참고하세요. 기능별로 라우터 파일이 나뉘어 있습니다.

| 라우터 파일 | 담당 영역 |
| --- | --- |
| `auth.py` | 회원가입/로그인/비밀번호 찾기/닉네임 변경/회원탈퇴/출석체크 |
| `typing_content.py` | 타이핑 콘텐츠 CRUD 및 플레이 기록 |
| `quiz_content.py` | 퀴즈 콘텐츠 CRUD 및 플레이 기록 |
| `battle.py` | 실시간 대전 REST + WebSocket |
| `ranking.py` | 종합/콘텐츠별 랭킹 |
| `profile.py` | 마이페이지 히스토리/통계 |
| `typo_stats.py` | 오타 통계 |
| `convert.py` | 한자→히라가나→로마자 변환 |
| `pages.py` | 페이지(HTML) 라우팅 |

## 인증 방식

로그인 성공 시 응답으로 `access_token`이 반환됩니다. 인증이 필요한 API는 아래 형식의 헤더를 포함해야 합니다.

```http
Authorization: Bearer <access_token>
```

프론트엔드는 로그인 정보를 `sessionStorage`에 저장하며, 공통 네비게이션 상태는 `js/shared/navbar.js`에서 관리합니다.

## 데이터 모델

`models.py`에 정의된 주요 테이블은 다음과 같습니다.

- `User`: 회원 이메일, 비밀번호 해시, 닉네임
- `Attendance`: 회원별 출석 날짜
- `TypingContent` / `QuizContent`: 타이핑/퀴즈 콘텐츠 (가사, 히라가나, 로마자, YouTube ID 등)
- `TypingHistory` / `QuizHistory` / `BattleHistory`: 각 모드의 플레이 기록
- `TypoStat` / `RomajiMistake` / `ContentTypoStat` / `ContentRomajiMistake`: 오타 통계 (전체 및 콘텐츠별)

## 개발 참고

- 앱 시작 시 `models.Base.metadata.create_all(bind=engine)`가 실행되어 정의된 테이블이 자동 생성됩니다. 기존 테이블/데이터는 건드리지 않습니다.
- 이메일 인증번호는 Redis에 TTL(만료시간)과 함께 저장됩니다. 서버를 재시작해도 Redis가 살아있으면 인증 상태가 유지됩니다.
- 실시간 대전 방 상태도 Redis에 저장됩니다 (`battle:room:{code}` 키).
- 정적 HTML 페이지는 대부분 `FileResponse`로 그대로 서빙되지만, 마이페이지(`/profile.html`)만 Jinja2 템플릿으로 렌더링되며 탭/모달 마크업이 `html/partials/`로 분리되어 있습니다.

## 보안 주의사항

- `.env` 파일에는 DB 비밀번호, Gmail 앱 비밀번호, JWT 시크릿이 들어가므로 저장소에 공개하지 마세요.
- 운영 환경에서는 `JWT_SECRET`을 반드시 강한 랜덤 문자열로 변경하세요.
- **현재 콘텐츠 수정/삭제 API에 소유자 권한 검사가 적용되어 있지 않습니다.** 콘텐츠 ID만 알면 다른 사용자가 만든 타이핑/퀴즈 콘텐츠도 수정·삭제할 수 있는 상태이므로, 배포 전 권한 검사 추가가 필요합니다 (`remind.txt` 참고).

## 문제 해결

### `DATABASE_URL이 .env 파일에 설정되지 않았습니다`

`.env` 파일이 `enter-typing/` 루트에 있는지, `DATABASE_URL` 값이 채워져 있는지 확인합니다.

### MySQL 연결 실패

- MySQL 서버가 실행 중인지 확인합니다.
- `enterping_db` 데이터베이스가 생성되어 있는지 확인합니다.
- 계정명, 비밀번호, 포트 번호가 올바른지 확인합니다.

### Redis 연결 실패

- Redis 서버가 로컬 6379 포트에서 실행 중인지 확인합니다.
- Redis가 꺼져 있으면 로그인, 회원가입, 실시간 대전이 모두 정상 동작하지 않습니다.

### 이메일 발송 실패

- `SMTP_USER`와 `SMTP_PASSWORD`가 올바른지 확인합니다.
- Gmail 계정의 2단계 인증과 앱 비밀번호 설정을 확인합니다.
- 방화벽 또는 네트워크에서 SMTP 포트 `587` 접근이 가능한지 확인합니다.

## 더 읽어보기

- 폴더/파일별 상세 구조, 최근 작업 이력, 알려진 이슈: [`PROJECT_STRUCTURE.md`](./PROJECT_STRUCTURE.md)
- 발견된 버그 및 추가 개발 사항 메모: [`remind.txt`](./remind.txt)
