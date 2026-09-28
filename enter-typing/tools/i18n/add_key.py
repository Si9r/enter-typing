"""번역 키를 ko/en/ja.json 에 한 번에 추가한다.

    python tools/i18n/add_key.py auth.sending "발송 중..." "Sending..." "送信中..."

이미 있는 키는 덮어쓰지 않고 알려 준다 (--force 로 덮어쓰기).
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LANGS = ("ko", "en", "ja")


def add_key(key, texts, force=False):
    ns, name = key.split(".", 1)
    data = {}
    for lang in LANGS:
        with open(os.path.join(ROOT, "locales", f"{lang}.json"), encoding="utf-8") as fp:
            data[lang] = json.load(fp)
    if not force and name in data["ko"].get(ns, {}):
        print(f"이미 있는 키입니다: {key} = {data['ko'][ns][name]!r}")
        return False
    for lang, text in zip(LANGS, texts):
        section = data[lang].setdefault(ns, {})
        section[name] = text
        data[lang][ns] = dict(sorted(section.items()))
        data[lang] = dict(sorted(data[lang].items()))
        with open(os.path.join(ROOT, "locales", f"{lang}.json"), "w", encoding="utf-8") as fp:
            json.dump(data[lang], fp, ensure_ascii=False, indent=2)
            fp.write("\n")
    print(f"추가: {key}")
    return True


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if a != "--force"]
    if len(args) != 4:
        print(__doc__)
        sys.exit(1)
    add_key(args[0], args[1:], force="--force" in sys.argv)
