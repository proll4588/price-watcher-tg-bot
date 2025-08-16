# Настройка CI/CD для проекта

## Обзор

Этот документ описывает полную настройку CI/CD pipeline для автоматического деплоя проекта через арендованный сервер на домашний сервер с Docker.

## Архитектура

```
GitHub → GitHub Actions → Арендованный сервер → VPN → Домашний сервер (Docker)
```

## Быстрый старт

### 1. Подготовка репозитория

```bash
# Клонируйте репозиторий
git clone <your-repo-url>
cd my-app

# Настройте переменные окружения
./scripts/setup-env.sh

# Добавьте .env в .gitignore
echo ".env" >> .gitignore
```

### 2. Настройка GitHub Secrets

Перейдите в `Settings` → `Secrets and variables` → `Actions` и добавьте:

#### SSH подключение

- `SSH_PRIVATE_KEY` - приватный SSH ключ для арендованного сервера
- `JUMP_SERVER_HOST` - IP арендованного сервера
- `JUMP_SERVER_USER` - пользователь на арендованном сервере
- `HOME_SERVER_IP` - IP домашнего сервера в VPN
- `HOME_SERVER_USER` - пользователь на домашнем сервере
- `PROJECT_PATH` - путь к проекту на домашнем сервере

#### Переменные приложения

- `PORT` - порт приложения (3000)
- `DATABASE_URL` - строка подключения к PostgreSQL
- `TELEGRAM_BOT_TOKEN` - токен Telegram бота
- `TELEGRAM_WEBHOOK_URL` - URL для webhook

### 3. Настройка серверов

#### На арендованном сервере:

```bash
# Создаем пользователя deploy
sudo adduser deploy
sudo usermod -aG sudo deploy

# Настраиваем SSH ключи
mkdir -p /home/deploy/.ssh
# Добавьте публичный ключ GitHub Actions в authorized_keys
```

#### На домашнем сервере:

```bash
# Создаем пользователя deploy
sudo adduser deploy
sudo usermod -aG docker deploy

# Настраиваем SSH ключи
mkdir -p /home/deploy/.ssh
# Добавьте публичный ключ арендованного сервера в authorized_keys

# Создаем директорию проекта
mkdir -p /home/deploy/projects/my-app
```

### 4. Первый деплой

```bash
# Сделайте push в main ветку
git add .
git commit -m "Initial commit with CI/CD setup"
git push origin main
```

## Детальная настройка

### 1. Генерация SSH ключей

```bash
# Создаем ключ для GitHub Actions
ssh-keygen -t rsa -b 4096 -f ~/.ssh/github_actions_key -N ""

# Показываем публичный ключ
cat ~/.ssh/github_actions_key.pub

# Показываем приватный ключ (для GitHub Secrets)
cat ~/.ssh/github_actions_key
```

### 2. Настройка переменных окружения

#### Создайте `.env` файл:

```bash
# Основные настройки
NODE_ENV=production
PORT=3000

# База данных
DATABASE_URL=postgresql://user:password@localhost:5432/myapp
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

### 3. Настройка Docker Compose

Убедитесь, что ваш `docker-compose.yml` использует переменные окружения:

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
      - NODE_ENV=${NODE_ENV:-production}
    depends_on:
      - postgres
      - redis
```

## Работа с CI/CD

### Автоматический деплой

При каждом push в `main` ветку:

1. Запускаются тесты
2. Выполняется деплой на сервер
3. Применяются миграции БД
4. Выполняется health check

### Ручной деплой

```bash
# На домашнем сервере
cd /home/deploy/projects/my-app
./scripts/deploy.sh production
```

### Откат изменений

```bash
# Автоматический откат при ошибке health check
# Или ручной откат
cd /home/deploy/projects/my-app
docker-compose down
cp -r /backups/YYYYMMDD_HHMMSS/* .
docker-compose up -d
```

## Мониторинг

### Логи деплоя

```bash
# Просмотр логов деплоя
tail -f /var/log/deployments/my-app.log

# Просмотр логов контейнеров
docker-compose logs -f app
```

### Статус сервисов

```bash
# Статус контейнеров
docker-compose ps

# Использование ресурсов
docker stats

# Health check
curl http://localhost:3000/health
```

## Безопасность

### SSH ключи

- Используйте ключи длиной 4096 бит
- Регулярно обновляйте ключи
- Ограничивайте доступ по IP

### Переменные окружения

- Никогда не коммитьте `.env` файлы
- Используйте сложные пароли
- Регулярно обновляйте токены

### Сетевая безопасность

- Используйте VPN для подключения серверов
- Ограничивайте доступ к портам
- Настройте firewall

## Устранение неполадок

### Ошибка SSH подключения

```bash
# Проверьте права на ключи
chmod 600 ~/.ssh/id_rsa
chmod 644 ~/.ssh/id_rsa.pub

# Проверьте SSH конфигурацию
ssh -v user@server-ip
```

### Ошибка деплоя

```bash
# Проверьте логи GitHub Actions
# Проверьте логи на сервере
tail -f /var/log/deployments/my-app.log

# Проверьте статус контейнеров
docker-compose ps
docker-compose logs app
```

### Ошибка базы данных

```bash
# Проверьте подключение
psql $DATABASE_URL -c "SELECT version();"

# Проверьте миграции
docker-compose run --rm app npx prisma migrate status
```

### Ошибка Telegram Bot

```bash
# Проверьте токен
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getMe"

# Проверьте webhook
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo"
```

## Полезные команды

### Управление проектом

```bash
# Обновление кода
git pull origin main

# Перезапуск сервисов
docker-compose restart

# Остановка всех сервисов
docker-compose down

# Просмотр логов
docker-compose logs -f

# Очистка неиспользуемых образов
docker image prune -f
```

### Мониторинг

```bash
# Статус системы
htop
df -h
free -h

# Статус Docker
docker system df
docker ps -a
```

### Backup и восстановление

```bash
# Создание backup
tar -czf backup-$(date +%Y%m%d).tar.gz /home/deploy/projects/my-app

# Восстановление
tar -xzf backup-YYYYMMDD.tar.gz -C /
```

## Поддержка

При возникновении проблем:

1. **Проверьте логи:**
   - GitHub Actions
   - Сервера: `/var/log/deployments/my-app.log`
   - Docker: `docker-compose logs`

2. **Проверьте подключения:**
   - SSH между серверами
   - База данных
   - Redis
   - Telegram API

3. **Проверьте конфигурацию:**
   - GitHub Secrets
   - Переменные окружения
   - Docker Compose

4. **Выполните откат:**
   - Автоматический при ошибке health check
   - Ручной из backup при необходимости

## Дополнительные возможности

### Blue-Green деплой

Для нулевого времени простоя можно настроить blue-green деплой с двумя экземплярами приложения.

### Мониторинг с уведомлениями

Добавьте уведомления в Telegram при успешном/неуспешном деплое.

### Автоматические теги версий

Настройте автоматическое создание тегов при деплое в production.

### Резервное копирование

Настройте автоматическое резервное копирование базы данных перед деплоем.
