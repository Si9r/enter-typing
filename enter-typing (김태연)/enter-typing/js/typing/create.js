// Data State
let linesData = [];
let editingIndex = -1;
let youtubePlayer = null;
let isPlayerReady = false;

// DOM Elements
const tbody = document.getElementById('lines-tbody');
const lineTimeInput = document.getElementById('line-time');
const lineLyricsInput = document.getElementById('line-lyrics');
const lineHiraganaInput = document.getElementById('line-hiragana');

const btnAddLine = document.getElementById('btn-add-line');
const btnUpdateLine = document.getElementById('btn-update-line');
const btnCancelEdit = document.getElementById('btn-cancel-edit');
const ytInput = document.getElementById('youtube_url');

function extractVideoId(url) {
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname.includes('youtube.com')) return urlObj.searchParams.get('v');
        if (urlObj.hostname.includes('youtu.be')) return urlObj.pathname.slice(1);
    } catch (e) {
        return null;
    }
    return null;
}

document.getElementById('btn-load-yt').addEventListener('click', () => {
    const vid = extractVideoId(ytInput.value);
    if (!vid) return alert("유효한 유튜브 URL을 입력하세요.");

    if (youtubePlayer) {
        youtubePlayer.loadVideoById(vid);
    } else {
        YouTubeManager.createPlayer('youtube-player', {
            height: '100%',
            width: '100%',
            videoId: vid,
            playerVars: { 'playsinline': 1 },
            events: {
                'onReady': () => isPlayerReady = true
            }
        }).then((createdPlayer) => {
            youtubePlayer = createdPlayer;
        });
    }
});

document.getElementById('btn-sync-time').addEventListener('click', () => {
    if (youtubePlayer && isPlayerReady) {
        const time = youtubePlayer.getCurrentTime();
        lineTimeInput.value = time.toFixed(2);
    } else {
        alert("유튜브 영상을 먼저 불러와 주세요.");
    }
});

// Auto Convert Lyrics
document.getElementById('btn-auto-convert').addEventListener('click', async () => {
    const lyrics = lineLyricsInput.value.trim();
    if (!lyrics) return alert('가사 텍스트를 먼저 입력해주세요.');

    const btn = document.getElementById('btn-auto-convert');
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳ 변환 중...';
    btn.disabled = true;

    try {
        const res = await fetch('/api/convert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: lyrics })
        });
        const data = await res.json();
        if (data.success) {
            lineHiraganaInput.value = data.hiragana;

        } else {
            alert('변환에 실패했습니다.');
        }
    } catch (err) {
        console.error(err);
        alert('변환 API 호출 중 오류가 발생했습니다.');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
});

// Line Rendering
function renderTable() {
    if (linesData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--theme-text-muted); padding: 30px;">등록된 가사가 없습니다. 오른쪽 입력창에서 가사를 추가해주세요.</td></tr>`;
        return;
    }

    // Sort lines by time
    linesData.sort((a, b) => a.time - b.time);

    tbody.innerHTML = '';
    linesData.forEach((line, index) => {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        if (index === editingIndex) tr.classList.add('active');

        tr.innerHTML = `
            <td style="text-align: center; color: var(--theme-text-muted);">${index + 1}</td>
            <td style="font-weight: bold; color: var(--color-pink);">${line.time.toFixed(2)}</td>
            ${line.lyrics === '[END]' ? '<td colspan="2" style="text-align: center; font-weight: bold; color: #e67700;">[타이핑 종료 지점]</td>' : `
            <td>${line.lyrics}</td>
            <td>${line.hiragana}</td>
            `}
            <td style="text-align: center;">
                <span class="action-icon edit-icon" data-index="${index}" title="수정">✏️</span>
                <span class="action-icon del-icon" data-index="${index}" title="삭제">🗑️</span>
            </td>
        `;

        tr.addEventListener('click', (e) => {
            if (e.target.classList.contains('action-icon')) return;
            if (youtubePlayer && isPlayerReady) {
                youtubePlayer.seekTo(line.time);
                youtubePlayer.playVideo();
            }
        });

        tbody.appendChild(tr);
    });

    // Bind events
    document.querySelectorAll('.edit-icon').forEach(icon => {
        icon.addEventListener('click', (e) => {
            const idx = parseInt(e.target.getAttribute('data-index'));
            startEditing(idx);
        });
    });

    document.querySelectorAll('.del-icon').forEach(icon => {
        icon.addEventListener('click', (e) => {
            const idx = parseInt(e.target.getAttribute('data-index'));
            deleteLine(idx);
        });
    });
}

