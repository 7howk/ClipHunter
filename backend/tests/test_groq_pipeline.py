"""Exercise Groq payloads, retries, alignment and validation with an HTTP mock."""

import json
import wave
from collections.abc import AsyncIterator
from pathlib import Path

import pytest
from httpx2 import AsyncClient, MockTransport, ReadTimeout, Request, Response

from cliphunter.application.pipeline import AnalyzeVideo, AudioChunk
from cliphunter.application.processing import AnalysisFailed
from cliphunter.domain.entities import ProcessingStage, TranscriptSegment, VideoProject
from cliphunter.infrastructure.groq import MAX_AUDIO_BYTES, GroqAnalysis
from cliphunter.infrastructure.media import SAMPLE_RATE, FFmpegAudio

pytestmark = pytest.mark.anyio

BASE_URL = "https://api.groq.com/openai/v1/"
STT = "whisper-large-v3-turbo"
LLM = "openai/gpt-oss-120b"


def choice(highlights: list[dict[str, str | int]]) -> Response:
    return Response(
        200,
        json={
            "choices": [
                {
                    "finish_reason": "stop",
                    "message": {"content": json.dumps({"highlights": highlights})},
                }
            ]
        },
    )


def candidate(**overrides: str | int) -> dict[str, str | int]:
    return {
        "start_segment": 0,
        "end_segment": 1,
        "score": 82,
        "category": "surprise",
        "title": "Неожиданный ответ",
        "description": "Герой объясняет свой выбор.",
        "reason": "Ответ меняет смысл предыдущей реплики.",
        **overrides,
    }


class Storage:
    async def download(self, key: str, path: Path) -> None:
        assert key == "source"
        path.write_bytes(b"test video")


class Audio:
    workspace: Path

    async def extract(self, source: Path, audio: Path, duration: float) -> bool:
        assert source.read_bytes() == b"test video"
        assert duration == 600
        self.workspace = audio.parent
        return True

    async def chunks(self, audio: Path, directory: Path) -> AsyncIterator[AudioChunk]:
        for start, duration in [(0, 300), (300, 299.995), (599.995, 0.005)]:
            path = directory / f"chunk-{start}.wav"
            path.write_bytes(b"test audio")
            yield AudioChunk(path, start, duration)


async def test_pipeline_aligns_chunks_and_resolves_highlight_on_transcript() -> None:
    requests: list[str] = []

    def handle(request: Request) -> Response:
        requests.append(request.url.path)
        if request.url.path.endswith("/audio/transcriptions"):
            assert b"verbose_json" in request.content
            assert b"timestamp_granularities[]" in request.content
            assert STT.encode() in request.content
            return Response(
                200, json={"segments": [{"start": 1.5, "end": 3.25, "text": "А вот и ответ."}]}
            )
        payload = json.loads(request.content)
        assert payload["model"] == LLM
        assert payload["response_format"]["json_schema"]["strict"] is True
        transcript = json.loads(payload["messages"][1]["content"])
        assert [item["id"] for item in transcript] == [0, 1]
        assert all("start_time" not in item for item in transcript)
        return choice([candidate()])

    project = VideoProject(title="Pipeline")
    project.attach_video(filename="original.mkv", storage_key="source", size=10, duration=600)
    stages = []

    async def stage(value: ProcessingStage) -> None:
        stages.append(value)

    audio = Audio()
    async with AsyncClient(base_url=BASE_URL, transport=MockTransport(handle)) as client:
        groq = GroqAnalysis(client, stt_model=STT, llm_model=LLM)
        result = await AnalyzeVideo(Storage(), audio, groq, groq).execute(project, stage)
    assert not audio.workspace.exists()
    assert stages == [ProcessingStage.TRANSCRIBING, ProcessingStage.ANALYZING]
    assert len(requests) == 3
    assert [(item.start_time, item.end_time) for item in result.segments] == [
        (1.5, 3.25),
        (301.5, 303.25),
    ]
    assert [(item.start_time, item.end_time, item.score) for item in result.highlights] == [
        (1.5, 303.25, 82)
    ]


