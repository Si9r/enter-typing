const romajiTable = {
  "ー": ["-"],
  あ: ["a"],
  い: ["i", "yi"],
  う: ["u", "wu"],
  え: ["e", "ye"],
  お: ["o"],
  か: ["ka"],
  き: ["ki"],
  く: ["ku"],
  け: ["ke"],
  こ: ["ko"],
  さ: ["sa"],
  し: ["shi", "si"],
  す: ["su"],
  せ: ["se"],
  そ: ["so"],
  た: ["ta"],
  ち: ["chi", "ti"],
  つ: ["tsu", "tu"],
  て: ["te"],
  と: ["to"],
  だ: ["da"],
  ぢ: ["di"],
  づ: ["du"],
  で: ["de"],
  ど: ["do"],
  ば: ["ba"],
  び: ["bi"],
  ぶ: ["bu"],
  べ: ["be"],
  ぼ: ["bo"],
  ぱ: ["pa"],
  ぴ: ["pi"],
  ぷ: ["pu"],
  ぺ: ["pe"],
  ぽ: ["po"],
  な: ["na"],
  に: ["ni"],
  ぬ: ["nu"],
  ね: ["ne"],
  の: ["no"],
  は: ["ha"],
  ひ: ["hi"],
  ふ: ["fu", "hu"],
  へ: ["he"],
  ほ: ["ho"],
  ま: ["ma"],
  み: ["mi"],
  む: ["mu"],
  め: ["me"],
  も: ["mo"],
  や: ["ya"],
  ゆ: ["yu"],
  よ: ["yo"],
  ら: ["ra"],
  り: ["ri"],
  る: ["ru"],
  れ: ["re"],
  ろ: ["ro"],
  わ: ["wa"],
  を: ["wo"],
  ん: ["nn", "n", "n'"],
  が: ["ga"],
  ぎ: ["gi"],
  ぐ: ["gu"],
  げ: ["ge"],
  ご: ["go"],
  ざ: ["za"],
  じ: ["zi", "ji"],
  ず: ["zu"],
  ぜ: ["ze"],
  ぞ: ["zo"],
  ぁ: ["xa", "la"],
  ぃ: ["xi", "li"],
  ぅ: ["xu", "lu"],
  ぇ: ["xe", "le"],
  ぉ: ["xo", "lo"],
  っ: ["xtsu", "ltsu", "xtu", "ltu"],
  ゃ: ["xya", "lya"],
  ゅ: ["xyu", "lyu"],
  ょ: ["xyo", "lyo"],
  ゎ: ["xwa", "lwa"],
  " ": [" "],
  "、": [","],
  "。": ["."],
  "?": ["?"],
  "!": ["!"],
};

const combinationRules = {
  き: { ゃ: ["kya"], ゅ: ["kyu"], ょ: ["kyo"] },
  し: { ゃ: ["sha", "sya"], ゅ: ["shu", "syu"], ょ: ["sho", "syo"] },
  せ: { ぃ: ["sexi", "seli"] },
  ち: { ゃ: ["cha", "tya"], ゅ: ["chu", "tyu"], ょ: ["cho", "tyo"] },
  に: { ゃ: ["nya"], ゅ: ["nyu"], ょ: ["nyo"] },
  ひ: { ゃ: ["hya"], ゅ: ["hyu"], ょ: ["hyo"] },
  み: { ゃ: ["mya"], ゅ: ["myu"], ょ: ["myo"] },
  り: { ゃ: ["rya"], ゅ: ["ryu"], ょ: ["ryo"] },
  ぎ: { ゃ: ["gya"], ゅ: ["gyu"], ょ: ["gyo"] },
  じ: { ゃ: ["ja", "zya"], ゅ: ["ju", "zyu"], ょ: ["jo", "zyo"] },
  ぢ: { ゃ: ["dya"], ゅ: ["dyu"], ょ: ["dyo"] },
  び: { ゃ: ["bya"], ゅ: ["byu"], ょ: ["byo"] },
  ぴ: { ゃ: ["pya"], ゅ: ["pyu"], ょ: ["pyo"] },
};

