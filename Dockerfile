# Build Stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy only package.json first (ignore local package-lock.json to ensure clean install)
COPY package.json ./

# Clean install - generate fresh package-lock.json inside container
RUN npm install --legacy-peer-deps

# Copy source code (excluding node_modules via .dockerignore)
COPY . .

# Ensure no local node_modules contamination
RUN rm -rf node_modules/.cache 2>/dev/null || true

# Build frontend and backend
# This runs "vite build" (client) and "esbuild" (server)
RUN npm run build:all

# Prune dev dependencies to keep image small
RUN npm prune --production

# Production Stage
FROM node:20-alpine

WORKDIR /app

# Copy built assets and dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Copy migrations and shared schemas required at runtime
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/shared ./shared

# Copy public folder for static assets if needed outside of dist/public
COPY --from=builder /app/public ./public

# Environment variables
ENV NODE_ENV=production
ENV PORT=10000
# DATABASE_URL should be provided at runtime via environment variable

EXPOSE 10000

# Start the application
CMD ["npm", "start"]
