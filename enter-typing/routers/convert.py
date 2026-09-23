import re
import threading

from fastapi import APIRouter
from pydantic import BaseModel
from sudachipy import dictionary, tokenizer

from services.kana import hiragana_to_romaji

router = APIRouter(prefix="/api", tags=["convert"])

# SudachiPy 형태소 분석으로 문맥에 맞는 읽기를 고른다. (예: 君は → きみ, 田中君 → くん)
# Tokenizer 는 스레드 안전하지 않으므로 잠금을 걸고 사용한다.
_tokenizer = dictionary.Dictionary(dict="core").create()
_tokenizer_lock = threading.Lock()
_SPLIT_MODE = tokenizer.Tokenizer.SplitMode.C

_KANJI_RE = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff々〆ヵヶ]")

# 사전 기본 읽기가 가사에서 어색한 단어 보정 (표층형 → 히라가나)
_READING_OVERRIDES = {
    "私": "わたし",
    "明日": "あした",
    "貴女": "あなた",
    "言う": "いう",
}
# 何 뒤에 이 글자가 오면 なに 로 읽는다 (何も, 何か, 何を …). 그 외(何で, 何度)는 사전 읽기를 따른다.
_NANI_FOLLOWERS = ("も", "か", "を", "が", "に", "の", "色", "処", "故")


def _to_hiragana(s: str) -> str:
    # 가타카나(ァ~ヶ) → 히라가나. 장음 기호(ー) 등은 그대로 둔다.
    return "".join(chr(ord(c) - 0x60) if "ァ" <= c <= "ヶ" else c for c in s)


def kanji_to_hiragana(text: str) -> str:
    with _tokenizer_lock:
        morphemes = [(m.surface(), m.reading_form()) for m in _tokenizer.tokenize(text, _SPLIT_MODE)]

    result = []
    for i, (surface, reading) in enumerate(morphemes):
        if surface in _READING_OVERRIDES:
            result.append(_READING_OVERRIDES[surface])
        elif surface == "何" and i + 1 < len(morphemes) and morphemes[i + 1][0].startswith(_NANI_FOLLOWERS):
            result.append("なに")
        elif _KANJI_RE.search(surface) and reading:
            result.append(_to_hiragana(reading))
        else:
            # 한자가 없는 토큰(가나, 숫자, 영문, 기호)은 원문을 유지한다. (숫자/영문의 사전 읽기는 타이핑에 부적합)
            result.append(_to_hiragana(surface))
    return "".join(result)


class ConvertRequest(BaseModel):
    text: str


# ════════════════════════════════════════════════════════════
# API: 가사 자동 변환 (한자 → 히라가나 → 로마자)
# POST /api/convert
# ════════════════════════════════════════════════════════════
@router.post("/convert")
def convert_lyrics(req: ConvertRequest):
    text = req.text
    if not text:
        return {"success": True, "hiragana": "", "romaji": ""}

    hiragana = kanji_to_hiragana(text).replace(" ", "")

    # romaji는 히라가나 → 로마자 변환 함수로 일관성 있게 처리
    romaji = hiragana_to_romaji(hiragana)

    return {"success": True, "hiragana": hiragana, "romaji": romaji}
