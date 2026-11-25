"""Keep a worker's database claim alive while it performs media I/O."""

import asyncio
from collections.abc import Awaitable, Callable
from contextlib import suppress
from datetime import timedelta

LEASE = timedelta(seconds=30)
MAX_ATTEMPTS = 3


class LeaseLost(Exception):
    """Processing ownership changed while a worker was running."""


async def run_with_lease[T](work: Awaitable[T], renew: Callable[[], Awaitable[bool]]) -> T:
    task = asyncio.ensure_future(work)
    try:
        while True:
            done, _ = await asyncio.wait({task}, timeout=LEASE.total_seconds() / 3)
            if done:
                return task.result()
            if not await renew():
                raise LeaseLost
    finally:
        if not task.done():
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task
