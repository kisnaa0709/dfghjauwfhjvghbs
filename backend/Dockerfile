# Dockerfile  —  Step 5b of the Gridbricks backend
#
# A recipe for building a container image that runs the API.
# Each line is one step; Docker caches steps that haven't changed.

# 1. Start from an official small Python image (like `FROM node:20-slim`).
FROM python:3.13-slim

# 2. Don't write .pyc cache files, and print logs immediately (no buffering).
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# 3. All following commands run inside /app in the container.
WORKDIR /app

# 4. Install libraries FIRST, before copying our code. If only our code
#    changes, Docker reuses this cached layer and skips the slow install.
#    (Same trick as copying package.json before `npm install`.)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 5. Copy our code in.
COPY app ./app

# 6. Run as a normal user instead of root (safer).
RUN useradd --create-home gridbricks
USER gridbricks

# 7. The API listens on port 8000.
EXPOSE 8000

# 8. Docker can ping /api/health to know the server is ready.
#    Uses Python itself, because the slim image has no curl.
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')"

# 9. Start the server. 0.0.0.0 = accept connections from outside the container.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
