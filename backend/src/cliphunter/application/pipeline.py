"""Extract audio, build a timed transcript, and select moments from the text."""

from collections.abc import AsyncIterator, Sequence
from dataclasses import dataclass
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Protocol

from cliphunter.application.interfaces import ObjectStorage
from cliphunter.application.processing import AnalysisFailed, ProcessingResult, StageReporter
from cliphunter.domain.entities import Highlight, ProcessingStage, TranscriptSegment, VideoProject
from cliphunter.domain.errors import ServiceUnavailable

MIN_TRANSCRIBABLE_SECONDS = 0.01


@dataclass(frozen=True)
class AudioChunk:
    path: Path
    start: float
    duration: float


@dataclass(frozen=True)
class SpeechSegment:
    start: float
    end: float
    text: str


class AudioExtractor(Protocol):
    async def extract(self, source: Path, audio: Path, duration: float) -> bool: ...

    def chunks(self, audio: Path, directory: Path) -> AsyncIterator[AudioChunk]: ...


class SpeechToText(Protocol):
    async def transcribe(self, path: Path) -> list[SpeechSegment]: ...


class HighlightRanker(Protocol):
    async def rank(self, segments: Sequence[TranscriptSegment]) -> list[Highlight]: ...


class AnalyzeVideo:
    def __init__(
        self,
        storage: ObjectStorage,
        audio: AudioExtractor,
        speech: SpeechToText,
        ranker: HighlightRanker,
    ) -> None:
        self.storage = storage
        self.audio = audio
        self.speech = speech
        self.ranker = ranker

    async def execute(self, project: VideoProject, report_stage: StageReporter) -> ProcessingResult:
        if project.storage_key is None or project.duration is None:
            raise AnalysisFailed("Исходное видео не найдено. Загрузите его снова.")
        with TemporaryDirectory(prefix="cliphunter-processing-") as name:
            directory = Path(name)
            source = directory / "source"
            audio = directory / "audio.wav"
            try:
                await self.storage.download(project.storage_key, source)
            except ServiceUnavailable:
                raise AnalysisFailed(
                    "Не удалось получить исходное видео. Попробуйте снова."
                ) from None
            if not await self.audio.extract(source, audio, project.duration):
                return ProcessingResult()
            source.unlink()
            await report_stage(ProcessingStage.TRANSCRIBING)
            segments = []
            async for chunk in self.audio.chunks(audio, directory):
                try:
                    if chunk.duration < MIN_TRANSCRIBABLE_SECONDS:
                        continue
                    speech = await self.speech.transcribe(chunk.path)
                    for item in speech:
                        start = chunk.start + item.start
                        end = min(chunk.start + min(item.end, chunk.duration), project.duration)
                        if item.text.strip() and start < end:
                            segments.append(
                                TranscriptSegment(
                                    project_id=project.id,
                                    start_time=start,
                                    end_time=end,
                                    text=item.text.strip(),
                                )
                            )
                finally:
                    chunk.path.unlink(missing_ok=True)
            segments.sort(key=lambda segment: (segment.start_time, segment.end_time))
            if not segments:
                return ProcessingResult()
            await report_stage(ProcessingStage.ANALYZING)
            return ProcessingResult(segments=segments, highlights=await self.ranker.rank(segments))
