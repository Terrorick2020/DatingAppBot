# Базовый образ с зависимостями
FROM node:20-alpine AS deps
WORKDIR /bot
COPY package*.json ./

# Установка Nest CLI и зависимостей
RUN npm install -g @nestjs/cli@latest && \
    npm ci --legacy-peer-deps --omit=dev

# Этап сборки
FROM node:20-alpine AS builder
WORKDIR /bot
COPY --from=deps /bot/node_modules ./node_modules
COPY . .
RUN npm run build

# Финальный образ
FROM node:20-alpine
WORKDIR /bot
COPY --from=builder /bot/dist ./dist
COPY --from=builder /bot/node_modules ./node_modules
COPY package*.json ./

EXPOSE 9000
CMD ["npm", "run", "start:prod"]