"""
Redis-backed Lobby State & Pub/Sub for distributed Quiz Service replicas.
Allows any replica to access/update lobby room state and relays broadcasts across replicas.
Gracefully falls back to in-memory state if Redis is not running or unreachable.
"""

import asyncio
import json
import logging
import random
from typing import Any
from starlette.websockets import WebSocket

from app.core.config import settings

logger = logging.getLogger("histofacts.quiz.lobby_state")

try:
    import redis.asyncio as aioredis
    REDIS_AVAILABLE = True
except ImportError:
    aioredis = None
    REDIS_AVAILABLE = False


class LobbyStateManager:
    """
    Manages shared lobby state across multiple Quiz service replicas via Redis (with in-memory fallback).
    Coordinates WebSocket distribution using Redis Pub/Sub channels.
    """

    def __init__(self, redis_url: str | None = None):
        self.redis_url = redis_url or getattr(settings, "redis_url", "redis://localhost:6379/0")
        self._redis: Any = None
        self._redis_healthy = False
        self._memory_lobbies: dict[str, dict] = {}
        # Local WebSocket connections: room_code -> { user_id: WebSocket }
        self._local_connections: dict[str, dict[str, WebSocket]] = {}
        # Active pubsub listener tasks: room_code -> asyncio.Task
        self._pubsub_tasks: dict[str, asyncio.Task] = {}
        self._lock = asyncio.Lock()

    async def get_redis(self):
        """Lazy-initialize Redis client and verify connectivity."""
        if not REDIS_AVAILABLE:
            return None
        if self._redis is not None and self._redis_healthy:
            return self._redis

        try:
            client = aioredis.from_url(
                self.redis_url,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=2.0,
                socket_timeout=2.0,
            )
            await client.ping()
            self._redis = client
            self._redis_healthy = True
            logger.info(f"Connected to Redis for quiz lobby distribution at {self.redis_url}")
            return self._redis
        except Exception as e:
            self._redis = None
            self._redis_healthy = False
            logger.debug(f"Redis unavailable ({e}); using resilient in-memory lobby state.")
            return None

    # ── State CRUD ──────────────────────────────────────────────

    async def get_lobby(self, code: str) -> dict | None:
        """Fetch lobby snapshot from Redis (or in-memory cache)."""
        r = await self.get_redis()
        if r:
            try:
                raw = await r.get(f"lobby:{code}")
                if raw:
                    data = json.loads(raw)
                    self._memory_lobbies[code] = data
                    return data
            except Exception as e:
                logger.warning(f"Error fetching lobby {code} from Redis: {e}")

        return self._memory_lobbies.get(code)

    async def save_lobby(self, code: str, state: dict, ttl_seconds: int = 3600) -> None:
        """Persist lobby snapshot to Redis with TTL, mirroring to local memory."""
        self._memory_lobbies[code] = state
        r = await self.get_redis()
        if r:
            try:
                await r.set(f"lobby:{code}", json.dumps(state), ex=ttl_seconds)
            except Exception as e:
                logger.warning(f"Error persisting lobby {code} to Redis: {e}")

    async def delete_lobby(self, code: str) -> None:
        """Remove lobby from Redis and local cache."""
        self._memory_lobbies.pop(code, None)
        r = await self.get_redis()
        if r:
            try:
                await r.delete(f"lobby:{code}")
            except Exception as e:
                logger.warning(f"Error deleting lobby {code} from Redis: {e}")

    async def create_lobby(
        self, host_id: str, host_name: str, topic: str, questions: list[dict]
    ) -> dict:
        """Generate unique lobby code and initialize room state."""
        code = str(random.randint(100000, 999999))
        lobby_data = {
            "code": code,
            "host_id": host_id,
            "host_name": host_name,
            "topic": topic,
            "questions": questions,
            "state": "waiting_room",
            "current_question_index": 0,
            "time_per_question": 20,
            "time_remaining": 20,
            "participants": {},  # user_id -> participant metadata
        }
        await self.save_lobby(code, lobby_data)
        return lobby_data

    # ── WebSocket & Pub/Sub Subscription ────────────────────────

    async def register_local_socket(self, code: str, user_id: str, ws: WebSocket) -> None:
        """Register a locally connected WebSocket and ensure pub/sub subscriber is active."""
        async with self._lock:
            if code not in self._local_connections:
                self._local_connections[code] = {}
            self._local_connections[code][user_id] = ws

            if code not in self._pubsub_tasks:
                task = asyncio.create_task(self._subscribe_to_lobby_channel(code))
                self._pubsub_tasks[code] = task

    async def unregister_local_socket(self, code: str, user_id: str) -> None:
        """Unregister a locally disconnected WebSocket."""
        async with self._lock:
            if code in self._local_connections:
                self._local_connections[code].pop(user_id, None)
                if not self._local_connections[code]:
                    self._local_connections.pop(code, None)
                    task = self._pubsub_tasks.pop(code, None)
                    if task and not task.done():
                        task.cancel()

    async def broadcast_to_lobby(self, code: str, message: dict) -> None:
        """
        Publish message to Redis pub/sub channel for cross-replica fan-out.
        Also dispatches immediately to local connections.
        """
        r = await self.get_redis()
        published_to_redis = False
        if r:
            try:
                await r.publish(f"lobby-channel:{code}", json.dumps(message))
                published_to_redis = True
            except Exception as e:
                logger.warning(f"Error publishing to lobby channel {code}: {e}")

        # If Redis is unavailable or didn't publish, deliver directly to local sockets
        if not published_to_redis:
            await self._dispatch_local(code, message)

    async def _dispatch_local(self, code: str, message: dict) -> None:
        """Send JSON message to all locally connected WebSockets for this lobby."""
        room_sockets = list(self._local_connections.get(code, {}).items())
        dead = []
        for uid, ws in room_sockets:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(uid)

        if dead and code in self._local_connections:
            for uid in dead:
                self._local_connections[code].pop(uid, None)

    async def _subscribe_to_lobby_channel(self, code: str) -> None:
        """Listen for pub/sub messages from any Quiz service replica on channel."""
        r = await self.get_redis()
        if not r:
            return

        try:
            pubsub = r.pubsub()
            channel_name = f"lobby-channel:{code}"
            await pubsub.subscribe(channel_name)

            while True:
                message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                if message and message["type"] == "message":
                    try:
                        data = json.loads(message["data"])
                        await self._dispatch_local(code, data)
                    except Exception as err:
                        logger.debug(f"Error processing pubsub message: {err}")
                await asyncio.sleep(0.05)
        except asyncio.CancelledError:
            try:
                await pubsub.unsubscribe(f"lobby-channel:{code}")
                await pubsub.close()
            except Exception:
                pass
        except Exception as e:
            logger.debug(f"PubSub channel listener exited: {e}")


# Global Singleton for the microservice instance
lobby_state_manager = LobbyStateManager()
