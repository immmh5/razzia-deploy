# ---- BASE ----
FROM node:26-alpine AS base
RUN npm install -g pnpm

# ---- BUILDER ----
FROM base AS builder
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/common/package.json ./packages/common/
COPY packages/web/package.json ./packages/web/
COPY packages/socket/package.json ./packages/socket/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

COPY . .

RUN pnpm build

# ---- RUNNER ----
FROM alpine:3.24.1 AS runner

RUN apk add --no-cache nginx nodejs supervisor npm

COPY docker/nginx.conf /etc/nginx/http.d/default.conf
COPY docker/supervisord.conf /etc/supervisord.conf

COPY --from=builder /app/packages/web/dist /app/web
COPY --from=builder /app/packages/socket/dist/index.cjs /app/socket/index.cjs

# The socket bundle keeps @libsql/client external because libsql loads a
# platform-specific native module at runtime. Installing it here lets npm pick
# the correct binary for this image's architecture (amd64/arm64, glibc/musl).
WORKDIR /app/socket
RUN npm install --no-save --omit=dev @libsql/client@0.15.15

WORKDIR /app

EXPOSE 3000

CMD ["supervisord", "-c", "/etc/supervisord.conf"]
