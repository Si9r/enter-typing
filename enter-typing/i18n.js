/**
 * i18n.js — 엔터핑 다국어 엔진 (키 기반)
 *
 * 번역 파일: /locales/{ko,en,ja}.json  (네임스페이스별 중첩 객체, 예: { "typing": { "current_position": "현재 입력 위치" } })
 * 페이지 <head> 에서 서버가 세 파일을 묶은 /i18n-bundle.js 를 먼저 불러오므로, 번역 사전은 처음부터 준비돼 있다.
 *   <script src="/i18n-bundle.js"></script>
 *   <script src="/i18n.js"></script>
 *
 * ── 사용법 ─────────────────────────────────────────────
 * HTML
 *   <span data-i18n="typing.current_position">현재 입력 위치</span>   ← 안의 한국어는 로딩 전 기본값
 *   <input data-i18n-placeholder="search.placeholder" placeholder="곡명, 아티스트 검색">
 *   <button data-i18n-title="common.delete" title="삭제">   (data-i18n-alt, data-i18n-aria-label 도 같은 방식)
 *   <span data-i18n="quiz.remaining" data-i18n-args='{"count": 3}'></span>  ← 문구 안의 {count} 치환
 *   <span translate="no">한국어</span>                                    ← 번역하지 않음
 * JS
 *   i18n.t('quiz.remaining', { count: 3 }); // 현재 언어 문구 (없으면 한국어 → 키 순으로 대체). 언제든 바로 사용 가능
 *   i18n.setText(el, 'quiz.remaining', { count: 3 }); // 요소에 키를 지정 (언어 전환 시 자동 갱신)
 *   i18n.server(data.detail, 'common.error');  // 서버가 보낸 한국어 메시지 → 현재 언어 (없으면 기본 문구)
 *   i18n.genre('애니메이션');                // DB 에 한국어로 저장된 장르 등 고정값 → "Anime"
 *   i18n.duration(185);                     // "3분 5초" / "3m 5s" / "3分5秒"
 *   document.addEventListener('i18n:change', rerender); // 언어를 바꿨을 때 JS 로 그린 화면을 다시 그리려면
 *   i18n.apply(element);                    // 동적으로 만든 요소 번역 (보통은 자동 감지되므로 불필요)
 */
