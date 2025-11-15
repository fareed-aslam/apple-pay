FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including dev dependencies for ts-node-dev)
RUN npm install

# Copy source code
COPY . .

# Build the application (for production)
RUN npm run build

# Default to production, but docker-compose will override with dev command
CMD ["npm", "start"]
