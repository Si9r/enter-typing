<div align="center">
  <img src="enter-typing/assets/logo_icon.png" alt="Enterping Logo" width="140" />
  <h1>🎮 엔터핑 (Enterping)</h1>
  <p><b>좋아하는 유튜브 음악과 영상으로 즐기는 리듬감 있는 다국어 타이핑 & 퀴즈 플랫폼</b></p>

  <!-- Badges -->
  <p>
    <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
    <img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" />
    <img src="https://img.shields.io/badge/SQLAlchemy-D71F00?style=for-the-badge&logo=sqlalchemy&logoColor=white" alt="SQLAlchemy" />
    <img src="https://img.shields.io/badge/MySQL-4479A1?style=for-the-badge&logo=mysql&logoColor=white" alt="MySQL" />
    <br>
    <img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" alt="HTML" />
    <img src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white" alt="CSS" />
    <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript" />
  </p>
</div>

---

## 🌟 프로젝트 소개
**엔터핑(Enterping)** 은 좋아하는 노래 가사와 유튜브 콘텐츠를 활용해 재미있게 타이핑을 연습할 수 있는 웹 플랫폼입니다. 
회원가입, 로그인, 출석 체크는 물론, 유저가 직접 유튜브 영상을 연동해 나만의 타이핑 콘텐츠를 제작할 수 있습니다. 특히 일본어 가사 입력 시 **히라가나/로마자 자동 변환 기능**을 제공하여 애니메이션 OST나 J-POP 타이핑에 최적화되어 있습니다.

<br>

## ✨ 핵심 기능 (Key Features)

* **🔐 튼튼한 회원 시스템**: 이메일/비밀번호 기반 가입, JWT 토큰 인증, 비밀번호 찾기(이메일 인증), 닉네임 변경 및 마이페이지 제공
* **🌐 실시간 다국어 지원 (i18n)**: 한국어, 영어, 일본어 등 UI 실시간 다국어 번역 지원
* **📝 유저 참여형 콘텐츠**: 타이핑 콘텐츠 및 퀴즈 목록 조회, 생성, 수정, 삭제 가능
* **🎥 YouTube IFrame API 연동**: YouTube URL 또는 영상 ID를 자동 분석하여 백그라운드 영상 재생과 함께 즐기는 타이핑 화면
* **🇯🇵 강력한 일본어 변환기**: `pykakasi`를 활용한 일본어 텍스트 → 히라가나/로마자 자동 변환 및 다이나믹 타이핑 엔진
* **📅 게이미피케이션**: 매일매일 출석 체크 기록

<br>

## 🛠️ 기술 스택 (Tech Stack)

### Backend
`Python`, `FastAPI`, `SQLAlchemy`, `Pydantic`, `bcrypt`, `python-jose`, `python-dotenv`, `PyMySQL`, `pykakasi`, `Redis`

### Frontend
`HTML5`, `CSS3`, `Vanilla JavaScript`, `YouTube IFrame API`

### Database
`MySQL` (기본), `SQLite` (로컬 개발용 호환)

<br>

## 🚀 시작하기 (Getting Started)

### 1. 저장소 클론 및 이동
```bash
git clone <repository-url>
cd enter-typing/enter-typing   # 앱 코드는 저장소 안쪽 enter-typing/ 폴더에 있습니다
```

### 2. 가상환경 생성 및 활성화
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### 3. 패키지 설치
```powershell
pip install -r requirements.txt
```

### 4. 환경변수 설정 (`.env`)
앱 폴더(`main.py`가 있는 `enter-typing/enter-typing/`)에 `.env` 파일을 생성하고 아래 값을 설정합니다. `.env.example`을 복사해서 시작하면 됩니다. *(실제 비밀번호와 시크릿 키는 절대 외부로 유출하지 마세요)*

```env
# 로컬 개발용 SQLite 예시
DATABASE_URL=sqlite:///./enterping.db

# MySQL 사용 예시
# DATABASE_URL=mysql+pymysql://사용자명:비밀번호@localhost:3306/enterping_db

# 32자 이상의 랜덤 값이 필수입니다. 비어 있거나 짧거나 예시 값이면 서버가 기동되지 않습니다.
# 생성: python -c "import secrets; print(secrets.token_urlsafe(48))"
JWT_SECRET=

# Redis (인증번호, 대전방 상태, 요청 횟수 제한에 사용). 기본값: redis://localhost:6379
# 비밀번호를 설정했다면 redis://:비밀번호@host:6379
# REDIS_URL=redis://localhost:6379

# 이메일 인증 발송용 SMTP 설정
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-gmail-app-password
SENDER_NAME=엔터핑
```

> **Note:** MySQL을 사용할 경우 실행 전 데이터베이스 생성이 필요합니다.
> ```sql
> CREATE DATABASE enterping_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
> ```

