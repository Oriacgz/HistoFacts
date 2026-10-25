"""Authoritative Redis lobby state with optimistic transactions and pub/sub."""
import asyncio
import json
import logging

import redis.asyncio as aioredis
from redis.exceptions import RedisError, WatchError
from fastapi import HTTPException

from app.core.config import settings

logger = logging.getLogger(__name__)


class LobbyStateManager:
    def __init__(self, redis_url=None, redis_client=None):
        self.redis = redis_client or aioredis.from_url(
            redis_url or settings.redis_url, decode_responses=True,
            socket_connect_timeout=2, socket_timeout=2)
        # Only transport connections live in this process; game state never does.
        self._local_connections = {}
        self._listeners = {}
        self._subscription_lock = asyncio.Lock()
        self.snapshot = None

    async def get_lobby(self, code):
        try:
            raw = await self.redis.get(f"lobby:{code}")
            return json.loads(raw) if raw else None
        except RedisError as exc:
            raise HTTPException(503, "Live lobbies require Redis; please try again") from exc

    async def create(self, code, state):
        try:
            return bool(await self.redis.set(f"lobby:{code}", json.dumps(state), ex=3600, nx=True))
        except RedisError as exc:
            raise HTTPException(503, "Live lobbies require Redis; please try again") from exc

    async def mutate(self, code, change):
        """Retry a pure mutation if another replica writes concurrently."""
        key = f"lobby:{code}"
        try:
            for _ in range(20):
                async with self.redis.pipeline(transaction=True) as pipe:
                    try:
                        await pipe.watch(key)
                        raw = await pipe.get(key)
                        if not raw:
                            raise HTTPException(404, "Lobby has expired or does not exist")
                        state = json.loads(raw)
                        change(state)
                        state["version"] += 1
                        pipe.multi()
                        pipe.set(key, json.dumps(state), ex=3600)
                        await pipe.execute()
                        return state
                    except WatchError:
                        continue
            raise HTTPException(409, "Lobby is busy; retry your action")
        except RedisError as exc:
            raise HTTPException(503, "Lobby state is temporarily unavailable") from exc

    async def register_local_socket(self, code, user_id, ws):
        async with self._subscription_lock:
            self._local_connections.setdefault(code, {})[user_id] = ws
            listener = self._listeners.get(code)
            if not listener or listener[0].done():
                ready = asyncio.Event()
                task = asyncio.create_task(self._subscribe(code, ready))
                self._listeners[code] = (task, ready)
            else:
                task, ready = listener
            await asyncio.wait_for(ready.wait(), timeout=5)
            if task.done():
                await task

    async def unregister_local_socket(self, code, user_id, ws):
        async with self._subscription_lock:
            sockets = self._local_connections.get(code, {})
            if sockets.get(user_id) is ws:
                sockets.pop(user_id, None)
            if not sockets:
                self._local_connections.pop(code, None)
                listener = self._listeners.pop(code, None)
                if listener:
                    listener[0].cancel()
                    await asyncio.gather(listener[0], return_exceptions=True)

    async def broadcast_to_lobby(self, code, message=None):
        # All replicas, including the publisher, receive through pub/sub.
        try:
            await self.redis.publish(f"lobby-channel:{code}", json.dumps(message or {"type": "state_changed"}))
        except RedisError as exc:
            raise HTTPException(503, "Lobby broadcast is temporarily unavailable") from exc

    async def _subscribe(self, code, ready):
        try:
            async with self.redis.pubsub() as pubsub:
                await pubsub.subscribe(f"lobby-channel:{code}")
                ready.set()
                while True:
                    event = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1)
                    if event and event["type"] == "message":
                        state = await self.get_lobby(code)
                        if state and self.snapshot:
                            for uid, ws in list(self._local_connections.get(code, {}).items()):
                                try:
                                    await ws.send_json(self.snapshot(state, uid))
                                except Exception:
                                    logger.debug("Disconnected lobby socket for %s", uid)
                    await asyncio.sleep(0.01)
        except asyncio.CancelledError:
            raise
        except Exception:
            ready.set()
            logger.exception("Lobby subscription failed for %s", code)
            for ws in list(self._local_connections.get(code, {}).values()):
                try:
                    await ws.close(code=1013)
                except Exception:
                    pass

    async def close(self):
        tasks = [task for task, _ in self._listeners.values()]
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        self._listeners.clear()
        self._local_connections.clear()
        await self.redis.aclose()


lobby_state_manager = LobbyStateManager()
