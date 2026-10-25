"""Cancel expensive quiz work when its caller stops waiting."""
import asyncio
from fastapi import HTTPException, Request


async def until_disconnect(request: Request, operation):
    stopping = asyncio.Event()

    async def watch():
        while not stopping.is_set():
            if await request.is_disconnected():
                return
            await asyncio.sleep(.25)

    work = asyncio.create_task(operation)
    watcher = asyncio.create_task(watch())
    try:
        done, _ = await asyncio.wait({work, watcher}, return_when=asyncio.FIRST_COMPLETED)
        if work in done:
            return await work
        raise HTTPException(499, "Quiz request cancelled")
    finally:
        # Starlette's disconnect probe may absorb task cancellation in its CancelScope.
        stopping.set()
        for task in (work, watcher):
            if not task.done():
                task.cancel()
        await asyncio.gather(work, watcher, return_exceptions=True)