(function () {
    if (window.i18n) return; // 중복 포함돼도 한 번만 초기화

    const SUPPORTED = ['ko', 'en', 'ja'];
    const DEFAULT_LANG = 'ko';
    const LANG_LABELS = { ko: '한국어', en: 'English', ja: '日本語' };

    const dicts = {}; // lang → { "ns.key": "문구" }

    function getLang() {
        let lang = null;
        try { lang = localStorage.getItem('ep_lang'); } catch (e) { /* 저장소 차단 */ }
        return SUPPORTED.includes(lang) ? lang : DEFAULT_LANG;
    }

    function flatten(obj, prefix, out) {
        Object.keys(obj).forEach((k) => {
            const v = obj[k];
            const key = prefix ? prefix + '.' + k : k;
            if (v && typeof v === 'object') flatten(v, key, out);
            else out[key] = String(v);
        });
        return out;
    }

    // <head> 의 /i18n-bundle.js 가 넣어 둔 사전을 바로 쓴다
    const bundled = window.__EP_LOCALES || {};
    Object.keys(bundled).forEach((lang) => { dicts[lang] = flatten(bundled[lang], '', {}); });

    async function loadDict(lang) {
        if (dicts[lang]) return dicts[lang];
        // 번들이 없는 페이지를 위한 예비 경로
        try {
            const res = await fetch(`/locales/${lang}.json`, { cache: 'no-cache' });
            dicts[lang] = res.ok ? flatten(await res.json(), '', {}) : {};
        } catch (e) {
            console.error('[i18n] 번역 파일을 불러오지 못했습니다:', lang, e);
            dicts[lang] = {};
        }
        return dicts[lang];
    }

    function interpolate(text, params) {
        if (!params) return text;
        return text.replace(/\{(\w+)\}/g, (m, name) => (name in params ? String(params[name]) : m));
    }

    // HTML 들여쓰기로 생긴 줄바꿈·연속 공백은 한 칸으로 정리해서 비교한다
    const normalize = (text) => text.replace(/\s+/g, ' ').trim();

    const warnedKeys = new Set();

    /** 키 → 현재 언어 문구. 현재 언어에 없으면 한국어, 그것도 없으면 키를 그대로 돌려준다. */
    function t(key, params) {
        const cur = dicts[getLang()] || {};
        const ko = dicts.ko || {};
        let text;
        if (key in cur) text = cur[key]; // 빈 문자열도 의도된 번역으로 취급
        else if (key in ko) text = ko[key];
        else {
            if (dicts.ko && !warnedKeys.has(key)) {
                warnedKeys.add(key);
                console.warn('[i18n] 번역 키가 없습니다:', key);
            }
            return key;
        }
        return interpolate(text, params);
    }

    /** 초 → "3분 5초" / "3m 5s" / "3分5秒" (1분 미만이면 "5초") */
    function duration(totalSeconds) {
        const total = Math.max(0, Math.round(Number(totalSeconds) || 0));
        const m = Math.floor(total / 60);
        const s = total % 60;
        return m > 0 ? t('common.duration_min_sec', { m, s }) : t('common.n_seconds', { count: s });
    }

    // DB 에 한국어로 저장되는 고정 분류값(장르, 기록 종류) → 번역 키. 사용자가 직접 입력한 값은 그대로 표시한다.
    const FIXED_VALUES = {
        '애니메이션': 'common.anime', '기타': 'common.etc', '팝송': 'common.pop_song', '문학': 'common.literature',
        '영어': 'common.english', '일본어': 'common.japanese', '상식': 'common.common_sense', '역사': 'common.history_genre',
        '타이핑': 'nav.typing', '퀴즈': 'nav.quiz', '실시간 대전': 'common.live_battle', '알 수 없음': 'common.unknown',
    };

    /** 장르 등 서버에 한국어로 저장된 고정값을 현재 언어로. 목록에 없는 값(JPOP, 사용자 입력)은 그대로. */
    function genre(value) {
        const key = FIXED_VALUES[String(value ?? '').trim()];
        return key ? t(key) : (value ?? '');
    }

    /**
     * 서버(FastAPI)가 detail/message 로 보내는 한국어 문구를 현재 언어로 바꾼다.
     * locales 의 server.* 문구와 같으면 번역하고, 모르는 문구는 그대로 보여준다.
     * 문자열이 아니거나 비어 있으면(예: 422 검증 오류 배열) fallbackKey 문구를 쓴다.
     */
    let serverIndex = null;
    function server(message, fallbackKey) {
        if (typeof message !== 'string' || !message.trim()) return fallbackKey ? t(fallbackKey) : '';
        if (!serverIndex) {
            serverIndex = {};
            Object.keys(dicts.ko || {}).forEach((key) => {
                if (key.startsWith('server.')) serverIndex[normalize(dicts.ko[key])] = key;
            });
        }
        const key = serverIndex[normalize(message)];
        return key ? t(key) : message;
    }

    // ── 요소 번역 (data-i18n*) ─────────────────────────────
    function parseArgs(el) {
        const raw = el.getAttribute('data-i18n-args');
        if (!raw) return undefined;
        try { return JSON.parse(raw); } catch (e) { return undefined; }
    }

    function koDefault(key, params) {
        const ko = dicts.ko || {};
        return key in ko ? interpolate(ko[key], params) : key;
    }

    /**
     * 요소의 현재 값이 "번역 엔진이 관리하는 값"인지 판단한다.
     * 한국어 기본값, 비어 있음, 현재 언어 번역, 또는 엔진이 마지막으로 넣은 값일 때만 번역한다.
     * JS 가 내용을 채운 요소(예: "로딩 중..." → 목록)는 언어를 바꿔도 덮어쓰지 않는다.
     */
    function owns(current, key, params, last) {
        if (last !== undefined && current === last) return true;
        const n = normalize(current || '');
        return n === '' || n === normalize(koDefault(key, params)) || n === normalize(t(key, params));
    }

    function ownsText(el) {
        const key = el.getAttribute('data-i18n');
        return !!key && el.children.length === 0 && owns(el.textContent, key, parseArgs(el), el._i18nLast);
    }

    const ATTR_BINDINGS = [['data-i18n-placeholder', 'placeholder'], ['data-i18n-title', 'title'], ['data-i18n-alt', 'alt'], ['data-i18n-aria-label', 'aria-label']];

    function ownsAttr(el, attr, target) {
        const key = el.getAttribute(attr);
        el._i18nAttrKeyLast = el._i18nAttrKeyLast || {};
        return !!key && owns(el.getAttribute(target), key, parseArgs(el), el._i18nAttrKeyLast[target]);
    }

    function applyElement(el) {
        if (el.closest('[translate="no"]')) return;
        const args = parseArgs(el);
        if (el.getAttribute('data-i18n') && ownsText(el)) {
            const v = t(el.getAttribute('data-i18n'), args);
            // 값이 같으면 건드리지 않는다 (MutationObserver 무한 반복 방지)
            if (el.textContent !== v) el.textContent = v;
            el._i18nLast = v;
        }
        ATTR_BINDINGS.forEach(([attr, target]) => {
            const key = el.getAttribute(attr);
            if (key && ownsAttr(el, attr, target)) {
                const v = t(key, args);
                if (el.getAttribute(target) !== v) el.setAttribute(target, v);
                el._i18nAttrKeyLast[target] = v;
            }
        });
    }

    /** JS 에서 요소 문구를 키로 지정한다. 이후 언어를 바꾸면 자동으로 따라 바뀐다. */
    function setText(el, key, params) {
        if (!el) return;
        el.setAttribute('data-i18n', key);
        if (params) el.setAttribute('data-i18n-args', JSON.stringify(params));
        else el.removeAttribute('data-i18n-args');
        el.textContent = t(key, params);
        el._i18nLast = el.textContent;
    }

    const I18N_SELECTOR = '[data-i18n],[data-i18n-placeholder],[data-i18n-title],[data-i18n-alt],[data-i18n-aria-label]';

    function apply(root) {
        root = root || document.body;
        if (!root || root.nodeType !== Node.ELEMENT_NODE) return;
        if (root.matches(I18N_SELECTOR)) applyElement(root);
        root.querySelectorAll(I18N_SELECTOR).forEach(applyElement);
        if (root === document.body || root === document.documentElement) {
            document.documentElement.lang = getLang();
            const titleKey = document.documentElement.getAttribute('data-i18n-doc-title');
            if (titleKey) document.title = t(titleKey);
        }
    }

    // ── 언어 전환 / 초기화 ─────────────────────────────────
    function updateLanguageSelectorUI() {
        const el = document.getElementById('current-lang-text');
        if (el) el.textContent = LANG_LABELS[getLang()];
    }

    async function loadCurrent() {
        await loadDict('ko'); // 번역이 없을 때 쓰는 기본값
        const lang = getLang();
        if (lang !== 'ko') await loadDict(lang);
    }

    async function setLanguage(lang) {
        if (!SUPPORTED.includes(lang)) return;
        try { localStorage.setItem('ep_lang', lang); } catch (e) { /* 저장소 차단 */ }
        await loadCurrent();
        apply(document.body);
        updateLanguageSelectorUI();
        document.dispatchEvent(new CustomEvent('i18n:change', { detail: { lang } }));
    }

    // 한국어가 아니면 첫 번역이 끝날 때까지 화면을 숨겨 한국어가 잠깐 보이는 것을 막는다. (3초 뒤에는 반드시 표시)
    const show = () => { document.documentElement.style.visibility = ''; };
    if (getLang() !== 'ko') {
        document.documentElement.style.visibility = 'hidden';
        setTimeout(show, 3000);
    }

    const domReady = document.readyState === 'loading'
        ? new Promise((r) => document.addEventListener('DOMContentLoaded', r, { once: true }))
        : Promise.resolve();

    const ready = Promise.all([loadCurrent(), domReady]).then(() => {
        apply(document.body);
        updateLanguageSelectorUI();

        // 나중에 추가되는 요소(카드, 모달, 채팅 등)와 키/인자 변경도 자동 번역
        new MutationObserver((mutations) => {
            mutations.forEach((m) => {
                if (m.type === 'childList') m.addedNodes.forEach((n) => apply(n));
                else applyElement(m.target);
            });
        }).observe(document.body, {
            childList: true, subtree: true, attributes: true,
            attributeFilter: ['data-i18n', 'data-i18n-args', 'data-i18n-placeholder', 'data-i18n-title',
                'data-i18n-alt', 'data-i18n-aria-label', 'placeholder', 'title', 'alt'],
        });
    }).finally(show);

    // HTML 이스케이프: 사용자가 입력한 값(닉네임, 제목 등)을 innerHTML 에 넣기 전에 사용한다.
    // 번역과는 별개지만, 모든 페이지에서 가장 먼저 로드되는 공통 스크립트라 여기서 제공한다.
    window.escapeHtml = (value) => String(value ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    window.i18n = { t, server, setText, duration, genre, apply, ready, setLanguage, getLang, SUPPORTED };
    window.setLanguage = setLanguage; // navbar 언어 선택 메뉴에서 사용
})();
