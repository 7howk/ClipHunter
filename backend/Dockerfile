FROM python:3.13.16-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app
RUN apt-get update \
    && apt-get install --yes --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 cliphunter \
    && useradd --uid 10001 --gid cliphunter --no-create-home cliphunter

COPY pyproject.toml requirements.lock README.md ./
COPY src ./src
COPY alembic.ini ./
COPY migrations ./migrations
RUN python -m pip install --no-cache-dir -c requirements.lock .

USER cliphunter
EXPOSE 8000
CMD ["python", "-m", "cliphunter"]
