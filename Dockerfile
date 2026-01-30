# Stage 1: Build the React frontend
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Create the production image
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
COPY server.js .

# Cloud Run injects the PORT environment variable.
# EXPOSE 3001
CMD ["node", "server.js"]
