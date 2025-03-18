# Базовый образ с зависимостями
FROM node:20-alpine AS deps
WORKDIR /bot
COPY package*.json ./
RUN npm i --omit=dev --legacy-peer-deps --prefer-offline

# Этап сборки
FROM node:20-alpine AS builder
WORKDIR /bot
RUN apk add --no-cache bash
COPY --from=deps /bot/node_modules ./node_modules
COPY . .
RUN npm run build

# Финальный образ
FROM node:20-alpine
WORKDIR /bot
COPY --from=builder /bot/node_modules ./node_modules
COPY --from=builder /bot/dist ./dist
COPY package*.json ./

EXPOSE 9000
CMD ["npm", "run", "start:prod"]