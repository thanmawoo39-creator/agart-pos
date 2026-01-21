# Build Stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

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
