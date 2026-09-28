"""(1회성, 실행 완료) 예전 locales.json(한국어 문장 → 번역)을 키 기반 언어별 파일로 변환한다.

    python tools/i18n/generate_keys.py

- 한국어 문장이 쓰이는 파일 위치로 네임스페이스를 정한다. 두 기능 이상에서 쓰이면 common.
- 키 이름은 영어 번역을 snake_case 로 줄여 만든다. (예: "현재 입력 위치" → typing.current_position)
- HTML/CSS 조각이 섞인 잘못된 항목은 버린다.
결과: locales/ko.json, locales/en.json, locales/ja.json

예전 locales.json 은 전환 후 삭제했다. 다시 실행하려면 git 기록에서 복원한다:
    git show 90d0d4b:enter-typing/locales.json > locales.json
"""
import glob
import json
import os
import re
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(ROOT)

LANGS = ("ko", "en", "ja")
# HTML/CSS/JS 조각 판별. ("전체보기 >" 처럼 > 만 있는 문구나, 들여쓰기 줄바꿈이 섞인 문구는 정상으로 본다)
BAD = re.compile(r"[<{};]|\bif\s*\(|getAttribute|startsWith")
KOREAN = re.compile(r"[가-힣]")

# 파일 경로 → 기능 네임스페이스
NS_RULES = [
    (r"html/(typing[^/]*|index)\.html$|js/typing/|js/home/|js/shared/(typing_engine|youtube_manager)\.js$", "typing"),
    (r"html/quiz[^/]*\.html$|js/quiz/", "quiz"),
    (r"html/battle[^/]*\.html$|js/battle/", "battle"),
    (r"html/profile\.html$|html/partials/profile_|js/profile/", "profile"),
    (r"html/(login|signup|forgot_password|change_password)\.html$|js/auth/", "auth"),
    (r"html/ranking[^/]*\.html$|js/ranking/", "ranking"),
    (r"html/notice\.html$|js/notice/", "notice"),
    (r"html/search\.html$|js/search/", "search"),
    (r"html/coming_soon\.html$", "common"),
    (r"js/shared/navbar\.js$", "nav"),
]


def namespace_of(path):
    path = path.replace("\\", "/")
    for pattern, ns in NS_RULES:
        if re.search(pattern, path):
            return ns
    return "common"


# 영어 번역이 없어 이름을 만들 수 없는 항목은 직접 지정한다.
NAME_OVERRIDES = {
    "3 명": "n3_people",
    "4 명 (최대)": "n4_people_max",
    "개": "unit_count",
    "2자~12자 입력": "nickname_length_hint",
    "30일 개근": "attendance_30_days",
    '" 검색 결과': "results_suffix",
    "검색 결과 - 엔터핑": "page_title",
}


# 예전 사전에 번역이 비어 있던 항목 보충
TRANSLATION_FILL = {
    "3 명": {"en": "3 players", "ja": "3人"},
    "4 명 (최대)": {"en": "4 players (max)", "ja": "4人（最大）"},
    "개": {"en": "", "ja": "個"},
    "2자~12자 입력": {"en": "2–12 characters", "ja": "2〜12文字で入力"},
    "30일 개근": {"en": "30-day perfect attendance", "ja": "30日皆勤"},
    '" 검색 결과': {"en": '" search results', "ja": '" の検索結果'},
    "검색 결과 - 엔터핑": {"en": "Search Results - Enterping", "ja": "検索結果 - エンターピン"},
}


def key_name(en, fallback_index):
    words = re.findall(r"[a-z0-9]+", (en or "").lower())
    name = "_".join(words[:6])[:40].strip("_")
    if not name or name[0].isdigit():
        name = f"text_{fallback_index}" if not name else f"n{name}"
    return name


def main():
    legacy = json.load(open("locales.json", encoding="utf-8"))
    entries = {k: v for k, v in legacy.items() if not BAD.search(k) and len(k) <= 300 and KOREAN.search(k)}

    sources = {f: open(f, encoding="utf-8").read()
               for f in glob.glob("html/**/*.html", recursive=True) + glob.glob("js/**/*.js", recursive=True)}

    out = {lang: defaultdict(dict) for lang in LANGS}
    used_names = defaultdict(set)
    for i, (ko_text, trans) in enumerate(sorted(entries.items())):
        namespaces = {namespace_of(f) for f, src in sources.items() if ko_text in src}
        # nav(공통 네비게이션)에 쓰이는 문구는 모든 페이지 HTML에도 복제돼 있으므로 nav 로 모은다.
        if "nav" in namespaces:
            ns = "nav"
        elif len(namespaces) == 1:
            ns = namespaces.pop()
        else:
            ns = "common"

        base = NAME_OVERRIDES.get(ko_text) or key_name(trans.get("en"), i)
        name, n = base, 2
        while name in used_names[ns]:
            name, n = f"{base}_{n}", n + 1
        used_names[ns].add(name)

        # HTML 들여쓰기로 생긴 줄바꿈·연속 공백은 한 칸으로 정리한다 (엔진도 같은 방식으로 비교)
        out["ko"][ns][name] = " ".join(ko_text.split())
        for lang in ("en", "ja"):
            # 번역이 비어 있으면 한국어 원문으로 대체하지 않고 비워 둔다 (엔진이 ko 로 폴백)
            filled = TRANSLATION_FILL.get(ko_text, {})
            out[lang][ns][name] = trans.get(lang) or filled.get(lang, "")

    for lang in LANGS:
        data = {ns: dict(sorted(keys.items())) for ns, keys in sorted(out[lang].items())}
        with open(f"locales/{lang}.json", "w", encoding="utf-8") as fp:
            json.dump(data, fp, ensure_ascii=False, indent=2)
            fp.write("\n")
    print({ns: len(keys) for ns, keys in sorted(out["ko"].items())}, "total", len(entries))


if __name__ == "__main__":
    main()