// Add Line
document.getElementById('btn-end-here').addEventListener('click', () => {
    const time = parseFloat(lineTimeInput.value);
    if (isNaN(time)) return alert("종료할 시간을 먼저 입력하거나 ⏱️싱크 버튼으로 가져와주세요.");
    linesData.push({ time, lyrics: "[END]", hiragana: "[END]" });
    resetForm();
    renderTable();
});

btnAddLine.addEventListener('click', () => {
    const time = parseFloat(lineTimeInput.value) || 0;
    const lyrics = lineLyricsInput.value.trim();
    const hiragana = lineHiraganaInput.value.trim();

    if (!lyrics || !hiragana) return alert("가사, 읽기를 모두 입력해주세요.");

    linesData.push({ time, lyrics, hiragana });
    resetForm();
    renderTable();
});

// Edit Line
function startEditing(index) {
    editingIndex = index;
    const line = linesData[index];
    lineTimeInput.value = line.time;
    lineLyricsInput.value = line.lyrics;
    lineHiraganaInput.value = line.hiragana;


    btnAddLine.style.display = 'none';
    btnUpdateLine.style.display = 'block';
    btnCancelEdit.style.display = 'block';
    renderTable();

    // Seek video if available
    if (youtubePlayer && isPlayerReady) {
        youtubePlayer.seekTo(line.time);
    }
}

btnUpdateLine.addEventListener('click', () => {
    if (editingIndex === -1) return;
    const time = parseFloat(lineTimeInput.value) || 0;
    const lyrics = lineLyricsInput.value.trim();
    const hiragana = lineHiraganaInput.value.trim();

    if (!lyrics || !hiragana) return alert("가사, 읽기를 모두 입력해주세요.");

    linesData[editingIndex] = { time, lyrics, hiragana };
    resetForm();
    renderTable();
});

btnCancelEdit.addEventListener('click', () => {
    resetForm();
    renderTable();
});

const btnClearAll = document.getElementById('btn-clear-all');
if (btnClearAll) {
    btnClearAll.addEventListener('click', () => {
        if (linesData.length === 0) return alert('삭제할 항목이 없습니다.');
        if (confirm('등록된 모든 가사 싱크 목록을 삭제하시겠습니까?')) {
            linesData = [];
            resetForm();
            renderTable();
        }
    });
}

function deleteLine(index) {
    if (confirm("정말 이 줄을 삭제하시겠습니까?")) {
        linesData.splice(index, 1);
        if (editingIndex === index) resetForm();
        else if (editingIndex > index) editingIndex--;
        renderTable();
    }
}

function resetForm() {
    editingIndex = -1;
    lineTimeInput.value = '';
    lineLyricsInput.value = '';
    lineHiraganaInput.value = '';

    btnAddLine.style.display = 'block';
    btnUpdateLine.style.display = 'none';
    btnCancelEdit.style.display = 'none';
}

// Settings Modal
const modal = document.getElementById('settings-modal');
document.getElementById('btn-settings').addEventListener('click', () => modal.style.display = 'flex');
document.getElementById('close-settings').addEventListener('click', () => modal.style.display = 'none');
document.getElementById('btn-save-settings').addEventListener('click', () => modal.style.display = 'none');

// Initial Data Load (If Edit Mode) - URL 경로(/typing/{id}/edit)에서 id를 읽습니다.
const editIdMatch = window.location.pathname.match(/^\/typing\/(\d+)\/edit\/?$/);
const editId = editIdMatch ? editIdMatch[1] : null;

