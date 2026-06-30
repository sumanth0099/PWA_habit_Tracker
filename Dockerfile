FROM node:20-alpine

# Install curl for healthcheck
RUN apk add --no-cache curl

WORKDIR /app

# Copy backend dependency files first (layer caching)
COPY backend/package.json ./package.json

# Install production dependencies
RUN npm install --omit=dev

# Copy backend source code
COPY backend/server.js ./server.js

# Copy frontend static files so Express can serve them
COPY frontend/ ./frontend/

EXPOSE 3001

# Health check — calls the /health endpoint
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD curl -f http://localhost:3001/health || exit 1

CMD ["node", "server.js"]
