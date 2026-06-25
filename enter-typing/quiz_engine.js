let audioPlayer = new Audio();
let isPlaying = false;
let quizStarted = false;
let playerIsReady = true;

// ── 상태 변수 ──────────────────────────────────────
let quizData = null;
let currentQ = 0;
let correctCount = 0;
let score = 0;
let answered = false;
let started = false;
let questionStartTime = 0; // 문제 시작 시간 기록용
let timerStarted = false; // 타이머가 시작되었는지 확인하는 플래그

// ── URL 파라미터에서 quiz_id 추출 ──────────────────
const params = new URLSearchParams(location.search);
const quizIdStr = params.get('id');
if (!quizIdStr) {
    alert("존재하지 않는 퀴즈입니다.");
    location.href = 'quiz_list.html';
}
const quizId = parseInt(quizIdStr);

// ── API에서 퀴즈 데이터 로드 ───────────────────────
async function loadQuizData() {
  try {
    const res = await fetch(`/api/quizzes/${quizId}`);
    if (!res.ok) throw new Error('퀴즈를 찾을 수 없습니다.');
    const data = await res.json();
    if (!data.success) throw new Error(data.detail || '오류');

    quizData = data;

    document.getElementById('overlay-title').textContent = '🎵 ' + data.title;
    document.getElementById('overlay-count').textContent = data.question_count;
    document.getElementById('page-title').textContent = '🎵 ' + data.title;

    document.getElementById('loading-overlay').style.display = 'none';
    document.getElementById('start-overlay').classList.add('show');
    
  } catch (err) {
    const overlay = document.getElementById('loading-overlay');
    if(overlay) {
        overlay.innerHTML = `
        <p style="color:#fff;font-size:1.1rem;">❌ ${err.message}</p>
        <button onclick="location.href='quiz_list.html'" style="margin-top:16px;background:#fff;color:#6C3FE8;border:none;border-radius:12px;padding:10px 24px;font-weight:800;cursor:pointer;">목록으로 돌아가기</button>
        `;
    }
  }
}

// 오디오 재생 시간 감시 (5초 제한)
audioPlayer.addEventListener('timeupdate', () => {
    if (!isPlaying || !quizData || !quizData.questions) return;
    const q = quizData.questions[currentQ];
    const actualEndTime = (q.end_time != null) ? q.end_time : (q.start_time + 5);

    if (audioPlayer.currentTime >= actualEndTime) {
        audioPlayer.pause();
        isPlaying = false;
        document.getElementById('record-wrap').classList.remove('spinning');
        updatePlaybackStatus();
        if (!answered) {
            document.getElementById('playback-status').textContent = '⏹ [재생 완료] - 다시 클릭해 재생';
        }
    }
});

audioPlayer.addEventListener('pause', () => {
    isPlaying = false;
    document.getElementById('record-wrap').classList.remove('spinning');
    updatePlaybackStatus();
});

audioPlayer.addEventListener('error', (e) => {
    console.error("Audio Load Error:", e);
    document.getElementById('playback-status').textContent = `⚠️ 재생 불가 (오디오 스트림 에러)`;
    document.getElementById('playback-status').className = 'playback-status';
    document.getElementById('record-wrap').classList.remove('spinning');
    isPlaying = false;
});

window.startQuiz = function() {
  document.getElementById('start-overlay').classList.remove('show');
  quizStarted = true;
  started = true;
  loadQuestionUI();
  playCurrentVideo(true);
  document.getElementById('answer-input').disabled = false;
  document.getElementById('submit-btn').disabled = false;
  document.getElementById('pass-btn').disabled = false;
  document.getElementById('answer-input').focus();
  document.getElementById('answer-log').innerHTML = '';
}

function extractVideoId(url) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

// 추출된 스트림 URL 캐싱 객체
const audioUrlCache = {};

