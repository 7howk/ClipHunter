"""Transaction boundary used by application use cases."""

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
