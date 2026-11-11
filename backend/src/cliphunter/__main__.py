"""Start the API using validated environment settings."""

import uvicorn

from cliphunter.infrastructure.config import Settings


def main() -> None:
    settings = Settings()
    uvicorn.run(
        "cliphunter.main:create_app", factory=True, host=settings.app_host, port=settings.app_port
    )


if __name__ == "__main__":
    main()
