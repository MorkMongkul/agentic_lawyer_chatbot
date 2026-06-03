# backend/Dockerfile
FROM python:3.11-slim

# System deps (faiss / numpy build wheels need libgomp)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies first (layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code + prebuilt indexes
COPY . .

EXPOSE 8000

# Single worker — FAISS/BM25 globals are loaded per-process
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
