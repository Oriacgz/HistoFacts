FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV APP_MODULE="app.main:app"
ENV PORT="8000"

EXPOSE 8000 8001 8002 8003 8004 8005 8006

CMD uvicorn ${APP_MODULE} --host 0.0.0.0 --port ${PORT}
