FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libjpeg62-turbo libwebp7 zlib1g \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Sin privilegios: si alguien explotara una falla (p. ej. al procesar una imagen) no sería root.
# UID/GID 1001 = usuario del servidor, dueño de backend/data/{fotos,flare} en el host.
RUN groupadd --gid 1001 app && useradd --uid 1001 --gid 1001 --no-create-home --shell /usr/sbin/nologin app
USER app

EXPOSE 8000

# --proxy-headers: usar X-Forwarded-Proto/For de Caddy (redirecciones a https e IP real).
# Solo se confía en las IPs de FORWARDED_ALLOW_IPS (variable de entorno que uvicorn lee).
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
