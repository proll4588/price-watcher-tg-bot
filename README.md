# Price Watcher Bot 🤖

Telegram-бот для отслеживания цен на товары с маркетплейсов Ozon, Wildberries и других.

> **🚀 Быстрый старт:** [QUICK_START.md](QUICK_START.md) | **📚 Документация:** [docs/README.md](docs/README.md)

## 🎯 Возможности

- **Отслеживание цен** на товары с Ozon, Wildberries
- **Автоматические уведомления** при изменении цены
- **Фильтры цен** (минимальная/максимальная цена, процент скидки)
- **Партнерские ссылки** для монетизации
- **Pro-подписка** с расширенными возможностями
- **Веб-интерфейс** для мониторинга и управления
- **CI/CD Pipeline** с автоматическим деплоем
- **Мониторинг** с Grafana и Prometheus

## 🏗️ Архитектура

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Telegram Bot  │    │   HTTP Server   │    │   Queue Workers │
│                 │    │                 │    │                 │
│ • Commands      │    │ • Health Check  │    │ • Price Checker │
│ • Callbacks     │    │ • Metrics       │    │ • Notifier      │
│ • Notifications │    │ • Webhooks      │    │ • Scheduler     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   PostgreSQL    │
                    │                 │
                    │ • Users         │
                    │ • Products      │
                    │ • Tracks        │
                    │ • Notifications │
                    └─────────────────┘
                                 │
                    ┌─────────────────┐
                    │     Redis       │
                    │                 │
                    │ • Queues        │
                    │ • Cache         │
                    │ • Rate Limiting │
                    └─────────────────┘
```

## 🚀 Быстрый старт

### Предварительные требования

- Node.js 18+
- PostgreSQL 13+
- Redis 6+
- Docker & Docker Compose
- Telegram Bot Token

### 1. Клонирование и установка

```bash
git clone <repository-url>
cd my-app
npm install
```

### 2. Настройка окружения

#### Автоматическая настройка (рекомендуется)

```bash
./scripts/setup-env.sh
```

#### Ручная настройка

```bash
cp env.example .env
```

Отредактируйте `.env` файл:

```env
# Основные настройки
NODE_ENV=production
PORT=3000

# База данных
DATABASE_URL=postgresql://username:password@localhost:5432/myapp
POSTGRES_DB=myapp
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password

# Telegram Bot
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_WEBHOOK_URL=https://your-domain.com/webhook

# Redis
REDIS_URL=redis://localhost:6379

# Мониторинг
GRAFANA_ADMIN_PASSWORD=admin_password
PROMETHEUS_PASSWORD=prometheus_password
```

### 3. Настройка базы данных

```bash
# Генерация Prisma клиента
npm run db:generate

# Создание миграций
npm run db:migrate

# (Опционально) Просмотр базы данных
npm run db:studio
```

### 4. Запуск приложения

#### Разработка

```bash
# Основное приложение
npm run dev

# Воркеры (в отдельных терминалах)
npm run queue:worker
npm run queue:notify
```

#### Продакшн с Docker (рекомендуется)

```bash
# Запуск всех сервисов
docker-compose up -d

# Просмотр логов
docker-compose logs -f

# Остановка
docker-compose down
```

#### Продакшн без Docker

```bash
# Сборка
npm run build

