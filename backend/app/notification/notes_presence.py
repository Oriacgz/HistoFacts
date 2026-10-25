"""Short-lived, per-tab Notes presence shared by notification workers."""
import logging
import time
import redis.asyncio as aioredis
from redis.exceptions import RedisError
from app.core.config import settings

logger = logging.getLogger(__name__)
LEASE_SECONDS = 45


class NotesPresence:
    def __init__(self, client=None, clock=None):
        self.redis = client or aioredis.from_url(
            settings.redis_url, decode_responses=True,
            socket_connect_timeout=.5, socket_timeout=.5,
        )
        self.now = clock or time.time
        self._fallback = {}

    def _prune(self):
        now = self.now()
        self._fallback = {key: expiry for key, expiry in self._fallback.items() if expiry > now}

    async def update(self, user_id: str, tab_id: str, active: bool):
        key = f'notes-presence:{user_id}'
        now = self.now()
        self._prune()
        try:
            async with self.redis.pipeline(transaction=True) as pipe:
                pipe.zremrangebyscore(key, '-inf', now)
                if active:
                    pipe.zadd(key, {tab_id: now + LEASE_SECONDS})
                    pipe.zremrangebyrank(key, 0, -65)
                else:
                    pipe.zrem(key, tab_id)
                pipe.expire(key, LEASE_SECONDS + 15)
                await pipe.execute()
            self._fallback.pop((user_id, tab_id), None)
        except RedisError:
            # Local development can run one notification worker without Redis.
            if active:
                self._fallback[(user_id, tab_id)] = now + LEASE_SECONDS
                tabs = [key for key in self._fallback if key[0] == user_id]
                if len(tabs) > 64:
                    self._fallback.pop(min(tabs, key=self._fallback.get))
            else:
                self._fallback.pop((user_id, tab_id), None)

    async def is_active(self, user_id: str) -> bool:
        self._prune()
        local = any(owner == user_id for owner, _ in self._fallback)
        try:
            return local or bool(await self.redis.zcount(f'notes-presence:{user_id}', self.now(), '+inf'))
        except RedisError:
            logger.warning('Notes presence unavailable; allowing completion notification')
            return local


notes_presence = NotesPresence()