async function playCurrentVideo(autoplay = false) {
  const q = quizData.questions[currentQ];
  const videoId = extractVideoId(q.youtube_url);
  if (!videoId) return;
  
  try {
    // 이미 스트림 URL을 불러온 적이 있는지 확인
    if (!audioUrlCache[videoId]) {
        document.getElementById('playback-status').textContent = '⏳ 오디오 불러오는 중...';
        
        const res = await fetch(`/api/youtube-audio/${videoId}`);
        const data = await res.json();
        if (!data.success) throw new Error(data.message || "추출 실패");
        
        audioUrlCache[videoId] = data.url;
    }
    
    // 이전에 재생 중이던 것이 있다면 중지
    audioPlayer.pause();
    
    audioPlayer.src = audioUrlCache[videoId];
    
    // 오디오 메타데이터가 로드되어 seek(탐색)가 가능해질 때까지 대기
    audioPlayer.onloadedmetadata = () => {
        audioPlayer.currentTime = q.start_time;
        if (autoplay) {
          document.getElementById('playback-status').textContent = '▶ [재생중]';
          document.getElementById('playback-status').className = 'playback-status playing';
          isPlaying = true;
          document.getElementById('record-wrap').classList.add('spinning');
          audioPlayer.play().catch(e => {
              console.error("자동 재생 실패:", e);
          });
        }
    };
    audioPlayer.load(); // 강제 로드 트리거

  } catch(e) { 
      console.error('오디오 로드 실패:', e); 
      document.getElementById('playback-status').textContent = `⚠️ 재생 불가 (${e.message})`;
  }
}

function loadQuestionUI() {
  answered = false;
  const q = quizData.questions[currentQ];

  document.getElementById('stat-cur').textContent = (currentQ + 1) + ' / ' + quizData.questions.length;
  document.getElementById('record-icon').textContent = '🎵';
  document.getElementById('record-hint').textContent = q.question_text;
  document.getElementById('record-hint').className = 'record-hint active';
  document.getElementById('album-thumb').textContent = '🎵';
  document.getElementById('album-thumb').className = 'album-thumb';
  document.getElementById('info-title').textContent = '???';
  document.getElementById('info-title').className = 'info-value info-hidden';
  const tags = quizData.category ? quizData.category.split(',').map(t => `<span class="tag">${t.trim()}</span>`).join('') : '<span class="tag">기타</span>';
  document.getElementById('info-tags').innerHTML = tags;
  
  // 입력창 및 버튼 초기화
  const input = document.getElementById('answer-input');
  input.value = '';
  input.placeholder = '정답을 입력하세요...';
  input.disabled = false;
  
  document.getElementById('submit-btn').disabled = false;
  document.getElementById('pass-btn').disabled = false;
  input.focus();
  
  // 상태 변수 초기화
  document.getElementById('result-banner').style.display = 'none';

  // 힌트 초기화
  document.getElementById('hint-box').style.display = 'none';
  document.getElementById('hint-box').textContent = q.hint || '힌트 없음';
  document.getElementById('hint-btn').disabled = false;
  document.getElementById('hint-btn').textContent = '💡 힌트 보기';

  // UI 초기화
  document.getElementById('record-wrap').classList.remove('spinning');
  isPlaying = false;
  updatePlaybackStatus();
}

window.togglePlay = function() {
  if (!started || answered) return;
  try {
    const q = quizData.questions[currentQ];
    const actualEndTime = (q.end_time != null) ? q.end_time : (q.start_time + 5);
    
    if (isPlaying) {
      audioPlayer.pause();
    } else {
      if (audioPlayer.currentTime >= actualEndTime - 0.5) {
        audioPlayer.currentTime = q.start_time;
      }
      audioPlayer.play();
      isPlaying = true;
      document.getElementById('record-wrap').classList.add('spinning');
      updatePlaybackStatus();
    }
  } catch(e) { console.error('togglePlay Error:', e); }
}