### 5. DB 마이그레이션
```powershell
python migrate.py
```
새 테이블은 앱 시작 시 자동 생성되지만, 기존 테이블의 컬럼 추가/삭제(예: `users.is_admin`)는 `migrate.py`가 담당합니다. 여러 번 실행해도 안전하며, 기존 DB를 업데이트할 때는 서버 재시작 **전에** 실행하세요.

### 6. 서버 실행
```powershell
uvicorn main:app --reload
```
서버가 실행되면 브라우저에서 `http://127.0.0.1:8000` 으로 접속하세요! 🎉

<br>

## 📡 API 명세 요약

### 👤 인증 / 회원 (Auth)
| Method | Endpoint | 설명 |
| --- | --- | --- |
| `POST` | `/api/signup` | 회원가입 |
| `POST` | `/api/login` | 로그인 (HttpOnly 세션 쿠키 발급) |
| `POST` | `/api/logout` | 로그아웃 (세션 쿠키 삭제) |
| `GET`  | `/api/me` | 현재 로그인 유저 정보 (세션 확인) |
| `GET`  | `/api/check-email` | 이메일 중복 확인 |
| `GET`  | `/api/check-nickname` | 닉네임 중복 확인 |
| `POST` | `/api/send-verification-code` | 비밀번호 찾기 인증번호 발송 |
| `POST` | `/api/verify-code` | 인증번호 확인 후 1회용 임시 비밀번호 메일 발송 (5회 실패 시 인증번호 폐기) |
| `POST` | `/api/change-password` | 비밀번호 변경 (로그인 필요) |
| `POST` | `/api/change-nickname` | 닉네임 변경 |
| `DELETE`| `/api/delete-account` | 회원 탈퇴 |
| `POST` | `/api/upload-image` | 썸네일 이미지 업로드 (로그인 필요, png/jpg/gif/webp, 2MB 이하) |

### 📅 출석 (Attendance)
| Method | Endpoint | 설명 |
| --- | --- | --- |
| `GET`  | `/api/attendance` | 내 출석 기록 조회 |
| `POST` | `/api/attendance` | 출석 체크 |

### ⌨️ 타이핑 콘텐츠 (Typing)
| Method | Endpoint | 설명 |
| --- | --- | --- |
| `GET`  | `/api/typing-contents` | 전체 타이핑 콘텐츠 목록 조회 |
| `GET`  | `/api/my-typing-contents` | 내가 만든 타이핑 콘텐츠 목록 조회 |
| `POST` | `/api/typing-contents` | 타이핑 콘텐츠 생성 |
| `GET`  | `/api/typing-content/{id}`| 타이핑 콘텐츠 상세 조회 |
| `PUT`  | `/api/typing-contents/{id}`| 타이핑 콘텐츠 수정 |
| `DELETE`| `/api/typing-contents/{id}`| 타이핑 콘텐츠 삭제 |

### 🔧 유틸리티 (Utils)
| Method | Endpoint | 설명 |
| --- | --- | --- |
| `POST` | `/api/youtube/resolve` | YouTube URL 또는 영상 ID 분석 |
| `POST` | `/api/convert` | 일본어 텍스트를 히라가나/로마자로 변환 |

<br>

## 🔐 인증 방식 (Authentication)
* 로그인 성공 시 서버가 `ep_session` 쿠키(HttpOnly, Secure, SameSite=Lax, 24시간)를 설정합니다.
  토큰은 JS에서 읽을 수 없고, 브라우저가 같은 도메인 요청에 자동으로 실어 보냅니다.
* 프론트엔드는 화면 표시용 정보(`id`, `nickname`, `is_admin`)만 `localStorage`의 `ep_user`에 저장합니다.
  공통 네비게이션 상태와 세션 확인(`/api/me`)은 `navbar.js`에서 통합 관리합니다.
* 로그아웃은 `POST /api/logout`으로 서버가 쿠키를 지웁니다.
* 상태를 바꾸는 요청(POST/PUT/DELETE)은 Origin/Referer 호스트가 `Host`와 같아야 하며, 아니면 403이 반환됩니다 (CSRF 방어).
* 웹소켓(`/ws/battle/*`)도 같은 쿠키로 인증하고 Origin을 검사합니다. 토큰을 URL로 전달하지 않습니다.
* 로그인·인증번호 발송·인증번호 검증에는 Redis 기반 요청 횟수 제한이 걸려 있습니다 (초과 시 429).
* 관리자 권한은 `users.is_admin` 컬럼으로 관리합니다.

<br>

## 🗄️ 데이터 모델 (Data Models)
- **`User`**: 회원 이메일, 비밀번호 해시, 닉네임, 관리자 여부(`is_admin`)
- **`Attendance`**: 회원별 출석 날짜 관리
- **`TypingHistory` & `QuizHistory`**: 타이핑 및 퀴즈 플레이 기록
- **`TypoStat`**: 사용자별 오타 통계 수집
- **`TypingContent`**: 타이핑 메타데이터, 가사, 히라가나, 로마자 및 YouTube ID

