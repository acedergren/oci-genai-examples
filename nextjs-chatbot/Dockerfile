# Next.js Chatbot Demo - Production Dockerfile
FROM node:22-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Enable corepack for pnpm
RUN corepack enable

# Copy workspace config
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
COPY packages/oci-genai-provider ./packages/oci-genai-provider
COPY examples/nextjs-chatbot ./examples/nextjs-chatbot

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build stage
FROM base AS builder
RUN corepack enable
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/examples/nextjs-chatbot ./examples/nextjs-chatbot
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=deps /app/pnpm-lock.yaml ./pnpm-lock.yaml

# Build the provider
RUN pnpm build --filter @acedergren/oci-genai-provider

# Build Next.js app
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build --filter nextjs-chatbot-demo

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 -G nodejs

# Copy standalone build
COPY --from=builder /app/examples/nextjs-chatbot/.next/standalone ./
COPY --from=builder /app/examples/nextjs-chatbot/.next/static ./examples/nextjs-chatbot/.next/static
COPY --from=builder /app/examples/nextjs-chatbot/public ./examples/nextjs-chatbot/public

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "examples/nextjs-chatbot/server.js"]
