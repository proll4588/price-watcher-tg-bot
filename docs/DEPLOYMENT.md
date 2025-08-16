# 🚀 Инструкции по развертыванию Price Watcher Bot

## 📋 Предварительные требования

### Системные требования
- **CPU**: Минимум 2 ядра (рекомендуется 4+)
- **RAM**: Минимум 2GB (рекомендуется 4GB+)
- **Диск**: Минимум 10GB свободного места
- **ОС**: Linux (Ubuntu 20.04+, CentOS 8+), macOS, Windows

### Программное обеспечение
- **Docker**: 20.10+
- **Docker Compose**: 2.0+
- **Git**: Последняя версия

## 🔧 Локальное развертывание

### 1. Клонирование репозитория

```bash
git clone <repository-url>
cd price-watcher-bot
```

### 2. Настройка переменных окружения

```bash
# Копируем пример файла
cp env.example .env

# Редактируем файл
nano .env
```

Обязательные переменные:
```env
# Telegram Bot Token (получите у @BotFather)
TELEGRAM_BOT_TOKEN=your_bot_token_here

# База данных PostgreSQL
DATABASE_URL="postgresql://price_watcher:password@localhost:5432/price_watcher"

# Redis
REDIS_URL=redis://localhost:6379

# Настройки сервера
PORT=3000
NODE_ENV=production
```

### 3. Запуск с Docker Compose

```bash
# Сборка и запуск всех сервисов
docker-compose up -d

# Просмотр логов
docker-compose logs -f app

# Проверка статуса сервисов
docker-compose ps
```

### 4. Инициализация базы данных

```bash
# Создание миграций
docker-compose exec app npm run db:migrate

# Генерация Prisma клиента
docker-compose exec app npm run db:generate
```

### 5. Проверка работоспособности

```bash
# Проверка здоровья приложения
curl http://localhost:3000/health

# Проверка метрик
curl http://localhost:3000/metrics

# Проверка статистики
curl http://localhost:3000/api/stats
```

## 🌐 Продакшн развертывание

### Вариант 1: VPS/Сервер

#### 1. Подготовка сервера

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Установка Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Добавление пользователя в группу docker
sudo usermod -aG docker $USER
```

#### 2. Настройка файрвола

```bash
# Установка UFW
sudo apt install ufw

# Настройка правил
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3000/tcp  # Только для отладки
sudo ufw enable
```

#### 3. Настройка домена и SSL

```bash
# Установка Certbot
sudo apt install certbot python3-certbot-nginx

# Получение SSL сертификата
sudo certbot --nginx -d your-domain.com

# Автоматическое обновление сертификата
sudo crontab -e
# Добавить строку: 0 12 * * * /usr/bin/certbot renew --quiet
```

#### 4. Настройка Nginx

Создайте файл `/etc/nginx/sites-available/price-watcher`:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # Проксирование к приложению
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Webhook для Telegram
    location /webhook {
        proxy_pass http://localhost:3000/webhook;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Активируйте конфигурацию:
```bash
sudo ln -s /etc/nginx/sites-available/price-watcher /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Вариант 2: Облачные платформы

#### Heroku

```bash
# Установка Heroku CLI
curl https://cli-assets.heroku.com/install.sh | sh

# Логин в Heroku
heroku login

# Создание приложения
heroku create your-price-watcher-bot

# Добавление переменных окружения
heroku config:set TELEGRAM_BOT_TOKEN=your_token
heroku config:set DATABASE_URL=your_postgres_url
heroku config:set REDIS_URL=your_redis_url

# Деплой
git push heroku main

# Запуск воркеров
heroku ps:scale price-checker=1
heroku ps:scale notifier=1
```

#### DigitalOcean App Platform

1. Создайте приложение в DigitalOcean App Platform
2. Подключите GitHub репозиторий
3. Настройте переменные окружения
4. Настройте сервисы (PostgreSQL, Redis)
5. Деплой

#### AWS ECS

```bash
# Установка AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Настройка AWS
aws configure

# Создание ECR репозитория
aws ecr create-repository --repository-name price-watcher-bot

# Сборка и отправка образа
docker build -t price-watcher-bot .
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin your-account.dkr.ecr.us-east-1.amazonaws.com
docker tag price-watcher-bot:latest your-account.dkr.ecr.us-east-1.amazonaws.com/price-watcher-bot:latest
docker push your-account.dkr.ecr.us-east-1.amazonaws.com/price-watcher-bot:latest
```

## 📊 Мониторинг и логирование

### Настройка Prometheus

Создайте файл `monitoring/prometheus.yml`:

```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'price-watcher'
    static_configs:
      - targets: ['app:3000']
    metrics_path: '/metrics'
```

### Настройка Grafana

1. Откройте Grafana (http://your-domain.com:3001)
2. Логин: `admin`, пароль: `admin`
3. Добавьте источник данных Prometheus
4. Импортируйте дашборды

### Настройка Sentry

```bash
# Добавьте переменную окружения
SENTRY_DSN=your_sentry_dsn
```

## 🔄 Обновление приложения

### Автоматическое обновление

```bash
# Создайте скрипт обновления
cat > update.sh << 'EOF'
#!/bin/bash
cd /path/to/price-watcher-bot
git pull origin main
docker-compose down
docker-compose build --no-cache
docker-compose up -d
docker system prune -f
EOF

chmod +x update.sh

# Добавьте в crontab для автоматического обновления
crontab -e
# 0 2 * * * /path/to/update.sh >> /var/log/price-watcher-update.log 2>&1
```

### Ручное обновление

```bash
# Остановка сервисов
docker-compose down

# Обновление кода
git pull origin main

# Пересборка образов
docker-compose build --no-cache

# Запуск сервисов
docker-compose up -d

# Очистка старых образов
docker system prune -f
```

## 🛠️ Устранение неполадок

### Проверка логов

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

### Проверка состояния сервисов

```bash
# Статус контейнеров
docker-compose ps

# Использование ресурсов
docker stats

# Проверка сети
docker network ls
docker network inspect price-watcher-bot_price-watcher-network
```

### Восстановление из резервной копии

```bash
# Создание резервной копии
docker-compose exec postgres pg_dump -U price_watcher price_watcher > backup.sql

# Восстановление
docker-compose exec -T postgres psql -U price_watcher price_watcher < backup.sql
```

## 🔒 Безопасность

### Настройка файрвола

```bash
# Только необходимые порты
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### Обновление системы

```bash
# Автоматические обновления безопасности
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

### Мониторинг безопасности

```bash
# Установка fail2ban
sudo apt install fail2ban

# Настройка для SSH
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

## 📈 Масштабирование

### Горизонтальное масштабирование

```bash
# Увеличение количества воркеров
docker-compose up -d --scale price-checker=3 --scale notifier=2
```

### Вертикальное масштабирование

```bash
# Ограничение ресурсов в docker-compose.yml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '1.0'
          memory: 1G
```

## 💰 Оптимизация затрат

### Использование spot instances (AWS)

```yaml
# В docker-compose.yml для AWS
services:
  app:
    deploy:
      placement:
        constraints:
          - node.role == worker
      restart_policy:
        condition: any
        delay: 5s
        max_attempts: 3
```

### Мониторинг затрат

```bash
# Установка утилиты для мониторинга затрат
npm install -g cost-of-modules
cost-of-modules
```

## 📞 Поддержка

При возникновении проблем:

1. Проверьте логи: `docker-compose logs`
2. Проверьте статус сервисов: `docker-compose ps`
3. Проверьте использование ресурсов: `docker stats`
4. Создайте Issue в репозитории
5. Обратитесь в Telegram: @support_username
