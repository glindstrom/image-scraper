FROM node:20-alpine

WORKDIR /app

# Copy workspace manifests so npm can resolve the monorepo
COPY package*.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

RUN npm install --workspace=backend --ignore-scripts

COPY backend/src ./backend/src

EXPOSE 3001

WORKDIR /app/backend

CMD ["node", "src/index.js"]
