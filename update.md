# 🔄 프로젝트 업데이트 상세 리포트

## 1. 🌐 전역 및 라우팅/네비게이션 변경 (가장 큰 변화)
모든 HTML 파일과 JS 파일에서 기존의 `.html` 직접 링크 방식이 **FastAPI 라우터 기반의 URL**로 전면 수정되었습니다.
- `index.html` → `/`
- `ranking.html` → `/ranking`, `ranking_song.html` → `/ranking/songs`
- `login.html` → `/login`, `signup.html` → `/signup`
- `search.html` → `/search`
- 헤더의 네비게이션 텍스트가 **"타이핑"** 에서 **"타이핑 & 퀴즈"** 로 변경되었습니다.

## 2. 🔐 인증 및 권한 (Auth & Security) 변경
- **`core/security.py`**: `is_admin` 함수 추가 (id가 1~9인 유저를 관리자로 식별).
- **`js/auth/login.js`**: 로그인 성공 시 응답 데이터에서 `is_admin` 값을 가져와 로컬 스토리지에 저장.
- **`sessionStorage` → `localStorage`**: 기존에 `sessionStorage`를 사용하던 인증 토큰(`ep_token`) 및 유저 정보(`ep_user`)를 모두 `localStorage`로 변경하여 브라우저를 닫아도 로그인이 유지되도록 개선.
- **`html/signup.html` & `js/auth/signup.js`**: 에러/성공 메시지가 같은 자리에 겹쳐 표시되도록 `.form-msg` CSS를 추가하고, 에러 표시 방식을 `display: block`에서 `classList.add('visible')`로 애니메이션/클래스 기반으로 개선. 이미 로그인된 상태에서 접근 시 메인으로 튕겨내는 로직 추가.
- **`html/login.html`**: 이미 로그인된 상태에서 접근 시 `/` 로 리다이렉트하는 방어 로직 추가.

## 3. ⚔️ 실시간 대전 (Battle) 변경
- **`html/battle.html`**: `content-select-box`, `content-preview` 등 대전 중 콘텐츠 미리보기 및 선택 UI/CSS 대거 추가. 퀴즈와 타이핑 모드를 시각적으로 구분하는 뱃지(`content-type-badge`) 스타일 추가.
- **`js/battle/battle_ui.js`**: 방장 여부에 따른 UI 갱신 로직 추가. 콘텐츠 썸네일 표시 로직 및 선택 시 UI 테두리 하이라이트(`boxShadow`, `border`) 반영 로직 추가.
- **`js/battle/battle_websocket.js`**: `updateWaitSongThumb`, `updateWaitContentMeta` 등 웹소켓 이벤트를 통해 대기실의 썸네일과 메타데이터를 실시간으로 업데이트하는 로직 추가.
- **`js/battle/battle_game.js`**: `parseKanaToTargetUnits` 호출 시 불필요한 파라미터(`true`) 제거.

## 4. 👤 마이페이지 및 프로필 변경
- **`html/partials/profile_modal_settings.html`**: 게임 설정 모달 파일 **완전 삭제**.
- **`html/partials/profile_tab_analysis.html` & `html/profile.html`**: 기존 "히라가나 오타 히트맵"이 **"키보드 오타 히트맵"**으로 명칭 변경. CSS 그리드 렌더링 방식에서 Flex 방식 등으로 스타일 튜닝.
- **`html/partials/profile_tab_attend.html`**: 출석 체크 버튼 UI 정렬 및 여백(margin, flex 등) 미세 조정.

## 5. 🧩 기타 파일별 세부 변경 내역
- **`.env` (추가)**: `DATABASE_URL` 및 `JWT_SECRET` 환경 변수가 로컬 파일로 세팅됨.
- **`assets/logo_icon.png` (추가)**: 새로운 로고 아이콘 에셋 등록.
- **`html/quiz.html`**: 퀴즈 점수를 표시하는 엘리먼트에 `id="best-score"` 부여.
- **`html/notice.html`**: 공지사항 제목/내용의 width 및 text-align 미세 스타일링 변경.
- **`js/search/search.js` (삭제)**: 검색 로직이 별도 JS 파일에서 제거되고 다른 곳으로 통합/이동됨.

