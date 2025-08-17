# Настройка CI/CD для проекта

## Обзор

Этот документ описывает полную настройку CI/CD pipeline для автоматического деплоя проекта через арендованный сервер на домашний сервер с Docker.

## Архитектура

```
GitHub → GitHub Actions → WireGuard VPN → Домашний сервер (Docker)
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

#### WireGuard VPN и SSH

- `WIREGUARD_CONFIG` - конфигурация WireGuard для GitHub Actions
- `HOME_SERVER_VPN_IP` - IP домашнего сервера в VPN сети
- `SSH_PRIVATE_KEY` - приватный SSH ключ для подключения к домашнему серверу
- `HOME_SERVER_USER` - пользователь на домашнем сервере
- `PROJECT_PATH` - путь к проекту на домашнем сервере

**Примечание:** Переменные окружения (.env) хранятся на сервере, а не в GitHub Secrets.

### 3. Настройка домашнего сервера

```bash
# Создаем пользователя deploy
sudo adduser deploy
sudo usermod -aG docker deploy

# Настраиваем SSH ключи
mkdir -p /home/deploy/.ssh
# Добавьте публичный ключ GitHub Actions в authorized_keys

# Создаем директорию проекта
mkdir -p /home/deploy/projects/my-app

# Настраиваем WireGuard VPN
sudo apt-get install wireguard wireguard-tools
# Сгенерируйте ключи и настройте конфигурацию
```

### 4. Создание .env файла на сервере

```bash
# На домашнем сервере
cd /home/deploy/projects/my-app
cp env.example .env
nano .env  # отредактируйте переменные
```

### 5. Первый деплой

```bash
# Создайте тег для деплоя
git tag v1.0.0
git push origin v1.0.0
```

## Детальная настройка

### 1. Генерация SSH ключей

```bash
# Создаем ключ для GitHub Actions
ssh-keygen -t rsa -b 4096 -f ~/.ssh/github_actions_key -N ""

# Показываем публичный ключ (добавить на сервер)
cat ~/.ssh/github_actions_key.pub

# Показываем приватный ключ (для GitHub Secrets)
cat ~/.ssh/github_actions_key
```

### 2. Настройка WireGuard VPN

```bash
# На домашнем сервере
sudo apt-get install wireguard wireguard-tools
wg genkey | sudo tee /etc/wireguard/private.key
sudo cat /etc/wireguard/private.key | wg pubkey | sudo tee /etc/wireguard/public.key

# Создайте конфигурацию wg0.conf
# Сгенерируйте конфигурацию для GitHub Actions
```

### 3. Настройка переменных окружения

#### Создайте `.env` файл на сервере:

```bash
# На домашнем сервере
cd /home/deploy/projects/my-app
cp env.example .env
nano .env  # отредактируйте переменные

# Пример переменных:
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/myapp
POSTGRES_DB=myapp
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_WEBHOOK_URL=https://your-domain.com/webhook
REDIS_URL=redis://localhost:6379
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

При создании тега (например, `v1.0.0`):

1. Устанавливается WireGuard VPN
2. Выполняется деплой на сервер
3. Применяются миграции БД
4. Запускаются контейнеры

### Ручной деплой

```bash
# На домашнем сервере
cd /home/deploy/projects/my-app
./scripts/deploy.sh production
```

### Откат изменений

```bash
# Ручной откат
cd /home/deploy/projects/my-app
docker-compose down
cp -r ~/backups/YYYYMMDD_HHMMSS/* .
docker-compose up -d
```

## Мониторинг

### Логи деплоя

```bash
# Просмотр логов деплоя
tail -f ~/logs/deployments.log

# Просмотр логов контейнеров
docker-compose logs -f app
```

### Статус сервисов

```bash
# Статус контейнеров
docker-compose ps

# Использование ресурсов
docker stats

# Проверка работы приложения
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

- Используйте WireGuard VPN для подключения GitHub Actions к серверу
- Переменные окружения хранятся на сервере
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
tail -f ~/logs/deployments.log

# Проверьте статус контейнеров
docker-compose ps
docker-compose logs app

# Проверьте .env файл
ls -la .env
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
git pull origin release

# Перезапуск сервисов
docker-compose restart

# Остановка всех сервисов
docker-compose down

# Просмотр логов
docker-compose logs -f

# Очистка неиспользуемых образов
docker image prune -f

# Создание тега для деплоя
git tag v1.0.0
git push origin v1.0.0
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
   - Сервера: `~/logs/deployments.log`
   - Docker: `docker-compose logs`

2. **Проверьте подключения:**
   - WireGuard VPN: `sudo wg show`
   - SSH: `ssh user@server-ip "echo 'test'"`
   - База данных
   - Redis
   - Telegram API

3. **Проверьте конфигурацию:**
   - GitHub Secrets
   - .env файл на сервере
   - Docker Compose

4. **Выполните откат:**
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
