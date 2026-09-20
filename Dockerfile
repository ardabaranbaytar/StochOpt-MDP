# syntax=docker/dockerfile:1

# ---- builder: install Poetry and resolve dependencies into system site-packages ----
FROM python:3.11-slim AS builder

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    POETRY_NO_INTERACTION=1

RUN pip install poetry

WORKDIR /app
COPY pyproject.toml poetry.lock ./
RUN poetry config virtualenvs.create false \
    && poetry install --no-root --only main

# ---- runtime: slim image with only the installed packages and the source ----
FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

RUN groupadd --system appuser && useradd --system --gid appuser --create-home appuser

WORKDIR /app
COPY --chown=appuser:appuser core ./core
COPY --chown=appuser:appuser simulation ./simulation
COPY --chown=appuser:appuser api ./api
COPY --chown=appuser:appuser dashboard ./dashboard

USER appuser

EXPOSE 8000 8501

# Default command serves the API; docker-compose overrides it per service.
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
