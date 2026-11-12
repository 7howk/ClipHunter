# Сборка: статические файлы SPA
FROM node:24.11.1-alpine3.22 AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
ARG VITE_API_MODE=hybrid
ARG VITE_MAX_UPLOAD_SIZE_MB=500
ARG VITE_MAX_VIDEO_DURATION_SECONDS=1800
ENV VITE_API_MODE=$VITE_API_MODE \
    VITE_MAX_UPLOAD_SIZE_MB=$VITE_MAX_UPLOAD_SIZE_MB \
    VITE_MAX_VIDEO_DURATION_SECONDS=$VITE_MAX_VIDEO_DURATION_SECONDS
RUN npm run build

# Раздача: nginx отдаёт SPA и проксирует /api в FastAPI, поэтому браузер
# работает с одним origin и CORS не нужен
FROM nginx:1.29.3-alpine3.22

ENV API_UPSTREAM=http://api:8000 \
    MAX_UPLOAD_SIZE_MB=500
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD wget --quiet --spider http://127.0.0.1/ || exit 1