function updatePlaybackStatus() {
  const statusEl = document.getElementById('playback-status');
  if (!statusEl) return;
  // 스트리밍 불러오는 중일때는 덮어쓰지 않음
  if (statusEl.textContent.includes('불러오는 중')) return;

  if (isPlaying) {
    statusEl.textContent = '▶ [재생중]';
    statusEl.className = 'playback-status playing';
  } else {
    statusEl.textContent = '⏸ [일시정지]';
    statusEl.className = 'playback-status';
  }
}

window.showHint = function() {
  const btn = document.getElementById('hint-btn');
  const box = document.getElementById('hint-box');
  box.style.display = 'block';
  btn.disabled = true;
  btn.textContent = '힌트 확인됨';
}

function normalizeAnswer(str) {
  if (!str) return '';
  let normalized = str.toLowerCase()
  .replace(/[\s~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/・]/gi, '') 
  .normalize('NFKC'); 
  
  // 가타카나를 히라가나로 변환하여 상호 호환되도록 처리
  normalized = normalized.replace(/[\u30a1-\u30f6]/g, function(match) {
      return String.fromCharCode(match.charCodeAt(0) - 0x60);
  });
  
  return normalized;
}

function processResult(isPass, userRaw = '') {
  if (!started || answered) return;
  const input = document.getElementById('answer-input');

  // 한국어 입력 방지 로직 (패스가 아닐 때만)
  if (!isPass) {
    if (!userRaw) return;
    const blockedRegex = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/;
    if (blockedRegex.test(userRaw)) {
        alert("한국어는 정답으로 인정되지 않습니다. 일본어(히라가나/가타카나/한자) 또는 영어(로마자)로 입력해주세요.");
        input.value = '';
        input.focus();
        return;
    }
  }

  // 제출 직후 입력창 및 버튼 즉시 잠금
  answered = true;
  input.disabled = true;
  document.getElementById('submit-btn').disabled = true;
  document.getElementById('pass-btn').disabled = true;

  const q = quizData.questions[currentQ];

  // 제출 시 음악 일시정지
  audioPlayer.pause();

  // 정답 판별
  let isCorrect = false;
  if (!isPass) {
    const userAns = normalizeAnswer(userRaw);
    const allAnswers = [q.answer];
    if (q.alternative_answers) {
      q.alternative_answers.split(';').forEach(a => allAnswers.push(a.trim()));
    }
    isCorrect = allAnswers.some(ans => userAns === normalizeAnswer(ans));
  }

  // 정답 공개 공통 처리
  document.getElementById('info-title').textContent = q.answer;
  document.getElementById('info-title').className = 'info-value';
  const thumb = document.getElementById('album-thumb');
  thumb.className = 'album-thumb revealed';
  
  const banner = document.getElementById('result-banner');
  banner.style.display = 'block';

  const log = document.getElementById('answer-log');
  const item = document.createElement('div');

  // 상태별 분기 처리
  if (isPass) {
    thumb.textContent = '⏭️';
    banner.textContent = `⏭️ 패스! 정답: ${q.answer}`;
    banner.style.background = 'linear-gradient(135deg,#888,#aaa)';
    
    item.className = 'log-item wrong';
    item.style.borderLeftColor = '#aaa';
    item.style.color = '#777';
    item.textContent = `Q${currentQ + 1}. [패스] 다음 문제로 넘어갑니다. (정답: ${q.answer})`;
  } else if (isCorrect) {
    thumb.textContent = '✅';
    correctCount++;
    let earnedScore = 100;
    score += earnedScore;
    
    banner.textContent = `✅ 정답입니다! +${earnedScore}점`;
    banner.style.background = 'linear-gradient(135deg,#52c41a,#73d13d)';
    
    item.className = 'log-item correct';
    item.textContent = `Q${currentQ + 1}. 나의 답: "${userRaw}" → 정답 ✅`;
  } else {
    thumb.textContent = '❌';
    banner.textContent = `❌ 오답! 정답: ${q.answer}`;
    banner.style.background = 'linear-gradient(135deg,#ff4d4f,#ff7875)';
    
    item.className = 'log-item wrong';
    item.textContent = `Q${currentQ + 1}. 나의 답: "${userRaw}" → 오답 ❌ (정답: ${q.answer})`;
  }

  document.getElementById('record-wrap').classList.remove('spinning');
  document.getElementById('playback-status').textContent = '⏹ [대기]';
  document.getElementById('playback-status').className = 'playback-status';

  log.appendChild(item);
  log.scrollTop = log.scrollHeight;

  document.getElementById('stat-correct').textContent = correctCount;
  document.getElementById('stat-score').textContent = score;
  input.value = '';
  input.placeholder = '다음 문제로...';

  // 1.8초 뒤 다음 문제
  setTimeout(() => {
    currentQ++;
    if (currentQ < quizData.questions.length) {
      loadQuestionUI();
      playCurrentVideo(true);
    } else {
      endQuiz();
    }
  }, 1800);
}

