"""JS 의 한국어 문자열을 i18n.t('키') 로 바꾼다. (i18n 3단계 보조 도구)

    python tools/i18n/migrate_js.py js/auth/login.js ...   # 지정한 파일 변환
    python tools/i18n/migrate_js.py --report js/auth/*.js  # 바꾸지 않고 분류만 출력

필요: pip install esprima

ko.json 에 있는 문구와 정확히 같은 문자열 리터럴만 자동으로 바꾼다. 다음은 자동으로 바꾸지 않고 REVIEW 로 표시한다.
- 비교/분기에 쓰이는 값      if (x === '초급'), case '초급':, .includes('초급')
- 객체의 키, 또는 서버로 보내는 데이터일 수 있는 객체 값   { genre: '타이핑' }
템플릿 문자열(`...${x}...`)과 사전에 없는 문구는 사람이 직접 옮긴다 (MANUAL).
console.* 안의 개발자용 메시지는 건드리지 않는다.
"""
import json
import os
import re
import sys

import esprima

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(ROOT)
KOREAN = re.compile(r"[가-힣]")


def load_index():
    ko = json.load(open("locales/ko.json", encoding="utf-8"))
    return {" ".join(v.split()): f"{ns}.{k}" for ns, d in ko.items() for k, v in d.items()}


def decode_js_string(raw):
    # 따옴표 안의 이스케이프(\n, \', \") 를 실제 문자로
    body = raw[1:-1]
    return re.sub(r"\\(.)", lambda m: {"n": "\n", "t": "\t"}.get(m.group(1), m.group(1)), body)


def classify(src, tok, index):
    start, end = tok.range
    before = src[max(0, start - 60):start]
    after = src[end:end + 30]
    if tok.type == "Template":
        return "MANUAL", "template"
    value = decode_js_string(tok.value)
    key = index.get(" ".join(value.split()))
    if re.search(r"console\.\w+\([^)]*$", before):
        return "SKIP", "console"
    if not key:
        return "MANUAL", "not in ko.json"
    if re.search(r"(===|!==|==|!=|\bcase)\s*$", before) or re.match(r"\s*(===|!==|==|!=)", after):
        return "REVIEW", "comparison"
    if re.search(r"\.(includes|startsWith|endsWith|indexOf|split|replace|match|test)\(\s*$", before):
        return "REVIEW", "string method argument"
    if re.match(r"\s*:", after) and re.search(r"[{,]\s*$", before):
        return "REVIEW", "object key"
    if re.search(r"[{,]\s*[\w$]+\s*:\s*$", before) and not re.search(r"(text|message|msg|label|title|placeholder|html)\s*:\s*$", before, re.I):
        return "REVIEW", "object value (server data?)"
    return "AUTO", key


def process(path, index, report_only):
    src = open(path, encoding="utf-8", newline="").read()
    toks = esprima.tokenize(src, {"range": True})
    edits, rows = [], []
    for tok in toks:
        if tok.type not in ("String", "Template") or not KOREAN.search(tok.value):
            continue
        kind, info = classify(src, tok, index)
        line = src.count("\n", 0, tok.range[0]) + 1
        rows.append((kind, line, tok.value[:70].replace("\n", "\\n"), info))
        if kind == "AUTO":
            edits.append((tok.range[0], tok.range[1], f"i18n.t('{info}')"))

    out = src
    for s, e, text in sorted(edits, reverse=True):
        out = out[:s] + text + out[e:]
    # LEGACY 래퍼 정리: window.i18nTranslate(i18n.t('k')), (window.i18nTranslate ? window.i18nTranslate(X) : X)
    out = re.sub(r"window\.i18nTranslate\s*\?\s*window\.i18nTranslate\((i18n\.t\('[\w.]+'\))\)\s*:\s*\1", r"\1", out)
    out = re.sub(r"window\.i18nTranslate\((i18n\.t\('[\w.]+'\))\)", r"\1", out)

    print(f"== {path}")
    for kind, line, text, info in rows:
        if kind != "SKIP":
            print(f"  {kind:6} L{line:<5} {text}  [{info}]")
    if not report_only and out != src:
        with open(path, "w", encoding="utf-8", newline="") as fp:
            fp.write(out)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    index = load_index()
    for path in args:
        process(path, index, "--report" in sys.argv)


if __name__ == "__main__":
    main()
