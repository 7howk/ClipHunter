"""Temporary deterministic results for local API integration."""

from cliphunter.application.processing import ProcessingResult
from cliphunter.domain.entities import Highlight, VideoProject


async def analyze_demo(project: VideoProject) -> ProcessingResult:
    if project.duration is None:
        return ProcessingResult()
    midpoint = project.duration / 2
    return ProcessingResult(
        highlights=[
            Highlight(
                project_id=project.id,
                start_time=0,
                end_time=min(midpoint, 15),
                score=72,
                category="reaction",
                title="Демонстрационный фрагмент из начала видео",
                description="Синтетический результат для проверки API.",
                reason="Тестовый хайлайт отдельного worker.",
            ),
            Highlight(
                project_id=project.id,
                start_time=midpoint,
                end_time=min(project.duration, midpoint + 15),
                score=86,
                category="surprise",
                title="Демонстрационный фрагмент из середины видео",
                description="Синтетический результат для проверки API.",
                reason="Тестовый хайлайт отдельного worker.",
            ),
        ]
    )
