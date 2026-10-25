import asyncio
import json
import sys

import psutil

from .providers import ResearchUnavailable


async def extract_pdf(body):
    process = await asyncio.create_subprocess_exec(sys.executable, "-m", "app.ai_notes.research.pdf_worker",
        stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL)
    task = asyncio.create_task(process.communicate(body))
    try:
        async with asyncio.timeout(6):
            while not task.done():
                try:
                    if psutil.Process(process.pid).memory_info().rss > 192 * 1024 * 1024:
                        raise ResearchUnavailable("PDF exceeds the extraction memory limit.")
                except psutil.NoSuchProcess:
                    break
                await asyncio.sleep(.03)
            stdout, _ = await task
            if len(stdout) > 400_000 or process.returncode:
                raise ResearchUnavailable("PDF is scanned, encrypted, malformed or exceeds extraction limits.")
            payload = json.loads(stdout)
            return payload
    except (TimeoutError, ValueError, OSError) as error:
        raise ResearchUnavailable("PDF text extraction could not complete within its limits.") from error
    finally:
        if process.returncode is None:
            process.kill()
        await process.wait()
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)