window.submitAnswer = function() {
  const input = document.getElementById('answer-input');
  processResult(false, input.value.trim());
}

window.passQuestion = function() {
  processResult(true);
}

async function endQuiz() {
  document.getElementById('answer-input').disabled = true;
  document.getElementById('answer-input').placeholder = '퀴즈가 모두 종료되었습니다.';
  document.getElementById('submit-btn').disabled = true;
  document.getElementById('pass-btn').disabled = true;
  document.getElementById('hint-btn').disabled = true;
  document.getElementById('record-wrap').classList.remove('spinning');
  document.getElementById('record-icon').textContent = '🏆';
  document.getElementById('record-hint').textContent = '퀴즈 완료!';
  const banner = document.getElementById('result-banner');
  banner.style.display = 'block';
  banner.style.background = 'linear-gradient(135deg,#6C3FE8,#FF8FAB)';
  banner.innerHTML = `🎉 완료! ${quizData.questions.length}문제 중 ${correctCount}개 정답 · ${score}점
    <div style="margin-top:12px; display:flex; gap:10px; justify-content:center;">
        <button onclick="location.reload()" style="padding:8px 16px; border-radius:12px; border:none; font-weight:800; cursor:pointer; background:#fff; color:#6C3FE8;">다시 풀기</button>
        <button onclick="location.href='quiz_list.html'" style="padding:8px 16px; border-radius:12px; border:none; font-weight:800; cursor:pointer; background:rgba(255,255,255,0.2); color:#fff;">목록으로</button>
    </div>`;
  document.getElementById('stat-cur').textContent = '완료!';

  const token = sessionStorage.getItem('ep_token');
  if (token && quizData) {
      try {
          await fetch('/api/quiz-history', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                  quiz_category: quizData.category,
                  score: score,
                  total_questions: quizData.questions.length
              })
          });
      } catch(e) {
          console.error("점수 저장 실패", e);
      }
  }
}

// 초기화 로직
document.addEventListener('DOMContentLoaded', () => {
    // 닉네임 표시
    const userStr = sessionStorage.getItem('ep_user');
    const nick = userStr ? JSON.parse(userStr).nickname : '나';
    const playerEl = document.getElementById('player-name');
    if(playerEl) playerEl.textContent = nick;

    const answerInput = document.getElementById('answer-input');
    if(answerInput) {
        answerInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') submitAnswer();
        });
    }
    // 페이지 로드 시 퀴즈 데이터 로드
    loadQuizData();

    // 볼륨 조절 리스너 추가
    const volumeSlider = document.getElementById('volume-slider');
    if (volumeSlider) {
        audioPlayer.volume = volumeSlider.value;
        volumeSlider.addEventListener('input', (e) => {
            audioPlayer.volume = e.target.value;
        });
    }
});
