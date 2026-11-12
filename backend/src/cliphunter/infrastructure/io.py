"""Finish blocking I/O before cancellation can close its files or delete its objects."""

import asyncio
from collections.abc import Callable

import anyio


async def run_io[T](function: Callable[[], T], *, on_cancel: Callable[[], None] | None = None) -> T:
    task = asyncio.create_task(anyio.to_thread.run_sync(function))
    try:
        return await asyncio.shield(task)
    except asyncio.CancelledError:
        if on_cancel is not None:
            on_cancel()
        with anyio.CancelScope(shield=True):
            while not task.done():
                try:
                    await asyncio.shield(task)
                except asyncio.CancelledError:
                    continue
                except Exception:
                    break
        if task.done() and not task.cancelled():
            task.exception()  # Retrieve a worker error while preserving the original cancellation.
        raise
