const romajiTable = {
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
 * 촉음(っ)이나 요음(ゃ, ゅ, ょ 등)을 처리하여 가능한 모든 로마자 입력 조합을 생성합니다.
 * @param {string} kanaString - 파싱할 히라가나/가타카나 문자열
 * @param {boolean} mustCombine - 요음/촉음 결합을 강제할지 여부
 * @returns {Array} 파싱된 입력 단위 배열
 */
function parseKanaToTargetUnits(kanaString, mustCombine = true) {
  const rawChars = Array.from(kanaString);
  const targetUnits = [];

  for (let i = 0; i < rawChars.length; i++) {
    let char = rawChars[i];
    let nextChar = rawChars[i + 1];

    if (char === "っ" && nextChar && mustCombine && romajiTable[nextChar]) {
      let nextValidRomajis = romajiTable[nextChar];
      let combinedRomajis = [];
      nextValidRomajis.forEach((r) => {
        combinedRomajis.push(r[0] + r);
        romajiTable["っ"].forEach((s) => {
          combinedRomajis.push(s + r);
        });
      });
      targetUnits.push({
        text: char + nextChar,
        validInputs: [...new Set(combinedRomajis)],
      });
      i++;
      continue;
    }

    if (
      mustCombine &&
      combinationRules[char] &&
      nextChar &&
      combinationRules[char][nextChar]
    ) {
      let combinedRomajis = [...combinationRules[char][nextChar]];
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

    const smallKana = ["ぁ", "ぃ", "ぅ", "ぇ", "ぉ", "ゃ", "ゅ", "ょ", "ゎ"];
    if (mustCombine && nextChar && smallKana.includes(nextChar)) {
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

const KO_CHO = ["r", "R", "s", "e", "E", "f", "a", "q", "Q", "t", "T", "d", "w", "W", "c", "z", "x", "v", "g"];
const KO_JUNG = ["k", "o", "i", "O", "j", "p", "u", "P", "h", "hk", "ho", "hl", "y", "n", "nj", "np", "nl", "b", "m", "ml", "l"];
const KO_JONG = ["", "r", "R", "rt", "s", "sw", "sg", "e", "f", "fr", "fa", "fq", "ft", "fx", "fv", "fg", "a", "q", "qt", "t", "T", "d", "w", "c", "z", "x", "v", "g"];
const KO_JA_MO = { "ㄱ": "r", "ㄲ": "R", "ㄳ": "rt", "ㄴ": "s", "ㄵ": "sw", "ㄶ": "sg", "ㄷ": "e", "ㄸ": "E", "ㄹ": "f", "ㄺ": "fr", "ㄻ": "fa", "ㄼ": "fq", "ㄽ": "ft", "ㄾ": "fx", "ㄿ": "fv", "ㅀ": "fg", "ㅁ": "a", "ㅂ": "q", "ㅃ": "Q", "ㅄ": "qt", "ㅅ": "t", "ㅆ": "T", "ㅇ": "d", "ㅈ": "w", "ㅉ": "W", "ㅊ": "c", "ㅋ": "z", "ㅌ": "x", "ㅍ": "v", "ㅎ": "g", "ㅏ": "k", "ㅐ": "o", "ㅑ": "i", "ㅒ": "O", "ㅓ": "j", "ㅔ": "p", "ㅕ": "u", "ㅖ": "P", "ㅗ": "h", "ㅘ": "hk", "ㅙ": "ho", "ㅚ": "hl", "ㅛ": "y", "ㅜ": "n", "ㅝ": "nj", "ㅞ": "np", "ㅟ": "nl", "ㅠ": "b", "ㅡ": "m", "ㅢ": "ml", "ㅣ": "l" };

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
  const diffWeight = { 1: 0.8, 2: 0.9, 3: 1.0, 4: 1.1, 5: 1.2 }[difficulty] || 1.0;

  const clampedAccuracy = Math.min(1.0, Math.max(0.0, accuracy));
  let clampedTypingRatio = Math.min(1.0, Math.max(0.0, typingRatio));
  const clampedTimeRatio = Math.max(0.0, timeRatio);

  const baseScore = clampedTypingRatio * 100 * Math.pow(clampedAccuracy, 2) * diffWeight;
  const finalScore = baseScore * (1 + clampedTimeRatio * 0.12);

  return Math.round(finalScore);
}

// 브라우저 전역 범위에 노출
window.getCompletedRomajiLength = getCompletedRomajiLength;
window.KO_CHO = KO_CHO;
window.KO_JUNG = KO_JUNG;
window.KO_JONG = KO_JONG;
window.KO_JA_MO = KO_JA_MO;
window.ko2en = ko2en;
window.calculateTypingScore = calculateTypingScore;
