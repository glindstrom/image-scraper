# Stage 1: build
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/

RUN npm install --workspace=frontend --ignore-scripts

COPY frontend/ ./frontend/

# Provide an empty .env so loadEnv doesn't fail
RUN touch .env

WORKDIR /app/frontend

RUN npm run build

# Stage 2: serve
FROM nginx:alpine

COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
