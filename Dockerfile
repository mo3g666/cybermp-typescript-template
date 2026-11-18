FROM --platform=linux/amd64 node:22-slim AS builder

RUN npm install -g pnpm

WORKDIR /app

# Copy monorepo configuration and source files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY scripts ./scripts
COPY resources ./resources

RUN pnpm install --frozen-lockfile --ignore-scripts
RUN pnpm run build

# CyberMP official server image
FROM --platform=linux/amd64 ghcr.io/cyber-mp/server:latest

WORKDIR /cybermp

COPY --from=builder /app/resources /cybermp/resources
COPY server.toml /cybermp/server.toml
