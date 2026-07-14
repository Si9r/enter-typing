"""실시간 대전 시스템 - Redis + WebSocket 기반 REST API 및 WebSocket 엔드포인트."""
import asyncio
import json
import random
import time
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models
from core.config import REDIS_ROOM_TTL, ALGORITHM, SECRET_KEY
from core.redis_client import get_redis
from core.security import get_current_user, get_password_hash, verify_password
from database import get_db
from jose import JWTError, jwt

router = APIRouter(tags=["battle"])


# ── WebSocket 연결 관리자 ──────────────────────────
class BattleConnectionManager:
    def __init__(self):
        # room_code → list of (websocket, nickname)
        self.rooms: Dict[str, List[tuple]] = {}

    async def connect(self, room_code: str, ws: WebSocket, nickname: str):
        await ws.accept()
        if room_code not in self.rooms:
            self.rooms[room_code] = []
        self.rooms[room_code].append((ws, nickname))

    def disconnect(self, room_code: str, ws: WebSocket):
        if room_code in self.rooms:
            self.rooms[room_code] = [(w, n) for w, n in self.rooms[room_code] if w != ws]
            if not self.rooms[room_code]:
                del self.rooms[room_code]

    async def broadcast(self, room_code: str, message: dict, exclude: WebSocket = None):
        if room_code not in self.rooms:
            return
        dead = []
        for ws, nick in self.rooms[room_code]:
            if ws == exclude:
                continue
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(room_code, ws)

    async def broadcast_all(self, room_code: str, message: dict):
        await self.broadcast(room_code, message, exclude=None)

    def get_connections(self, room_code: str) -> int:
        return len(self.rooms.get(room_code, []))


battle_manager = BattleConnectionManager()
lobby_manager = BattleConnectionManager()


async def get_room_data(redis, room_code: str) -> Optional[dict]:
    raw = await redis.get(f"battle:room:{room_code}")
    if raw:
        return json.loads(raw)
    return None


async def save_room_data(redis, room_code: str, data: dict):
    await redis.set(f"battle:room:{room_code}", json.dumps(data, ensure_ascii=False), ex=REDIS_ROOM_TTL)


async def delete_room(redis, room_code: str):
    await redis.delete(f"battle:room:{room_code}")
    await lobby_manager.broadcast_all("lobby", {"type": "lobby_update"})


def public_room_view(room_data: dict) -> dict:
    """password_hash 등 내부 전용 필드를 제거한 방 정보를 반환합니다."""
    return {k: v for k, v in room_data.items() if k != "password_hash"}


# ════════════════════════════════════════════════════════════
# 요청 모델
# ════════════════════════════════════════════════════════════
class BattleRoomCreate(BaseModel):
    title: str
    max_players: int = 4
    is_private: bool = False
    password: Optional[str] = None


class RoomPasswordVerify(BaseModel):
    password: str = ""


class RoomContentSelect(BaseModel):
    mode: str  # "typing" or "quiz"
    content_id: int


# ════════════════════════════════════════════════════════════
# API: 방 생성
# POST /api/battle/rooms
# ════════════════════════════════════════════════════════════
@router.post("/api/battle/rooms")
async def create_battle_room(req: BattleRoomCreate, authorization: str = Header(None), db: Session = Depends(get_db)):
    current_user = get_current_user(authorization, db)
    redis = await get_redis()

    # 4자리 방 코드 생성 (중복 방지)
    for _ in range(10):
        code = str(random.randint(1000, 9999))
        existing = await redis.get(f"battle:room:{code}")
        if not existing:
            break

    room_data = {
        "code": code,
        "mode": None,
        "title": req.title,
        "host": current_user.nickname,
        "song_id": None,
        "song_title": None,
        "song_artist": None,
        "is_private": req.is_private,
        "password_hash": get_password_hash(req.password) if req.is_private and req.password else None,
        "max_players": min(req.max_players, 4),
        "status": "waiting",  # waiting | countdown | playing | finished
        "players": {}
    }

    await save_room_data(redis, code, room_data)
    await lobby_manager.broadcast_all("lobby", {"type": "lobby_update"})
    return {"success": True, "room_code": code, "room": public_room_view(room_data)}


