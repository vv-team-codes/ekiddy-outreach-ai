FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json tsconfig.base.json ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

RUN npm install --workspaces --include-workspace-root

COPY shared ./shared
COPY frontend ./frontend

RUN npm run build --workspace=@ekiddy/shared && npm run build --workspace=@ekiddy/frontend

FROM nginx:alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:80/ || exit 1
