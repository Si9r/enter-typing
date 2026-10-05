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

// 줄의 time 은 숫자(초)이거나, 일괄 입력 직후처럼 아직 싱크 전이면 null 이다.
const isEndLine = (line) => line.lyrics === '[END]';
const hasTime = (line) => typeof line.time === 'number' && !isNaN(line.time);

function parseTimeInput() {
    const value = lineTimeInput.value.trim();
    if (value === '') return null;
    const n = parseFloat(value);
    return isNaN(n) ? null : n;
}

// 시간순 정렬. 시간이 없는 줄은 맨 뒤에 입력한 순서대로 둔다.
function sortLines() {
    const key = (line) => (hasTime(line) ? line.time : Infinity);
    linesData.sort((a, b) => (key(a) === key(b) ? 0 : key(a) < key(b) ? -1 : 1));
}

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
    if (!vid) return alert(i18n.t('typing.please_enter_a_valid_youtube_url'));

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
        alert(i18n.t('typing.please_load_the_youtube_video_first'));
    }
});

// Auto Convert Lyrics
document.getElementById('btn-auto-convert').addEventListener('click', async () => {
    const lyrics = lineLyricsInput.value.trim();
    if (!lyrics) return alert(i18n.t('typing.please_enter_the_lyrics_text_first'));

    const btn = document.getElementById('btn-auto-convert');
    const originalText = btn.innerHTML;
    btn.innerHTML = i18n.t('typing.converting');
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
            alert(i18n.t('typing.conversion_failed'));
        }
    } catch (err) {
        console.error(err);
        alert(i18n.t('typing.an_error_occurred_while_calling_the'));
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
});

