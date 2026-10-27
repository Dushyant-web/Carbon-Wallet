# Carbon Wallet engine (FastAPI) for Render. Slim Python + Tesseract for reading bill photos.
# same Python as local development and the tests
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

# English, Hindi and orientation models come from Debian's packages: backend/tessdata/*.traineddata is
# git-ignored, so a build from GitHub has no copy of it (app/bills/acquire.py then uses the system models)
RUN apt-get update \
 && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-eng tesseract-ocr-hin tesseract-ocr-osd libgl1 libglib2.0-0 \
 && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:0.8.17 /uv /usr/local/bin/uv

WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --extra postgres --no-install-project
COPY app ./app

# never run as root
RUN useradd --create-home --uid 10001 engine && chown -R engine /app
USER engine

EXPOSE 10000
# Render passes $PORT; one worker keeps memory low on the free instance
CMD ["sh", "-c", "/app/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000} --proxy-headers --forwarded-allow-ips='*'"]
