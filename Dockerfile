# syntax=docker/dockerfile:1

# ============================================================================
# ROSA — Released Objects Search Assistant
# Multi-stage, multi-arch (linux/amd64, linux/arm64) container image.
# Docker = server usage, so the container runs the HTTP transport.
# ============================================================================

FROM node:22 AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY sap_abbreviation_dictionary.json ./

RUN npm run build && npm prune --omit=dev

FROM node:22-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV TRANSPORT=http
ENV PORT=3001

# node:22-slim ships a non-root `node` user; run as it.
USER node

COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/sap_abbreviation_dictionary.json ./

EXPOSE 3001

# Pure-node health check (no wget/curl dependency on the slim base).
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD node -e "require('http').get('http://localhost:'+(process.env.PORT||3001)+'/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "dist/index.js"]
