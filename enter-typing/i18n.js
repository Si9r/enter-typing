let translations = {};

// 메모리 캐시 (원본 텍스트 보관)
const textNodesToTranslate = [];
const placeholdersToTranslate = [];
const titlesToTranslate = [];
let domScanned = false;
let localesLoaded = false;

// 페이지가 로드될 때 한국어가 아닌 다른 언어가 설정되어 있다면,
// 번역이 완료되기 전까지 화면을 임시로 숨겨서 텍스트가 깜빡이는(Flicker) 현상을 방지합니다.
if (localStorage.getItem('ep_lang') && localStorage.getItem('ep_lang') !== 'ko') {
    document.documentElement.style.visibility = 'hidden';
}

// 텍스트 노드 순회 및 스캔
function scanDOM(node) {
    if (node.nodeType === Node.TEXT_NODE) {
        const fullText = node.textContent;
        const trimmedText = fullText.trim();
        const hasDynamicPattern = /(?:\d+|\d+,\d+)(?:\s*)(초|분|점|회|명|개|문제|승|전)/.test(trimmedText) || /코드:\s*[\w\d]+/.test(trimmedText) || /대전방\(#[\w\d]+\)에 입장했습니다!/.test(trimmedText) || /\s\(나\)$/.test(trimmedText) || /남은 퀴즈:\s*\d+/.test(trimmedText) || /문제\s*\d+\s*\/\s*\d+/.test(trimmedText);
        
        if (trimmedText && (translations[trimmedText] || hasDynamicPattern)) {
            const prefix = fullText.substring(0, fullText.indexOf(trimmedText));
            const suffix = fullText.substring(fullText.indexOf(trimmedText) + trimmedText.length);
            
            if (!node._i18n_tracked) {
                textNodesToTranslate.push({
                    node: node,
                    originalKey: trimmedText,
                    prefix: prefix,
                    suffix: suffix
                });
                node._i18n_tracked = true;
            }
        }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
        if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(node.tagName)) return;
        node.childNodes.forEach(scanDOM);
    }
}

// placeholder 및 title 스캔
function scanPlaceholders() {
    const elementsWithPlaceholder = document.querySelectorAll('input[placeholder], textarea[placeholder]');
    elementsWithPlaceholder.forEach(el => {
        const text = el.getAttribute('placeholder').trim();
        if (text && translations[text] && !el._i18n_tracked_ph) {
            placeholdersToTranslate.push({
                element: el,
                originalKey: text
            });
            el._i18n_tracked_ph = true;
        }
    });

    const elementsWithTitle = document.querySelectorAll('[title]');
    elementsWithTitle.forEach(el => {
        const text = el.getAttribute('title').trim();
        if (text && translations[text] && !el._i18n_tracked_title) {
            titlesToTranslate.push({
                element: el,
                originalKey: text
            });
            el._i18n_tracked_title = true;
        }
    });
}

function getCurrentLanguage() {
    return localStorage.getItem('ep_lang') || 'ko';
}

function setLanguage(lang) {
    localStorage.setItem('ep_lang', lang);
    applyTranslations();
    updateLanguageSelectorUI();
}

async function loadLocales() {
    try {
        const res = await fetch(`/locales.json?v=${new Date().getTime()}`);
        if (res.ok) {
            translations = await res.json();
            localesLoaded = true;
        }
    } catch (e) {
        console.error("Failed to load locales:", e);
    }
}