# ════════════════════════════════════════════════════════════
# API: 비밀방 비밀번호 검증
# POST /api/battle/rooms/{room_code}/verify-password
# ════════════════════════════════════════════════════════════
@router.post("/api/battle/rooms/{room_code}/verify-password")
async def verify_room_password(room_code: str, req: RoomPasswordVerify):
    redis = await get_redis()
    room_data = await get_room_data(redis, room_code)
    if not room_data:
        raise HTTPException(status_code=404, detail="존재하지 않는 방입니다.")
    if not room_data.get("is_private"):
        return {"success": True}
    if not room_data.get("password_hash") or not verify_password(req.password, room_data["password_hash"]):
        raise HTTPException(status_code=401, detail="비밀번호가 올바르지 않습니다.")
    return {"success": True}


# ════════════════════════════════════════════════════════════
# API: 방장 전용 - 대전 콘텐츠(타이핑/퀴즈) 선택
# POST /api/battle/rooms/{room_code}/select-content
# ════════════════════════════════════════════════════════════
@router.post("/api/battle/rooms/{room_code}/select-content")
async def select_room_content(room_code: str, req: RoomContentSelect, authorization: str = Header(None), db: Session = Depends(get_db)):
    current_user = get_current_user(authorization, db)
    redis = await get_redis()

    async with redis.lock(f"battle:lock:{room_code}", timeout=5):
        room_data = await get_room_data(redis, room_code)
        if not room_data:
            raise HTTPException(status_code=404, detail="존재하지 않는 방입니다.")
        if room_data["host"] != current_user.nickname:
            raise HTTPException(status_code=403, detail="방장만 콘텐츠를 선택할 수 있습니다.")

        model = models.QuizContent if req.mode == "quiz" else models.TypingContent
        content = db.query(model).filter(model.id == req.content_id).first()
        if not content:
            raise HTTPException(status_code=404, detail="콘텐츠를 찾을 수 없습니다.")

        room_data["mode"] = req.mode
        room_data["song_id"] = content.id
        room_data["song_title"] = content.title
        room_data["song_artist"] = content.artist if hasattr(content, "artist") else "알 수 없음"
        await save_room_data(redis, room_code, room_data)

    await battle_manager.broadcast_all(room_code, {"type": "content_selected", "room": public_room_view(room_data)})
    await lobby_manager.broadcast_all("lobby", {"type": "lobby_update"})
    return {"success": True, "room": public_room_view(room_data)}


# ════════════════════════════════════════════════════════════
# API: 활성 방 목록 조회
# GET /api/battle/rooms
# ════════════════════════════════════════════════════════════
@router.get("/api/battle/rooms")
async def list_battle_rooms():
    redis = await get_redis()
    keys = await redis.keys("battle:room:*")
    rooms = []
    for key in keys:
        raw = await redis.get(key)
        if raw:
            room = json.loads(raw)
            if room.get("status") in ("waiting", "playing"):
                rooms.append({
                    "code": room["code"],
                    "title": room["title"],
                    "host": room["host"],
                    "mode": room.get("mode"),
                    "song_title": room.get("song_title"),
                    "song_artist": room.get("song_artist"),
                    "is_private": room.get("is_private", False),
                    "player_count": len(room.get("players", {})),
                    "max_players": room["max_players"],
                    "status": room["status"]
                })
    return {"success": True, "rooms": rooms}


# ════════════════════════════════════════════════════════════
# WebSocket: 로비 (방 목록 실시간 갱신 알림)
# /ws/lobby
# ════════════════════════════════════════════════════════════
@router.websocket("/ws/lobby")
async def lobby_websocket(websocket: WebSocket):
    await lobby_manager.connect("lobby", websocket, "guest")
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        lobby_manager.disconnect("lobby", websocket)


# ── 대전 기록 저장 (내부 함수) ─────────────────────────────
async def save_battle_results(room_data: dict, db: Session):
    """게임 종료 시 MySQL에 대전 기록 저장"""
    players = room_data.get("players", {})
    song_id = room_data.get("song_id")
    room_code = room_data.get("code", "")

    sorted_players = sorted(
        players.items(),
        key=lambda x: x[1].get("score", 0),
        reverse=True
    )

    for rank, (nickname, pdata) in enumerate(sorted_players, start=1):
        user_id = pdata.get("user_id")
        if not user_id:
            continue
        mode = room_data.get("mode", "typing")
        content_id_val = song_id if mode == "typing" else None
        quiz_id_val = song_id if mode == "quiz" else None

        history = models.BattleHistory(
            room_code=room_code,
            user_id=user_id,
            content_id=content_id_val,
            quiz_id=quiz_id_val,
            rank=rank,
            score=pdata.get("score", 0),
            wpm=pdata.get("wpm", 0),
            accuracy=pdata.get("accuracy", 100.0)
        )
        db.add(history)
    db.commit()