/**
 * 주어진 가나(Kana) 문자열을 타이핑 가능한 로마자 입력 단위(TargetUnit) 배열로 파싱하는 함수입니다.
 * 촉음(っ)이나 요음(ゃ, ゅ, ょ 등)을 처리하여 가능한 모든 로마자 입력 조합(기본 방식과 분리 입력 방식 모두)을 생성합니다.
 * @param {string} kanaString - 파싱할 히라가나/가타카나 문자열
 * @returns {Array} 파싱된 입력 단위 배열
 */
function parseKanaToTargetUnits(kanaString) {
  const rawChars = Array.from(kanaString);
  const targetUnits = [];

  for (let i = 0; i < rawChars.length; i++) {
    let char = rawChars[i];
    let nextChar = rawChars[i + 1];

    if (char === "っ" && nextChar && romajiTable[nextChar]) {
      let nextValidRomajis = romajiTable[nextChar];
      let combinedRomajis = [];
      nextValidRomajis.forEach((r) => {
        combinedRomajis.push(r[0] + r); // 기본 방식: 자음 중복 (katta)
        romajiTable["っ"].forEach((s) => {
          combinedRomajis.push(s + r); // 분리 입력: ltsu/xtu 등
        });
      });
      targetUnits.push({
        text: char + nextChar,
        validInputs: [...new Set(combinedRomajis)],
      });
      i++;
      continue;
    }

    if (combinationRules[char] && nextChar && combinationRules[char][nextChar]) {
      let combinedRomajis = [...combinationRules[char][nextChar]]; // 기본 방식 (sho)
      romajiTable[char].forEach((c) => {
        romajiTable[nextChar].forEach((n) => {
          combinedRomajis.push(c + n); // 분리 입력 (shilyo 등)
        });
      });
      targetUnits.push({
        text: char + nextChar,
        validInputs: [...new Set(combinedRomajis)],
      });
      i++;
      continue;
    }

    const smallKana = ["ぁ", "ぃ", "ぅ", "ぇ", "ぉ", "ゃ", "ゅ", "ょ", "ゎ"];
    if (nextChar && smallKana.includes(nextChar)) {
      if (romajiTable[char] && romajiTable[nextChar]) {
        let combinedRomajis = [];
        romajiTable[char].forEach((c) => {
          romajiTable[nextChar].forEach((n) => {
            combinedRomajis.push(c + n);
          });
        });
        targetUnits.push({
          text: char + nextChar,
          validInputs: [...new Set(combinedRomajis)],
        });
        i++;
        continue;
      }
    }

    targetUnits.push({ text: char, validInputs: romajiTable[char] || [char] });
  }
  return targetUnits;
}

/**
 * 현재까지 입력 완료된 로마자의 전체 길이를 계산하여 반환하는 함수입니다.
 * @param {Array} units - 입력 단위 배열
 * @param {number} currentIdx - 현재 입력 중인 단위의 인덱스
 * @returns {number} 완료된 로마자의 문자열 길이 합
 */
function getCompletedRomajiLength(units, currentIdx) {
  if (!units) return 0;
  return units.slice(0, currentIdx).reduce((sum, unit) => {
    return sum + (unit.validInputs[0]?.length || 0);
  }, 0);
}

const KO_CHO = ["r","R","s","e","E","f","a","q","Q","t","T","d","w","W","c","z","x","v","g"];
const KO_JUNG = ["k","o","i","O","j","p","u","P","h","hk","ho","hl","y","n","nj","np","nl","b","m","ml","l"];
const KO_JONG = ["","r","R","rt","s","sw","sg","e","f","fr","fa","fq","ft","fx","fv","fg","a","q","qt","t","T","d","w","c","z","x","v","g"];
const KO_JA_MO = {"ㄱ":"r","ㄲ":"R","ㄳ":"rt","ㄴ":"s","ㄵ":"sw","ㄶ":"sg","ㄷ":"e","ㄸ":"E","ㄹ":"f","ㄺ":"fr","ㄻ":"fa","ㄼ":"fq","ㄽ":"ft","ㄾ":"fx","ㄿ":"fv","ㅀ":"fg","ㅁ":"a","ㅂ":"q","ㅃ":"Q","ㅄ":"qt","ㅅ":"t","ㅆ":"T","ㅇ":"d","ㅈ":"w","ㅉ":"W","ㅊ":"c","ㅋ":"z","ㅌ":"x","ㅍ":"v","ㅎ":"g","ㅏ":"k","ㅐ":"o","ㅑ":"i","ㅒ":"O","ㅓ":"j","ㅔ":"p","ㅕ":"u","ㅖ":"P","ㅗ":"h","ㅘ":"hk","ㅙ":"ho","ㅚ":"hl","ㅛ":"y","ㅜ":"n","ㅝ":"nj","ㅞ":"np","ㅟ":"nl","ㅠ":"b","ㅡ":"m","ㅢ":"ml","ㅣ":"l"};

