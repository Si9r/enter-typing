/**
 * navbar.js — 엔터핑 공통 네비게이션 바 로그인 상태 관리
 * 모든 페이지에서 <script src="navbar.js"></script> 로 포함
 *
 * localStorage 키:
 *   ep_user  → { id, email, nickname, is_admin }   (로그인 중)
 */

(function () {
  function getUser() {
    try { return JSON.parse(localStorage.getItem('ep_user')); }
    catch { return null; }
  }

  function setUser(data) {
    if (data && data.token) {
      localStorage.setItem('ep_token', data.token);
      const userInfo = { id: data.id, email: data.email, nickname: data.nickname, is_admin: !!data.is_admin };
      localStorage.setItem('ep_user', JSON.stringify(userInfo));
    } else {
      localStorage.setItem('ep_user', JSON.stringify(data));
    }
  }

  function clearUser() {
    localStorage.removeItem('ep_user');
    localStorage.removeItem('ep_token');
  }

  function logout() {
    clearUser();
    location.href = '/';
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
          <a class="dropdown-item" href="/profile"><i class="ph-fill ph-user"></i> 마이페이지</a>
          <hr class="dropdown-divider">
          <button class="dropdown-item dropdown-logout" id="nav-logout-btn"><i class="ph-fill ph-door"></i> 로그아웃</button>
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
  

  
  const termsData = {
    ko: `
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
  `,
    en: `
      <div class="terms-content">
          <h3>Article 1 (Purpose)</h3>
          <p>The purpose of these Terms of Service is to set forth the rights, obligations, and responsibilities of Enterping (hereinafter referred to as the "Company") and the Members regarding the use of the website and related services.</p>
          <h3>Article 2 (Definitions)</h3>
          <p>The definitions of terms used in this agreement are as follows:</p>
          <ul>
              <li><strong>Member</strong>: A person who accesses the Company's service, agrees to these terms, and enters into a service usage contract by registering an ID (email) and password.</li>
              <li><strong>Service</strong>: Typing practice games, entertainment quizzes, real-time ranking systems, and all other related services provided by the Company.</li>
              <li><strong>Post</strong>: Articles, images, score records, etc. posted by the Member while using the Service.</li>
          </ul>
          <h3>Article 3 (Modification of Terms)</h3>
          <p>The Company may amend these Terms to the extent that it does not violate relevant laws. Notice of any amendments will be posted on the Service.</p>
          <h3>Article 4 (Registration and Account Management)</h3>
          <p>Membership is established when the user agrees to these terms and the Privacy Policy, and applies for membership. Members are responsible for maintaining the confidentiality of their accounts and passwords.</p>
          <h3>Article 5 (Obligations of Members and Prohibited Acts)</h3>
          <p>Members shall not engage in the following acts:</p>
          <ul>
              <li>Stealing another person's personal information or account</li>
              <li>Using macro programs, auto keyboards, hacking tools, or exploiting systemic vulnerabilities</li>
              <li>Interfering with the normal operation of the service</li>
              <li>Violating the intellectual property rights of the Company or third parties</li>
          </ul>
          <h3>Article 6 (Modification and Suspension of Service)</h3>
          <p>The Company may temporarily suspend the provision of the Service in the event of maintenance, replacement, or breakdown of information and communication facilities.</p>
          <h3>Article 7 (Disclaimer)</h3>
          <p>The Company shall be exempted from liability for the provision of the Service if it cannot provide the Service due to force majeure. The Company is not responsible for any disputes between Members.</p>
          <h3>Article 8 (Governing Law and Jurisdiction)</h3>
          <p>Lawsuits filed between the Company and the Member shall be governed by the laws of the Republic of Korea.</p>
      </div>
`,
    ja: `
      <div class="terms-content">
          <h3>第1条（目的）</h3>
          <p>本規約は、エンターピング（以下「会社」といいます）が提供するウェブサイトおよび関連サービス（以下「サービス」といいます）の利用に関する、会社と会員との間の権利、義務、責任事項を定めることを目的とします。</p>
          <h3>第2条（用語の定義）</h3>
          <p>本規約で使用する用語の定義は以下の通りです。</p>
          <ul>
              <li><strong>会員</strong>：会社のサービスにアクセスし、本規約に同意した上でアカウント（メールアドレス）とパスワードを登録した者を指します。</li>
              <li><strong>サービス</strong>：会社が提供するタイピング練習ゲーム、クイズ、リアルタイムランキングシステムおよびそれに関連するすべてのサービスを意味します。</li>
              <li><strong>投稿物</strong>：会員がサービスを利用するにあたり、サービス上に掲示したテキスト、画像、スコア記録などを意味します。</li>
          </ul>
          <h3>第3条（規約の明示と改定）</h3>
          <p>会社は、関連法令に違反しない範囲で本規約を改定することができます。改定された規約はサービス内で告知されます。</p>
          <h3>第4条（会員登録とアカウント管理）</h3>
          <p>会員登録は、利用者が本規約およびプライバシーポリシーに同意し、登録申請を行うことで成立します。会員は自身のアカウントとパスワードを秘密に保持する責任があります。</p>
          <h3>第5条（利用者の義務と不正行為の禁止）</h3>
          <p>会員は、以下の行為を行ってはなりません。</p>
          <ul>
              <li>他人の個人情報またはアカウントの盗用</li>
              <li>マクロプログラム、自動キーボード、ハッキングツールの使用、またはシステムの脆弱性の悪用</li>
              <li>サービスの正常な運営の妨害</li>
              <li>会社または第三者の知的財産権の侵害</li>
          </ul>
          <h3>第6条（サービスの変更および中断）</h3>
          <p>会社は、設備の保守点検、交換、故障などの事由が発生した場合、サービスの提供を一時的に中断することがあります。</p>
          <h3>第7条（免責条項）</h3>
          <p>会社は、不可抗力によりサービスを提供できない場合、サービス提供に関する責任を免除されます。また、会員間の紛争について会社は責任を負いません。</p>
          <h3>第8条（準拠法と管轄裁判所）</h3>
          <p>会社と会員との間に提起された訴訟は、大韓民国の法律を準拠法とします。</p>
      </div>
`
  };

  const privacyData = {
    ko: `
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
              <strong>이메일</strong>: privacy@enterping.com (임시)
          </p>
      </div>
  `,
    en: `
      <div class="privacy-content">
          <h3>Article 1 (Purpose of Personal Information Processing)</h3>
          <p>Enterping (the "Company") processes personal information for the following purposes. It will not be used for any other purposes:</p>
          <ul>
              <li><strong>Membership Registration and Management</strong>: Verification of intent to join, user identification, service restriction enforcement, and sending notifications.</li>
              <li><strong>Service Provision</strong>: Recording typing rankings, managing quiz results, and providing personalized content.</li>
          </ul>
          <h3>Article 2 (Items of Personal Information Processed)</h3>
          <p>The Company collects the following personal information:</p>
          <ul>
              <li><strong>Required Items</strong>: Email address, nickname, password (encrypted)</li>
              <li><strong>Optional Items</strong>: Consent to receive marketing information</li>
              <li><strong>Automatically Collected Items</strong>: IP address, cookies, access logs, etc.</li>
          </ul>
          <h3>Article 3 (Processing and Retention Period)</h3>
          <p>The Company processes and retains personal information within the period agreed upon by the user. <strong>Personal information is destroyed without delay upon membership withdrawal.</strong></p>
          <h3>Article 4 (Provision to Third Parties)</h3>
          <p>The Company processes personal information only within the scope specified in Article 1, and provides it to third parties only with the user's consent or as required by law.</p>
          <h3>Article 5 (Rights and Duties of the Subject)</h3>
          <p>Users can exercise their rights to view, correct, delete, or suspend the processing of their personal information at any time through the profile page or customer support.</p>
          <h3>Article 6 (Destruction of Personal Information)</h3>
          <p>Personal information is destroyed without delay when it is no longer needed. Electronic files are destroyed using technical methods that prevent recovery.</p>
          <h3>Article 7 (Safety Measures)</h3>
          <p>The Company implements safety measures such as one-way encryption for passwords and security programs to prevent hacking and data leaks.</p>
          <h3>Article 8 (Privacy Officer)</h3>
          <p>The Company has designated a privacy officer to oversee personal information processing and handle related complaints.</p>
          <p style="padding-left: 10px; border-left: 3px solid var(--color-pink); margin-left: 5px;">
              <strong>Department</strong>: Enterping Security Operations Team<br>
              <strong>Email</strong>: privacy@enterping.com (Temporary)
          </p>
      </div>
`,
    ja: `
      <div class="privacy-content">
          <h3>第1条（個人情報の処理目的）</h3>
          <p>エンターピング（以下「会社」）は、以下の目的のために個人情報を処理します。これ以外の目的には使用されません。</p>
          <ul>
              <li><strong>会員登録および管理</strong>：本人確認、サービスの不正利用防止、各種通知などを目的とします。</li>
              <li><strong>サービスの提供</strong>：タイピングランキングの登録、クイズの成績管理、カスタマイズコンテンツの提供を目的とします。</li>
          </ul>
          <h3>第2条（処理する個人情報の項目）</h3>
          <p>会社は、以下の個人情報項目を収集および処理しています。</p>
          <ul>
              <li><strong>必須項目</strong>：メールアドレス、ニックネーム、パスワード（暗号化）</li>
              <li><strong>選択項目</strong>：イベントおよびマーケティング情報の受信同意</li>
              <li><strong>自動収集項目</strong>：IPアドレス、クッキー、アクセスログなど</li>
          </ul>
          <h3>第3条（処理および保有期間）</h3>
          <p>会社は、利用者の同意を得た保有期間内で個人情報を処理および保有します。<strong>会員退会時には遅滞なく破棄することを原則とします。</strong></p>
          <h3>第4条（第三者への提供）</h3>
          <p>会社は、利用者の同意がある場合や法令に基づく場合を除き、個人情報を第三者に提供しません。</p>
          <h3>第5条（情報主体の権利・義務および行使方法）</h3>
          <p>利用者は、会社に対していつでも個人情報の閲覧、訂正、削除、処理停止を要求する権利を行使することができます。</p>
          <h3>第6条（個人情報の破棄手続きおよび方法）</h3>
          <p>個人情報が不要となった場合、会社は遅滞なく破棄します。電子ファイルは復元不可能な技術的方法を用いて破棄します。</p>
          <h3>第7条（安全性の確保措置）</h3>
          <p>会社は、パスワードの暗号化やハッキング対策のセキュリティプログラムなど、個人情報を保護するための技術的対策を講じています。</p>
          <h3>第8条（個人情報保護責任者）</h3>
          <p>会社は、個人情報の処理に関する業務を統括し、利用者の苦情処理などに対応するため、個人情報保護責任者を指定しています。</p>
          <p style="padding-left: 10px; border-left: 3px solid var(--color-pink); margin-left: 5px;">
              <strong>担当部署</strong>：エンターピング セキュリティ運用チーム<br>
              <strong>メールアドレス</strong>：privacy@enterping.com (仮)
          </p>
      </div>
`
  };


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
      const lang = (typeof getCurrentLanguage === 'function') ? getCurrentLanguage() : 'ko';
      
      if (type === 'terms') {
        const titles = {ko: '이용약관', en: 'Terms of Service', ja: '利用規約'};
        titleEl.textContent = titles[lang] || titles['ko'];
        contentEl.innerHTML = termsData[lang] || termsData['ko'];
      } else if (type === 'privacy') {
        const titles = {ko: '개인정보 처리방침', en: 'Privacy Policy', ja: 'プライバシーポリシー'};
        titleEl.textContent = titles[lang] || titles['ko'];
        contentEl.innerHTML = privacyData[lang] || privacyData['ko'];
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
                location.href = '/search?q=' + encodeURIComponent(query);
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

  function initSocialLinks() {
    const socialLinks = document.querySelectorAll('.social-links a');
    socialLinks.forEach(link => {
      // 이벤트 리스너(alert)를 제거하고 href와 target 설정
      link.href = '/coming_soon.html';
      link.target = '_blank';
      
      // 혹시 이전에 등록된 리스너가 있다면 cloneNode로 제거 (안전장치)
      const newLink = link.cloneNode(true);
      link.parentNode.replaceChild(newLink, link);
    });
  }

  /* DOM 준비 후 실행 */
  function onDOMReady() {
    applyNavState();
    initFooterModals();
    initSearchBar();
    initSocialLinks();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onDOMReady);
  } else {
    onDOMReady();
  }

  /* 외부에서 사용 가능하도록 노출 */
  window.NavAuth = { getUser, setUser, clearUser, logout };
})();


// ============================================
// Dark Mode Toggle Logic
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    const navRight = document.querySelector('.nav-right');
    if (navRight) {
        const themeBtn = document.createElement('button');
        themeBtn.id = 'theme-toggle';
        themeBtn.innerHTML = document.documentElement.getAttribute('data-theme') === 'dark' ? '<i class="ph-fill ph-sun"></i>' : '<i class="ph-fill ph-moon"></i>';
        themeBtn.style.cssText = `
            background: var(--theme-bg-card);
            border: 1.5px solid var(--theme-border);
            color: var(--theme-text-main);
            font-size: 1.2rem;
            cursor: pointer;
            margin-right: 15px;
            padding: 5px;
            border-radius: 50%;
            transition: all 0.3s;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 36px;
            height: 36px;
        `;
        themeBtn.onmouseover = () => themeBtn.style.background = 'var(--theme-bg-hover)';
        themeBtn.onmouseout = () => themeBtn.style.background = 'none';

        themeBtn.addEventListener('click', () => {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            if (isDark) {
                document.documentElement.removeAttribute('data-theme');
                localStorage.setItem('ep_theme', 'light');
                themeBtn.innerHTML = '<i class="ph-fill ph-moon"></i>';
            } else {
                document.documentElement.setAttribute('data-theme', 'dark');
                localStorage.setItem('ep_theme', 'dark');
                themeBtn.innerHTML = '<i class="ph-fill ph-sun"></i>';
            }
        });

        const authGroup = navRight.querySelector('.auth-group') || navRight.querySelector('.profile-menu-container');
        
        // Language Switcher Logic
        const langWrap = document.createElement('div');
        langWrap.className = 'lang-switcher-wrap';
        langWrap.style.cssText = 'position: relative; margin-right: 15px; display: flex; align-items: center; flex-shrink: 0; white-space: nowrap;';
        
        const langBtn = document.createElement('button');
        langBtn.className = 'lang-switcher-btn';
        langBtn.id = 'lang-switcher-btn';
        langBtn.style.cssText = 'background: transparent; border: none; color: var(--theme-text-main); font-size: 1rem; cursor: pointer; display: flex; align-items: center; padding: 5px; flex-shrink: 0; white-space: nowrap;';
        
        const langMap = { ko: "한국어", en: "English", ja: "日本語" };
        const initialLangText = (typeof getCurrentLanguage === 'function') ? 
            (langMap[getCurrentLanguage()] || '한국어') : '한국어';
        langBtn.innerHTML = `<i class="ph-fill ph-globe"></i> <span id="current-lang-text" style="font-size: 0.9rem; font-weight: 500; margin-left: 4px;">${initialLangText}</span>`;
        
        const langDropdown = document.createElement('div');
        langDropdown.className = 'lang-switcher-dropdown';
        langDropdown.id = 'lang-switcher-dropdown';
        langDropdown.style.cssText = 'position: absolute; top: 100%; right: 0; background: var(--theme-bg-card); border: 1px solid var(--theme-border); border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); display: none; flex-direction: column; min-width: 120px; z-index: 100; overflow: hidden; margin-top: 8px;';
        
        langDropdown.innerHTML = `
            <button class="lang-item" data-lang="ko" style="padding: 10px 15px; border: none; background: transparent; color: var(--theme-text-main); cursor: pointer; text-align: left; font-size: 0.9rem; border-bottom: 1px solid var(--theme-border);">한국어</button>
            <button class="lang-item" data-lang="en" style="padding: 10px 15px; border: none; background: transparent; color: var(--theme-text-main); cursor: pointer; text-align: left; font-size: 0.9rem; border-bottom: 1px solid var(--theme-border);">English</button>
            <button class="lang-item" data-lang="ja" style="padding: 10px 15px; border: none; background: transparent; color: var(--theme-text-main); cursor: pointer; text-align: left; font-size: 0.9rem;">日本語</button>
        `;
        
        // Add hover effects for dropdown items
        const langItems = langDropdown.querySelectorAll('.lang-item');
        langItems.forEach(item => {
            item.onmouseover = () => item.style.background = 'var(--theme-bg-hover)';
            item.onmouseout = () => item.style.background = 'transparent';
        });

        langWrap.appendChild(langBtn);
        langWrap.appendChild(langDropdown);
        
        langBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (langDropdown.style.display === 'none') {
                langDropdown.style.display = 'flex';
            } else {
                langDropdown.style.display = 'none';
            }
        });
        
        langDropdown.querySelectorAll('.lang-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const selectedLang = e.target.getAttribute('data-lang');
                if (typeof setLanguage === 'function') {
                    setLanguage(selectedLang);
                } else {
                    localStorage.setItem('ep_lang', selectedLang);
                    location.reload();
                }
                langDropdown.style.display = 'none';
            });
        });
        
        document.addEventListener('click', () => {
            langDropdown.style.display = 'none';
        });

        if (authGroup) {
            navRight.insertBefore(langWrap, authGroup);
            navRight.insertBefore(themeBtn, langWrap);
        } else {
            navRight.appendChild(themeBtn);
            navRight.appendChild(langWrap);
        }
    }
});
