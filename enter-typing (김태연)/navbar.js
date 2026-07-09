/**
 * navbar.js — 엔터핑 공통 네비게이션 바 로그인 상태 관리
 * 모든 페이지에서 <script src="navbar.js"></script> 로 포함
 *
 * sessionStorage 키:
 *   ep_user  → { email, nickname }   (로그인 중)
 */

(function () {
  function getUser() {
    try { return JSON.parse(sessionStorage.getItem('ep_user')); }
    catch { return null; }
  }

  function setUser(data) {
    if (data && data.token) {
      sessionStorage.setItem('ep_token', data.token);
      const userInfo = { email: data.email, nickname: data.nickname };
      sessionStorage.setItem('ep_user', JSON.stringify(userInfo));
    } else {
      sessionStorage.setItem('ep_user', JSON.stringify(data));
    }
  }

  function clearUser() {
    sessionStorage.removeItem('ep_user');
    sessionStorage.removeItem('ep_token');
  }

  function logout() {
    clearUser();
    location.href = 'index.html';
  }

  /* 닉네임 첫 글자(아바타) */
  function avatarChar(user) {
    if (user.nickname) return user.nickname.charAt(0).toUpperCase();
    if (user.email)    return user.email.charAt(0).toUpperCase();
    return '?';
  }

  /* auth-group 영역을 프로필 아이콘으로 교체 */
  function applyNavState() {
    const authGroup = document.querySelector('.auth-group');
    if (!authGroup) return;

    const user = getUser();
    if (!user) return; // 비로그인 → 기본 버튼 유지

    // overflow:hidden이 드롭다운을 가리므로 해제
    authGroup.style.overflow = 'visible';
    authGroup.style.borderRadius = '0';
    authGroup.style.background = 'transparent';

    authGroup.innerHTML = `
      <div class="nav-profile-wrap" id="nav-profile-wrap">
        <button class="nav-profile-btn" id="nav-profile-btn" aria-label="마이페이지">
          <span class="nav-avatar">${avatarChar(user)}</span>
        </button>
        <div class="nav-profile-dropdown" id="nav-profile-dropdown">
          <div class="dropdown-user-info">
            <span class="dropdown-avatar">${avatarChar(user)}</span>
            <div>
              <div class="dropdown-name">${user.nickname || '유저'}</div>
              <div class="dropdown-email">${user.email}</div>
            </div>
          </div>
          <hr class="dropdown-divider">
          <a class="dropdown-item" href="profile.html">👤 마이페이지</a>
          <hr class="dropdown-divider">
          <button class="dropdown-item dropdown-logout" id="nav-logout-btn">🚪 로그아웃</button>
        </div>
      </div>
    `;

    /* 드롭다운 토글 */
    const btn      = document.getElementById('nav-profile-btn');
    const dropdown = document.getElementById('nav-profile-dropdown');

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      dropdown.classList.toggle('open');
    });

    document.addEventListener('click', function () {
      dropdown.classList.remove('open');
    });

    dropdown.addEventListener('click', function (e) {
      e.stopPropagation();
    });

    /* 로그아웃 */
    document.getElementById('nav-logout-btn').addEventListener('click', function () {
      logout();
    });
  }

  // ─── 하단 이용약관 및 개인정보 처리방침 모달 ──────────────────────────────
  const footerTermsHTML = `
      <div class="terms-content">
          <h3>제1조 (목적)</h3>
          <p>본 약관은 "엔터핑"(이하 "회사"라 합니다)이 제공하는 타이핑 연습, 퀴즈 및 실시간 웹소켓(WebSocket) 기반 대전 서비스(이하 "서비스")의 이용과 관련하여 회사와 회원 간의 권리, 의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다.</p>

          <h3>제2조 (용어의 정의)</h3>
          <ul>
              <li><strong>회원:</strong> 본 약관에 동의하고 서비스에 가입하여, JWT(JSON Web Token) 기반의 인증을 통해 회사가 제공하는 서비스를 이용하는 자를 말합니다.</li>
              <li><strong>콘텐츠:</strong> 회사가 제공하거나, 회원이 '데이터 가져오기(Bulk Import)' 기능 등을 통해 서비스 내에 게시한 가사, 퀴즈, 텍스트 등의 모든 정보를 의미합니다.</li>
              <li><strong>실시간 대전:</strong> Redis 및 WebSocket을 통해 다른 회원과 1:1로 실시간으로 타자 속도를 겨루는 게임 모드를 말합니다.</li>
          </ul>

          <h3>제3조 (서비스의 제공 및 변경)</h3>
          <p>회사는 안정적인 서비스 제공을 위해 분산 서버(Multi-worker) 환경을 운영하며, 시스템 유지보수나 기술적 업데이트(XSS 방어 로직 수정 등)가 필요한 경우 사전 공지 후 서비스를 일시 중단하거나 변경할 수 있습니다. 실시간 대전의 경우 네트워크 지연(Latency)에 따라 상태 동기화에 차이가 발생할 수 있으며, 이는 서비스 결함으로 간주하지 않습니다.</p>

          <h3>제4조 (회원의 의무 및 게시물 관리)</h3>
          <ul>
              <li>회원은 회원가입 시 정확한 정보를 기재해야 하며, 비밀번호(Bcrypt 암호화 저장됨) 관리에 대한 책임은 전적으로 회원에게 있습니다.</li>
              <li>회원은 직접 생성하거나 Bulk Import를 통해 업로드하는 콘텐츠(텍스트, 퀴즈 등)가 타인의 저작권을 침해하지 않도록 해야 합니다.</li>
              <li>악의적인 스크립트 삽입(XSS 시도)이나 자동화 프로그램(매크로, 봇)을 이용한 실시간 대전 어뷰징 행위가 적발될 경우, 회사는 즉시 해당 계정을 영구 정지할 수 있습니다.</li>
          </ul>

          <h3>제5조 (저작권 및 면책 사항)</h3>
          <p>사용자가 생성한 콘텐츠의 저작권은 사용자에게 있으나, 서비스 운영을 위해 회사는 이를 복제 및 배포할 수 있는 권리를 가집니다. 회사는 외부 통신망의 장애, 천재지변, 서버(Redis/MySQL)의 일시적 오류 등으로 인해 발생한 게임 데이터 유실에 대해 법적 책임을 지지 않습니다.</p>

          <h3>제6조 (관할 법원)</h3>
          <p>본 약관과 관련된 분쟁에 대해서는 대한민국 법률을 적용하며, 관할 법원은 민사소송법에 따릅니다.</p>
      </div>
  `;

  const footerPrivacyHTML = `
      <div class="privacy-content">
          <h3>제1조 (개인정보의 처리 목적)</h3>
          <p>"엔터핑"(이하 "회사")은 정보통신망 이용촉진 및 정보보호 등에 관한 법률, 개인정보보호법 등 관련 법령에 따라 이용자의 개인정보 및 권익을 보호하기 위해 다음과 같이 개인정보처리방침을 수립·공개합니다.</p>
          <ul>
              <li><strong>회원 관리:</strong> 회원제 서비스 이용에 따른 본인확인, 가입 의사 확인, 불량 회원의 부정 이용(어뷰징, XSS 스크립트 공격 등) 방지</li>
              <li><strong>서비스 제공:</strong> 실시간 타자 대전 매칭, 랭킹 시스템 운영, 개인 맞춤형 프로필 및 학습 기록 제공</li>
              <li><strong>보안 및 인증:</strong> JWT(JSON Web Token) 발급 및 세션 유지를 통한 안전한 API 통신 인가</li>
          </ul>

          <h3>제2조 (처리하는 개인정보의 항목 및 수집 방법)</h3>
          <ul>
              <li><strong>필수 수집 항목:</strong> 아이디(ID), 비밀번호, 이메일 주소, 닉네임</li>
              <li><strong>자동 수집 항목:</strong> IP 주소, 쿠키(JWT 토큰 저장 용도), 서비스 이용 기록(타자 기록, 퀴즈 정답률, 실시간 대전 전적, 웹소켓 접속 기록)</li>
              <li><strong>수집 방법:</strong> 회원가입 폼, 서비스 이용 중 자동 수집</li>
          </ul>

          <h3>제3조 (개인정보의 보관 및 파기)</h3>
          <p>원칙적으로 회원의 탈퇴 등 개인정보 수집 및 이용 목적이 달성된 후에는 해당 정보를 지체 없이 파기합니다. 단, 관계 법령에 의해 보존할 필요가 있는 경우 일정 기간 동안 보관합니다.</p>
          <ul>
              <li>비밀번호는 평문으로 저장되지 않으며, <strong>Bcrypt 암호화 알고리즘</strong>을 통해 단방향 해시 처리되어 안전하게 보관됩니다 (관리자도 원본 비밀번호를 알 수 없습니다).</li>
              <li>전자상거래 등에서의 소비자보호에 관한 법률 등 관련 법령에 따른 의무 보존 기록은 법정 기간 동안 안전한 데이터베이스(MySQL)에 보관됩니다.</li>
          </ul>

          <h3>제4조 (쿠키(Cookie) 및 로컬 스토리지의 운용)</h3>
          <p>회사는 사용자 인증 및 로그인 상태 유지를 위해 로컬 스토리지(Local Storage) 및 쿠키에 JWT(JSON Web Token)를 저장합니다. 이용자는 브라우저 설정을 통해 쿠키 저장을 거부할 수 있으나, 이 경우 로그인이 필요한 서비스(실시간 대전, 랭킹 등록 등) 이용이 제한됩니다.</p>

          <h3>제5조 (정보주체의 권리·의무 및 그 행사방법)</h3>
          <p>이용자는 언제든지 등록되어 있는 자신의 개인정보를 조회하거나 수정할 수 있으며, 가입 해지(회원 탈퇴)를 요청할 수 있습니다.</p>

          <h3>제6조 (개인정보 보호책임자)</h3>
          <p>개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 정보주체의 불만처리 및 피해구제 등을 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.</p>
          <p style="padding-left: 10px; border-left: 3px solid var(--color-pink); margin-left: 5px;">
              <strong>개인정보 보호책임 부서</strong>: 엔터핑 보안운영팀<br>
              <strong>이메일</strong>: privacy@enterping.com
          </p>
      </div>
  `;

  function initFooterModals() {
    const btnTerms = document.getElementById('footer-open-terms');
    const btnPrivacy = document.getElementById('footer-open-privacy');
    
    // 만약 푸터가 없는 페이지라면 종료
    if (!btnTerms && !btnPrivacy) return;

    // 모달 컨테이너 생성 및 바디에 삽입
    let modal = document.getElementById('footer-terms-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'footer-terms-modal';
      modal.className = 'terms-modal-overlay';
      modal.innerHTML = `
        <div class="terms-modal-card">
            <div class="terms-modal-header">
                <h2 id="footer-modal-title"></h2>
                <button class="terms-modal-close-btn" id="footer-modal-close">&times;</button>
            </div>
            <div class="terms-modal-body" id="footer-modal-content"></div>
            <div class="terms-modal-footer">
                <button class="btn-terms-modal-confirm" id="footer-modal-confirm-btn">확인</button>
            </div>
        </div>
      `;
      document.body.appendChild(modal);

      // 모달 닫기 이벤트 등록
      document.getElementById('footer-modal-close').addEventListener('click', closeFooterModal);
      document.getElementById('footer-modal-confirm-btn').addEventListener('click', closeFooterModal);
      modal.addEventListener('click', function (e) {
        if (e.target === modal) closeFooterModal();
      });
    }

    function openFooterModal(type) {
      const titleEl = document.getElementById('footer-modal-title');
      const contentEl = document.getElementById('footer-modal-content');
      
      if (type === 'terms') {
        titleEl.textContent = '이용약관';
        contentEl.innerHTML = footerTermsHTML;
      } else if (type === 'privacy') {
        titleEl.textContent = '개인정보 처리방침';
        contentEl.innerHTML = footerPrivacyHTML;
      }
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    function closeFooterModal() {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }

    if (btnTerms) {
      btnTerms.addEventListener('click', function (e) {
        e.preventDefault();
        openFooterModal('terms');
      });
    }

    if (btnPrivacy) {
      btnPrivacy.addEventListener('click', function (e) {
        e.preventDefault();
        openFooterModal('privacy');
      });
    }
  }

  function initSearchBar() {
    const searchBars = document.querySelectorAll('.search-bar');
    searchBars.forEach(bar => {
      bar.removeAttribute('onclick'); // 기존 하드코딩된 onclick 제거
      const input = bar.querySelector('input');
      const icon = bar.querySelector('.search-icon');
      
      if (input) {
        input.removeAttribute('readonly');
        
        const executeSearch = () => {
            const query = input.value.trim();
            if (query) {
                location.href = 'search.html?q=' + encodeURIComponent(query);
            } else {
                alert('검색어를 입력해주세요.');
            }
        };

        input.addEventListener('keypress', function(e) {
          if (e.key === 'Enter') {
            executeSearch();
          }
        });

        if (icon) {
            icon.style.cursor = 'pointer';
            icon.addEventListener('click', executeSearch);
        }
      }
    });
  }

  /* DOM 준비 후 실행 */
  function onDOMReady() {
    applyNavState();
    initFooterModals();
    initSearchBar();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onDOMReady);
  } else {
    onDOMReady();
  }

  /* 외부에서 사용 가능하도록 노출 */
  window.NavAuth = { getUser, setUser, clearUser, logout };
})();
