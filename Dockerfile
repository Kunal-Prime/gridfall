# Use Node.js LTS
FROM node:20-slim

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies including devDependencies (for tsx)
RUN npm install

# Copy source files
COPY . .

# Expose port (default 3000)
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Start the server using tsx
CMD ["npx", "tsx", "server.ts"]
