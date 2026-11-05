FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-bookworm-slim
WORKDIR /app
ARG APP_VERSION=dev
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    DB_PATH=/data/study.sqlite \
    WEB_DIST=/app/dist/web \
    TZ=America/Argentina/Buenos_Aires \
    APP_VERSION=$APP_VERSION
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY core ./core
COPY modules ./modules
COPY --from=build /app/dist/web ./dist/web
USER 1000:1000
CMD ["node","core/server/main.ts"]
