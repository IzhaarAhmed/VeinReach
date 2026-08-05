# ── VeinReach API ───────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
# Install only production deps. Prefer the lockfile (reproducible); fall back to
# a plain install if the lockfile is absent or out of sync.
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Run as the unprivileged 'node' user that ships with the base image.
COPY --chown=node:node --from=deps /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src

USER node
EXPOSE 5000

# Lightweight liveness probe against the health route.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||5000)+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]
