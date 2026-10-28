FROM python:3.12-slim
RUN pip install --no-cache-dir uv
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev
COPY . .
EXPOSE 5000
CMD ["uv", "run", "--no-sync", "gunicorn", "-w", "1", "--threads", "4", "-b", "0.0.0.0:5000", "app:app"]
