// ── 퀴즈 제작: 링크로 여러 문제 만들기 ─────────────────────────────
// 유튜브 링크를 여러 개 붙여넣으면 영상 제목·채널명으로 가수/제목 정답을 채운 문제를 한 번에 만든다.
// create.js 의 linesData, renderGrid, extractVideoId 를 사용하므로 그 뒤에 불러온다.

const LINKS_MAX = 50; // 서버(/api/youtube/meta) 제한과 같다
const ARTIST_QUESTION = "가수";
const TITLE_QUESTION = "제목";

// 질문 구성
const QUESTION_TEMPLATES = {
    artist_title: [ARTIST_QUESTION, TITLE_QUESTION],
    title: [TITLE_QUESTION],
    artist: [ARTIST_QUESTION],
};

// 구간 프리셋 (초). custom 은 입력칸 값을 쓴다.
const SEGMENT_PRESETS = {
    m1_30: { start: 60, length: 30 },
    s0_10: { start: 0, length: 10 },
    s0_30: { start: 0, length: 30 },
};

const LINKS_PREFS_KEY = "ep_quiz_links_prefs";

// ── 영상 제목 → 가수 / 제목 추출 ────────────────────────────────
// 완벽할 수 없으므로 미리보기 표에서 고칠 수 있게 한다.

// 제목에서 지울 꼬리표 (괄호 안이나 끝에 붙는 것)
const TITLE_NOISE = /(official|music\s*video|lyrics?|video|audio|\bmv\b|\bpv\b|m\/v|full\s*ver|\bver\b|4k|\bhd\b|歌詞|字幕|公式|フル|ミュージックビデオ|视频|中文|한글|가사|뮤직비디오|teaser|trailer|live)/i;

function cleanArtistName(name) {
    const cleaned = (name || "")
        .replace(/\s*-\s*topic\s*$/i, "")
        .replace(/vevo$/i, "")
        .replace(/\s*(official\s*)?(youtube\s*)?(channel|チャンネル|채널)\s*$/i, "")
        .replace(/\s*(official|公式|オフィシャル)\s*$/i, "")
        .trim();
    return cleaned || (name || "").trim();
}

function stripNoise(text) {
    let s = text;
    // 괄호 안이 꼬리표면 괄호째 지운다: 【MV】 [Official Video] (Lyric Video) （歌詞付き）
    s = s.replace(/[【\[(（〔［]([^】\])）〕］]*)[】\])）〕］]/g, (m, inner) => (TITLE_NOISE.test(inner) ? " " : m));
    // 끝에 붙은 꼬리표: "... Official Music Video", "... MV"
    s = s.replace(/\s+(official\s+)?(music\s+video|lyric\s+video|video|mv|pv|audio)\s*$/i, "");
    return s.replace(/\s+/g, " ").trim();
}

function sameName(a, b) {
    const norm = (v) => (v || "").toLowerCase().replace(/[\s._\-・]/g, "");
    const x = norm(a), y = norm(b);
    return !!x && !!y && (x === y || x.includes(y) || y.includes(x));
}

/** 영상 제목과 채널명으로 { artist, title } 을 추측한다. */
function parseVideoTitle(videoTitle, channel) {
    const channelArtist = cleanArtistName(channel);
    const raw = (videoTitle || "").trim();

    // 1) 「곡명」『곡명』 이 있으면 그 안이 제목, 앞부분이 가수. 'I AM' "Dynamite" 처럼 띄어 쓴 따옴표도 같은 규칙
    const quoted = raw.match(/[「『]([^」』]+)[」』]/) || raw.match(/(?:^|\s)['"‘“]([^'"’”]+)['"’”](?=\s|$)/);
    if (quoted) {
        const before = stripNoise(raw.slice(0, quoted.index)).replace(/[\s:：/／|｜-]+$/, "").trim();
        return { artist: before ? cleanArtistName(before) : channelArtist, title: quoted[1].trim() };
    }

    const text = stripNoise(raw);

    // 2) "가수 - 곡명", "가수：곡명" (뒤에 " / THE FIRST TAKE" 같은 꼬리가 있으면 버린다)
    const dash = text.split(/\s+[-–—]\s+|\s*：\s*|\s+:\s+/);
    if (dash.length >= 2) {
        let [left, ...rest] = dash;
        let right = rest.join(" - ").split(/\s*[/／|｜]\s*/)[0].trim();
        if (sameName(right, channelArtist) && !sameName(left, channelArtist)) [left, right] = [right, left];
        return { artist: cleanArtistName(left), title: right || text };
    }

    // 3) "곡명 / 가수"
    const slash = text.split(/\s*[/／|｜]\s*/).filter(Boolean);
    if (slash.length >= 2) {
        const [left, right] = slash;
        if (sameName(left, channelArtist)) return { artist: cleanArtistName(left), title: right };
        return { artist: sameName(right, channelArtist) || !channelArtist ? cleanArtistName(right) : channelArtist, title: left };
    }

    // 4) 나눌 수 없으면 영상 제목 전체가 곡명, 채널이 가수 ("가수 - Topic" 자동 생성 채널 등)
    return { artist: channelArtist, title: text || raw };
}

