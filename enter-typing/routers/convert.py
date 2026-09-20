import pykakasi
from fastapi import APIRouter
from pydantic import BaseModel

from services.kana import hiragana_to_romaji

router = APIRouter(prefix="/api", tags=["convert"])

kks = pykakasi.kakasi()


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

    converted = kks.convert(text)

    # pykakasi로 한자 → 히라가나 변환만 수행
    hiragana = ""
    for item in converted:
        hiragana += item['hira']

    hiragana = hiragana.replace(" ", "")

    # romaji는 히라가나 → 로마자 변환 함수로 일관성 있게 처리
    romaji = hiragana_to_romaji(hiragana)

    return {"success": True, "hiragana": hiragana, "romaji": romaji}
