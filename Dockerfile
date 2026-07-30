FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
    && rm -rf /var/lib/apt/lists/*

# Binario standalone de yt-dlp (incluye su propio Python empaquetado, no depende del sistema).
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY activity/package.json activity/package-lock.json ./activity/
RUN npm --prefix activity ci

COPY . .
RUN npm --prefix activity run build

ENV YTDLP_PATH=/usr/local/bin/yt-dlp
ENV NODE_ENV=production

CMD ["node", "index.js"]
