FROM oven/bun:latest
WORKDIR /bot

# Копирование package.json и lockfile
COPY package*.json ./
COPY bun.lockb ./

# Установка зависимостей
RUN bun install

# Копирование всего проекта
COPY . .

# Сборка приложения
RUN bun run build

# Установка только production зависимостей
RUN bun install --production

# Открытие порта
EXPOSE 9000

# Запуск приложения
CMD ["bun", "dist/main.js"]