if (editId) {
    document.getElementById('btn-save').innerHTML = " 수정하기";

    fetch(`/api/typing-content/${editId}`)
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                document.getElementById('title').value = data.title || '';
                document.getElementById('artist').value = data.artist || '';
                document.getElementById('genre').value = data.genre || 'JPOP';
                document.getElementById('description').value = data.description || '';
                document.getElementById('difficulty').value = data.difficulty || 3;

                if (data.youtube_id) {
                    ytInput.value = `https://www.youtube.com/watch?v=${data.youtube_id}`;
                    document.getElementById('btn-load-yt').click();
                }

                // Parse existing multiline strings into linesData
                const lyricsArr = (data.raw_lyrics || '').split('\n');
                const hiraArr = (data.raw_hiragana || '').split('\n');
                const timeArr = (data.timestamps || '').split('\n').map(t => parseFloat(t) || 0);

                for (let i = 0; i < lyricsArr.length; i++) {
                    if (!lyricsArr[i].trim()) continue;
                    linesData.push({
                        time: timeArr[i] || 0,
                        lyrics: lyricsArr[i],
                        hiragana: hiraArr[i] || '',

                    });
                }
                renderTable();
            }
        })
        .catch(err => console.error(err));
}

// Save Content
document.getElementById('btn-save').addEventListener('click', async () => {
    const title = document.getElementById('title').value.trim();
    if (!title) return alert("동영상 제목을 입력해주세요.");
    if (linesData.length === 0) return alert("최소 1줄 이상의 가사를 추가해주세요.");

    const artist = document.getElementById('artist').value.trim() || '알 수 없음';
    const genre = document.getElementById('genre').value;
    const description = document.getElementById('description').value.trim();
    const difficulty = parseInt(document.getElementById('difficulty').value, 10);
    const youtube_id = extractVideoId(ytInput.value);

    // Compile linesData
    linesData.sort((a, b) => a.time - b.time); // ensure strictly sorted
    const lyrics = linesData.map(l => l.lyrics).join('\n');
    const hiragana = linesData.map(l => l.hiragana).join('\n');
    const romaji = linesData.map(() => "-").join('\n');
    const timestamps = linesData.map(l => l.time.toFixed(2)).join('\n');

    let video_duration = 0;
    const endLine = linesData.find(l => l.lyrics === '[END]');
    if (endLine) {
        video_duration = Math.round(endLine.time);
    } else if (typeof youtubePlayer !== 'undefined' && youtubePlayer && typeof youtubePlayer.getDuration === 'function') {
        video_duration = Math.round(youtubePlayer.getDuration());
    }

    const payload = {
        title, artist, genre, description, difficulty, youtube_id,
        lyrics, hiragana, romaji, timestamps, best_time: video_duration
    };

    try {
        const token = sessionStorage.getItem('ep_token');
        if (!token) return alert('로그인이 필요한 서비스입니다.');

        const method = editId ? 'PUT' : 'POST';
        const endpoint = editId ? `/api/typing-contents/${editId}` : '/api/typing-contents';

        const response = await fetch(endpoint, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (data.success) {
            alert(editId ? '성공적으로 수정되었습니다!' : '성공적으로 등록되었습니다!');
            location.href = editId ? 'profile.html' : '/typing';
        } else {
            alert((editId ? '수정에' : '등록에') + ' 실패했습니다: ' + (data.detail || '알 수 없는 오류'));
        }
    } catch (err) {
        console.error(err);
        alert('서버와 통신 중 오류가 발생했습니다.');
    }
});

// Guide Modal Logic
const guideModal = document.getElementById('guide-modal');
const hideGuideCheckbox = document.getElementById('hide-guide-today');

function showGuideModal() {
    const hideUntil = localStorage.getItem('hideTypingGuideUntil');
    const now = new Date().getTime();

    // 기존 콘텐츠 수정(Edit) 모드일 경우 가이드를 띄우지 않습니다.
    if (editId) return;

    if (!hideUntil || now > parseInt(hideUntil)) {
        guideModal.style.display = 'flex';
    }
}

function closeGuideModal() {
    if (hideGuideCheckbox.checked) {
        // 24시간 동안 숨김 처리
        const now = new Date();
        now.setHours(now.getHours() + 24);
        localStorage.setItem('hideTypingGuideUntil', now.getTime());
    }
    guideModal.style.display = 'none';
}

document.getElementById('close-guide').addEventListener('click', closeGuideModal);
document.getElementById('btn-close-guide').addEventListener('click', closeGuideModal);
document.getElementById('btn-show-guide').addEventListener('click', () => {
    guideModal.style.display = 'flex';
});

window.addEventListener('DOMContentLoaded', showGuideModal);
