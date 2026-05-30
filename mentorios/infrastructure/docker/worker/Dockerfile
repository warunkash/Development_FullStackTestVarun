# ============================================================
# MentorOS Worker — GPU-optimized Dockerfile
# ============================================================
FROM nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04 as base

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    python3.12 python3.12-pip python3.12-dev \
    ffmpeg \
    libgl1-mesa-glx libglib2.0-0 libsm6 libxext6 \
    libglib2.0-0 libgomp1 \
    build-essential curl git \
    && rm -rf /var/lib/apt/lists/*

RUN ln -sf /usr/bin/python3.12 /usr/bin/python && \
    ln -sf /usr/bin/pip3.12 /usr/bin/pip

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124 && \
    pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PYTHONPATH=/app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV CUDA_VISIBLE_DEVICES=0

CMD ["celery", "-A", "workers.celery_app", "worker", "-Q", "video,wisdom,embed", "-c", "1", "--loglevel=info"]
