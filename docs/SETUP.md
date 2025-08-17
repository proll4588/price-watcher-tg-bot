# 🚀 Настройка и запуск Price Watcher Bot

## 📋 Быстрый старт

### 1. Предварительные требования

Убедитесь, что у вас установлены:

- **Node.js** 18+
- **npm** или **yarn**
- **Docker** и **Docker Compose** (для контейнеризации)
- **PostgreSQL** 13+ (для локальной разработки)
- **Redis** 6+ (для локальной разработки)

### 2. Клонирование проекта

```bash
git clone <repository-url>
cd price-watcher-bot
```

### 3. Установка зависимостей

```bash
npm install
```

### 4. Настройка переменных окружения

```bash
# Копируем пример файла
cp env.example .env

# Редактируем файл
nano .env
```

**Обязательные переменные:**

```env
# Telegram Bot Token (получите у @BotFather)
TELEGRAM_BOT_TOKEN=your_bot_token_here

# База данных
DATABASE_URL="postgresql://username:password@localhost:5432/price_watcher"

# Redis
REDIS_URL=redis://localhost:6379

# Настройки сервера
PORT=3000
NODE_ENV=development
```

### 5. Настройка базы данных

```bash
# Генерация Prisma клиента
npm run db:generate

# Создание миграций
npm run db:migrate

# (Опционально) Просмотр базы данных
npm run db:studio
```

### 6. Запуск в режиме разработки

```bash
# Основное приложение
npm run dev

# В отдельном терминале - воркер проверки цен
npm run queue:worker

# В отдельном терминале - воркер уведомлений
npm run queue:notify
```

## 🐳 Запуск с Docker

### 1. Сборка и запуск

```bash
# Сборка и запуск всех сервисов
docker-compose up -d

# Просмотр логов
docker-compose logs -f app

# Проверка статуса
docker-compose ps
```

### 2. Инициализация базы данных

```bash
# Создание миграций
docker-compose exec app npm run db:migrate

# Генерация Prisma клиента
docker-compose exec app npm run db:generate
```

### 3. Проверка работоспособности

```bash
# Проверка здоровья приложения
curl http://localhost:3000/health

# Проверка метрик
curl http://localhost:3000/metrics

# Проверка статистики
curl http://localhost:3000/api/stats
```

## 🔧 Настройка Telegram бота

### 1. Создание бота

1. Откройте Telegram и найдите @BotFather
2. Отправьте команду `/newbot`
3. Следуйте инструкциям для создания бота
4. Сохраните полученный токен

### 2. Настройка webhook (опционально)

Если вы используете webhook вместо polling:

```bash
# Установите webhook URL
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{"url": "https://your-domain.com/webhook"}'
```

### 3. Тестирование бота

1. Найдите вашего бота в Telegram
2. Отправьте команду `/start`
3. Отправьте ссылку на товар с Wildberries

## 📊 Мониторинг

### 1. Prometheus

Откройте http://localhost:9090 для просмотра метрик Prometheus.

### 2. Grafana

Откройте http://localhost:3001 для просмотра дашбордов Grafana:

- Логин: `admin`
- Пароль: `admin`

### 3. Логи

```bash
# Логи приложения
docker-compose logs app

# Логи воркеров
docker-compose logs price-checker
docker-compose logs notifier

# Логи базы данных
docker-compose logs postgres

# Логи Redis
docker-compose logs redis
```

## 🛠️ Разработка

### 1. Структура проекта

```
src/
├── bot/           # Telegram бот
├── providers/     # Провайдеры маркетплейсов
├── services/      # Бизнес-логика
├── workers/       # Воркеры очередей
├── utils/         # Утилиты
└── index.ts       # Точка входа
```

### 2. Добавление нового провайдера

1. Создайте новый файл в `src/providers/`
2. Наследуйтесь от `BaseProvider`
3. Реализуйте все абстрактные методы
4. Добавьте провайдер в `ProviderManager`

### 3. Тестирование

```bash
# Запуск тестов
npm test

# Линтинг
npm run lint

# Форматирование кода
npm run format
```

## 🔒 Безопасность

### 1. Переменные окружения

- Никогда не коммитьте `.env` файл
- Используйте разные токены для разработки и продакшна
- Регулярно обновляйте токены

### 2. База данных

- Используйте сильные пароли
- Ограничьте доступ к базе данных
- Регулярно создавайте резервные копии

### 3. API

- Настройте rate limiting
- Используйте HTTPS в продакшне
- Мониторьте подозрительную активность

## 🚀 Продакшн развертывание

### 1. Подготовка сервера

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Установка Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 2. Настройка SSL

```bash
# Установка Certbot
sudo apt install certbot python3-certbot-nginx

# Получение SSL сертификата
sudo certbot --nginx -d your-domain.com
```

### 3. Настройка Nginx

Создайте конфигурацию Nginx (см. `nginx/nginx.conf`)

### 4. Запуск в продакшне

```bash
# Установка переменных окружения
export NODE_ENV=production
export TELEGRAM_BOT_TOKEN=your_production_token

# Запуск с Docker Compose
docker-compose -f docker-compose.yml up -d
```

## 📝 Полезные команды

### Docker

```bash
# Перезапуск сервиса
docker-compose restart app

# Просмотр логов в реальном времени
docker-compose logs -f

# Остановка всех сервисов
docker-compose down

# Очистка неиспользуемых ресурсов
docker system prune -f
```

### База данных

```bash
# Создание резервной копии
docker-compose exec postgres pg_dump -U price_watcher price_watcher > backup.sql

# Восстановление из резервной копии
docker-compose exec -T postgres psql -U price_watcher price_watcher < backup.sql

# Сброс базы данных
npm run db:migrate:reset
```

### Мониторинг

```bash
# Проверка использования ресурсов
docker stats

# Проверка состояния сервисов
docker-compose ps

# Проверка сети
docker network ls
```

## 🆘 Устранение неполадок

### Частые проблемы

1. **Бот не отвечает**
    - Проверьте токен бота
    - Проверьте логи приложения
    - Убедитесь, что webhook настроен правильно

2. **Ошибки базы данных**
    - Проверьте подключение к PostgreSQL
    - Убедитесь, что миграции выполнены
    - Проверьте права доступа

3. **Ошибки Redis**
    - Проверьте подключение к Redis
    - Убедитесь, что Redis запущен
    - Проверьте конфигурацию

4. **Провайдеры не работают**
    - Проверьте feature flags в конфигурации
    - Проверьте логи провайдеров
    - Убедитесь, что сайты доступны

### Получение помощи

1. Проверьте логи: `docker-compose logs`
2. Проверьте документацию в `/docs`
3. Создайте Issue в репозитории
4. Обратитесь в Telegram: @support_username
