from fastapi import HTTPException, Request

from core.redis_client import sync_redis_client


def client_ip(request: Request) -> str:
    # nginx 등 리버스 프록시가 붙이는 X-Forwarded-For 의 마지막 값(프록시가 본 실제 접속자)을 사용한다.
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[-1].strip()
    return request.client.host if request.client else "unknown"


def hit(key: str, limit: int, window_seconds: int, detail: str = "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.") -> int:
    """고정 윈도우 카운터. 윈도우 안에서 limit 을 넘으면 429 를 발생시킨다."""
    redis_key = f"rl:{key}"
    count = sync_redis_client.incr(redis_key)
    if count == 1:
        sync_redis_client.expire(redis_key, window_seconds)
    elif sync_redis_client.ttl(redis_key) < 0:
        # 만료 설정이 누락된 키가 영구히 남아 계정이 잠기는 일을 막는다.
        sync_redis_client.expire(redis_key, window_seconds)
    if count > limit:
        raise HTTPException(status_code=429, detail=detail)
    return count


def clear(key: str) -> None:
    sync_redis_client.delete(f"rl:{key}")
