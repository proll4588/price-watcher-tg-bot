# Настройка окружения

## Обзор

Этот документ описывает, как настроить переменные окружения для безопасного деплоя проекта в Git без раскрытия секретных данных.

## Структура файлов окружения

```
.env.example          # Шаблон с примерами (в Git)
.env                  # Реальные значения (НЕ в Git)
.env.production       # Продакшн значения (НЕ в Git)
.env.staging          # Стейджинг значения (НЕ в Git)
```

## Быстрая настройка

### 1. Клонирование репозитория

```bash
git clone <your-repo-url>
cd my-app
```

### 2. Создание файла окружения

```bash
cp .env.example .env
```

### 3. Редактирование переменных

Откройте `.env` файл и замените все значения на реальные:

```bash
# Database
DATABASE_URL="postgresql://myuser:mypassword@localhost:5432/myapp"
POSTGRES_DB="myapp"
POSTGRES_USER="postgres"
POSTGRES_PASSWORD="your_secure_password"

# Telegram Bot
TELEGRAM_BOT_TOKEN="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
TELEGRAM_WEBHOOK_URL="https://your-domain.com/webhook"

# Redis
REDIS_URL="redis://localhost:6379"

# App settings
NODE_ENV="production"
PORT="3000"

# Monitoring
GRAFANA_ADMIN_PASSWORD="my_secure_password"
PROMETHEUS_PASSWORD="my_prometheus_password"
```

### 4. Запуск приложения

```bash
docker-compose up -d
```

## Переменные окружения

### Основные настройки приложения

| Переменная | Описание             | Пример                      | Обязательная            |
| ---------- | -------------------- | --------------------------- | ----------------------- |
| `NODE_ENV` | Окружение приложения | `production`, `development` | Да                      |
| `PORT`     | Порт для приложения  | `3000`                      | Нет (по умолчанию 3000) |

### База данных

| Переменная          | Описание                               | Пример                                     | Обязательная |
| ------------------- | -------------------------------------- | ------------------------------------------ | ------------ |
| `DATABASE_URL`      | Полная строка подключения к PostgreSQL | `postgresql://user:pass@localhost:5432/db` | Да           |
| `POSTGRES_DB`       | Имя базы данных                        | `myapp`                                    | Нет          |
| `POSTGRES_USER`     | Пользователь PostgreSQL                | `postgres`                                 | Нет          |
| `POSTGRES_PASSWORD` | Пароль PostgreSQL                      | `secure_password`                          | Да           |

### Telegram Bot

| Переменная             | Описание                 | Пример                                  | Обязательная |
| ---------------------- | ------------------------ | --------------------------------------- | ------------ |
| `TELEGRAM_BOT_TOKEN`   | Токен бота от @BotFather | `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz` | Да           |
| `TELEGRAM_WEBHOOK_URL` | URL для webhook          | `https://your-domain.com/webhook`       | Да           |

### Redis

| Переменная  | Описание                | Пример                   | Обязательная |
| ----------- | ----------------------- | ------------------------ | ------------ |
| `REDIS_URL` | URL подключения к Redis | `redis://localhost:6379` | Нет          |

### Мониторинг

| Переменная               | Описание                      | Пример                | Обязательная |
| ------------------------ | ----------------------------- | --------------------- | ------------ |
| `GRAFANA_ADMIN_PASSWORD` | Пароль администратора Grafana | `admin_password`      | Нет          |
| `PROMETHEUS_PASSWORD`    | Пароль для Prometheus         | `prometheus_password` | Нет          |

## Настройка для разных окружений

### Разработка (Development)

```bash
# .env
NODE_ENV=development
DATABASE_URL=postgresql://dev_user:dev_pass@localhost:5432/myapp_dev
TELEGRAM_BOT_TOKEN=your_dev_bot_token
```

### Стейджинг (Staging)

```bash
# .env.staging
NODE_ENV=staging
DATABASE_URL=postgresql://staging_user:staging_pass@staging-db:5432/myapp_staging
TELEGRAM_BOT_TOKEN=your_staging_bot_token
```

### Продакшн (Production)

```bash
# .env.production
NODE_ENV=production
DATABASE_URL=postgresql://prod_user:prod_pass@prod-db:5432/myapp_prod
TELEGRAM_BOT_TOKEN=your_prod_bot_token
```

## Получение Telegram Bot Token

1. Найдите @BotFather в Telegram
2. Отправьте команду `/newbot`
3. Следуйте инструкциям для создания бота
4. Скопируйте полученный токен в `TELEGRAM_BOT_TOKEN`

## Настройка базы данных

### Локальная разработка

```bash
# PostgreSQL должен быть запущен локально или в Docker
DATABASE_URL="postgresql://postgres:password@localhost:5432/myapp"
```

### Продакшн

```bash
# Используйте реальные данные вашего сервера
DATABASE_URL="postgresql://prod_user:prod_password@prod-server:5432/myapp_prod"
```

## Проверка настроек

### Тест подключения к базе данных

```bash
# Проверка подключения к PostgreSQL
psql $DATABASE_URL -c "SELECT version();"
```

### Тест Telegram Bot

```bash
# Проверка токена бота
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getMe"
```

### Тест Redis

```bash
# Проверка подключения к Redis
redis-cli -u $REDIS_URL ping
```

## Безопасность

### ✅ Что делать

- Используйте `.env` файлы для локальной разработки
- Добавляйте `.env` в `.gitignore`
- Используйте GitHub Secrets для CI/CD
- Регулярно обновляйте пароли
- Используйте сложные пароли

### ❌ Что НЕ делать

- Не коммитьте `.env` файлы в Git
- Не используйте простые пароли
- Не передавайте токены в открытом виде
- Не храните секреты в коде

## CI/CD настройка

### GitHub Actions

В настройках репозитория (`Settings → Secrets and variables → Actions`) добавьте:

```
DATABASE_URL
TELEGRAM_BOT_TOKEN
POSTGRES_PASSWORD
GRAFANA_ADMIN_PASSWORD
PROMETHEUS_PASSWORD
```

### Скрипт деплоя

```bash
#!/bin/bash
# deploy.sh

# Создаем .env файл на сервере
cat > .env << EOF
DATABASE_URL=$DATABASE_URL
TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
NODE_ENV=production
EOF

# Запускаем приложение
docker-compose up -d
```

## Устранение неполадок

### Ошибка подключения к базе данных

```bash
# Проверьте DATABASE_URL
echo $DATABASE_URL

# Проверьте доступность сервера
nc -zv your-db-host 5432
```

### Ошибка Telegram Bot

```bash
# Проверьте токен
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getMe"

# Проверьте webhook
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo"
```

### Ошибка Docker

```bash
# Проверьте логи
docker-compose logs app

# Пересоберите образы
docker-compose build --no-cache
```

## Полезные команды

```bash
# Создание .env из примера
cp .env.example .env

# Проверка переменных окружения
docker-compose config

# Запуск с определенным .env файлом
docker-compose --env-file .env.production up -d

# Остановка всех контейнеров
docker-compose down

# Просмотр логов
docker-compose logs -f app

# Обновление кода и перезапуск
git pull && docker-compose up -d --build
```

## Поддержка

При возникновении проблем:

1. Проверьте все переменные окружения
2. Убедитесь, что все сервисы доступны
3. Проверьте логи Docker контейнеров
4. Обратитесь к документации Docker Compose