/**
 * 한글 문자열을 영타로 변환하는 함수입니다.
 * @param {string} str - 변환할 한글 문자열
 * @returns {string} 변환된 영문 레이아웃 문자열
 */
function ko2en(str) {
  let res = "";
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    if (code >= 0xac00 && code <= 0xd7a3) {
      code -= 0xac00;
      let jong = code % 28;
      let jung = ((code - jong) / 28) % 21;
      let cho = parseInt(((code - jong) / 28) / 21);
      res += KO_CHO[cho] + KO_JUNG[jung] + KO_JONG[jong];
    } else if (code >= 0x3131 && code <= 0x3163) {
      res += KO_JA_MO[str.charAt(i)] || str.charAt(i);
    } else {
      res += str.charAt(i);
    }
  }
  return res;
}

/**
 * 타이핑 게임 점수를 계산하는 공통 함수입니다.
 * @param {number} accuracy - 정확도 (0.0 ~ 1.0)
 * @param {number} typingRatio - 타이핑 완성 비율 (0.0 ~ 1.0)
 * @param {number} timeRatio - 남은 시간 비율 (0.0 ~ 1.0)
 * @param {number} difficulty - 곡/컨텐츠 난이도 (1 ~ 5)
 * @returns {number} 정수로 반올림된 최종 점수
 */
function calculateTypingScore(accuracy, typingRatio, timeRatio, difficulty) {
  const diffWeight = {1: 0.8, 2: 0.9, 3: 1.0, 4: 1.1, 5: 1.2}[difficulty] || 1.0;
  
  const clampedAccuracy = Math.min(1.0, Math.max(0.0, accuracy));
  let clampedTypingRatio = Math.min(1.0, Math.max(0.0, typingRatio));
  const clampedTimeRatio = Math.max(0.0, timeRatio);

  const baseScore = clampedTypingRatio * 100 * Math.pow(clampedAccuracy, 2) * diffWeight;
  const finalScore = baseScore * (1 + clampedTimeRatio * 0.12);

  return Math.round(finalScore);
}

/**
 * 사용자가 입력한 새로운 글자가 현재 입력해야 할 가나 유닛에 유효한지 검사하는 함수입니다.
 * @param {Object} currentUnit - 검사할 대상 유닛 (validInputs 배열 포함)
 * @param {string} testBuffer - 현재까지 입력된 버퍼와 새로 입력된 글자의 조합
 * @returns {Object} { isCompleteMatch: boolean, isPossiblePrefix: boolean }
 */
function checkRomajiMatch(currentUnit, testBuffer) {
  let isPossiblePrefix = false;
  let isCompleteMatch = false;

  if (currentUnit && currentUnit.validInputs) {
    for (let validInput of currentUnit.validInputs) {
      if (validInput === testBuffer) {
        isCompleteMatch = true;
        break;
      }
      if (validInput.startsWith(testBuffer)) {
        isPossiblePrefix = true;
      }
    }
  }

  return { isCompleteMatch, isPossiblePrefix };
}

/**
 * 타이핑 대상이 되는 일본어 가사 유닛(TargetUnits)들을 HTML DOM 요소로 생성하여 컨테이너에 삽입하는 함수입니다.
 * @param {HTMLElement} container - 가사가 렌더링될 부모 컨테이너 요소
 * @param {Array} units - parseKanaToTargetUnits 로 파싱된 유닛 배열
 */