// Line Rendering
function renderTable() {
    updateUnsyncedBadge();
    if (linesData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--theme-text-muted); padding: 30px;">${i18n.t('typing.no_lyrics_yet')}</td></tr>`;
        return;
    }

    // 시간순 정렬 (탭 싱크 중에는 찍는 순서가 흔들리지 않도록 정렬하지 않는다)
    if (!tapSync.active) sortLines();

    tbody.innerHTML = '';
    linesData.forEach((line, index) => {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        if (index === editingIndex) tr.classList.add('active');
        if (tapSync.active && index === tapSync.pointer) tr.classList.add('sync-current');

        tr.innerHTML = `
            <td style="text-align: center; color: var(--theme-text-muted);">${index + 1}</td>
            ${hasTime(line) ? `<td style="font-weight: bold; color: var(--color-pink);">${line.time.toFixed(2)}</td>` : `<td class="unsynced">${i18n.t('typing.unsynced_time')}</td>`}
            ${line.lyrics === '[END]' ? `<td colspan="2" style="text-align: center; font-weight: bold; color: #e67700;">${i18n.t('typing.end_of_typing')}</td>` : `
            <td>${escapeHtml(line.lyrics)}</td>
            <td>${escapeHtml(line.hiragana)}</td>
            `}
            <td style="text-align: center;">
                <span class="action-icon edit-icon" data-index="${index}" title="${i18n.t('common.edit')}">✏️</span>
                <span class="action-icon del-icon" data-index="${index}" title="${i18n.t('nav.delete')}">🗑️</span>
            </td>
        `;

        tr.addEventListener('click', (e) => {
            if (e.target.classList.contains('action-icon')) return;
            if (tapSync.active) {
                moveTapSyncTo(index);
                return;
            }
            if (youtubePlayer && isPlayerReady && hasTime(line)) {
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
    if (isNaN(time)) return alert(i18n.t('typing.please_enter_the_end_time_first'));
    linesData.push({ time, lyrics: "[END]", hiragana: "[END]" });
    resetForm();
    renderTable();
});

btnAddLine.addEventListener('click', () => {
    const time = parseTimeInput();
    const lyrics = lineLyricsInput.value.trim();
    const hiragana = lineHiraganaInput.value.trim();

    if (!lyrics || !hiragana) return alert(i18n.t('typing.please_enter_all_lyrics_and_reading'));

    linesData.push({ time, lyrics, hiragana });
    resetForm();
    renderTable();
});

// Edit Line
function startEditing(index) {
    editingIndex = index;
    const line = linesData[index];
    lineTimeInput.value = hasTime(line) ? line.time : '';
    lineLyricsInput.value = line.lyrics;
    lineHiraganaInput.value = line.hiragana;


    btnAddLine.style.display = 'none';
    btnUpdateLine.style.display = 'block';
    btnCancelEdit.style.display = 'block';
    renderTable();

    // Seek video if available
    if (youtubePlayer && isPlayerReady && hasTime(line)) {
        youtubePlayer.seekTo(line.time);
    }
}

btnUpdateLine.addEventListener('click', () => {
    if (editingIndex === -1) return;
    const time = parseTimeInput();
    const lyrics = lineLyricsInput.value.trim();
    const hiragana = lineHiraganaInput.value.trim();

    if (!lyrics || !hiragana) return alert(i18n.t('typing.please_enter_all_lyrics_and_reading'));

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
        if (linesData.length === 0) return alert(i18n.t('typing.there_is_nothing_to_delete'));
        if (confirm(i18n.t('typing.do_you_want_to_delete_all'))) {
            stopTapSync();
            linesData = [];
            resetForm();
            renderTable();
        }
    });
}

function deleteLine(index) {
    if (confirm(i18n.t('typing.are_you_sure_you_want_to'))) {
        stopTapSync();
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
    const editCurrentUser = window.NavAuth && window.NavAuth.getUser();

    if (!editCurrentUser) {
        alert(i18n.t('common.this_service_requires_login'));
        location.href = '/login';
    } else {
        document.getElementById('btn-save').innerHTML = i18n.t('typing.edit_2');

        fetch(`/api/typing-content/${editId}`)
            .then(res => res.json())
            .then(data => {
                if (!data.success) return;

                const isOwner = editCurrentUser.id === data.creator_id;
                if (!isOwner && !editCurrentUser.is_admin) {
                    alert(i18n.t('typing.no_edit_permission'));
                    location.href = '/typing';
                    return;
                }

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
            })
            .catch(err => console.error(err));
    }
}

// Save Content
document.getElementById('btn-save').addEventListener('click', async () => {
    const title = document.getElementById('title').value.trim();
    if (!title) return alert(i18n.t('common.please_enter_the_video_title'));
    if (linesData.length === 0) return alert(i18n.t('typing.please_add_at_least_one_line'));
    stopTapSync();
    const unsyncedCount = linesData.filter((l) => !hasTime(l)).length;
    if (unsyncedCount > 0) return alert(i18n.t('typing.unsynced_block_save', { count: unsyncedCount }));

    const artist = document.getElementById('artist').value.trim() || i18n.t('common.unknown');
    const genre = document.getElementById('genre').value;
    const description = document.getElementById('description').value.trim();
    const difficulty = parseInt(document.getElementById('difficulty').value, 10);
    const youtube_id = extractVideoId(ytInput.value);

    // Compile linesData
    sortLines(); // ensure strictly sorted
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
        if (!localStorage.getItem('ep_user')) return alert(i18n.t('common.this_service_requires_login'));

        const method = editId ? 'PUT' : 'POST';
        const endpoint = editId ? `/api/typing-contents/${editId}` : '/api/typing-contents';

        const response = await fetch(endpoint, {
            method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (data.success) {
            alert(editId ? i18n.t('common.fixed_successfully') : i18n.t('typing.you_have_registered_successfully'));
            location.href = editId ? 'profile' : '/typing';
        } else {
            alert(i18n.t(editId ? 'typing.edit_failed_detail' : 'typing.register_failed_detail', { message: i18n.server(data.detail, 'common.unknown_error') }));
        }
    } catch (err) {
        console.error(err);
        alert(i18n.t('typing.an_error_occurred_while_communicating_wi'));
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

// ════════════════════════════════════════════════════════════
// 가사 일괄 입력: 가사 전체를 붙여넣으면 줄마다 나눠 한 번에 히라가나로 변환한다.
// 추가된 줄은 시간이 없는 '싱크 전' 상태이며, 탭 싱크로 시간을 찍는다.
// ════════════════════════════════════════════════════════════
const BULK_MAX_LINES = 300; // 서버(/api/convert) 제한과 같다
const bulkModal = document.getElementById('bulk-modal');
const bulkText = document.getElementById('bulk-lyrics');
const bulkCount = document.getElementById('bulk-count');
const bulkMode = document.getElementById('bulk-mode');
const btnBulkApply = document.getElementById('btn-bulk-apply');
const linesStatus = document.getElementById('lines-status');
let linesStatusTimer = null;

function bulkLines() {
    return bulkText.value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
}

function updateBulkCount() {
    i18n.setText(bulkCount, 'typing.bulk_line_count', { count: bulkLines().length });
}

function showLinesStatus(key, params) {
    i18n.setText(linesStatus, key, params);
    clearTimeout(linesStatusTimer);
    linesStatusTimer = setTimeout(() => { linesStatus.textContent = ''; linesStatus.removeAttribute('data-i18n'); }, 8000);
}

function openBulkModal() {
    stopTapSync();
    bulkMode.hidden = !linesData.some((l) => !isEndLine(l));
    bulkMode.querySelector('input[value="append"]').checked = true;
    bulkModal.style.display = 'flex';
    updateBulkCount();
    bulkText.focus();
}

function closeBulkModal() {
    bulkModal.style.display = 'none';
}

document.getElementById('btn-bulk-input').addEventListener('click', openBulkModal);
document.getElementById('close-bulk').addEventListener('click', closeBulkModal);
bulkText.addEventListener('input', updateBulkCount);
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && bulkModal.style.display === 'flex') closeBulkModal();
});

btnBulkApply.addEventListener('click', async () => {
    const lines = bulkLines();
    if (lines.length === 0) return alert(i18n.t('typing.bulk_empty'));
    if (lines.length > BULK_MAX_LINES) return alert(i18n.t('typing.bulk_too_many', { max: BULK_MAX_LINES }));

    btnBulkApply.disabled = true;
    i18n.setText(btnBulkApply, 'typing.converting');
    try {
        const res = await fetch('/api/convert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lines })
        });
        const data = await res.json();
        if (!res.ok || !data.success || !Array.isArray(data.lines)) {
            return alert(i18n.server(data.detail, 'typing.conversion_failed'));
        }
        const newLines = lines.map((lyrics, i) => ({
            time: null,
            lyrics,
            hiragana: (data.lines[i] && data.lines[i].hiragana) || lyrics,
        }));
        const mode = bulkMode.querySelector('input[name="bulk-mode"]:checked').value;
        if (!bulkMode.hidden && mode === 'replace') linesData = newLines;
        else linesData.push(...newLines);

        resetForm();
        renderTable();
        bulkText.value = '';
        closeBulkModal();
        showLinesStatus('typing.bulk_added', { count: newLines.length });
    } catch (err) {
        console.error(err);
        alert(i18n.t('typing.an_error_occurred_while_calling_the'));
    } finally {
        btnBulkApply.disabled = false;
        i18n.setText(btnBulkApply, 'typing.bulk_apply');
    }
});

function updateUnsyncedBadge() {
    const badge = document.getElementById('unsynced-badge');
    const count = linesData.filter((l) => !hasTime(l)).length;
    badge.hidden = count === 0;
    if (count > 0) i18n.setText(badge, 'typing.unsynced_badge', { count });
}

// ════════════════════════════════════════════════════════════
// 탭 싱크: 영상을 들으며 Space 를 누를 때마다 '지금 찍을 줄'에 현재 시간을 기록하고 다음 줄로 넘어간다.
//   Space 찍기 · Backspace 되돌리기 · Esc 끝내기 · 표의 줄 클릭 → 그 줄부터
//   모든 줄을 찍은 뒤 Space 를 한 번 더 누르면 그 시간이 종료 지점([END])이 된다.
// ════════════════════════════════════════════════════════════
const TAP_OFFSET_OPTIONS = [0, 0.1, 0.2, 0.3, 0.4];
const TAP_OFFSET_DEFAULT = 0.2;   // 사람이 듣고 누르기까지의 반응 지연 보정 (초)
const TAP_OFFSET_STORAGE_KEY = 'ep_tap_sync_offset';
const TAP_UNDO_REWIND_SEC = 2;    // 되돌리기 시 영상을 이만큼 앞으로 돌린다

const tapSync = {
    active: false,
    pointer: -1,     // 지금 찍을 줄의 linesData 인덱스
    atEnd: false,    // 모든 줄을 찍고 종료 지점을 기다리는 중
    history: [],     // 되돌리기용 [{ index, prevTime, stampedAt }]
};
const tapBar = document.getElementById('tap-sync-bar');
const tapOffsetSelect = document.getElementById('tap-offset');
const tapWarning = document.getElementById('tap-sync-warning');

function lyricIndices() {
    return linesData.map((l, i) => (isEndLine(l) ? -1 : i)).filter((i) => i !== -1);
}

function nextLyricIndex(from) {
    for (let i = from; i < linesData.length; i++) {
        if (!isEndLine(linesData[i])) return i;
    }
    return -1;
}

function previousTimedLyric(index) {
    for (let i = index - 1; i >= 0; i--) {
        if (!isEndLine(linesData[i]) && hasTime(linesData[i])) return linesData[i];
    }
    return null;
}

function getTapOffset() {
    const v = parseFloat(tapOffsetSelect.value);
    return isNaN(v) ? TAP_OFFSET_DEFAULT : v;
}

function buildTapOffsetOptions() {
    let saved = TAP_OFFSET_DEFAULT;
    try {
        const stored = parseFloat(localStorage.getItem(TAP_OFFSET_STORAGE_KEY));
        if (TAP_OFFSET_OPTIONS.includes(stored)) saved = stored;
    } catch (e) { /* 저장소 차단 */ }
    const current = tapOffsetSelect.value === '' ? saved : getTapOffset();
    tapOffsetSelect.innerHTML = TAP_OFFSET_OPTIONS
        .map((sec) => `<option value="${sec}">${i18n.t('typing.seconds_short', { sec })}</option>`)
        .join('');
    tapOffsetSelect.value = String(current);
}

tapOffsetSelect.addEventListener('change', () => {
    try { localStorage.setItem(TAP_OFFSET_STORAGE_KEY, String(getTapOffset())); } catch (e) { /* 저장소 차단 */ }
    tapOffsetSelect.blur(); // 다음 Space 가 선택 상자로 가지 않도록
});

function seekAndPlay(seconds) {
    youtubePlayer.seekTo(Math.max(0, seconds), true);
    youtubePlayer.playVideo();
}

function renderTapSync() {
    if (!tapSync.active) return;
    const lyrics = lyricIndices();
    const progress = document.getElementById('tap-sync-progress');
    const now = document.getElementById('tap-sync-now');
    const next = document.getElementById('tap-sync-next');
    now.innerHTML = '';
    next.textContent = '';

    if (tapSync.atEnd) {
        progress.textContent = `${lyrics.length} / ${lyrics.length}`;
        now.textContent = i18n.t('typing.tap_end_prompt');
        return;
    }
    const line = linesData[tapSync.pointer];
    progress.textContent = `${lyrics.indexOf(tapSync.pointer) + 1} / ${lyrics.length}`;
    now.textContent = line.lyrics;
    if (line.hiragana && line.hiragana !== line.lyrics) {
        const small = document.createElement('small');
        small.textContent = line.hiragana;
        now.appendChild(small);
    }
    const nextIndex = nextLyricIndex(tapSync.pointer + 1);
    if (nextIndex !== -1) next.textContent = `${i18n.t('typing.tap_next')}: ${linesData[nextIndex].lyrics}`;
}

function startTapSync() {
    if (!(youtubePlayer && isPlayerReady)) return alert(i18n.t('typing.please_load_the_youtube_video_first'));
    const lyrics = lyricIndices();
    if (lyrics.length === 0) return alert(i18n.t('typing.tap_sync_need_lines'));

    if (editingIndex !== -1) resetForm();
    sortLines();
    // 싱크 전 줄이 있으면 그 줄부터, 모두 찍혀 있으면 처음부터 (표의 줄을 눌러 원하는 줄로 옮길 수 있다)
    const firstUnsynced = lyricIndices().find((i) => !hasTime(linesData[i]));
    Object.assign(tapSync, { active: true, atEnd: false, history: [], pointer: firstUnsynced !== undefined ? firstUnsynced : lyricIndices()[0] });

    if (document.activeElement) document.activeElement.blur();
    document.body.classList.add('tap-syncing');
    tapBar.hidden = false;
    tapWarning.hidden = true;

    // 이어서 싱크할 때는 직전에 찍힌 줄부터 다시 들려준다
    const previous = previousTimedLyric(tapSync.pointer);
    if (previous) seekAndPlay(previous.time);
    else youtubePlayer.playVideo();

    renderTapSync();
    renderTable();
}

function stopTapSync() {
    if (!tapSync.active) return;
    Object.assign(tapSync, { active: false, pointer: -1, atEnd: false, history: [] });
    tapBar.hidden = true;
    document.body.classList.remove('tap-syncing');
    renderTable(); // 이제 시간순으로 정렬된다
}

function stampTap() {
    if (!tapSync.active) return;
    const time = Math.round(Math.max(0, youtubePlayer.getCurrentTime() - getTapOffset()) * 100) / 100;

    if (tapSync.atEnd) {
        // 종료 지점: 이미 있으면 시간만 바꾸고, 없으면 새로 추가한 뒤 싱크를 마친다
        const endLine = linesData.find(isEndLine);
        if (endLine) endLine.time = time;
        else linesData.push({ time, lyrics: '[END]', hiragana: '[END]' });
        stopTapSync();
        return;
    }

    const index = tapSync.pointer;
    tapSync.history.push({ index, prevTime: linesData[index].time, stampedAt: time });
    linesData[index].time = time;
    const nextIndex = nextLyricIndex(index + 1);
    if (nextIndex === -1) {
        tapSync.atEnd = true;
        tapSync.pointer = -1;
    } else {
        tapSync.pointer = nextIndex;
    }
    renderTapSync();
    renderTable();
}

function undoTap() {
    if (!tapSync.active) return;
    const last = tapSync.history.pop();
    if (!last) return;
    linesData[last.index].time = last.prevTime;
    tapSync.pointer = last.index;
    tapSync.atEnd = false;
    seekAndPlay(last.stampedAt - TAP_UNDO_REWIND_SEC);
    renderTapSync();
    renderTable();
}

function moveTapSyncTo(index) {
    if (isEndLine(linesData[index])) return;
    tapSync.pointer = index;
    tapSync.atEnd = false;
    // 그 줄을 다시 찍을 수 있도록 조금 앞에서부터 재생한다
    const line = linesData[index];
    const previous = previousTimedLyric(index);
    if (hasTime(line)) seekAndPlay(line.time - TAP_UNDO_REWIND_SEC);
    else if (previous) seekAndPlay(previous.time);
    renderTapSync();
    renderTable();
}

document.getElementById('btn-tap-sync').addEventListener('click', () => {
    if (tapSync.active) stopTapSync();
    else startTapSync();
});
document.getElementById('btn-tap-stamp').addEventListener('click', stampTap);
document.getElementById('btn-tap-undo').addEventListener('click', undoTap);
document.getElementById('btn-tap-exit').addEventListener('click', stopTapSync);
// 진행 바의 버튼이 포커스를 가져가면 다음 Space 가 그 버튼을 누르게 되므로 포커스를 주지 않는다
tapBar.querySelectorAll('button').forEach((b) => b.addEventListener('mousedown', (e) => e.preventDefault()));

document.addEventListener('keydown', (e) => {
    if (!tapSync.active) return;
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target && e.target.isContentEditable)) return;
    if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault(); // 페이지 스크롤 방지
        if (!e.repeat) stampTap();
    } else if (e.key === 'Backspace') {
        e.preventDefault();
        undoTap();
    } else if (e.key === 'Escape') {
        e.preventDefault();
        stopTapSync();
    }
});

// 영상(iframe)을 클릭하면 키 입력이 유튜브로 가서 Space 가 페이지에 오지 않는다 → 안내
window.addEventListener('blur', () => {
    if (!tapSync.active) return;
    setTimeout(() => {
        if (document.activeElement && document.activeElement.tagName === 'IFRAME') tapWarning.hidden = false;
    }, 0);
});
window.addEventListener('focus', () => { tapWarning.hidden = true; });

buildTapOffsetOptions();
document.addEventListener('i18n:change', () => {
    buildTapOffsetOptions();
    renderTable();
    renderTapSync();
});
