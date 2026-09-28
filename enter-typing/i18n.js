/**
 * i18n.js — 엔터핑 다국어 엔진 (키 기반)
 *
 * 번역 파일: /locales/{ko,en,ja}.json  (네임스페이스별 중첩 객체, 예: { "typing": { "current_position": "현재 입력 위치" } })
 *
 * ── 사용법 ─────────────────────────────────────────────
 * HTML
 *   <span data-i18n="typing.current_position">현재 입력 위치</span>   ← 안의 한국어는 로딩 전 기본값
 *   <input data-i18n-placeholder="search.placeholder" placeholder="곡명, 아티스트 검색">
 *   <button data-i18n-title="common.delete" title="삭제">
 *   <span data-i18n="quiz.remaining" data-i18n-args='{"count": 3}'></span>  ← 문구 안의 {count} 치환
 * JS
 *   await i18n.ready;                       // 번역 파일 로딩 완료 대기
 *   i18n.t('quiz.remaining', { count: 3 }); // 현재 언어 문구 (없으면 한국어 → 키 순으로 대체)
 *   i18n.apply(element);                    // 동적으로 만든 요소 번역 (보통은 자동 감지되므로 불필요)
 *
 * ── 이전 방식 호환 (전환 기간 동안만 유지) ──────────────────
 * 아직 키로 바꾸지 않은 화면을 위해, 화면의 한국어 문장이 ko.json 의 값과 정확히 같으면
 * 해당 키를 찾아 번역한다. window.i18nTranslate(한국어), alert/confirm 자동 번역도 이 방식이다.
 * 모든 화면을 키로 옮기면 LEGACY 표시가 붙은 부분을 삭제한다.
 */
