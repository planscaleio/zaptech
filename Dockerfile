# ─── Stage 1: build frontend ──────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build          # tsc -b && vite build → dist/


# ─── Stage 2: production runtime ──────────────────────────────────────────────
FROM node:22-alpine

WORKDIR /app

# Install deps (all — tsx + prisma CLI are devDeps but required at runtime)
COPY package*.json ./
RUN npm ci

# Frontend build output
COPY --from=builder /app/dist ./dist

# Server source & Prisma schema
COPY server       ./server
COPY prisma       ./prisma
COPY prisma.config.ts ./

# Generate Prisma client
RUN npx prisma generate

# Runtime config
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# On start: apply pending migrations, then boot the server.
# Set RUN_PRISMA_SEED=true only for a controlled first-time/bootstrap run.
CMD ["sh", "-c", "npx prisma migrate deploy && if [ \"$RUN_PRISMA_SEED\" = \"true\" ]; then npx prisma db seed; fi && npx tsx server/index.ts"]
