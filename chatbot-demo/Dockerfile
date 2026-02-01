# SvelteKit Chatbot Demo - Production Dockerfile
FROM node:22-alpine AS builder

# Enable corepack for pnpm
RUN corepack enable

WORKDIR /app

# Copy workspace config and lock file
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./

# Copy the provider package
COPY packages/oci-genai-provider ./packages/oci-genai-provider

# Copy the demo
COPY examples/chatbot-demo ./examples/chatbot-demo

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build the provider first
RUN pnpm build --filter @acedergren/oci-genai-provider

# Build the SvelteKit app with Node adapter for Docker
ENV ADAPTER=node
RUN pnpm build --filter @acedergren/chatbot-demo

# Production stage
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Copy the built app
COPY --from=builder /app/examples/chatbot-demo/build ./build
COPY --from=builder /app/examples/chatbot-demo/package.json ./

# Copy node_modules (production dependencies)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/oci-genai-provider/dist ./packages/oci-genai-provider/dist
COPY --from=builder /app/packages/oci-genai-provider/package.json ./packages/oci-genai-provider/

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S sveltekit -u 1001 -G nodejs

USER sveltekit

EXPOSE 5173

# Start the SvelteKit server
CMD ["node", "build"]
