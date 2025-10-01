# Multi-stage build for Telegram Wiki Bot
FROM node:20-alpine AS base
WORKDIR /app

# Install production dependencies separately for smaller runtime image
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM base AS builder
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=8080

# Copy production dependencies and compiled output
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json package-lock.json ./
COPY .env.example ./

EXPOSE 8080

CMD ["node", "dist/index.js"]
