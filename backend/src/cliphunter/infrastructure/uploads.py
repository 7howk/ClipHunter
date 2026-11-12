"""Bounded disk buffering and safe, time-limited ffprobe metadata inspection."""

import asyncio
import errno
import json
import math
import os
import shutil
import tempfile
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from functools import partial
from pathlib import Path

from cliphunter.application.interfaces import BufferedUpload
from cliphunter.domain.errors import (
    InsufficientStorage,
    InvalidInput,
    ServiceUnavailable,
    UploadTooLarge,
)
from cliphunter.infrastructure.io import run_io


class TemporaryUploadBuffer:
    def __init__(
        self,
        directory: Path,
        max_bytes: int,
        reserve_bytes: int,
        *,
        concurrency: int = 2,
    ) -> None:
        self.directory = directory
        self.max_bytes = max_bytes
        self.reserve_bytes = reserve_bytes
        self.slots = asyncio.Semaphore(concurrency)

    @asynccontextmanager
    async def receive(
        self,
        chunks: AsyncIterator[bytes],
        expected_size: int | None,
    ) -> AsyncIterator[BufferedUpload]:
        if expected_size is not None and expected_size > self.max_bytes:
            raise UploadTooLarge("Превышен допустимый размер видео")
        async with self.slots:
            path: Path | None = None
            try:
                self.directory.mkdir(parents=True, exist_ok=True, mode=0o700)
                if shutil.disk_usage(self.directory).free < self.reserve_bytes + (
                    expected_size or 1
                ):
                    raise InsufficientStorage("Недостаточно места для временного файла")
                fd, name = tempfile.mkstemp(prefix="video-", suffix=".upload", dir=self.directory)
                path = Path(name)
                size = 0
                with os.fdopen(fd, "wb") as file:
                    async for chunk in chunks:
                        size += len(chunk)
                        if size > self.max_bytes:
                            raise UploadTooLarge("Превышен допустимый размер видео")
                        if shutil.disk_usage(self.directory).free < self.reserve_bytes + len(chunk):
                            raise InsufficientStorage("Недостаточно места для временного файла")
                        await run_io(partial(file.write, chunk))
                if size == 0:
                    raise InvalidInput("Файл пуст")
                if expected_size is not None and expected_size != size:
                    raise InvalidInput("Размер тела не совпадает с Content-Length")
                yield BufferedUpload(path=path, size=size)
            except OSError as exc:
                if exc.errno in (errno.ENOSPC, errno.EDQUOT):
                    raise InsufficientStorage("Недостаточно места для временного файла") from None
                raise
            finally:
                if path is not None:
                    path.unlink(missing_ok=True)


class FFprobeVideoInspector:
    def __init__(
        self, max_duration: float, *, executable: str = "ffprobe", timeout: float = 20
    ) -> None:
        self.max_duration = max_duration
        self.executable = executable
        self.timeout = timeout

    async def inspect(self, path: Path, extension: str) -> float:
        try:
            process = await asyncio.create_subprocess_exec(
                self.executable,
                "-v",
                "error",
                "-protocol_whitelist",
                "file,pipe",
                "-max_alloc",
                "67108864",
                "-probesize",
                "5000000",
                "-analyzeduration",
                "5000000",
                "-select_streams",
                "v:0",
                "-show_entries",
                "stream=codec_type,width,height:stream_disposition=attached_pic:format=duration,format_name",
                "-of",
                "json",
                str(path),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.DEVNULL,
            )
        except FileNotFoundError:
            raise ServiceUnavailable("Сервис проверки видео недоступен") from None
        try:
            try:
                output, _ = await asyncio.wait_for(process.communicate(), timeout=self.timeout)
            except TimeoutError:
                raise InvalidInput("Не удалось проверить видео за допустимое время") from None
            if process.returncode != 0:
                raise InvalidInput("Файл повреждён или не является поддерживаемым видео")
            return self._validate(output, extension)
        finally:
            if process.returncode is None:
                process.kill()
                await process.wait()

    def _validate(self, output: bytes, extension: str) -> float:
        try:
            data = json.loads(output)
            video = data["streams"][0]
            duration = float(data["format"]["duration"])
            formats = set(data["format"]["format_name"].split(","))
            expected = {"matroska", "webm"} if extension in (".mkv", ".webm") else {"mov", "mp4"}
            valid = (
                video["codec_type"] == "video"
                and video["width"] > 0
                and video["height"] > 0
                and not video.get("disposition", {}).get("attached_pic", 0)
                and bool(formats & expected)
                and math.isfinite(duration)
                and 0 < duration <= self.max_duration
            )
            if not valid:
                raise ValueError
        except (KeyError, IndexError, TypeError, ValueError, AttributeError):
            raise InvalidInput("Неподдерживаемое видео или превышен лимит длительности") from None
        return duration
