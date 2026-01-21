# Build Stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install
# Verified sync

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

# Create persistent data directory for SQLite
RUN mkdir -p /data
VOLUME ["/data"]

# Copy built assets and dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Copy migrations and shared schemas required at runtime
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/shared ./shared
# Copy public folder for static assets if needed outside of dist/public (though vite build puts them there)
# Note: vite build outputs to dist/public, which express serves. 
# We might need server specific public files if any, usually they go to dist or are copied.
# In this project, express serves 'public/uploads' from process.cwd()/public/uploads.
# We need to ensure that directory exists or is created.
COPY --from=builder /app/public ./public

# Environment variables
ENV NODE_ENV=production
ENV PORT=8000
# DATABASE_URL is not used, we use /data/database.sqlite defined in code

EXPOSE 8000

# Start the application
CMD ["npm", "start"]
