"""Run ffmpeg without a shell, and split decoded PCM on sample boundaries."""

import asyncio
import wave
from collections.abc import AsyncIterator
from contextlib import suppress
from functools import partial
from pathlib import Path

from cliphunter.application.pipeline import AudioChunk
from cliphunter.application.processing import AnalysisFailed
from cliphunter.infrastructure.io import run_io

SAMPLE_RATE = 16_000
CHUNK_SECONDS = 300


async def run_media(
    arguments: list[str], *, timeout: float, failure_message: str, capture: bool = False
) -> bytes:
    try:
        process = await asyncio.create_subprocess_exec(
            *arguments,
            stdin=asyncio.subprocess.DEVNULL,
            stdout=asyncio.subprocess.PIPE if capture else asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
        )
    except OSError:
        raise AnalysisFailed("Сервис обработки видео временно недоступен.") from None
    try:
        output, _ = await asyncio.wait_for(process.communicate(), timeout=timeout)
        if process.returncode:
            raise AnalysisFailed(failure_message)
        return output or b""
    finally:
        if process.returncode is None:
            with suppress(ProcessLookupError):
                process.kill()
            await process.wait()


class FFmpegAudio:
    def __init__(self, *, timeout: float = 180, chunk_seconds: int = CHUNK_SECONDS) -> None:
        self.timeout = timeout
        self.chunk_frames = SAMPLE_RATE * chunk_seconds

    async def extract(self, source: Path, audio: Path, duration: float) -> bool:
        stream = await run_media(
            [
                "ffprobe",
                "-v",
                "error",
                "-protocol_whitelist",
                "file,pipe",
                "-select_streams",
                "a:0",
                "-show_entries",
                "stream=index",
                "-of",
                "csv=p=0",
                str(source),
            ],
            timeout=self.timeout,
            failure_message="Не удалось прочитать аудиодорожку видео.",
            capture=True,
        )
        if not stream.strip():
            return False
        await run_media(
            [
                "ffmpeg",
                "-nostdin",
                "-v",
                "error",
                "-protocol_whitelist",
                "file,pipe",
                "-i",
                str(source),
                "-map",
                "0:a:0",
                "-vn",
                "-ac",
                "1",
                "-ar",
                str(SAMPLE_RATE),
                "-af",
                "aresample=async=1:first_pts=0",
                "-c:a",
                "pcm_s16le",
                "-t",
                f"{duration:.6f}",
                str(audio),
            ],
            timeout=self.timeout,
            failure_message="Не удалось извлечь звук из видео.",
        )
        return True

    async def chunks(self, audio: Path, directory: Path) -> AsyncIterator[AudioChunk]:
        with wave.open(str(audio), "rb") as source:
            params = source.getparams()

            def write_chunk(path: Path) -> None:
                data = source.readframes(self.chunk_frames)
                with wave.open(str(path), "wb") as target:
                    target.setparams(params)
                    target.writeframes(data)

            while source.tell() < source.getnframes():
                start = source.tell()
                path = directory / f"chunk-{start}.wav"
                await run_io(partial(write_chunk, path))
                end = source.tell()
                if end <= start:
                    raise AnalysisFailed("Не удалось разбить аудио на части.")
                yield AudioChunk(path, start / SAMPLE_RATE, (end - start) / SAMPLE_RATE)
