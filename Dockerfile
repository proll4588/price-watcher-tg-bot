# Используем официальный образ Node.js
FROM node:20-alpine AS base

# Устанавливаем зависимости для сборки, Prisma и Puppeteer
RUN apk add --no-cache \
    libc6-compat \
    openssl \
    openssl-dev \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Создаем рабочую директорию
WORKDIR /app

# Копируем файлы зависимостей
COPY package*.json ./
COPY prisma ./prisma/

# Устанавливаем зависимости
RUN npm ci --only=production && npm cache clean --force

# Генерируем Prisma клиент для продакшна
RUN npx prisma generate --schema=./prisma/schema.prisma

# Создаем пользователя для безопасности
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Копируем исходный код
COPY . .

# Собираем приложение для продакшна
RUN npm run build:prod

# Создаем продакшн образ
FROM node:20-alpine AS runner

WORKDIR /app

# Устанавливаем зависимости для продакшна, Prisma и Puppeteer
RUN apk add --no-cache \
    libc6-compat \
    openssl \
    openssl-dev \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Создаем пользователя
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Копируем собранное приложение
COPY --from=base /app/dist ./dist
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package*.json ./
COPY --from=base /app/prisma ./prisma
COPY --from=base /app/tsconfig.json ./

# Меняем владельца файлов
RUN chown -R nodejs:nodejs /app

# Переключаемся на пользователя nodejs
USER nodejs

# Открываем порт
EXPOSE 3000

# Проверяем здоровье приложения
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node dist/health-check.js

# Запускаем приложение
CMD ["node", "dist/index.js"]
