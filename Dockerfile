FROM node:20-alpine

RUN apk add --no-cache bash netcat-openbsd && \
    npm install -g @nestjs/cli

WORKDIR /bot

COPY package.json .

RUN npm install --omit=dev --legacy-peer-deps && \
    npm install --save-dev @types/node

COPY . .

RUN npm run build

EXPOSE 9000

CMD ["npm", "run", "start:prod"]