---
### 📂 추적된 파일 목록 상세 (추가/수정/삭제)

#### 🌐 라우팅 및 전역 HTML
- **html/change_password.html** (수정됨) - `+8` `-8`
- **html/forgot_password.html** (수정됨) - `+9` `-9`
- **html/index.html** (수정됨) - `+19` `-19`
- **html/login.html** (수정됨) - `+13` `-9`
- **html/notice.html** (수정됨) - `+19` `-18`
- **html/quiz.html** (수정됨) - `+18` `-18`
- **html/quiz_create.html** (수정됨) - `+6` `-6`
- **html/quiz_detail.html** (수정됨) - `+1` `-1`
- **html/quiz_list.html** (수정됨) - `+19` `-24`
- **html/ranking.html** (수정됨) - `+17` `-17`
- **html/ranking_song.html** (수정됨) - `+19` `-18`
- **html/search.html** (수정됨) - `+19` `-19`
- **html/signup.html** (수정됨) - `+44` `-19`
- **html/typing.html** (수정됨) - `+17` `-17`
- **html/typing_create.html** (수정됨) - `+6` `-6`
- **html/typing_detail.html** (수정됨) - `+18` `-18`
- **html/typing_list.html** (수정됨) - `+19` `-24`
- **html/typing_popular.html** (수정됨) - `+1` `-1`

#### 🔐 인증 및 보안
- **core/security.py** (수정됨) - `+5` `-0`
- **js/auth/change_password.js** (수정됨) - `+1` `-1`
- **js/auth/login.js** (수정됨) - `+4` `-2`
- **js/auth/signup.js** (수정됨) - `+3` `-3`

#### ⚔️ 실시간 대전
- **html/battle.html** (수정됨) - `+146` `-33`
- **html/battle_list.html** (수정됨) - `+15` `-14`
- **js/battle/battle.js** (수정됨) - `+2` `-2`
- **js/battle/battle_game.js** (수정됨) - `+1` `-1`
- **js/battle/battle_ui.js** (수정됨) - `+66` `-17`
- **js/battle/battle_websocket.js** (수정됨) - `+8` `-3`
- **js/battle/list.js** (수정됨) - `+2` `-2`

#### 👤 마이페이지
- **html/partials/profile_modal_settings.html** (삭제됨) - `+0` `-27`
- **html/partials/profile_tab_analysis.html** (수정됨) - `+2` `-2`
- **html/profile.html** (수정됨) - `+32` `-30`
- **js/profile/profile.js** (수정됨) - `+3` `-5`
- **js/profile/profile_attendance.js** (수정됨) - `+3` `-3`
- **js/profile/profile_history.js** (수정됨) - `+18` `-14`
- **js/profile/profile_settings.js** (수정됨) - `+8` `-22`
- **js/profile/profile_stats.js** (수정됨) - `+85` `-114`

