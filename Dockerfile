# Сборка
FROM node:22-alpine AS builder

WORKDIR /bot
COPY package.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

# Прод
FROM node:22-alpine

WORKDIR /bot
COPY package.json ./
RUN npm install --omit=dev --legacy-peer-deps

COPY --from=builder /bot/node_modules ./node_modules
COPY --from=builder /bot/dist ./dist

# Установка только production зависимостей
RUN bun install --production

# Открытие порта
EXPOSE 9000
CMD ["node", "dist/main.js"]