<br>

## 💡 개발 참고 사항 (Developer Notes)
1. 앱 시작 시 `models.Base.metadata.create_all(bind=engine)`가 실행되어 **새 테이블**이 자동 생성됩니다. 기존 테이블의 컬럼 변경은 `python migrate.py`로 수동 실행합니다.
2. 이메일 인증번호와 임시 비밀번호 해시는 Redis에 저장(3~5분 후 만료)되며, 대전방 상태도 Redis를 사용합니다. Redis가 없으면 서버가 정상 동작하지 않습니다.
3. Gmail SMTP 사용 시 일반 비밀번호가 아닌 **Google 앱 비밀번호**를 발급받아 사용해야 합니다.
4. 정적 파일(HTML, CSS, JS)은 FastAPI의 `FileResponse`를 통해 서빙됩니다.

<br>

## 🚨 보안 주의사항 (Security Alerts)
> [!WARNING]
> * `.env` 파일은 절대 GitHub 등의 퍼블릭 저장소에 커밋하지 마세요!
> * `JWT_SECRET`은 32자 이상의 랜덤 값이어야 하며, 코드나 저장소에 기본값을 두지 마세요. (유출이 의심되면 교체하세요. 교체하면 모든 사용자가 로그아웃됩니다.)
> * Redis는 외부에 노출하지 말고(`bind 127.0.0.1`), 필요하면 비밀번호를 설정한 뒤 `REDIS_URL`에 반영하세요.
> * 운영 환경에서는 `/docs`, `/redoc`, `/openapi.json`이 꺼져 있습니다.

## 🚢 배포 체크리스트 (Deployment)
1. `.env`의 `JWT_SECRET`을 32자 이상 랜덤 값으로 설정합니다. (아니면 서버가 기동되지 않습니다.)
2. 코드 갱신 후 서버 재시작 **전에** `python migrate.py`를 실행합니다.
3. HTTPS로 서비스합니다. http에서는 Secure 쿠키가 저장되지 않아 로그인이 되지 않습니다.
4. 리버스 프록시(nginx)의 `location` 블록에 아래 헤더를 모두 지정합니다.
   ```nginx
   proxy_set_header Host $host;
   proxy_set_header X-Forwarded-Proto $scheme;
   proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
   ```
   * `Host`가 바뀌면 CSRF 검사가 정상 요청까지 차단합니다.
   * `X-Forwarded-Proto`가 없으면 Secure 쿠키가 설정되지 않습니다.
   * `X-Forwarded-For`는 IP 기준 요청 제한에 사용됩니다.
   * 웹소켓용 `location`(`/ws/`)에는 `proxy_http_version 1.1;`, `proxy_set_header Upgrade $http_upgrade;`, `proxy_set_header Connection "upgrade";`도 필요합니다.
   * 확인: `sudo nginx -T | grep proxy_set_header`, 변경 후 `sudo nginx -t && sudo systemctl reload nginx`
5. 업로드 폴더(`assets/thumbnails/`)는 저장소에 포함되지 않습니다. 배포 시 쓰기 권한을 확인하세요.

<br>

## 🩺 트러블슈팅 (Troubleshooting)

<details>
<summary><b>Q. `DATABASE_URL is not set in the .env file.` 에러가 납니다.</b></summary>
<br>
루트 디렉토리에 <code>.env</code> 파일이 올바르게 생성되어 있고, 내부에 <code>DATABASE_URL</code> 값이 제대로 할당되어 있는지 확인하세요.
</details>

<details>
<summary><b>Q. MySQL 연결에 실패합니다.</b></summary>
<br>
<ul>
  <li>MySQL 서버 서비스가 정상적으로 실행 중인지 확인하세요.</li>
  <li><code>enterping_db</code> 데이터베이스를 미리 <code>CREATE DATABASE</code> 했는지 확인하세요.</li>
  <li>아이디, 비밀번호, 포트 번호(기본 3306)가 맞는지 확인하세요.</li>
  <li>비밀번호에 특수문자가 포함된 경우 URL 인코딩 처리가 필요할 수 있습니다.</li>
</ul>
</details>

<details>
<summary><b>Q. 인증 이메일 발송이 안 됩니다.</b></summary>
<br>
<ul>
  <li><code>SMTP_USER</code>와 <code>SMTP_PASSWORD</code>(Google 앱 비밀번호)가 정확한지 확인하세요.</li>
  <li>네트워크나 PC 방화벽에서 SMTP 포트 <code>587</code>의 외부 접근을 차단하고 있지 않은지 확인하세요.</li>
</ul>
</details>

<br>

---
<div align="center">
  <i>엔터핑 플랫폼과 함께 즐거운 타이핑 생활을 시작해 보세요! 🎹</i>
</div>