(function () {
    if (window.i18n) return; // 여러 partial 에서 중복 포함돼도 한 번만 초기화

    // 번역 파일을 바꾸면 이 값을 올린다 (브라우저 캐시 갱신용)
    const LOCALE_VERSION = '2026-09-28';
    const SUPPORTED = ['ko', 'en', 'ja'];
    const DEFAULT_LANG = 'ko';
    const LANG_LABELS = { ko: '한국어', en: 'English', ja: '日本語' };

    const dicts = {};          // lang → { "ns.key": "문구" }
    let legacyIndex = null;    // LEGACY: 한국어 문구 → 키

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

    async function loadDict(lang) {
        if (dicts[lang]) return dicts[lang];
        try {
            const res = await fetch(`/locales/${lang}.json?v=${LOCALE_VERSION}`);
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

    /** 키 → 현재 언어 문구. 현재 언어에 없으면 한국어, 그것도 없으면 키를 그대로 돌려준다. */
    function t(key, params) {
        const lang = getLang();
        const cur = dicts[lang] || {};
        const ko = dicts.ko || {};
        let text;
        if (key in cur) text = cur[key];          // 빈 문자열도 의도된 번역으로 취급
        else if (key in ko) text = ko[key];
        else return legacyTranslate(key);         // LEGACY: 키 대신 한국어 문장이 들어온 경우
        return interpolate(text, params);
    }

    // ── 요소 번역 (data-i18n*) ─────────────────────────────
    function parseArgs(el) {
        const raw = el.getAttribute('data-i18n-args');
        if (!raw) return undefined;
        try { return JSON.parse(raw); } catch (e) { return undefined; }
    }

    function applyElement(el) {
        const args = parseArgs(el);
        const textKey = el.getAttribute('data-i18n');
        if (textKey) {
            const v = t(textKey, args);
            // 값이 같으면 건드리지 않는다 (MutationObserver 무한 반복 방지)
            if (el.textContent !== v) el.textContent = v;
        }
        [['data-i18n-placeholder', 'placeholder'], ['data-i18n-title', 'title'], ['data-i18n-aria-label', 'aria-label']]
            .forEach(([attr, target]) => {
                const key = el.getAttribute(attr);
                if (key) {
                    const v = t(key, args);
                    if (el.getAttribute(target) !== v) el.setAttribute(target, v);
                }
            });
    }

    const I18N_SELECTOR = '[data-i18n],[data-i18n-placeholder],[data-i18n-title],[data-i18n-aria-label]';

    function apply(root) {
        root = root || document.body;
        if (!root) return;
        if (root.nodeType === Node.ELEMENT_NODE && root.matches(I18N_SELECTOR)) applyElement(root);
        if (root.querySelectorAll) root.querySelectorAll(I18N_SELECTOR).forEach(applyElement);
        legacyScan(root);
        if (root === document.body || root === document.documentElement) {
            document.documentElement.lang = getLang();
            const titleKey = document.documentElement.getAttribute('data-i18n-doc-title');
            if (titleKey) document.title = t(titleKey);
        }
    }

    // ── LEGACY: 한국어 문장 매칭 번역 ──────────────────────
    // 숫자가 섞인 문구 (예: "3초", "5점") — 키 기반으로 옮기면 {count} 인자로 대체한다.
    const LEGACY_PATTERNS = [
        [/(\d+)\s*초/g, '$1s', '$1秒'],
        [/(\d+)\s*분/g, '$1m', '$1分'],
        [/([\d,]+)\s*점/g, '$1 pts', '$1点'],
        [/(\d+)\s*회/g, '$1 plays', '$1回'],
        [/(\d+)\s*명/g, '$1 players', '$1人'],
        [/(\d+)\s*개/g, '$1 items', '$1個'],
        [/(\d+)\s*문제/g, '$1 Qs', '$1問'],
        [/([\d,]+)\s*승/g, '$1 wins', '$1勝'],
        [/\(총\s*([\d,]+)\s*전\)/g, '(Total $1 plays)', '(計$1戦)'],
        [/코드:\s*([\w\d]+)/g, 'Code: $1', 'コード：$1'],
        [/대전방\(#([\w\d]+)\)에 입장했습니다!/g, 'Joined battle room (#$1)!', '対戦部屋(#$1)に入場しました！'],
        [/(.+)\s\(나\)$/g, '$1 (Me)', '$1 (私)'],
        [/남은 퀴즈:\s*(\d+)/g, 'Remaining: $1', '残り: $1'],
        [/문제\s*(\d+)\s*\/\s*(\d+)/g, 'Q $1 / $2', '問題 $1 / $2'],
    ];
    const LEGACY_PATTERN_TEST = /(?:\d+|\d+,\d+)\s*(초|분|점|회|명|개|문제|승|전)|코드:\s*[\w\d]+|대전방\(#[\w\d]+\)에 입장했습니다!|\s\(나\)$|남은 퀴즈:\s*\d+|문제\s*\d+\s*\/\s*\d+/;

    // HTML 들여쓰기로 생긴 줄바꿈·연속 공백은 한 칸으로 정리해서 비교한다
    const normalize = (text) => text.replace(/\s+/g, ' ').trim();

    function getLegacyIndex() {
        if (!legacyIndex && dicts.ko) {
            legacyIndex = {};
            Object.keys(dicts.ko).forEach((key) => {
                const ko = normalize(dicts.ko[key]);
                if (ko && !(ko in legacyIndex)) legacyIndex[ko] = key;
            });
        }
        return legacyIndex || {};
    }

    function legacyTranslate(text) {
        if (typeof text !== 'string') return text;
        const trimmed = text.trim();
        const lang = getLang();
        const key = getLegacyIndex()[normalize(trimmed)];
        let translated = trimmed;
        if (key) {
            const cur = dicts[lang] || {};
            translated = key in cur ? cur[key] : dicts.ko[key];
        } else if (lang !== 'ko' && LEGACY_PATTERN_TEST.test(trimmed)) {
            const col = lang === 'en' ? 1 : 2;
            LEGACY_PATTERNS.forEach((p) => { translated = translated.replace(p[0], p[col]); });
        }
        return trimmed ? text.replace(trimmed, translated) : text;
    }

    const legacyTextNodes = new Set();
    const legacyAttrs = new Set();

    function legacyTranslateNode(node) {
        const v = legacyTranslate(node._i18nOriginal);
        // characterData 변경은 childList 관찰 대상이 아니므로 무한 반복이 생기지 않는다
        if (node.nodeValue !== v) node.nodeValue = v;
        node._i18nLast = v;
    }

    function legacyTranslateAttrs(el) {
        Object.keys(el._i18nAttrOriginal).forEach((attr) => {
            const v = legacyTranslate(el._i18nAttrOriginal[attr]);
            if (el.getAttribute(attr) !== v) el.setAttribute(attr, v);
            el._i18nAttrLast[attr] = v;
        });
    }

    function legacyTrackText(node) {
        // JS 가 문구를 바꿨으면(마지막으로 번역한 값과 다르면) 새 문구를 원문으로 다시 등록한다
        if (node._i18nOriginal !== undefined && node.nodeValue === node._i18nLast) return;
        const parent = node.parentElement;
        if (!parent || parent.closest('[data-i18n],script,style,noscript,textarea')) return;
        const trimmed = normalize(node.nodeValue);
        if (trimmed && (getLegacyIndex()[trimmed] || LEGACY_PATTERN_TEST.test(trimmed))) {
            node._i18nOriginal = node.nodeValue;
            legacyTextNodes.add(node);
            legacyTranslateNode(node);
        } else if (node._i18nOriginal !== undefined) {
            // 번역 대상이 아닌 문구로 바뀌었으면 추적을 멈춘다 (언어 전환 시 덮어쓰지 않도록)
            delete node._i18nOriginal;
            legacyTextNodes.delete(node);
        }
    }

    function legacyTrackAttrs(el) {
        ['placeholder', 'title'].forEach((attr) => {
            if (!el.hasAttribute(attr) || el.hasAttribute('data-i18n-' + attr)) return;
            el._i18nAttrOriginal = el._i18nAttrOriginal || {};
            el._i18nAttrLast = el._i18nAttrLast || {};
            const current = el.getAttribute(attr);
            if (attr in el._i18nAttrOriginal && current === el._i18nAttrLast[attr]) return;
            const v = current.trim();
            if (v && getLegacyIndex()[normalize(v)]) {
                el._i18nAttrOriginal[attr] = v;
                legacyAttrs.add(el);
                legacyTranslateAttrs(el);
            } else if (attr in el._i18nAttrOriginal) {
                // 번역 대상이 아닌 문구로 바뀌었으면 추적을 멈춘다 (언어 전환 시 덮어쓰지 않도록)
                delete el._i18nAttrOriginal[attr];
                if (!Object.keys(el._i18nAttrOriginal).length) legacyAttrs.delete(el);
            }
        });
    }

    /** root 아래에서 새로 발견한 한국어 문구만 번역한다. 한국어 화면에서는 할 일이 없으므로 건너뛴다. */
    function legacyScan(root) {
        if (!dicts.ko || getLang() === 'ko') return;
        if (root.nodeType === Node.TEXT_NODE) {
            legacyTrackText(root);
        } else if (root.nodeType === Node.ELEMENT_NODE) {
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
            let n;
            while ((n = walker.nextNode())) legacyTrackText(n);
            legacyTrackAttrs(root);
            root.querySelectorAll('[placeholder],[title]').forEach(legacyTrackAttrs);
        }
    }

    /** 언어를 바꿀 때 이미 번역해 둔 문구 전체를 새 언어로 다시 번역한다 (한국어로 되돌리기 포함). */
    function legacyRetranslateAll() {
        // 번역해 둔 뒤 JS 가 문구를 바꾼 경우(한국어 화면에서는 감시하지 않음)를 먼저 반영하고 다시 번역한다
        [...legacyTextNodes].forEach((node) => {
            if (!node.isConnected) legacyTextNodes.delete(node);
            else if (node.nodeValue === node._i18nLast) legacyTranslateNode(node);
            else legacyTrackText(node);
        });
        [...legacyAttrs].forEach((el) => {
            if (!el.isConnected) { legacyAttrs.delete(el); return; }
            legacyTrackAttrs(el);
            if (legacyAttrs.has(el)) legacyTranslateAttrs(el);
        });
    }

    // LEGACY: alert/confirm 에 넘긴 한국어 문장 자동 번역
    const originalAlert = window.alert.bind(window);
    const originalConfirm = window.confirm.bind(window);
    window.alert = (msg) => originalAlert(typeof msg === 'string' ? legacyTranslate(msg) : msg);
    window.confirm = (msg) => originalConfirm(typeof msg === 'string' ? legacyTranslate(msg) : msg);

    // ── 언어 전환 / 초기화 ─────────────────────────────────
    function updateLanguageSelectorUI() {
        const el = document.getElementById('current-lang-text');
        if (el) el.textContent = LANG_LABELS[getLang()];
    }

    async function loadCurrent() {
        await loadDict('ko'); // 기본값 및 이전 방식 매칭에 항상 필요
        const lang = getLang();
        if (lang !== 'ko') await loadDict(lang);
    }

    async function setLanguage(lang) {
        if (!SUPPORTED.includes(lang)) return;
        try { localStorage.setItem('ep_lang', lang); } catch (e) { /* 저장소 차단 */ }
        await loadCurrent();
        legacyRetranslateAll();
        apply(document.body);
        updateLanguageSelectorUI();
        document.dispatchEvent(new CustomEvent('i18n:change', { detail: { lang } }));
    }

    // 한국어가 아니면 번역이 끝날 때까지 화면을 숨겨 깜빡임을 줄인다. (실패해도 3초 뒤에는 반드시 표시)
    const hide = getLang() !== 'ko';
    const show = () => { document.documentElement.style.visibility = ''; };
    if (hide) {
        document.documentElement.style.visibility = 'hidden';
        setTimeout(show, 3000);
    }

    const domReady = document.readyState === 'loading'
        ? new Promise((r) => document.addEventListener('DOMContentLoaded', r, { once: true }))
        : Promise.resolve();

    const ready = Promise.all([loadCurrent(), domReady]).then(() => {
        apply(document.body);
        updateLanguageSelectorUI();

        // 나중에 추가되는 요소(카드, 모달, 채팅 등)도 자동 번역
        new MutationObserver((mutations) => {
            mutations.forEach((m) => {
                if (m.type === 'childList') m.addedNodes.forEach((n) => apply(n));
                else if (m.type === 'characterData') legacyScan(m.target);
                else if (m.attributeName.startsWith('data-i18n')) applyElement(m.target);
                else legacyScan(m.target); // JS 가 placeholder/title 을 바꾼 경우
            });
        }).observe(document.body, {
            childList: true, subtree: true, characterData: true,
            attributes: true,
            attributeFilter: ['data-i18n', 'data-i18n-args', 'data-i18n-placeholder', 'data-i18n-title',
                'data-i18n-aria-label', 'placeholder', 'title'],
        });
    }).finally(show);

    window.i18n = { t, apply, ready, setLanguage, getLang, SUPPORTED };
    window.setLanguage = setLanguage;           // navbar 언어 선택 메뉴에서 사용
    window.i18nTranslate = legacyTranslate;     // LEGACY: 기존 JS 호환
})();
