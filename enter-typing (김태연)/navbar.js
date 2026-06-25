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
          <p>본 약관은 엔터핑(이하 "회사")이 제공하는 웹사이트 및 관련 제반 서비스(이하 "서비스")의 이용과 관련하여 회사와 회원과의 권리, 의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다.</p>

          <h3>제2조 (용어의 정의)</h3>
          <p>본 약관에서 사용하는 용어의 정의는 다음과 같습니다.</p>
          <ul>
              <li><strong>회원</strong>: 회사의 서비스에 접속하여 본 약관에 동의하고, 아이디(이메일)와 비밀번호를 등록하여 서비스 이용 계약을 체결한 자를 말합니다.</li>
              <li><strong>서비스</strong>: 회사가 회원을 위해 제공하는 타이핑 연습 게임, 엔터테인먼트 관련 퀴즈, 실시간 랭킹 시스템 및 이에 부수되는 모든 서비스를 의미합니다.</li>
              <li><strong>게시물</strong>: 회원이 서비스를 이용함에 있어 서비스상에 게시한 글, 이미지, 점수 기록 등을 의미합니다.</li>
          </ul>

          <h3>제3조 (약관의 명시와 개정)</h3>
          <p>회사는 본 약관의 내용을 회원이 쉽게 알 수 있도록 회원가입 화면에 게시합니다. 회사는 약관의 규제에 관한 법률, 정보통신망 이용촉진 및 정보보호 등에 관한 법률 등 관계 법령을 위배하지 않는 범위에서 본 약관을 개정할 수 있습니다.</p>

          <h3>제4조 (회원가입 및 계정 관리)</h3>
          <p>회원가입은 이용자가 본 약관 및 개인정보 처리방침에 동의한 후, 회사가 정한 가입 신청 양식에 따라 정보를 입력하고 가입 신청을 함으로써 성립합니다. 회원은 자신의 계정(이메일 및 닉네임)과 비밀번호를 비밀로 유지할 책임이 있으며, 자신의 계정 하에서 발생하는 모든 활동에 대한 책임을 집니다.</p>

          <h3>제5조 (이용자의 의무 및 서비스 부정행위 금지)</h3>
          <p>회원은 서비스 이용 시 다음 각 호의 행위를 하여서는 안 됩니다.</p>
          <ul>
              <li>타인의 개인정보 또는 계정을 도용하는 행위</li>
              <li>타이핑 연습 및 퀴즈 서비스 이용 시 매크로 프로그램, 오토 키보드, 해킹 툴 등 부정한 도구 또는 시스템적 취약점을 이용하는 부정행위</li>
              <li>서비스의 정상적인 운영을 방해하거나 서버에 과도한 부하를 주는 행위</li>
              <li>회사 또는 제3자의 지식재산권을 침해하는 행위</li>
              <li>기타 관계 법령 및 미풍양속에 반하는 행위</li>
          </ul>
          <p>회사는 회원이 부정행위(매크로 사용, 비정상적 점수 획득 등)를 행한 것이 감지되거나 신고될 경우, 사전 통지 없이 해당 회원의 기록 삭제 및 서비스 이용 제한(일시적 또는 영구적 정지) 조치를 취할 수 있습니다.</p>

          <h3>제6조 (서비스의 변경 및 중단)</h3>
          <p>회사는 서비스의 안정적인 제공을 위하여 컴퓨터 등 정보통신설비의 보수점검, 교체 및 고장, 통신두절 등의 사유가 발생한 경우에는 서비스의 제공을 일시적으로 중단할 수 있습니다.</p>

          <h3>제7조 (면책 조항)</h3>
          <p>회사는 천재지변, 전시, 사변 또는 이에 준하는 국가비상사태 등 불가항력으로 인하여 서비스를 제공할 수 없는 경우에는 서비스 제공에 관한 책임이 면제됩니다. 또한, 회사는 회원의 귀책사유로 인한 서비스 이용 장애 또는 회원 간의 분쟁에 대해 책임을 지지 않습니다.</p>

          <h3>제8조 (준거법 및 재판관할)</h3>
          <p>회사와 회원 간에 제기된 소송은 대한민국법을 준거법으로 합니다. 회사와 회원 간 발생한 분쟁에 관한 소송은 민사소송법상의 관할법원에 제기합니다.</p>
      </div>
  `;

  const footerPrivacyHTML = `
      <div class="privacy-content">
          <h3>제1조 (개인정보의 처리 목적)</h3>
          <p>엔터핑(이하 "회사")은 다음의 목적을 위하여 개인정보를 처리합니다. 처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며, 이용 목적이 변경되는 경우에는 개인정보 보호법 제18조에 따라 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.</p>
          <ul>
              <li><strong>회원 가입 및 관리</strong>: 회원 가입 의사 확인, 회원제 서비스 제공에 따른 본인 식별 및 인증, 회원자격 유지 및 관리, 제한적 본인확인제 시행에 따른 본인확인, 서비스 부정 이용 방지, 각종 고지·통지 등을 목적으로 개인정보를 처리합니다.</li>
              <li><strong>서비스 제공 및 고도화</strong>: 타이핑 연습 랭킹 등록, 퀴즈 전적 관리, 개인 맞춤형 콘텐츠 제공을 목적으로 개인정보를 처리합니다.</li>
          </ul>

          <h3>제2조 (처리하는 개인정보의 항목)</h3>
          <p>회사는 회원가입 및 서비스 이용 과정에서 다음과 같은 개인정보 항목을 수집 및 처리하고 있습니다.</p>
          <ul>
              <li><strong>필수 수집 항목</strong>: 이메일 주소, 닉네임, 비밀번호(암호화 저장)</li>
              <li><strong>선택 수집 항목</strong>: 이벤트 및 마케팅 정보 수신 동의 여부</li>
              <li><strong>자동 수집 항목</strong>: 서비스 이용 과정에서 IP 주소, 쿠키, 서비스 이용 기록, 접속 로그, 불량 이용 기록 등이 생성되어 수집될 수 있습니다.</li>
          </ul>

          <h3>제3조 (개인정보의 처리 및 보유 기간)</h3>
          <p>회사는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보를 수집 시에 동의받은 개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다. <strong>회원의 개인정보는 회원 탈퇴 시 지체 없이 파기하는 것을 원칙으로 합니다.</strong></p>

          <h3>제4조 (개인정보의 제3자 제공)</h3>
          <p>회사는 정보주체의 개인정보를 제1조(개인정보의 처리 목적)에서 명시한 범위 내에서만 처리하며, 정보주체의 동의, 법률의 특별한 규정 등 개인정보 보호법 제17조 및 제18조에 해당하는 경우에만 개인정보를 제3자에게 제공합니다. 이 외에 제3자에게 회원 개인정보를 양도하거나 대여하지 않습니다.</p>

          <h3>제5조 (정보주체의 권리·의무 및 그 행사방법)</h3>
          <p>정보주체는 회사에 대해 언제든지 개인정보 열람·정정·삭제·처리정지 요구 등의 권리를 행사할 수 있습니다. 권리 행사는 회원 정보 수정 페이지 또는 고객문의를 통해 직접 처리하거나 서면, 전자우편 등을 통하여 하실 수 있으며 회사는 이에 대해 지체 없이 조치하겠습니다.</p>

          <h3>제6조 (개인정보의 파기절차 및 파기방법)</h3>
          <p>회사는 개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게 되었을 때에는 지체 없이 해당 개인정보를 파기합니다. 전자적 파일 형태의 정보는 기록을 재생할 수 없는 기술적 방법을 사용하여 파기하며, 종이 문서에 출력된 개인정보는 분쇄기로 분쇄하거나 소각하여 파기합니다.</p>

          <h3>제7조 (개인정보의 안전성 확보 조치)</h3>
          <p>회사는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다.</p>
          <ul>
              <li>비밀번호 암호화: 회원의 비밀번호는 일방향 암호화(bcrypt 등)되어 저장 및 관리되므로 본인만이 알 수 있습니다.</li>
              <li>해킹 등에 대비한 기술적 대책: 해킹이나 컴퓨터 바이러스 등에 의한 개인정보 유출 및 훼손을 막기 위하여 보안 프로그램을 설치하고 주기적으로 갱신·점검하고 있습니다.</li>
          </ul>

          <h3>제8조 (개인정보 보호책임자)</h3>
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

  /* DOM 준비 후 실행 */
  function onDOMReady() {
    applyNavState();
    initFooterModals();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onDOMReady);
  } else {
    onDOMReady();
  }

  /* 외부에서 사용 가능하도록 노출 */
  window.NavAuth = { getUser, setUser, clearUser, logout };
})();
