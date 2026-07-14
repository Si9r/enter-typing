// ── 출석체크 탭: 달력, 출석 등록, 연속 출석 통계 ──────────────────
import { updateBadges } from './profile_stats.js';

let attendanceData = {}; // 형식: { "2026-05-24": true, "2026-05-25": true }
let curYear = new Date().getFullYear();
let curMonth = new Date().getMonth() + 1;

function todayStr() {
    const t = new Date();
    const y = t.getFullYear();
    const m = String(t.getMonth() + 1).padStart(2, '0');
    const d = String(t.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function dateKey(y, m, d) {
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function renderCalendar(y, m) {
    const grid = document.getElementById('calendar-grid');
    const headers = grid.querySelectorAll('.cal-day-header');
    grid.innerHTML = '';
    headers.forEach(h => grid.appendChild(h.cloneNode(true)));

    const first = new Date(y, m - 1, 1).getDay();
    const days = new Date(y, m, 0).getDate();
    const today = new Date();

    for (let i = 0; i < first; i++) {
        const el = document.createElement('div');
        el.className = 'cal-day empty';
        grid.appendChild(el);
    }
    for (let d = 1; d <= days; d++) {
        const el = document.createElement('div');
        el.className = 'cal-day';
        el.textContent = d;
        // DB에서 조회된 날짜면 빨갛게 표시
        if (attendanceData[dateKey(y, m, d)]) el.classList.add('attended');
        // 오늘 날짜 테두리
        if (d === today.getDate() && y === today.getFullYear() && m === today.getMonth() + 1) {
            el.classList.add('today');
        }
        grid.appendChild(el);
    }
    const months = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
    document.getElementById('month-label').textContent = y + '년 ' + months[m - 1];
}

export function prevMonth() {
    if (curMonth === 1) { curYear--; curMonth = 12; } else curMonth--;
    renderCalendar(curYear, curMonth);
}

export function nextMonth() {
    if (curMonth === 12) { curYear++; curMonth = 1; } else curMonth++;
    renderCalendar(curYear, curMonth);
}

// ── 출석 버튼 ─────────────────────────────────────────────
function initAttendBtn() {
    const btn = document.getElementById('attend-btn');
    if (attendanceData[todayStr()]) {
        // 이미 오늘 출석한 경우
        btn.textContent = ' 오늘 출석 완료!';
        btn.disabled = true;
        btn.style.background = '#90EE90';
        btn.style.color = '#2F7A2F';
    } else {
        // 오늘 아직 출석 안 한 경우 버튼 초기화
        btn.textContent = ' 오늘 출석체크 하기';
        btn.disabled = false;
        btn.style.background = '';
        btn.style.color = '';
    }
}

export async function doAttend() {
    const btn = document.getElementById('attend-btn');
    if (btn.disabled) return;

    const token = localStorage.getItem('ep_token');
    if (!token) {
        alert('로그인이 필요한 기능입니다.');
        location.href = '/login';
        return;
    }

    const today = todayStr();

    try {
        const res = await fetch('/api/attendance', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ date: today })
        });

        const resData = await res.json();

        if (res.ok && resData.success) {
            alert('출석체크가 정상적으로 완료되었습니다!');
            attendanceData[today] = true;

            // 버튼 상태 변경
            btn.textContent = ' 오늘 출석 완료!';
            btn.disabled = true;
            btn.style.background = '#90EE90';
            btn.style.color = '#2F7A2F';

            // 달력 즉시 리렌더링 및 통계 갱신
            renderCalendar(curYear, curMonth);
            calculateStats();
        } else {
            alert(resData.detail || '출석체크 등록 실패');
        }
    } catch (e) {
        console.error("출석체크 등록 도중 에러가 발생했습니다:", e);
        alert('출석체크 처리 도중 예기치 못한 에러가 발생했습니다.');
    }
}

// ── 출석 통계 계산 ─────────────────────────────────────────
export function calculateStats() {
    const dates = Object.keys(attendanceData);

    let total = dates.length;
    let thisMonthCount = 0;

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;

    // 이번 달 출석 계산
    dates.forEach(d => {
        const [y, m, day] = d.split('-').map(Number);
        if (y === currentYear && m === currentMonth) {
            thisMonthCount++;
        }
    });

    // 연속 출석일 계산
    let streak = 0;
    let checkDate = new Date(today);

    while (true) {
        const y = checkDate.getFullYear();
        const m = checkDate.getMonth() + 1;
        const d = checkDate.getDate();
        const key = dateKey(y, m, d);

        if (attendanceData[key]) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            // 오늘 출석 안했어도 어제까지의 연속 출석 유지
            if (streak === 0 && checkDate.getTime() === today.getTime()) {
                checkDate.setDate(checkDate.getDate() - 1);
                continue;
            }
            break;
        }
    }

    document.getElementById('attend-streak-num').innerHTML = ` ${streak}`;
    document.getElementById('attend-month-num').textContent = thisMonthCount;
    document.getElementById('attend-total-num').textContent = total;

    window.attendanceStreak = streak;
    window.totalAttendance = total;

    if (window.latestHistoryData) {
        updateBadges(window.latestHistoryData);
    }
}

async function loadAttendanceData() {
    const token = localStorage.getItem('ep_token');
    if (!token) return;

    try {
        const res = await fetch('/api/attendance', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const resData = await res.json();
        if (resData.success) {
            attendanceData = {};
            resData.dates.forEach(d => {
                attendanceData[d] = true;
            });
            // 데이터를 무사히 불러온 후 캘린더와 통계, 버튼 로직 초기화
            renderCalendar(curYear, curMonth);
            initAttendBtn();
            calculateStats();
        }
    } catch (e) {
        console.error("출석 데이터를 불러오는 도중 오류가 발생했습니다:", e);
    }
}

export function initAttendance() {
    renderCalendar(curYear, curMonth);
    loadAttendanceData();
}
