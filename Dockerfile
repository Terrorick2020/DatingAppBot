FROM node:20-alpine AS deps
WORKDIR /bot

RUN npm install -g @nestjs/cli@latest

COPY package*.json ./
RUN npm install --legacy-peer-deps --prefer-offline

FROM node:20-alpine AS builder
WORKDIR /bot
COPY --from=deps /bot/node_modules ./node_modules
COPY . . 
RUN npm install -g @nestjs/cli
RUN npm run build

FROM node:20-alpine
WORKDIR /bot
COPY --from=builder /bot/dist ./dist
COPY --from=builder /bot/node_modules ./node_modules
COPY package*.json ./

RUN npm install --omit=dev --prefer-offline

EXPOSE 3001
CMD ["node", "dist/main.js"]
