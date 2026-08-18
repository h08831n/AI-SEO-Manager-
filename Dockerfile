# Multi-stage Dockerfile for AI SEO Operating System (API + Worker)
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json bun.lock* ./
RUN npm install

# Copy source code and Prisma schema
COPY . .

# Generate Prisma Client bindings
RUN npx prisma generate

# Build Frontend & Backend Bundles (server.cjs and worker.cjs)
RUN npm run build

# -----------------------------------------------------------------------------
# Production Runner Image
# -----------------------------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install only production dependencies
COPY package.json ./
RUN npm install --omit=dev

# Copy generated Prisma schema and client
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy compiled artifacts from builder
COPY --from=builder /app/dist ./dist

# Expose standard API port
EXPOSE 3000

# Default command starts the API service
CMD ["npm", "run", "start:api"]