# Запуск
npm start
```

## 📋 Команды бота

| Команда         | Описание                          |
| --------------- | --------------------------------- |
| `/start`        | Запуск бота и основная информация |
| `/add <ссылка>` | Добавить товар для отслеживания   |
| `/list`         | Список отслеживаемых товаров      |
| `/remove <ID>`  | Удалить товар из отслеживания     |
| `/settings`     | Настройки аккаунта                |
| `/pro`          | Информация о Pro-подписке         |
| `/help`         | Справка по командам               |

## 💰 Тарифы

### 🆓 Бесплатный

- До 3 товаров
- Проверка каждые 6 часов
- Базовые уведомления

### ⭐️ Pro (99₽/мес)

- До 50 товаров
- Проверка каждые 2 часа
- Расширенные фильтры цен
- Приоритетная поддержка
- Экспорт данных
- Партнерские ссылки

## 🔧 API Endpoints

### Health Check

```
GET /health
```

### Метрики Prometheus

```
GET /metrics
```

### Статистика системы

```
GET /api/stats
```

### Webhook Telegram (если используется)

```
POST /webhook
```

## 🚀 CI/CD Pipeline

Проект настроен с автоматическим CI/CD pipeline через GitHub Actions:

### Автоматический деплой

- **Деплой** при создании тега (например, `v1.0.0`)
- **Health Check** после деплоя
- **Автоматический откат** при ошибках

### Архитектура деплоя

```
GitHub → GitHub Actions → Арендованный сервер → VPN → Домашний сервер (Docker)
```

### Настройка CI/CD

Подробные инструкции по настройке:

- [📚 Полная документация](docs/README.md)
- [Настройка CI/CD](docs/CI_CD_SETUP.md)
- [Настройка окружения](docs/ENVIRONMENT_SETUP.md)
- [🔐 **Настройка GitHub Secrets**](docs/GITHUB_SECRETS_SETUP.md) - **Пошаговая настройка SSH ключей и секретов**
- [🔧 **SSH Troubleshooting**](docs/SSH_TROUBLESHOOTING.md) - **Устранение проблем с SSH подключениями**
- [🔧 **WireGuard Setup**](docs/WIREGUARD_SETUP.md) - **Настройка WireGuard VPN для CI/CD**

## 🏗️ Структура проекта

```
src/
├── bot/                 # Telegram бот
│   ├── commands/        # Команды бота
│   ├── handlers/        # Обработчики событий
│   └── index.ts         # Основной файл бота
├── config/              # Конфигурация
│   └── index.ts
├── providers/           # Провайдеры маркетплейсов
│   ├── base.ts          # Базовый класс провайдера
│   ├── ozon.ts          # Провайдер Ozon
│   ├── wildberries.ts   # Провайдер Wildberries
│   └── manager.ts       # Менеджер провайдеров
├── services/            # Бизнес-логика
│   ├── database.ts      # Работа с БД
│   └── queue.ts         # Работа с очередями
├── types/               # TypeScript типы
│   └── index.ts
├── utils/               # Утилиты
│   ├── logger.ts        # Логирование
│   └── formatters.ts    # Форматирование
├── workers/             # Воркеры очередей
│   ├── price-checker.ts # Проверка цен
│   └── notifier.ts      # Отправка уведомлений
└── index.ts             # Точка входа

scripts/
├── setup-env.sh         # Скрипт настройки окружения
└── deploy.sh            # Скрипт деплоя

.github/
└── workflows/
    └── deploy.yml       # GitHub Actions workflow

docs/
├── README.md            # 📚 Главная страница документации
├── CI_CD_SETUP.md       # Настройка CI/CD
├── ENVIRONMENT_SETUP.md # Настройка окружения
└── GITHUB_SECRETS_SETUP.md # Настройка GitHub Secrets
```

## 🔌 Провайдеры

### Ozon

- Поддерживаемые URL: `ozon.ru`, `ozon.com`
- Формат: `https://www.ozon.ru/product/123456789/`

### Wildberries

- Поддерживаемые URL: `wildberries.ru`, `wildberries.com`
- Формат: `https://www.wildberries.ru/catalog/12345678/detail.aspx`

## 📊 Мониторинг

### Логирование

- Структурированные логи с Pino
- Разные уровни для разных компонентов
- Ротация логов
- Логи деплоя в `/var/log/deployments/`

### Метрики

- **Prometheus** метрики на порту 9090
- **Grafana** дашборды на порту 3001
- Мониторинг очередей
- Статистика пользователей

### Health Checks

- Автоматическая проверка здоровья приложения
- Мониторинг базы данных и Redis
- Уведомления о проблемах

### Алерты