function renderActiveLyrics(container, units) {
  if (!container || !units) return;
  container.innerHTML = "";
  units.forEach((unit, idx) => {
    const span = document.createElement("span");
    span.className = "lyric-unit " + (idx === 0 ? "current" : "pending");

    const hira = document.createElement("span");
    hira.className = "hira-text";
    hira.textContent = unit.text;

    const roma = document.createElement("span");
    roma.className = "roma-text";
    const initialRoma = unit.validInputs[0] || "";
    for (let i = 0; i < initialRoma.length; i++) {
      const charSpan = document.createElement("span");
      charSpan.textContent = initialRoma[i];
      roma.appendChild(charSpan);
    }

    span.appendChild(hira);
    span.appendChild(roma);
    container.appendChild(span);
  });
}

/**
 * 현재 입력 위치 및 입력 중인 버퍼 상태에 맞춰 가사 렌더링 요소들의 하이라이트 클래스를 업데이트하는 함수입니다.
 * @param {HTMLElement} container - 가사가 렌더링되어 있는 부모 컨테이너 요소
 * @param {Array} units - 파싱된 유닛 배열
 * @param {number} currentUnitIndex - 현재 입력 중인 유닛의 인덱스
 * @param {string} currentBuffer - 현재 입력 중인 로마자 버퍼
 */
function highlightCurrentChar(container, units, currentUnitIndex, currentBuffer) {
  if (!container || !units) return;
  const spans = container.querySelectorAll(".lyric-unit");
  spans.forEach((span, idx) => {
    span.classList.remove("current", "typed", "pending");

    const romaContainer = span.querySelector(".roma-text");

    if (idx < currentUnitIndex) {
      span.classList.add("typed");
      if (romaContainer) {
        const chars = romaContainer.querySelectorAll("span");
        chars.forEach((c) => {
          c.classList.remove("current", "pending");
          c.classList.add("typed");
        });
      }
    } else if (idx === currentUnitIndex) {
      span.classList.add("current");

      const unit = units[idx];
      if (!unit) return;
      let bestMatch = unit.validInputs[0];
      if (currentBuffer.length > 0) {
        for (let v of unit.validInputs) {
          if (v.startsWith(currentBuffer)) {
            bestMatch = v;
            break;
          }
        }
      }

      if (romaContainer && romaContainer.textContent !== bestMatch) {
        romaContainer.innerHTML = "";
        for (let i = 0; i < bestMatch.length; i++) {
          const charSpan = document.createElement("span");
          charSpan.textContent = bestMatch[i];
          romaContainer.appendChild(charSpan);
        }
      }

      if (romaContainer) {
        const chars = romaContainer.querySelectorAll("span");
        chars.forEach((c, i) => {
          c.classList.remove("current", "typed", "pending");
          if (i < currentBuffer.length) {
            c.classList.add("typed");
          } else if (i === currentBuffer.length) {
            c.classList.add("current");
          } else {
            c.classList.add("pending");
          }
        });
      }
    } else {
      span.classList.add("pending");
      if (romaContainer) {
        const chars = romaContainer.querySelectorAll("span");
        chars.forEach((c) => {
          c.classList.remove("current", "typed");
          c.classList.add("pending");
        });
      }
    }
  });
}

/**
 * 현재 입력해야 할 가사와 현재까지 입력된 로마자 버퍼 상태를 한글 텍스트(Status Panel)로 업데이트하는 함수입니다.
 * @param {HTMLElement} statusPanel - 상태 정보를 표시할 엘리먼트
 * @param {Array} units - 파싱된 유닛 배열
 * @param {number} currentUnitIndex - 현재 입력 중인 유닛의 인덱스
 * @param {string} currentBuffer - 현재 입력 중인 로마자 버퍼
 * @param {string} completeMessage - 입력 완료 시 표시할 메시지
 * @returns {string} 상태 패널에 설정될 HTML/Text 문자열
 */
function getStatusHTML(statusPanel, units, currentUnitIndex, currentBuffer, completeMessage = "입력 완료!") {
  if (!statusPanel) return "";
  if (!units || currentUnitIndex >= units.length) {
    statusPanel.innerHTML = completeMessage;
    return completeMessage;
  }

  const currentUnit = units[currentUnitIndex];
  if (!currentUnit) {
    const defaultMsg = "입력할 항목을 준비 중입니다.";
    statusPanel.innerText = defaultMsg;
    return defaultMsg;
  }

  let htmlStr = "";
  if (currentBuffer === "") {
    htmlStr = `현재 입력 위치: <span class="typing-now">${currentUnit.text}</span>`;
  } else {
    htmlStr = `현재 입력 위치: <span class="typing-now">${currentUnit.text}</span> 입력 중... (입력된 조합: <span class="typing-now">${currentBuffer}</span>)`;
  }
  statusPanel.innerHTML = htmlStr;
  return htmlStr;
}

