# Backend rules

Follow the root AGENTS.md. Use the `src/cliphunter` package layout.

- `domain`: framework-independent entities, value objects and repository ports.
- `application`: use cases, DTOs and external-service interfaces.
- `infrastructure`: configuration and concrete external adapters.
- `presentation/http`: HTTP routes, schemas and dependencies.
- `main.py`: application factory and composition root.

Do not move business behavior into HTTP routes or infrastructure. Do not add
SQLAlchemy, storage/Groq SDKs, FFmpeg or queue dependencies before their milestone.
Keep settings injectable so tests can run independently of the host environment.
The health endpoint is process liveness, not database/storage readiness.

From this directory, install and check with:

```sh
python -m pip install -c requirements.lock -e '.[dev]'
ruff check .
ruff format --check .
mypy src
pytest
```

When changing runtime dependencies, regenerate `requirements.lock` in a clean
Python 3.13 environment using `pip install .` and `pip freeze --exclude cliphunter`.
Keep test dependencies out of the runtime lock and Docker image.
