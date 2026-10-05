"""유튜브 영상 정보 조회 (퀴즈 제작: 링크로 여러 문제 만들기).

유튜브 oEmbed(API 키 불필요)로 제목·채널명을 가져온다. 삭제·비공개 영상은 404, 퍼가기(외부 재생) 금지 영상은 401 을
돌려주므로 저장 전에 미리 걸러낼 수 있다. 브라우저가 직접 부르지 않고 서버를 거쳐 CORS·차단 문제를 피한다.
"""
import asyncio
import json
import re

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

import models
from core import rate_limit
from core.redis_client import get_redis
from core.security import get_current_user

router = APIRouter(prefix="/api/youtube", tags=["youtube"])

OEMBED_URL = "https://www.youtube.com/oembed"
VIDEO_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")
MAX_IDS = 50              # 한 번에 조회할 수 있는 영상 수
CONCURRENCY = 5           # 유튜브로 동시에 보내는 요청 수
TIMEOUT_SECONDS = 5.0
CACHE_TTL_SECONDS = 86400 # 같은 영상은 하루 동안 다시 묻지 않는다
RATE_LIMIT_PER_MINUTE = 30


class VideoMetaRequest(BaseModel):
    ids: list[str]


async def _fetch_one(client: httpx.AsyncClient, semaphore: asyncio.Semaphore, video_id: str) -> dict:
    async with semaphore:
        try:
            res = await client.get(OEMBED_URL, params={"url": f"https://www.youtube.com/watch?v={video_id}", "format": "json"})
        except httpx.HTTPError:
            return {"id": video_id, "ok": False, "reason": "network"}
    if res.status_code == 200:
        try:
            data = res.json()
        except ValueError:
            return {"id": video_id, "ok": False, "reason": "network"}
        return {
            "id": video_id,
            "ok": True,
            "title": str(data.get("title") or "")[:300],
            "author": str(data.get("author_name") or "")[:200],
        }
    if res.status_code in (401, 403):
        return {"id": video_id, "ok": False, "reason": "not_embeddable"}
    if res.status_code in (400, 404):
        return {"id": video_id, "ok": False, "reason": "not_found"}
    return {"id": video_id, "ok": False, "reason": "network"}


# ════════════════════════════════════════════════════════════
# API: 영상 제목·채널명 조회
# POST /api/youtube/meta  {"ids": ["dQw4w9WgXcQ", ...]}
#   → {"videos": [{"id", "ok", "title", "author"} | {"id", "ok": false, "reason"}]}  (요청 순서, 중복 제거)
#   reason: not_found(삭제·비공개) / not_embeddable(외부 재생 금지) / network(일시 오류)
# ════════════════════════════════════════════════════════════
@router.post("/meta")
async def video_meta(req: VideoMetaRequest, current_user: models.User = Depends(get_current_user)):
    rate_limit.hit(f"ytmeta:user:{current_user.id}", RATE_LIMIT_PER_MINUTE, 60)

    ids = list(dict.fromkeys(req.ids))
    if len(ids) > MAX_IDS:
        raise HTTPException(status_code=400, detail="영상은 한 번에 50개까지 불러올 수 있습니다.")
    if any(not VIDEO_ID_RE.match(video_id) for video_id in ids):
        raise HTTPException(status_code=400, detail="올바르지 않은 영상 ID가 있습니다.")

    redis = await get_redis()
    results: dict[str, dict] = {}
    missing = []
    for video_id in ids:
        cached = await redis.get(f"ytmeta:{video_id}")
        if cached:
            results[video_id] = json.loads(cached)
        else:
            missing.append(video_id)

    if missing:
        semaphore = asyncio.Semaphore(CONCURRENCY)
        async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS, follow_redirects=True) as client:
            fetched = await asyncio.gather(*(_fetch_one(client, semaphore, v) for v in missing))
        for item in fetched:
            results[item["id"]] = item
            if item.get("reason") != "network":  # 일시 오류는 캐시하지 않고 다음에 다시 묻는다
                await redis.set(f"ytmeta:{item['id']}", json.dumps(item, ensure_ascii=False), ex=CACHE_TTL_SECONDS)

    return {"success": True, "videos": [results[video_id] for video_id in ids]}
