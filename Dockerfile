FROM node:20-alpine

RUN apk add --no-cache bash netcat-openbsd

WORKDIR /bot

COPY package*.json ./
RUN npm install --production --legacy-peer-deps

COPY . .

RUN npm run build

EXPOSE 9000

CMD ["npm", "run", "start:prod"]
