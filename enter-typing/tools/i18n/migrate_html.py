"""HTML 의 한국어 문구에 번역 키를 붙인다. (i18n 2단계, 여러 번 실행해도 안전)

    python tools/i18n/migrate_html.py            # 변환
    python tools/i18n/migrate_html.py --dry-run  # 무엇이 바뀌는지만 출력

원본 HTML 을 다시 조립하지 않고, 필요한 위치에 속성/태그만 끼워 넣는다 (들여쓰기, Jinja 문법 보존).

- 문구가 요소의 유일한 내용이면 그 요소에 data-i18n="키" 를 붙인다.
      <button>로그인</button>  →  <button data-i18n="nav.login">로그인</button>
- 아이콘 등 다른 요소와 섞여 있으면 문구만 <span data-i18n> 으로 감싼다.
      <a><i class="ph"></i> 공지</a>  →  <a><i class="ph"></i> <span data-i18n="nav.notice">공지</span></a>
- placeholder / title / alt 속성은 data-i18n-placeholder / data-i18n-title / data-i18n-alt 를 붙인다.
- 예전 형식 data-i18n="한국어" 는 키로 바꾼다.
- <title> 은 <html data-i18n-doc-title="키"> 로 옮긴다.
ko.json 의 문구와 (공백 정리 후) 정확히 같은 문구만 변환한다. 나머지는 이전 방식 호환 기능이 처리한다.
"""
import glob
import json
import os
import re
import sys
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(ROOT)

VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}
SKIP_TEXT_IN = {"script", "style", "textarea", "noscript", "head", "svg"}
# data-i18n 은 요소 내용을 통째로 바꾸므로, 구조를 가진 컨테이너에는 붙이지 않는다
NO_ATTR_TAGS = {"html", "head", "body", "table", "tbody", "thead", "tr", "ul", "ol", "select"}


def normalize(text):
    return " ".join(text.split())


def load_index():
    ko = json.load(open("locales/ko.json", encoding="utf-8"))
    index = {}
    for ns, entries in ko.items():
        for name, text in entries.items():
            index.setdefault(normalize(text), f"{ns}.{name}")
    return index


class Node:
    def __init__(self, tag, start, tag_text, parent):
        self.tag, self.start, self.tag_text, self.parent = tag, start, tag_text, parent
        self.children = []  # Node 또는 ("text", start, raw)
        self.attrs = {}


class Collector(HTMLParser):
    def __init__(self, src):
        super().__init__(convert_charrefs=False)
        self.src = src
        self.line_starts = [0] + [m.end() for m in re.finditer(r"\n", src)]
        self.root = Node("#root", 0, "", None)
        self.cur = self.root
        self.elements = []

    def src_offset(self):
        line, col = self.getpos()
        return self.line_starts[line - 1] + col

    def handle_starttag(self, tag, attrs):
        node = Node(tag, self.src_offset(), self.get_starttag_text(), self.cur)
        node.attrs = {k: (v or "") for k, v in attrs}
        self.cur.children.append(node)
        self.elements.append(node)
        if tag not in VOID:
            self.cur = node

    def handle_startendtag(self, tag, attrs):
        node = Node(tag, self.src_offset(), self.get_starttag_text(), self.cur)
        node.attrs = {k: (v or "") for k, v in attrs}
        self.cur.children.append(node)
        self.elements.append(node)

    def handle_endtag(self, tag):
        n = self.cur
        while n is not self.root and n.tag != tag:
            n = n.parent
        if n is not self.root:
            self.cur = n.parent

    def handle_data(self, data):
        self.cur.children.append(("text", self.src_offset(), data))

    # 엔티티(&amp; 등)는 텍스트를 쪼개므로 해당 문구는 변환하지 않는다 (호환 기능이 처리)
    def handle_entityref(self, name):
        self.cur.children.append(("entity", self.src_offset(), f"&{name};"))

    def handle_charref(self, name):
        self.cur.children.append(("entity", self.src_offset(), f"&#{name};"))


def ancestors(node):
    while node is not None:
        yield node
        node = node.parent


def insert_attr(edits, node, attr_text):
    """시작 태그의 태그 이름 바로 뒤에 속성을 끼워 넣는다."""
    m = re.match(r"<[A-Za-z][\w:-]*", node.tag_text)
    edits.append((node.start + m.end(), 0, " " + attr_text))


def migrate(path, index, dry_run):
    src = open(path, encoding="utf-8", newline="").read()  # 줄바꿈(CRLF/LF) 그대로 보존
    p = Collector(src)
    p.feed(src)
    p.close()
    edits, log = [], []

    for el in p.elements:
        # 예전 형식 data-i18n="한국어" → 키
        legacy = el.attrs.get("data-i18n")
        if legacy and re.search(r"[가-힣]", legacy) and normalize(legacy) in index:
            key = index[normalize(legacy)]
            m = re.search(r'data-i18n=(["\'])(.*?)\1', el.tag_text, re.S)
            edits.append((el.start + m.start(2), len(m.group(2)), key))
            log.append(f"  attr  data-i18n={legacy!r} → {key}")

        for attr in ("placeholder", "title", "alt"):
            value = el.attrs.get(attr)
            if value and f"data-i18n-{attr}" not in el.attrs and normalize(value) in index:
                key = index[normalize(value)]
                insert_attr(edits, el, f'data-i18n-{attr}="{key}"')
                log.append(f"  {attr:5} {value!r} → {key}")

        if el.tag == "title":
            texts = [c for c in el.children if isinstance(c, tuple)]
            html_el = next((e for e in p.elements if e.tag == "html"), None)
            if html_el and len(texts) == 1 and normalize(texts[0][2]) in index and "data-i18n-doc-title" not in html_el.attrs:
                key = index[normalize(texts[0][2])]
                insert_attr(edits, html_el, f'data-i18n-doc-title="{key}"')
                log.append(f"  title {texts[0][2].strip()!r} → {key}")

    for el in p.elements:
        if any(a.tag in SKIP_TEXT_IN for a in ancestors(el)) or any("data-i18n" in a.attrs for a in ancestors(el)):
            continue
        meaningful = [c for c in el.children if not (isinstance(c, tuple) and c[0] == "text" and not c[2].strip())]
        for child in el.children:
            if not (isinstance(child, tuple) and child[0] == "text"):
                continue
            _, start, raw = child
            text = raw.strip()
            if not text or normalize(text) not in index:
                continue
            key = index[normalize(text)]
            if len(meaningful) == 1 and el.tag not in VOID and el.tag not in NO_ATTR_TAGS:
                insert_attr(edits, el, f'data-i18n="{key}"')
                log.append(f"  attr  <{el.tag}> {text[:40]!r} → {key}")
            else:
                lead = len(raw) - len(raw.lstrip())
                edits.append((start + lead, len(text), f'<span data-i18n="{key}">{text}</span>'))
                log.append(f"  span  <{el.tag}> {text[:40]!r} → {key}")

    if not edits:
        return 0
    out = src
    for pos, length, text in sorted(edits, key=lambda e: e[0], reverse=True):
        out = out[:pos] + text + out[pos + length:]
    print(f"{path}: {len(edits)}")
    if dry_run:
        print("\n".join(log))
    else:
        with open(path, "w", encoding="utf-8", newline="") as fp:
            fp.write(out)
    return len(edits)


def main():
    dry_run = "--dry-run" in sys.argv
    index = load_index()
    total = sum(migrate(f, index, dry_run) for f in sorted(glob.glob("html/**/*.html", recursive=True)))
    print("total edits:", total)


if __name__ == "__main__":
    main()
