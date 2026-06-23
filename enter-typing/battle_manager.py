import json
import asyncio
from fastapi import WebSocket
from typing import Dict, List
import redis.asyncio as redis

class BattleManager:
    # [ 초기화 ] 
    # Redis 클라이언트를 연결하고, 로컬 웹소켓 연결 목록 및 Pub/Sub 인스턴스를 초기화합니다.
    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
        # room_id -> list of active websocket connections (현재 서버 인스턴스에 연결된 소켓들)
        self.active_connections: Dict[str, List[WebSocket]] = {}
        self.pubsub = self.redis.pubsub()
        self.listener_task = None

    # [ 리스너 시작 ]
    # Redis Pub/Sub을 통해 모든 방(channel:room:*)에서 발생하는 이벤트를 수신하는 백그라운드 작업을 시작합니다.
    async def start_listening(self):
        if self.listener_task is None:
            await self.pubsub.psubscribe("channel:room:*")
            self.listener_task = asyncio.create_task(self._listener())

    # [ 메시지 수신 대기 ]
    # Redis 채널로부터 실시간 메시지를 수신하여, 해당 방에 연결된 유저들에게 로컬 브로드캐스트합니다.
    async def _listener(self):
        while True:
            try:
                # 연결이 끊겼을 수 있으므로 다시 구독을 시도합니다.
                await self.pubsub.psubscribe("channel:room:*")
                async for message in self.pubsub.listen():
                    if message['type'] == 'pmessage':
                        channel = message['channel']
                        room_id = channel.split(":")[-1]
                        data = json.loads(message['data'])
                        await self._local_broadcast(room_id, data)
            except Exception as e:
                # 타임아웃 에러는 대기 중일 때 발생하는 정상적인 현상이므로 로그를 생략합니다.
                if "Timeout" not in str(e):
                    print(f"PubSub Listener Error: {e}")
                    print("5초 후 다시 연결을 시도합니다...")
                await asyncio.sleep(5)

    # [ 로컬 브로드캐스트 ]
    # 특정 방(room_id)에 대해, 현재 서버에 직접 연결되어 있는 모든 웹소켓 클라이언트에게 메시지를 쏴줍니다.
    async def _local_broadcast(self, room_id: str, message: dict):
        if room_id in self.active_connections:
            for connection in list(self.active_connections[room_id]):
                try:
                    await connection.send_json(message)
                except Exception:
                    pass
                    
    # [ 웹소켓 연결 ]
    # 유저가 방에 입장할 때 웹소켓 연결을 승인하고, 로컬 연결 목록(active_connections)에 추가합니다.
    async def connect(self, websocket: WebSocket, room_id: str):
        await websocket.accept()
        if room_id not in self.active_connections:
            self.active_connections[room_id] = []
        self.active_connections[room_id].append(websocket)
        
    # [ 웹소켓 해제 ]
    # 유저가 방을 나가거나 통신이 끊길 때, 로컬 연결 목록에서 해당 웹소켓을 제거합니다.
    def disconnect(self, websocket: WebSocket, room_id: str):
        if room_id in self.active_connections:
            try:
                self.active_connections[room_id].remove(websocket)
            except ValueError:
                pass
            if not self.active_connections[room_id]:
                del self.active_connections[room_id]

    # [ 메시지 발행 ]
    # Redis를 통해 특정 방(room_id) 채널에 메시지를 뿌립니다. 
    # 이렇게 발행된 메시지는 _listener가 감지하여 방에 있는 모든 유저에게 전달합니다.
    async def publish(self, room_id: str, message: dict):
        await self.redis.publish(f"channel:room:{room_id}", json.dumps(message))

    # [ 전체 방 목록 조회 ]
    # Redis에 저장되어 있는 현재 생성된 모든 대전 방의 정보를 가져옵니다.
    async def get_rooms(self):
        # Redis에서 생성된 방 목록 가져오기
        keys = await self.redis.keys("room:*")
        rooms = []
        for key in keys:
            data = await self.redis.get(key)
            if data:
                rooms.append(json.loads(data))
        return rooms

    # [ 방 생성 ]
    # 새로운 대전 방의 데이터(방장, 노래번호, 비밀방 여부 등)를 구성하고, 2시간 만료 조건으로 Redis에 저장합니다.
    async def create_room(self, room_id: str, title: str, creator: str, content_id: int, max_players: int = 2, is_private: bool = False, room_code: str = None):
        room_data = {
            "id": room_id,
            "title": title,
            "creator": creator,
            "content_id": content_id,
            "max_players": max_players,
            "players": [],  # list of dict {"nickname": ..., "ready": bool, "progress": 0, "wpm": 0}
            "status": "waiting",
            "is_private": is_private,
            "room_code": room_code
        }
        await self.redis.set(f"room:{room_id}", json.dumps(room_data), ex=3600*2) # 2시간 만료
        return room_data
        
    # [ 방 상태 업데이트 ]
    # 게임 시작, 유저 레디 상태 등 방 내부의 데이터가 변경될 때 Redis에 업데이트된 정보를 저장합니다.
    async def update_room(self, room_id: str, room_data: dict):
        await self.redis.set(f"room:{room_id}", json.dumps(room_data), ex=3600*2)

    # [ 특정 방 조회 ]
    # 특정 room_id를 가진 방의 현재 상세 정보(유저 목록 등)를 Redis에서 불러옵니다.
    async def get_room(self, room_id: str):
        data = await self.redis.get(f"room:{room_id}")
        if data:
            return json.loads(data)
        return None

    # [ 방 삭제 ]
    # 모든 유저가 나갔거나 특정 상황에 의해 해당 방 데이터를 Redis에서 완전히 삭제합니다.
    async def delete_room(self, room_id: str):
        await self.redis.delete(f"room:{room_id}")
