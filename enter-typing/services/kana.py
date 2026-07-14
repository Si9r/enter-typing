ROMAJI_TABLE = {
    "あ": "a", "い": "i", "う": "u", "え": "e", "お": "o",
    "か": "ka", "き": "ki", "く": "ku", "け": "ke", "こ": "ko",
    "さ": "sa", "し": "shi", "す": "su", "せ": "se", "そ": "so",
    "た": "ta", "ち": "chi", "つ": "tsu", "て": "te", "と": "to",
    "な": "na", "に": "ni", "ぬ": "nu", "ね": "ne", "の": "no",
    "は": "ha", "ひ": "hi", "ふ": "fu", "へ": "he", "ほ": "ho",
    "ま": "ma", "み": "mi", "む": "mu", "め": "me", "も": "mo",
    "や": "ya", "ゆ": "yu", "よ": "yo",
    "ら": "ra", "り": "ri", "る": "ru", "れ": "re", "ろ": "ro",
    "わ": "wa", "を": "wo", "ん": "nn",
    "が": "ga", "ぎ": "gi", "ぐ": "gu", "げ": "ge", "ご": "go",
    "ざ": "za", "じ": "zi", "ず": "zu", "ぜ": "ze", "ぞ": "zo",
    "だ": "da", "ぢ": "di", "づ": "du", "で": "de", "ど": "do",
    "ば": "ba", "び": "bi", "ぶ": "bu", "べ": "be", "ぼ": "bo",
    "ぱ": "pa", "ぴ": "pi", "ぷ": "pu", "ぺ": "pe", "ぽ": "po",
    "ぁ": "xa", "ぃ": "xi", "ぅ": "xu", "ぇ": "xe", "ぉ": "xo",
    "っ": "xtsu",
    "ゃ": "xya", "ゅ": "xyu", "ょ": "xyo", "ゎ": "xwa",
    " ": " ", "、": ",", "。": ".", "?": "?", "!": "!",
    "？": "?", "！": "!", "〜": "~", "~": "~"
}

COMBINATION_RULES = {
    "きゃ": "kya", "きゅ": "kyu", "きょ": "kyo",
    "しゃ": "sha", "しゅ": "shu", "しぇ": "she", "しょ": "sho",
    "ちゃ": "cha", "ちゅ": "chu", "ちぇ": "che", "ちょ": "cho",
    "にゃ": "nya", "にゅ": "nyu", "にょ": "nyo",
    "ひゃ": "hya", "ひゅ": "hyu", "ひょ": "hyo",
    "みゃ": "mya", "みゅ": "myu", "みょ": "myo",
    "りゃ": "rya", "りゅ": "ryu", "りょ": "ryo",
    "ぎゃ": "gya", "ぎゅ": "gyu", "ぎょ": "gyo",
    "じゃ": "ja", "じゅ": "ju", "じぇ": "je", "じょ": "jo",
    "ぢゃ": "dya", "ぢゅ": "dyu", "ぢょ": "dyo",
    "びゃ": "bya", "びゅ": "byu", "びょ": "byo",
    "ぴゃ": "pya", "ぴゅ": "pyu", "ぴょ": "pyo"
}


def hiragana_to_romaji(hira_str: str) -> str:
    romaji = ""
    i = 0
    while i < len(hira_str):
        char = hira_str[i]
        next_char = hira_str[i + 1] if i + 1 < len(hira_str) else None

        if char == "っ" and next_char and next_char in ROMAJI_TABLE:
            next_romaji = ROMAJI_TABLE[next_char]
            romaji += next_romaji[0]
            i += 1
            continue

        if next_char and (char + next_char) in COMBINATION_RULES:
            romaji += COMBINATION_RULES[char + next_char]
            i += 2
            continue

        if char in ROMAJI_TABLE:
            romaji += ROMAJI_TABLE[char]
        else:
            romaji += char
        i += 1

    return romaji


# ── 가나 파서 (요음/촉음 결합 단위로 쪼갬) ───────────────────
def parse_kana_to_units(kana_str: str) -> list[str]:
    units = []
    chars = list(kana_str)
    i = 0
    small_kana = {"ぁ", "ぃ", "ぅ", "ぇ", "ぉ", "ゃ", "ゅ", "ょ", "ゎ"}
    combination_rules = {
        "き": {"ゃ", "ゅ", "ょ"},
        "し": {"ゃ", "ゅ", "ょ"},
        "せ": {"ぃ"},
        "ち": {"ゃ", "ゅ", "ょ"},
        "に": {"ゃ", "ゅ", "ょ"},
        "ひ": {"ゃ", "ゅ", "ょ"},
        "み": {"ゃ", "ゅ", "ょ"},
        "り": {"ゃ", "ゅ", "ょ"},
        "ぎ": {"ゃ", "ゅ", "ょ"},
        "じ": {"ゃ", "ゅ", "ょ"},
        "ぢ": {"ゃ", "ゅ", "ょ"},
        "び": {"ゃ", "ゅ", "ょ"},
        "ぴ": {"ゃ", "ゅ", "ょ"},
    }

    while i < len(chars):
        char = chars[i]
        next_char = chars[i + 1] if i + 1 < len(chars) else None

        if char in ["\n", "\r", " "]:
            i += 1
            continue

        # 1. 촉음(っ) 결합
        if char == "っ" and next_char and next_char not in ["\n", "\r", " "]:
            units.append(char + next_char)
            i += 2
            continue

        # 2. 요음 combination rules
        if char in combination_rules and next_char in combination_rules[char]:
            units.append(char + next_char)
            i += 2
            continue

        # 3. 기타 작은 가나 결합
        if next_char in small_kana:
            units.append(char + next_char)
            i += 2
            continue

        # 4. 단일 문자
        units.append(char)
        i += 1

    return units
