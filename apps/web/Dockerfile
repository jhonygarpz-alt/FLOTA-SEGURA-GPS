# FLOTA SEGURA GPS — Web (PWA). Contexto de construcción: raíz del repositorio.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci -w apps/web --include-workspace-root=false
COPY apps/web apps/web
ARG VITE_MAP_STYLE_URL
ARG VITE_MAP_STYLE_DARK_URL
ARG VITE_SATELLITE_STYLE_URL
RUN npm run build -w apps/web

FROM nginx:1.30-alpine
ENV PORT=8080 \
    API_UPSTREAM=http://api:3000
COPY apps/web/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