#### 🧩 기타 변경점
- **.env** (추가됨) - `+2` `-0`
- **assets/logo_icon.png** (추가됨) - `+0` `-0`
- **assets/logo_icon.png** (삭제됨) - `+0` `-0`
- **js/search/search.js** (삭제됨) - `+0` `-161`
- **js/home/home.js** (수정됨) - `+16` `-0`
- **js/quiz/create.js** (수정됨) - `+17` `-2`
- **js/quiz/detail_engine.js** (수정됨) - `+2` `-2`
- **js/quiz/list.js** (수정됨) - `+8` `-13`
- **js/quiz/play.js** (수정됨) - `+2` `-1`
- **js/ranking/ranking_song.js** (수정됨) - `+17` `-5`
- **js/search/search.js** (추가됨) - `+204` `-0`
- **js/shared/navbar.js** (수정됨) - `+12` `-12`
- **js/shared/typing_engine.js** (수정됨) - `+85` `-16`
- **js/typing/create.js** (수정됨) - `+25` `-10`
- **js/typing/list.js** (수정됨) - `+7` `-12`
- **js/typing/play.js** (수정됨) - `+62` `-62`
- **main.py** (수정됨) - `+24` `-0`
- **models.py** (수정됨) - `+10` `-12`
- **remind.txt** (삭제됨) - `+0` `-34`
- **routers/auth.py** (수정됨) - `+3` `-1`
- **routers/content_common.py** (수정됨) - `+2` `-1`
- **routers/pages.py** (수정됨) - `+52` `-0`
- **routers/quiz_content.py** (수정됨) - `+6` `-1`
- **routers/ranking.py** (수정됨) - `+2` `-1`
- **routers/typing_content.py** (수정됨) - `+5` `-3`
- **routers/typo_stats.py** (수정됨) - `+53` `-64`
- **server.log** (추가됨) - `+7` `-0`
- **i18n.js** & **locales.json** (유지 및 라우팅 복구)
- **add_i18n.py** (추가 및 삭제됨) - HTML 다국어 스크립트 일괄 적용용 임시 스크립트

## 6. 🌍 다국어(i18n) 기능 복구 및 라우팅 추가
- **`routers/pages.py`**: `STATIC_FILE_MAP`에 `i18n.js`와 `locales.json` 라우팅을 추가하여 프론트엔드에서 번역 스크립트와 데이터를 불러올 수 있도록 복구.
- **모든 HTML 파일**: 총 28개의 HTML 파일 및 partial 템플릿 하단에 `<script src="/i18n.js"></script>` 일괄 추가.
- **`js/shared/navbar.js`**: 다크모드 토글 버튼 옆에 **언어 선택기(Language Switcher)** UI(한국어, English, 日本語)를 복구하여 실시간 언어 변경이 가능하도록 수정.

## 7. 🚀 추가 업데이트 사항 (버그 수정 및 UX 개선)
- **다국어(i18n) 동적 렌더링 정상화**: 자바스크립트가 화면을 다시 그릴 때 번역이 풀리는 현상 해결.
- **내 콘텐츠 다국어 지원**: 타이핑/퀴즈 컨텐츠 탭 다국어 번역 완료.
- **콘텐츠 삭제 시 500 에러 해결**: 외래키 제약조건 위반으로 삭제가 안되던 버그 패치 (하위 레코드 선 삭제 로직 적용).
- **실시간 대전 스크롤 튐 현상 수정**: 타이핑 구간 진입 시 ocus()에 의한 강제 스크롤 방지.
- **푸터(Footer) 레이아웃 픽스**: 비정상적으로 크기가 변형되던 배틀 페이지 푸터 정상화.

### 📂 세부 파일 변경 내역 (추가 작업물)
#### 🌐 프론트엔드 HTML / CSS
- **html/battle_list.html** (수정됨): 푸터 레이아웃 inline 스타일 정리
- **html/partials/profile_tab_mycontent.html** (수정됨): 다국어 속성(data-i18n) 적용
- **html/partials/profile_tab_attend.html** (수정됨): 텍스트 포맷 정리

#### ⚙️ 프론트엔드 자바스크립트
- **js/profile/profile_attendance.js** (수정됨): 캘린더 생성 및 출석 버튼 로직이 i18n.js 번역 스캐너(MutationObserver)와 호환되도록 DOM 생성 방식 개편
- **js/battle/battle_game.js** (수정됨): input.focus({ preventScroll: true }) 적용

#### 🔌 백엔드 라우터
- **routers/typing_content.py** (수정됨): TypingHistory, ContentTypoStat 등 연쇄 삭제(Cascade) 로직 추가
- **routers/quiz_content.py** (수정됨): QuizHistory 연쇄 삭제 로직 추가

#### 🌍 다국어 데이터
- **locales.json** (수정됨): 출석 캘린더(월/년), 출석체크 버튼, 내 콘텐츠 탭 관련 한국어/영어/일본어 번역 세트 대거 추가
