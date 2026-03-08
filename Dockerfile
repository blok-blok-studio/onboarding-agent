# ── Build stage ────────────────────────────────────
FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# ── Production stage ──────────────────────────────
FROM node:20-slim
WORKDIR /app

# Non-root user for security
RUN groupadd -r onboarding && useradd -r -g onboarding onboarding

# Copy deps from build stage
COPY --from=deps /app/node_modules ./node_modules

# Copy app source
COPY . .

# Set ownership
RUN chown -R onboarding:onboarding /app

USER onboarding

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 3000) + '/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

EXPOSE 3000

CMD ["node", "src/api/server.js"]
