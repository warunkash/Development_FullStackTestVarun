# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS production

RUN apk add --no-cache dumb-init

WORKDIR /app

# Create non-root user
RUN addgroup -S ecnt && adduser -S ecnt -G ecnt

COPY --from=builder --chown=ecnt:ecnt /app/node_modules ./node_modules
COPY --from=builder --chown=ecnt:ecnt /app/dist ./dist
COPY --from=builder --chown=ecnt:ecnt /app/package.json ./

USER ecnt

EXPOSE 3005

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:3005/api/v1/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main"]
