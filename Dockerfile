# Stage 1: Build the NestJS app
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
RUN npm run build

# Stage 2: Setup Nginx and run app
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app /app
COPY nginx.conf /etc/nginx/nginx.conf
RUN npm install --production

# Install nginx
RUN apk add --no-cache nginx

# Expose ports
EXPOSE 80
EXPOSE 3000

# Start both Nginx and NestJS app
CMD ["sh", "-c", "npm run start:prod & nginx -g 'daemon off;'"]
