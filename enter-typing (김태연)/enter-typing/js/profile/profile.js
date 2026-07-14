// ── profile.js: 프로필 페이지 진입점(Entry Point) ──────────────
// 실제 로직은 기능별 모듈로 분리되어 있으며, 이 파일은 모듈을 불러와
// 초기화하고 HTML의 inline onclick 핸들러가 참조할 수 있도록 필요한
// 함수들을 window 전역 객체에 연결하는 역할만 담당한다.
import { initAttendance, prevMonth, nextMonth, doAttend } from './profile_attendance.js';
import {
    switchSubTab, loadMyHistory, loadMyTypingContents, loadMyQuizContents,
    deleteMyTyping, deleteMyQuiz
} from './profile_history.js';
import { loadProfileAnalysis, switchAnalysisTab, resetTypoStats } from './profile_stats.js';
import {
    openEditModal, closeEditModal, closeEditModalOutside, switchModalTab,
    checkNewNicknameDuplicate, submitChangeNickname, submitChangePassword, submitDeleteAccount,
    openSettingsModal, closeSettingsModal, closeSettingsModalOutside, toggleSplitSokuonMain,
    initSettingsModalListeners
} from './profile_settings.js';

function switchTab(name) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + name).classList.add('active');
    document.getElementById('tab-' + name + '-btn').classList.add('active');
}

// html/profile.html의 inline onclick="..." 핸들러들이 참조하는 전역 함수 바인딩
Object.assign(window, {
    switchTab,
    prevMonth, nextMonth, doAttend,
    switchSubTab, deleteMyTyping, deleteMyQuiz,
    switchAnalysisTab, resetTypoStats,
    openEditModal, closeEditModal, closeEditModalOutside, switchModalTab,
    checkNewNicknameDuplicate, submitChangeNickname, submitChangePassword, submitDeleteAccount,
    openSettingsModal, closeSettingsModal, closeSettingsModalOutside, toggleSplitSokuonMain
});

// ── 프로필 정보 로드 ─────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    const user = (typeof NavAuth !== 'undefined') ? NavAuth.getUser() : null;
    if (!user) {
        alert('로그인이 필요한 서비스입니다.');
        location.href = 'login.html';
        return;
    }
    document.getElementById('profile-nickname').textContent = user.nickname || '엔터핑유저';
    document.getElementById('profile-email').textContent = user.email || '';
    document.getElementById('profile-avatar').textContent = (user.nickname || user.email || '?').charAt(0).toUpperCase();

    initSettingsModalListeners();
});

// 페이지 로드 시 초기화
initAttendance();
loadMyHistory();
loadProfileAnalysis();
loadMyTypingContents();
loadMyQuizContents();