@pytest.mark.parametrize(
    ("override", "error"),
    [
        ({"score": 101}, "некорректный результат"),
        ({"category": "unknown"}, "некорректный результат"),
        ({"end_segment": 2}, "некорректные границы"),
        ({"start_segment": 1, "end_segment": 0}, "некорректные границы"),
        ({"start_time": 0}, "некорректный результат"),
        ({"title": "Неверный\0текст"}, "некорректный результат"),
    ],
)
async def test_rank_rejects_invalid_llm_output(override: dict[str, str | int], error: str) -> None:
    project = VideoProject(title="Pipeline")
    segments = [
        TranscriptSegment(project_id=project.id, start_time=start, end_time=start + 1, text="Тест")
        for start in (0, 2)
    ]
    transport = MockTransport(lambda _: choice([candidate(**override)]))
    async with AsyncClient(base_url=BASE_URL, transport=transport) as client:
        groq = GroqAnalysis(client, stt_model=STT, llm_model=LLM)
        with pytest.raises(AnalysisFailed, match=error):
            await groq.rank(segments)


@pytest.mark.parametrize(
    ("status", "attempts", "expected"),
    [
        (401, 1, "Проверьте доступ к Groq"),
        (413, 1, "превышает допустимый размер"),
        (429, 3, "Исчерпан лимит"),
        (503, 3, "временно недоступен"),
        (None, 3, "временно недоступен"),
    ],
)
async def test_transcription_errors_are_bounded_and_safe(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    status: int | None,
    attempts: int,
    expected: str,
) -> None:
    path = tmp_path / "part.wav"
    path.write_bytes(b"fake wave")
    calls = 0
    delays: list[float] = []

    async def sleep(delay: float) -> None:
        delays.append(delay)

    def handle(request: Request) -> Response:
        nonlocal calls
        calls += 1
        assert b"fake wave" in request.content
        if status is None:
            raise ReadTimeout("/private/temp/path", request=request)
        return Response(status, text="Private Groq diagnostic", headers={"Retry-After": "5"})

    monkeypatch.setattr("cliphunter.infrastructure.groq.asyncio.sleep", sleep)
    async with AsyncClient(base_url=BASE_URL, transport=MockTransport(handle)) as client:
        groq = GroqAnalysis(client, stt_model=STT, llm_model=LLM)
        with pytest.raises(AnalysisFailed, match=expected) as exc:
            await groq.transcribe(path)
    assert "Private" not in str(exc.value) and "/private" not in str(exc.value)
    assert calls == attempts
    assert len(delays) == attempts - 1
    if status == 429:
        assert delays == [5, 5]


async def test_oversized_chunk_does_not_call_groq(tmp_path: Path) -> None:
    path = tmp_path / "huge.wav"
    with path.open("wb") as file:
        file.truncate(MAX_AUDIO_BYTES + 1)
    transport = MockTransport(lambda _: pytest.fail("Oversized audio must never be submitted"))
    async with AsyncClient(base_url=BASE_URL, transport=transport) as client:
        groq = GroqAnalysis(client, stt_model=STT, llm_model=LLM)
        with pytest.raises(AnalysisFailed, match="превышает допустимый размер"):
            await groq.transcribe(path)


async def test_pcm_chunks_use_exact_sample_offsets(tmp_path: Path) -> None:
    path = tmp_path / "audio.wav"
    with wave.open(str(path), "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(SAMPLE_RATE)
        audio.writeframes(bytes(2 * (2 * SAMPLE_RATE + 13)))
    chunks = [chunk async for chunk in FFmpegAudio(chunk_seconds=1).chunks(path, tmp_path)]
    assert [(chunk.start, chunk.duration) for chunk in chunks] == [
        (0, 1),
        (1, 1),
        (2, 13 / SAMPLE_RATE),
    ]
    with wave.open(str(chunks[-1].path), "rb") as tail:
        assert tail.getnframes() == 13