async function applyTranslations() {
    if (!localesLoaded) {
        await loadLocales();
    }
    
    const lang = getCurrentLanguage();
    
    // 처음 적용 시 한 번만 초기화
    if (!domScanned) {
        scanDOM(document.body);
        scanPlaceholders();
        domScanned = true;
        
        // 동적 렌더링 카드(초, 점수 등) 감지를 위한 옵저버
        const observer = new MutationObserver((mutations) => {
            let shouldRescan = false;
            mutations.forEach(m => {
                if (m.addedNodes.length > 0) shouldRescan = true;
            });
            if (shouldRescan) {
                scanDOM(document.body);
                scanPlaceholders();
                // 재귀 호출을 막기 위해 domScanned는 true 상태 유지하며 번역만 실행
                applyTranslationsCore();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }
    
    updateLanguageSelectorUI();
    applyTranslationsCore();
}

function applyTranslationsCore() {
    const lang = getCurrentLanguage();
    
    textNodesToTranslate.forEach(item => {
        let translatedText = item.originalKey; // 기본값 (ko)
        
        // 1. 사전 번역 확인
        if (translations[item.originalKey] && translations[item.originalKey][lang]) {
            translatedText = translations[item.originalKey][lang];
        } 
        // 2. 패턴(숫자+초/점/회 등) 번역
        else if (lang !== 'ko') {
            if (lang === 'en') {
                translatedText = translatedText.replace(/(\d+)\s*초/g, '$1s');
                translatedText = translatedText.replace(/(\d+)\s*분/g, '$1m');
                translatedText = translatedText.replace(/(\d+)\s*점/g, '$1 pts');
                translatedText = translatedText.replace(/(\d+)\s*회/g, '$1 plays');
                translatedText = translatedText.replace(/(\d+)\s*명/g, '$1 players');
                translatedText = translatedText.replace(/(\d+)\s*개/g, '$1 items');
                translatedText = translatedText.replace(/(\d+)\s*문제/g, '$1 Qs');
                translatedText = translatedText.replace(/([\d,]+)\s*점/g, '$1 pts');
                translatedText = translatedText.replace(/([\d,]+)\s*승/g, '$1 wins');
                translatedText = translatedText.replace(/\(총\s*([\d,]+)\s*전\)/g, '(Total $1 plays)');
                translatedText = translatedText.replace(/코드:\s*([\w\d]+)/g, 'Code: $1');
                translatedText = translatedText.replace(/대전방\(#([\w\d]+)\)에 입장했습니다!/g, 'Joined battle room (#$1)!');
                translatedText = translatedText.replace(/(.+)\s\(나\)$/g, '$1 (Me)');
                translatedText = translatedText.replace(/남은 퀴즈:\s*(\d+)/g, 'Remaining: $1');
                translatedText = translatedText.replace(/문제\s*(\d+)\s*\/\s*(\d+)/g, 'Q $1 / $2');
            } else if (lang === 'ja') {
                translatedText = translatedText.replace(/(\d+)\s*초/g, '$1秒');
                translatedText = translatedText.replace(/(\d+)\s*분/g, '$1分');
                translatedText = translatedText.replace(/(\d+)\s*점/g, '$1点');
                translatedText = translatedText.replace(/(\d+)\s*회/g, '$1回');
                translatedText = translatedText.replace(/(\d+)\s*명/g, '$1人');
                translatedText = translatedText.replace(/(\d+)\s*개/g, '$1個');
                translatedText = translatedText.replace(/(\d+)\s*문제/g, '$1問');
                translatedText = translatedText.replace(/([\d,]+)\s*점/g, '$1点');
                translatedText = translatedText.replace(/([\d,]+)\s*승/g, '$1勝');
                translatedText = translatedText.replace(/\(총\s*([\d,]+)\s*전\)/g, '(計$1戦)');
                translatedText = translatedText.replace(/코드:\s*([\w\d]+)/g, 'コード：$1');
                translatedText = translatedText.replace(/대전방\(#([\w\d]+)\)에 입장했습니다!/g, '対戦部屋(#$1)に入場しました！');
                translatedText = translatedText.replace(/(.+)\s\(나\)$/g, '$1 (私)');
                translatedText = translatedText.replace(/남은 퀴즈:\s*(\d+)/g, '残り: $1');
                translatedText = translatedText.replace(/문제\s*(\d+)\s*\/\s*(\d+)/g, '問題 $1 / $2');
            }
        }
        
        item.node.textContent = item.prefix + translatedText + item.suffix;
    });
    
    // Placeholder 번역
    placeholdersToTranslate.forEach(item => {
        let translatedText = item.originalKey; // 기본값 (ko)
        if (lang !== 'ko' && translations[item.originalKey] && translations[item.originalKey][lang]) {
            translatedText = translations[item.originalKey][lang];
        }
        item.element.setAttribute('placeholder', translatedText);
    });

    // Title 번역
    titlesToTranslate.forEach(item => {
        let translatedText = item.originalKey; // 기본값 (ko)
        if (lang !== 'ko' && translations[item.originalKey] && translations[item.originalKey][lang]) {
            translatedText = translations[item.originalKey][lang];
        }
        item.element.setAttribute('title', translatedText);
    });
}

// alert, confirm 패치 (Javascript 문자열 번역용)
const originalAlert = window.alert;
window.alert = function(msg) {
    const lang = getCurrentLanguage();
    if (lang !== 'ko' && localesLoaded && translations[msg] && translations[msg][lang]) {
        originalAlert(translations[msg][lang]);
    } else {
        originalAlert(msg);
    }
};

const originalConfirm = window.confirm;
window.confirm = function(msg) {
    const lang = getCurrentLanguage();
    if (lang !== 'ko' && localesLoaded && translations[msg] && translations[msg][lang]) {
        return originalConfirm(translations[msg][lang]);
    } else {
        return originalConfirm(msg);
    }
};

function updateLanguageSelectorUI() {
    const currentLangText = document.getElementById('current-lang-text');
    if (currentLangText) {
        const langMap = { ko: "한국어", en: "English", ja: "日本語" };
        currentLangText.textContent = langMap[getCurrentLanguage()] || "한국어";
    }
}

// 전역 번역 유틸리티 함수 추가
window.i18nTranslate = function(key) {
    if (typeof key !== 'string') return key;
    const lang = getCurrentLanguage();
    const trimmedKey = key.trim();
    if (lang !== 'ko' && localesLoaded && translations[trimmedKey] && translations[trimmedKey][lang]) {
        return key.replace(trimmedKey, translations[trimmedKey][lang]);
    }
    return key;
};

document.addEventListener('DOMContentLoaded', () => {
    applyTranslations().then(() => {
        updateLanguageSelectorUI();
        // 번역이 완료되면 화면을 다시 표시합니다.
        document.documentElement.style.visibility = '';
    });
});
