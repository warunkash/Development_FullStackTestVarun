# ---- Build Stage ----
FROM node:20-alpine AS builder

WORKDIR /app

# Install build tools
RUN apk add --no-cache python3 make g++

# Copy package files and install deps
COPY package*.json ./
RUN npm ci --only=production

# Copy source and build
COPY . .
RUN npm run build

# ---- Production Stage ----
FROM node:20-alpine AS production

WORKDIR /app

# Security: non-root user
RUN addgroup -S ecnt && adduser -S ecnt -G ecnt

# Copy built artifacts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Set ownership
RUN chown -R ecnt:ecnt /app
USER ecnt

# HTTP healthcheck on REST port
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3004/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# REST API port
EXPOSE 3004

# OCPP WebSocket port
EXPOSE 9000

ENV NODE_ENV=production
ENV PORT=3004
ENV WS_PORT=9000

CMD ["node", "dist/main"]
