FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json tsconfig.base.json ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

RUN npm install --workspaces --include-workspace-root

COPY shared ./shared
COPY backend ./backend

RUN npm run build --workspace=@ekiddy/shared && npm run build --workspace=@ekiddy/backend

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/shared/package.json ./shared/
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/backend/package.json ./backend/
COPY --from=builder /app/backend/dist ./backend/dist

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/api/health || exit 1

CMD ["node", "backend/dist/server.js"]
