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
    if (linesData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--theme-text-muted); padding: 30px;">${i18n.t('typing.no_lyrics_yet')}</td></tr>`;
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
    if (isNaN(time)) return alert(i18n.t('typing.please_enter_the_end_time_first'));
    linesData.push({ time, lyrics: "[END]", hiragana: "[END]" });
    resetForm();
    renderTable();
});

btnAddLine.addEventListener('click', () => {
    const time = parseFloat(lineTimeInput.value) || 0;
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
            linesData = [];
            resetForm();
            renderTable();
        }
    });
}

function deleteLine(index) {
    if (confirm(i18n.t('typing.are_you_sure_you_want_to'))) {
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

    const artist = document.getElementById('artist').value.trim() || i18n.t('common.unknown');
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