# ════════════════════════════════════════════════════════════
# WebSocket: 실시간 대전방
# /ws/battle/{room_code}
# ════════════════════════════════════════════════════════════
@router.websocket("/ws/battle/{room_code}")
async def battle_websocket(
    websocket: WebSocket,
    room_code: str,
    token: str = Query(...),
    password: str = Query(""),
    db: Session = Depends(get_db)
):
    # 1. JWT 토큰 검증
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if not email:
            await websocket.close(code=4001)
            return
    except JWTError:
        await websocket.close(code=4001)
        return

    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        await websocket.close(code=4001)
        return

    nickname = user.nickname
    redis = await get_redis()

    # 2. 방 상태 로드 (Lock 적용)
    async with redis.lock(f"battle:lock:{room_code}", timeout=5):
        room_data = await get_room_data(redis, room_code)
        if not room_data:
            await websocket.close(code=4004)
            return

        # 2-1. 비밀방 비밀번호 체크
        if room_data.get("is_private") and nickname != room_data.get("host"):
            if not room_data.get("password_hash") or not verify_password(password, room_data["password_hash"]):
                await websocket.close(code=4005)
                return

        # 3. 인원 초과 체크
        if len(room_data["players"]) >= room_data["max_players"] and nickname not in room_data["players"]:
            await websocket.close(code=4003)
            return

        # 4. WebSocket 수락 및 방 입장
        await battle_manager.connect(room_code, websocket, nickname)

        # 플레이어 등록 (재접속 시 기존 데이터 유지)
        if nickname not in room_data["players"]:
            room_data["players"][nickname] = {
                "user_id": user.id,
                "ready": False,
                "score": 0,
                "progress": 0.0,
                "wpm": 0,
                "accuracy": 100.0,
                "finished": False,
                "is_host": nickname == room_data["host"]
            }
            await save_room_data(redis, room_code, room_data)

    # 입장한 플레이어에게 현재 방 상태 전송
    await websocket.send_json({"type": "room_state", "room": room_data})

    # 나머지 플레이어에게 입장 알림
    await battle_manager.broadcast(room_code, {
        "type": "player_joined",
        "nickname": nickname,
        "players": room_data["players"]
    }, exclude=websocket)

    # 로비에도 인원 변동 알림
    await lobby_manager.broadcast_all("lobby", {"type": "lobby_update"})

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            # ── 준비 상태 변경 ──────────────────────────────
            if msg_type == "ready":
                async with redis.lock(f"battle:lock:{room_code}", timeout=5):
                    room_data = await get_room_data(redis, room_code)
                    if room_data and nickname in room_data["players"]:
                        room_data["players"][nickname]["ready"] = data.get("ready", True)
                        await save_room_data(redis, room_code, room_data)

                if room_data and nickname in room_data["players"]:
                    await battle_manager.broadcast_all(room_code, {
                        "type": "player_update",
                        "nickname": nickname,
                        "data": room_data["players"][nickname],
                        "players": room_data["players"]
                    })

            # ── 방장이 시작 ─────────────────────────────────
            elif msg_type == "start":
                room_data = await get_room_data(redis, room_code)
                if not room_data:
                    continue
                if nickname != room_data["host"]:
                    await websocket.send_json({"type": "error", "message": "방장만 시작할 수 있습니다."})
                    continue

                non_host_players = {n: p for n, p in room_data["players"].items() if n != room_data["host"] and not p.get("disconnected")}
                if non_host_players and not all(p["ready"] for p in non_host_players.values()):
                    await websocket.send_json({"type": "error", "message": "아직 준비가 안 된 플레이어가 있습니다."})
                    continue

                async def sync_and_start(r_code):
                    sync_timeout = 10.0
                    checked_time = 0.0
                    while checked_time < sync_timeout:
                        r_data = await get_room_data(redis, r_code)
                        if not r_data or r_data.get("status") != "syncing":
                            return
                        active_players = {n: p for n, p in r_data["players"].items() if not p.get("disconnected")}
                        if active_players and all(p.get("sync_ready") for p in active_players.values()):
                            break
                        await asyncio.sleep(0.5)
                        checked_time += 0.5

                    r_data = await get_room_data(redis, r_code)
                    if r_data and r_data.get("status") == "syncing":
                        r_data["status"] = "countdown"
                        await save_room_data(redis, r_code, r_data)

                        for count in range(5, 0, -1):
                            await battle_manager.broadcast_all(r_code, {"type": "countdown", "count": count})
                            await asyncio.sleep(1)

                        f_data = await get_room_data(redis, r_code)
                        if f_data:
                            f_data["status"] = "playing"
                            f_data["start_time"] = time.time()
                            for p in f_data["players"].values():
                                p["score"] = 0
                                p["progress"] = 0.0
                                p["wpm"] = 0
                                p["accuracy"] = 100.0
                                p["finished"] = False
                            await save_room_data(redis, r_code, f_data)
                            await battle_manager.broadcast_all(r_code, {
                                "type": "game_start",
                                "song_id": f_data["song_id"],
                                "players": f_data["players"]
                            })

                room_data["status"] = "syncing"
                for p in room_data["players"].values():
                    if not p.get("disconnected"):
                        p["sync_ready"] = False
                await save_room_data(redis, room_code, room_data)

                await battle_manager.broadcast_all(room_code, {"type": "sync_check"})
                asyncio.create_task(sync_and_start(room_code))

            # ── 동기화 완료 신호 ─────────────────────────────
            elif msg_type == "sync_ready":
                async with redis.lock(f"battle:lock:{room_code}", timeout=5):
                    room_data = await get_room_data(redis, room_code)
                    if room_data and room_data.get("status") == "syncing" and nickname in room_data["players"]:
                        room_data["players"][nickname]["sync_ready"] = True
                        await save_room_data(redis, room_code, room_data)

            # ── 채팅 메시지 ─────────────────────────────────
            elif msg_type == "chat":
                await battle_manager.broadcast(room_code, {
                    "type": "chat",
                    "nickname": nickname,
                    "message": data.get("message", "")
                }, exclude=websocket)

            # ── 퀴즈 정답 브로드캐스트 ──────────────────────
            elif msg_type == "quiz_answer":
                async with redis.lock(f"battle:lock:{room_code}", timeout=5):
                    room_data = await get_room_data(redis, room_code)
                    if room_data and nickname in room_data["players"]:
                        new_score = data.get("score", 0)
                        room_data["players"][nickname]["score"] = new_score
                        await save_room_data(redis, room_code, room_data)

                await battle_manager.broadcast(room_code, {
                    "type": "quiz_answer",
                    "nickname": nickname,
                    "question_key": data.get("question_key"),
                    "answer_index": data.get("answer_index"),
                    "answer_text": data.get("answer_text", ""),
                    "score": data.get("score", 0),
                    "message": data.get("message", "")
                }, exclude=websocket)

            # ── 퀴즈 채팅 메시지 ─────────────────────────────
            elif msg_type == "quiz_chat":
                await battle_manager.broadcast(room_code, {
                    "type": "quiz_chat",
                    "nickname": nickname,
                    "message": data.get("message", "")
                }, exclude=websocket)

            # ── 타이핑 진행도 업데이트 ──────────────────────
            elif msg_type == "progress":
                async with redis.lock(f"battle:lock:{room_code}", timeout=5):
                    room_data = await get_room_data(redis, room_code)
                    if room_data and nickname in room_data["players"]:
                        room_data["players"][nickname]["score"] = data.get("score", 0)
                        room_data["players"][nickname]["progress"] = data.get("progress", 0.0)
                        room_data["players"][nickname]["wpm"] = data.get("wpm", 0)
                        room_data["players"][nickname]["accuracy"] = data.get("accuracy", 100.0)
                        await save_room_data(redis, room_code, room_data)

                if room_data and nickname in room_data["players"]:
                    await battle_manager.broadcast(room_code, {
                        "type": "player_update",
                        "nickname": nickname,
                        "score": room_data["players"][nickname]["score"],
                        "progress": room_data["players"][nickname]["progress"],
                        "wpm": room_data["players"][nickname]["wpm"],
                    }, exclude=websocket)

            # ── 게임 완료 ───────────────────────────────────
            elif msg_type == "finish":
                async with redis.lock(f"battle:lock:{room_code}", timeout=5):
                    room_data = await get_room_data(redis, room_code)
                    if room_data and nickname in room_data["players"]:
                        room_data["players"][nickname]["finished"] = True
                        if room_data.get("mode") == "quiz":
                            room_data["players"][nickname]["score"] = data.get("score", room_data["players"][nickname].get("score", 0))
                            room_data["players"][nickname]["wpm"] = 0
                            room_data["players"][nickname]["accuracy"] = 0.0
                        else:
                            room_data["players"][nickname]["score"] = data.get("score", 0)
                            room_data["players"][nickname]["wpm"] = data.get("wpm", 0)
                            room_data["players"][nickname]["accuracy"] = data.get("accuracy", 100.0)
                        room_data["players"][nickname]["progress"] = 1.0

                        all_finished = all(p["finished"] for p in room_data["players"].values())
                        if all_finished and room_data.get("status") != "finished":
                            room_data["status"] = "finished"

                        await save_room_data(redis, room_code, room_data)

                if room_data and nickname in room_data["players"]:
                    await battle_manager.broadcast_all(room_code, {
                        "type": "player_finished",
                        "nickname": nickname,
                        "players": room_data["players"]
                    })

                    if room_data.get("status") == "finished":
                        sorted_players = sorted(
                            room_data["players"].items(),
                            key=lambda x: x[1].get("score", 0),
                            reverse=True
                        )
                        results = [
                            {"rank": i + 1, "nickname": n, **p}
                            for i, (n, p) in enumerate(sorted_players)
                        ]

                        await battle_manager.broadcast_all(room_code, {
                            "type": "game_end",
                            "results": results
                        })

                        try:
                            await save_battle_results(room_data, db)
                        except Exception as e:
                            print(f"Battle history save error: {e}")

                        await asyncio.sleep(600)
                        await delete_room(redis, room_code)

    except WebSocketDisconnect:
        battle_manager.disconnect(room_code, websocket)
        async with redis.lock(f"battle:lock:{room_code}", timeout=10):
            room_data = await get_room_data(redis, room_code)
            if room_data and nickname in room_data["players"]:
                if room_data.get("status") in ["playing", "countdown", "finished"]:
                    room_data["players"][nickname]["disconnected"] = True
                    room_data["players"][nickname]["finished"] = True

                    if nickname == room_data["host"]:
                        active_players = [n for n, p in room_data["players"].items() if not p.get("disconnected")]
                        if active_players:
                            room_data["host"] = active_players[0]

                    await save_room_data(redis, room_code, room_data)

                    await battle_manager.broadcast_all(room_code, {
                        "type": "player_disconnected",
                        "nickname": nickname,
                        "players": room_data["players"],
                        "new_host": room_data["host"]
                    })

                    active_players_dict = {n: p for n, p in room_data["players"].items() if not p.get("disconnected")}
                    if active_players_dict:
                        all_finished = all(p.get("finished") for p in active_players_dict.values())
                        if all_finished and room_data["status"] != "finished":
                            room_data["status"] = "finished"
                            await save_room_data(redis, room_code, room_data)

                            sorted_players = sorted(
                                room_data["players"].items(),
                                key=lambda x: x[1].get("score", 0),
                                reverse=True
                            )
                            results = [
                                {"rank": i + 1, "nickname": n, **p}
                                for i, (n, p) in enumerate(sorted_players)
                            ]
                            await battle_manager.broadcast_all(room_code, {
                                "type": "game_end",
                                "results": results
                            })
                            try:
                                await save_battle_results(room_data, db)
                            except Exception as e:
                                print(f"Battle history save error: {e}")
                            await asyncio.sleep(600)
                            await delete_room(redis, room_code)
                    else:
                        await delete_room(redis, room_code)
                else:
                    del room_data["players"][nickname]
                    if not room_data["players"]:
                        await delete_room(redis, room_code)
                    else:
                        if nickname == room_data["host"] and room_data["players"]:
                            room_data["host"] = next(iter(room_data["players"]))
                        await save_room_data(redis, room_code, room_data)
                        await battle_manager.broadcast_all(room_code, {
                            "type": "player_left",
                            "nickname": nickname,
                            "players": room_data["players"],
                            "new_host": room_data["host"]
                        })
                    await lobby_manager.broadcast_all("lobby", {"type": "lobby_update"})
    except Exception as e:
        print(f"WebSocket error: {e}")
        battle_manager.disconnect(room_code, websocket)
