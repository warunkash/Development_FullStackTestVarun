# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production=false

# Copy source
COPY tsconfig*.json ./
COPY src ./src
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production

WORKDIR /app

# Create non-root user
RUN addgroup -S ecnt && adduser -S ecnt -G ecnt

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

# Change ownership
RUN chown -R ecnt:ecnt /app
USER ecnt

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/v1/health || exit 1

CMD ["node", "dist/main"]
