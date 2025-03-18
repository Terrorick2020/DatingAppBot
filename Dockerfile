# Используем Node.js 20 на Alpine Linux
FROM node:20-alpine AS deps
WORKDIR /bot

# Устанавливаем глобально NestJS CLI
RUN npm install -g @nestjs/cli@latest

# Копируем package.json и устанавливаем зависимости
COPY package*.json ./
RUN npm install --legacy-peer-deps --omit=dev --prefer-offline

# Этап сборки
FROM node:20-alpine AS builder
WORKDIR /bot
COPY --from=deps /bot/node_modules ./node_modules
COPY . . 

# Финальный образ
FROM node:20-alpine
WORKDIR /bot
COPY --from=builder /bot/dist ./dist
COPY --from=builder /bot/node_modules ./node_modules
COPY package*.json ./

# Устанавливаем зависимости (если что-то потерялось при копировании)
RUN npm install --omit=dev --prefer-offline

# Открываем порт и запускаем бота
EXPOSE 3001
CMD ["node", "dist/main.js"]
