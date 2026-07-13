from typing import Optional

import redis as sync_redis
import redis.asyncio as aioredis

from core.config import REDIS_URL

# ── 동기 Redis 클라이언트 (이메일 인증 등에 사용) ──
sync_redis_client = sync_redis.Redis.from_url(REDIS_URL, decode_responses=True, protocol=2)

# ── 비동기 Redis 클라이언트 (실시간 대전 WebSocket에 사용) ──
_async_redis_client: Optional[aioredis.Redis] = None


async def get_redis() -> aioredis.Redis:
    global _async_redis_client
    if _async_redis_client is None:
        _async_redis_client = aioredis.from_url(REDIS_URL, decode_responses=True, protocol=2)
    return _async_redis_client