// ── 링크 해석 ─────────────────────────────────────────────────
/** 유튜브 링크에서 영상 ID 를 꺼낸다. 재생목록만 있는 링크는 { playlist: true }. */
function parseYoutubeLink(line) {
    let url;
    try {
        url = new URL(/^https?:\/\//i.test(line) ? line : "https://" + line);
    } catch (e) {
        return { id: null };
    }
    const host = url.hostname.replace(/^(www|m|music)\./, "");
    let id = null;
    if (host === "youtu.be") id = url.pathname.split("/")[1];
    else if (host === "youtube.com" || host === "youtube-nocookie.com") {
        id = url.searchParams.get("v");
        const m = url.pathname.match(/^\/(shorts|embed|live|v)\/([^/?#]+)/);
        if (!id && m) id = m[2];
        if (!id && url.searchParams.get("list")) return { id: null, playlist: true };
    }
    return { id: id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null };
}

// ── 모달 ─────────────────────────────────────────────────────
const linksModal = document.getElementById("links-modal");
const linksText = document.getElementById("links-input");
const linksCount = document.getElementById("links-count");
const linksPreview = document.getElementById("links-preview");
const linksNotice = document.getElementById("links-notice");
const btnLinksLoad = document.getElementById("btn-links-load");
const btnLinksAdd = document.getElementById("btn-links-add");
const segStartInput = document.getElementById("links-seg-start");
const segLengthInput = document.getElementById("links-seg-length");
let previewRows = []; // [{ id, ok, reason, artist, title, already, raw }]

function linkLines() {
    return linksText.value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
}

function loadPrefs() {
    try { return JSON.parse(localStorage.getItem(LINKS_PREFS_KEY)) || {}; } catch (e) { return {}; }
}

function savePrefs() {
    try {
        localStorage.setItem(LINKS_PREFS_KEY, JSON.stringify({
            template: selectedTemplate(), segment: selectedSegment(),
            start: segStartInput.value, length: segLengthInput.value,
        }));
    } catch (e) { /* 저장소 차단 */ }
}

function selectedTemplate() {
    const el = linksModal.querySelector('input[name="links-template"]:checked');
    return el && QUESTION_TEMPLATES[el.value] ? el.value : "artist_title";
}

function selectedSegment() {
    const el = linksModal.querySelector('input[name="links-segment"]:checked');
    return el ? el.value : "m1_30";
}

/** 선택한 프리셋의 { start, end } (초). 직접 입력이 잘못되면 null. */
function segmentRange() {
    const preset = SEGMENT_PRESETS[selectedSegment()];
    if (preset) return { start: preset.start, end: preset.start + preset.length };
    const m = segStartInput.value.trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$|^(\d+)$/);
    const length = parseInt(segLengthInput.value, 10);
    if (!m || !(length > 0)) return null;
    const start = m[4] !== undefined ? parseInt(m[4], 10) : (parseInt(m[1] || "0", 10) * 3600 + parseInt(m[2], 10) * 60 + parseInt(m[3], 10));
    return { start, end: start + length };
}

function updateSegmentInputs() {
    const custom = selectedSegment() === "custom";
    document.getElementById("links-seg-custom").hidden = !custom;
}

function updateTemplateColumns() {
    const used = QUESTION_TEMPLATES[selectedTemplate()];
    linksPreview.classList.toggle("hide-artist", !used.includes(ARTIST_QUESTION));
    linksPreview.classList.toggle("hide-title", !used.includes(TITLE_QUESTION));
}

function clearPreview() {
    previewRows = [];
    linksPreview.innerHTML = "";
    linksPreview.hidden = true;
    linksNotice.textContent = "";
    btnLinksAdd.disabled = true;
    i18n.setText(btnLinksAdd, "quiz.links_add", { count: 0 });
}

function openLinksModal() {
    const prefs = loadPrefs();
    const tpl = linksModal.querySelector(`input[name="links-template"][value="${prefs.template}"]`);
    if (tpl) tpl.checked = true;
    const seg = linksModal.querySelector(`input[name="links-segment"][value="${prefs.segment}"]`);
    if (seg) seg.checked = true;
    if (prefs.start) segStartInput.value = prefs.start;
    if (prefs.length) segLengthInput.value = prefs.length;
    updateSegmentInputs();
    updateTemplateColumns();
    i18n.setText(linksCount, "quiz.links_count", { count: linkLines().length });
    linksModal.style.display = "flex";
    document.body.style.overflow = "hidden";
    linksText.focus();
}

function closeLinksModal() {
    linksModal.style.display = "none";
    document.body.style.overflow = "";
}

function reasonText(row) {
    if (row.reason === "playlist") return i18n.t("quiz.links_reason_playlist");
    if (row.reason === "invalid") return i18n.t("quiz.links_reason_invalid");
    if (row.reason === "not_found") return i18n.t("quiz.links_reason_not_found");
    if (row.reason === "not_embeddable") return i18n.t("quiz.links_reason_not_embeddable");
    return i18n.t("quiz.links_reason_network");
}

function selectedRows() {
    return previewRows.filter((r) => r.ok && r.checked);
}

function updateAddButton() {
    const count = selectedRows().length;
    btnLinksAdd.disabled = count === 0;
    i18n.setText(btnLinksAdd, "quiz.links_add", { count });
}

function renderPreview() {
    linksPreview.hidden = previewRows.length === 0;
    const head = `<thead><tr><th></th><th></th><th class="col-artist">${i18n.t("quiz.links_col_artist")}</th><th class="col-title">${i18n.t("quiz.links_col_title")}</th></tr></thead>`;
    const body = previewRows.map((row, i) => {
        if (!row.ok) {
            return `<tr class="failed"><td></td><td colspan="3"><div class="link-raw">${escapeHtml(row.raw)}</div><div class="link-reason">${escapeHtml(reasonText(row))}</div></td></tr>`;
        }
        const already = row.already ? `<div class="link-note">${i18n.t("quiz.links_already_registered")}</div>` : "";
        return `<tr>
            <td><input type="checkbox" class="link-check" data-i="${i}" ${row.checked ? "checked" : ""}></td>
            <td><img class="link-thumb" src="https://img.youtube.com/vi/${escapeHtml(row.id)}/mqdefault.jpg" alt="" loading="lazy"></td>
            <td class="col-artist"><input type="text" class="link-artist" data-i="${i}" value="${escapeHtml(row.artist)}"></td>
            <td class="col-title"><input type="text" class="link-title" data-i="${i}" value="${escapeHtml(row.title)}"><div class="link-source" title="${escapeHtml(row.videoTitle)}">${escapeHtml(row.videoTitle)}</div>${already}</td>
        </tr>`;
    }).join("");
    linksPreview.innerHTML = `<table>${head}<tbody>${body}</tbody></table>`;

    linksPreview.querySelectorAll(".link-check").forEach((el) => el.addEventListener("change", () => {
        previewRows[el.dataset.i].checked = el.checked;
        updateAddButton();
    }));
    linksPreview.querySelectorAll(".link-artist").forEach((el) => el.addEventListener("input", () => { previewRows[el.dataset.i].artist = el.value; }));
    linksPreview.querySelectorAll(".link-title").forEach((el) => el.addEventListener("input", () => { previewRows[el.dataset.i].title = el.value; }));
    updateAddButton();
}

async function loadLinks() {
    const lines = linkLines();
    if (lines.length === 0) return alert(i18n.t("quiz.links_none"));

    // 링크 해석, 중복 제거
    const rows = [];
    const seen = new Set();
    let duplicates = 0;
    lines.forEach((raw) => {
        const parsed = parseYoutubeLink(raw);
        if (!parsed.id) {
            rows.push({ raw, ok: false, reason: parsed.playlist ? "playlist" : "invalid" });
            return;
        }
        if (seen.has(parsed.id)) {
            duplicates++;
            return;
        }
        seen.add(parsed.id);
        rows.push({ raw, id: parsed.id });
    });
    const ids = rows.filter((r) => r.id).map((r) => r.id);
    if (ids.length > LINKS_MAX) return alert(i18n.t("quiz.links_too_many", { max: LINKS_MAX }));

    btnLinksLoad.disabled = true;
    i18n.setText(btnLinksLoad, "quiz.links_loading");
    try {
        let videos = {};
        if (ids.length) {
            const res = await fetch("/api/youtube/meta", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) return alert(i18n.server(data.detail, "common.unknown_error"));
            data.videos.forEach((v) => { videos[v.id] = v; });
        }
        const registered = new Set(linesData.map((l) => l.youtube_id));
        previewRows = rows.map((row) => {
            if (!row.id) return row;
            const v = videos[row.id] || { ok: false, reason: "network" };
            if (!v.ok) return { ...row, ok: false, reason: v.reason };
            const guess = parseVideoTitle(v.title, v.author);
            return { ...row, ok: true, checked: true, artist: guess.artist, title: guess.title, videoTitle: v.title, already: registered.has(row.id) };
        });
        linksNotice.textContent = duplicates ? i18n.t("quiz.links_duplicates_removed", { count: duplicates }) : "";
        renderPreview();
    } catch (err) {
        console.error(err);
        alert(i18n.t("quiz.a_server_communication_error_occurred"));
    } finally {
        btnLinksLoad.disabled = false;
        i18n.setText(btnLinksLoad, "quiz.links_load");
    }
}

function addLinkQuestions() {
    const rows = selectedRows();
    if (rows.length === 0) return alert(i18n.t("quiz.links_select_none"));
    const range = segmentRange();
    if (!range) return alert(i18n.t("quiz.links_segment_invalid"));
    const questionNames = QUESTION_TEMPLATES[selectedTemplate()];

    // 필요한 정답이 비어 있으면 막는다
    const answerOf = (row, name) => (name === ARTIST_QUESTION ? row.artist : row.title).trim();
    if (rows.some((row) => questionNames.some((name) => !answerOf(row, name)))) {
        return alert(i18n.t("quiz.links_answer_empty"));
    }

    rows.forEach((row) => {
        const item = { start: range.start, end: range.end, hint: "", youtube_id: row.id, needs_review: true };
        questionNames.forEach((name, i) => {
            item[`question_${i + 1}`] = { question: name, answer: [answerOf(row, name)] };
        });
        linesData.push(item);
    });
    savePrefs();
    renderGrid();
    closeLinksModal();
    linksText.value = "";
    clearPreview();
    alert(i18n.t("quiz.links_added", { count: rows.length }));
}

document.getElementById("btn-links-open").addEventListener("click", openLinksModal);
document.getElementById("close-links").addEventListener("click", closeLinksModal);
btnLinksLoad.addEventListener("click", loadLinks);
btnLinksAdd.addEventListener("click", addLinkQuestions);
linksText.addEventListener("input", () => {
    i18n.setText(linksCount, "quiz.links_count", { count: linkLines().length });
    if (previewRows.length) clearPreview(); // 링크를 바꾸면 다시 불러와야 한다
});
linksModal.querySelectorAll('input[name="links-segment"]').forEach((el) => el.addEventListener("change", updateSegmentInputs));
linksModal.querySelectorAll('input[name="links-template"]').forEach((el) => el.addEventListener("change", updateTemplateColumns));
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && linksModal.style.display === "flex") closeLinksModal();
});
document.addEventListener("i18n:change", () => {
    if (previewRows.length) renderPreview();
});
clearPreview();
