"""번역 키 이름을 바꾸고, locales 와 HTML/JS 의 사용처를 함께 고친다.

    python tools/i18n/rename_key.py nav.fury common.weekday_tue
    python tools/i18n/rename_key.py nav.hour common.time --en "Time" --ja "時間"   # 번역도 함께 수정

새 키가 이미 있으면 사용처만 새 키로 옮기고 옛 키를 지운다 (중복 키 합치기).
"""
import argparse
import glob
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LANGS = ("ko", "en", "ja")


def load(lang):
    with open(os.path.join(ROOT, "locales", f"{lang}.json"), encoding="utf-8") as fp:
        return json.load(fp)


def save(lang, data):
    data = {ns: dict(sorted(v.items())) for ns, v in sorted(data.items()) if v}
    with open(os.path.join(ROOT, "locales", f"{lang}.json"), "w", encoding="utf-8") as fp:
        json.dump(data, fp, ensure_ascii=False, indent=2)
        fp.write("\n")


def rename(old, new, texts=None):
    texts = texts or {}
    ons, oname = old.split(".", 1)
    nns, nname = new.split(".", 1)
    for lang in LANGS:
        data = load(lang)
        if oname in data.get(ons, {}):
            value = data[ons].pop(oname)
            data.setdefault(nns, {}).setdefault(nname, value)
        elif old != new and nname not in data.get(nns, {}):
            raise SystemExit(f"{lang}.json 에 {old} 가 없습니다")
        if texts.get(lang) is not None:
            data.setdefault(nns, {})[nname] = texts[lang]
        save(lang, data)

    if old == new:
        return 0
    pattern = re.compile(r"(['\"])" + re.escape(old) + r"\1")
    changed = 0
    for path in glob.glob(os.path.join(ROOT, "html", "**", "*.html"), recursive=True) + \
            glob.glob(os.path.join(ROOT, "js", "**", "*.js"), recursive=True):
        with open(path, encoding="utf-8", newline="") as fp:
            src = fp.read()
        out, n = pattern.subn(lambda m: m.group(1) + new + m.group(1), src)
        if n:
            with open(path, "w", encoding="utf-8", newline="") as fp:
                fp.write(out)
            changed += n
    return changed


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("old")
    ap.add_argument("new")
    for lang in LANGS:
        ap.add_argument(f"--{lang}")
    a = ap.parse_args()
    n = rename(a.old, a.new, {lang: getattr(a, lang) for lang in LANGS})
    print(f"{a.old} → {a.new}: 사용처 {n}곳")


if __name__ == "__main__":
    main()
