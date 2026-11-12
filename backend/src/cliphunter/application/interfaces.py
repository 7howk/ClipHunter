"""Transaction boundary used by application use cases."""

from collections.abc import AsyncIterator
from contextlib import AbstractAsyncContextManager
from dataclasses import dataclass
from pathlib import Path
from types import TracebackType
from typing import Protocol, Self

from cliphunter.domain.repositories import ProjectRepository


class UnitOfWork(Protocol):
    @property
    def projects(self) -> ProjectRepository: ...

    async def __aenter__(self) -> Self: ...

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        traceback: TracebackType | None,
    ) -> None: ...

    async def commit(self) -> None: ...


@dataclass(frozen=True)
class BufferedUpload:
    path: Path
    size: int


class UploadBuffer(Protocol):
    def receive(
        self,
        chunks: AsyncIterator[bytes],
        expected_size: int | None,
    ) -> AbstractAsyncContextManager[BufferedUpload]: ...


class VideoInspector(Protocol):
    async def inspect(self, path: Path, extension: str) -> float: ...


class ObjectStorage(Protocol):
    async def upload(self, path: Path, key: str, content_type: str) -> None: ...

    async def delete(self, key: str) -> None: ...