- Sentry для отслеживания ошибок
- Уведомления о критических проблемах
- Автоматический откат при сбоях

## 🚀 Развертывание

### Docker Compose (рекомендуется)

```yaml
version: "3.8"

services:
  app:
    build: .
    ports:
      - "${PORT:-3000}:3000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
      - TELEGRAM_WEBHOOK_URL=${TELEGRAM_WEBHOOK_URL}
      - REDIS_URL=${REDIS_URL}
      - NODE_ENV=${NODE_ENV:-production}
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB=${POSTGRES_DB:-myapp}
      - POSTGRES_USER=${POSTGRES_USER:-postgres}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD}
    volumes:
      - grafana_data:/var/lib/grafana
    restart: unless-stopped

  prometheus:
    image: prom/prometheus:latest
    environment:
      - BASIC_AUTH_USERNAME=admin
      - BASIC_AUTH_PASSWORD=${PROMETHEUS_PASSWORD}
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    restart: unless-stopped

volumes:
  postgres_data:
  grafana_data:
  prometheus_data:
```

### Запуск

```bash
# Запуск всех сервисов
docker-compose up -d

# Просмотр логов
docker-compose logs -f

# Остановка
docker-compose down
```

### Ручной деплой

```bash
# На сервере
cd /path/to/project
./scripts/deploy.sh production
```

## 🔒 Безопасность

- Валидация входных данных с Zod
- Rate limiting для API
- CORS настройки
- Helmet для HTTP заголовков
- Безопасное хранение токенов

## 🤝 Разработка

### Установка зависимостей для разработки

```bash
npm install
```

### Линтинг и форматирование

```bash
npm run lint
npm run format
```

### Тестирование

```bash
npm test
```

### Миграции базы данных

```bash
# Создание новой миграции
npm run db:migrate

# Откат миграции
npm run db:migrate:reset
```

### Настройка окружения для разработки

```bash
# Автоматическая настройка
./scripts/setup-env.sh

# Или ручная настройка
cp env.example .env
# Отредактируйте .env файл
```

### Локальный запуск с Docker

```bash
# Запуск всех сервисов
docker-compose up -d

# Просмотр логов
docker-compose logs -f app

# Остановка
docker-compose down
```

## 📝 Лицензия

MIT License

## 🤝 Поддержка

Если у вас есть вопросы или проблемы:

1. Создайте Issue в репозитории
2. Обратитесь в Telegram: @support_username
3. Проверьте документацию:
   - [📚 Полная документация](docs/README.md)
   - [Настройка CI/CD](docs/CI_CD_SETUP.md)
   - [Настройка окружения](docs/ENVIRONMENT_SETUP.md)
   - [Настройка GitHub Secrets](docs/GITHUB_SECRETS_SETUP.md)

### Устранение неполадок

#### Проблемы с деплоем

```bash
# Проверьте логи GitHub Actions
# Проверьте логи на сервере
tail -f /var/log/deployments/my-app.log

# Проверьте статус контейнеров
docker-compose ps
docker-compose logs app
```

#### Проблемы с окружением

```bash
# Проверьте переменные окружения
docker-compose config

# Проверьте подключение к БД
docker-compose exec app npx prisma db push

# Проверьте health check
curl http://localhost:3000/health
```

## 🚀 Roadmap

### В разработке

- [ ] Поддержка Яндекс.Маркет
- [ ] Поддержка AliExpress
- [ ] Веб-интерфейс для управления
- [ ] Мобильное приложение

### Планируется

- [ ] Интеграция с платежными системами
- [ ] Аналитика и отчеты
- [ ] API для внешних интеграций
- [ ] Blue-Green деплой
- [ ] Автоматические теги версий
- [ ] Уведомления о деплое в Telegram

### Завершено ✅

- [x] CI/CD Pipeline с GitHub Actions
- [x] Автоматический деплой через VPN
- [x] Мониторинг с Grafana и Prometheus
- [x] Автоматический откат при ошибках
- [x] Безопасное управление секретами