// 키(키보드 자판) 단위 오타 수집기 팩토리
// 한 가나 유닛을 입력하는 동안 발생한 오타 키들을, 그 유닛이 확정된
// 로마자 패턴(예: "shi")의 각 구성 키에 각각 매핑해 통계로 누적한다.
function createKeyTypoCollector() {
  let pendingTypos = []; // 현재 유닛을 치는 동안 발생한 오타 키들
  let totals = {};       // { key: 등장 횟수 }
  let typoMap = {};      // { expected_key: { typo_key: 오타 횟수 } }

  return {
    // 잘못 누른 키 한 글자를 현재 유닛의 pending 목록에 추가
    recordTypo(wrongChar) {
      if (!wrongChar) return;
      const ch = String(wrongChar).charAt(0).toLowerCase();
      if (!ch) return;
      pendingTypos.push(ch);
    },
    // 유닛 입력 완료: 확정 로마자 패턴의 각 키에 대해 totals/오타를 누적
    commitUnit(confirmedRomaji) {
      if (confirmedRomaji) {
        const romaji = String(confirmedRomaji).toLowerCase();
        for (let i = 0; i < romaji.length; i++) {
          const k = romaji.charAt(i);
          totals[k] = (totals[k] || 0) + 1;
          if (pendingTypos.length > 0) {
            if (!typoMap[k]) typoMap[k] = {};
            for (const t of pendingTypos) {
              typoMap[k][t] = (typoMap[k][t] || 0) + 1;
            }
          }
        }
      }
      pendingTypos = [];
    },
    // 입력하지 못하고 지나간 유닛: totals만 누적 (pending은 건드리지 않음)
    addTotalsOnly(romaji) {
      if (!romaji) return;
      const r = String(romaji).toLowerCase();
      for (let i = 0; i < r.length; i++) {
        const k = r.charAt(i);
        totals[k] = (totals[k] || 0) + 1;
      }
    },
    // pending 오타만 폐기
    discardPending() {
      pendingTypos = [];
    },
    // 서버 계약 형식으로 평탄화하여 반환
    getPayload() {
      const key_typos = [];
      for (const expected_key in typoMap) {
        for (const typo_key in typoMap[expected_key]) {
          key_typos.push({
            expected_key,
            typo_key,
            error_count: typoMap[expected_key][typo_key]
          });
        }
      }
      const key_totals = [];
      for (const key in totals) {
        key_totals.push({ key, total_count: totals[key] });
      }
      return { key_typos, key_totals };
    },
    // 전체 초기화
    reset() {
      pendingTypos = [];
      totals = {};
      typoMap = {};
    }
  };
}

// 브라우저 전역 범위에 노출
if (typeof window !== "undefined") {
  window.TypingEngine = {
    romajiTable,
    combinationRules,
    parseKanaToTargetUnits,
    getCompletedRomajiLength,
    KO_CHO,
    KO_JUNG,
    KO_JONG,
    KO_JA_MO,
    ko2en,
    calculateTypingScore,
    checkRomajiMatch,
    renderActiveLyrics,
    highlightCurrentChar,
    getStatusHTML,
    createKeyTypoCollector
  };

  // 기존 전역 변수 하위 호환성 유지
  window.parseKanaToTargetUnits = parseKanaToTargetUnits;
  window.getCompletedRomajiLength = getCompletedRomajiLength;
  window.KO_CHO = KO_CHO;
  window.KO_JUNG = KO_JUNG;
  window.KO_JONG = KO_JONG;
  window.KO_JA_MO = KO_JA_MO;
  window.ko2en = ko2en;
  window.calculateTypingScore = calculateTypingScore;
}

// Node.js 모듈 노출
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    romajiTable,
    combinationRules,
    parseKanaToTargetUnits,
    getCompletedRomajiLength,
    KO_CHO,
    KO_JUNG,
    KO_JONG,
    KO_JA_MO,
    ko2en,
    calculateTypingScore,
    checkRomajiMatch,
    createKeyTypoCollector,
  };
}
