# Настройка GitHub Secrets для CI/CD

## Обзор

Для работы CI/CD pipeline необходимо настроить секреты в GitHub репозитории. Эти секреты содержат конфиденциальную информацию и не должны попадать в код.

## Настройка секретов

### 1. Перейдите в настройки репозитория

1. Откройте ваш GitHub репозиторий
2. Перейдите в `Settings` → `Secrets and variables` → `Actions`
3. Нажмите `New repository secret`

### 2. Добавьте следующие секреты

#### SSH подключение к арендованному серверу

```
SSH_PRIVATE_KEY
```

**Значение:** Приватный SSH ключ для подключения к арендованному серверу

#### Настройки арендованного сервера (Jump Server)

```
JUMP_SERVER_HOST
```

**Значение:** IP адрес или домен арендованного сервера

```
JUMP_SERVER_USER
```

**Значение:** Пользователь для SSH подключения к арендованному серверу

#### Настройки домашнего сервера

```
HOME_SERVER_IP
```

**Значение:** IP адрес домашнего сервера в VPN сети

```
HOME_SERVER_USER
```

**Значение:** Пользователь для SSH подключения к домашнему серверу

```
PROJECT_PATH
```

**Значение:** Полный путь к проекту на домашнем сервере (например: `/home/deploy/projects/my-app`)

#### Настройки приложения

```
PORT
```

**Значение:** Порт приложения (например: `3000`)

```
LOG_LEVEL
```

**Значение:** Уровень логирования (например: `info`)

#### База данных

```
DATABASE_URL
```

**Значение:** Полная строка подключения к PostgreSQL

```
postgresql://username:password@host:port/database
```

```
POSTGRES_DB
```

**Значение:** Имя базы данных

```
POSTGRES_USER
```

**Значение:** Пользователь PostgreSQL

```
POSTGRES_PASSWORD
```

**Значение:** Пароль PostgreSQL

#### Telegram Bot

```
TELEGRAM_BOT_TOKEN
```

**Значение:** Токен бота от @BotFather

```
TELEGRAM_WEBHOOK_URL
```

**Значение:** URL для webhook (должен быть HTTPS)

```
https://your-domain.com/webhook
```

#### Redis

```
REDIS_URL
```

**Значение:** URL подключения к Redis

```
redis://host:port
```

#### Мониторинг

```
GRAFANA_ADMIN_PASSWORD
```

**Значение:** Пароль администратора Grafana

```
PROMETHEUS_PASSWORD
```

**Значение:** Пароль для Prometheus

## Генерация SSH ключей

### 1. Создание SSH ключа для GitHub Actions

```bash
# Генерируем новый SSH ключ
ssh-keygen -t rsa -b 4096 -f ~/.ssh/github_actions_key -N ""

# Показываем публичный ключ для добавления на сервер
cat ~/.ssh/github_actions_key.pub

# Показываем приватный ключ для GitHub Secrets
cat ~/.ssh/github_actions_key
```

### 2. Настройка на арендованном сервере

```bash
# Добавляем публичный ключ GitHub Actions
echo "ssh-rsa AAAAB3NzaC1yc2E..." >> ~/.ssh/authorized_keys

# Создаем пользователя deploy (если нужно)
sudo adduser deploy
sudo usermod -aG sudo deploy

# Настраиваем SSH ключи для домашнего сервера
ssh-keygen -t rsa -b 4096 -f ~/.ssh/home_server_key -N ""
cat ~/.ssh/home_server_key.pub
```

### 3. Настройка на домашнем сервере

```bash
# Добавляем публичный ключ арендованного сервера
echo "ssh-rsa AAAAB3NzaC1yc2E..." >> ~/.ssh/authorized_keys

# Создаем пользователя deploy (если нужно)
sudo adduser deploy
sudo usermod -aG docker deploy
```

## Проверка настроек

### 1. Тест SSH подключения

```bash
# Тест подключения к арендованному серверу
ssh -i ~/.ssh/github_actions_key user@jump-server-ip

# Тест подключения к домашнему серверу через арендованный
ssh user@jump-server-ip "ssh user@home-server-ip 'echo test'"
```

### 2. Тест переменных окружения

```bash
# Тест подключения к базе данных
psql $DATABASE_URL -c "SELECT version();"

# Тест Telegram Bot
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getMe"

# Тест Redis
redis-cli -u $REDIS_URL ping
```

## Безопасность

### ✅ Рекомендации

- Используйте сложные пароли
- Регулярно обновляйте SSH ключи
- Ограничивайте доступ к серверам по IP
- Используйте VPN для дополнительной защиты
- Ведите логи всех подключений

### ❌ Что НЕ делать

- Не коммитьте секреты в код
- Не используйте простые пароли
- Не передавайте ключи в открытом виде
- Не давайте доступ посторонним

## Устранение неполадок

### Ошибка SSH подключения

```bash
# Проверьте права на ключи
chmod 600 ~/.ssh/id_rsa
chmod 644 ~/.ssh/id_rsa.pub

# Проверьте SSH конфигурацию
ssh -v user@server-ip
```

### Ошибка переменных окружения

```bash
# Проверьте синтаксис DATABASE_URL
echo $DATABASE_URL

# Проверьте доступность сервисов
nc -zv host port
```

### Ошибка Docker

```bash
# Проверьте права пользователя
sudo usermod -aG docker $USER

# Проверьте статус Docker
sudo systemctl status docker
```

## Пример полной настройки

### 1. Создание всех секретов

```bash
# Скопируйте и вставьте в GitHub Secrets
SSH_PRIVATE_KEY="-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAABlwAAAAdzc2gtcn
...
-----END OPENSSH PRIVATE KEY-----"

JUMP_SERVER_HOST="123.456.789.10"
JUMP_SERVER_USER="deploy"
HOME_SERVER_IP="192.168.1.100"
HOME_SERVER_USER="deploy"
PROJECT_PATH="/home/deploy/projects/my-app"
PORT="3000"
DATABASE_URL="postgresql://user:pass@localhost:5432/myapp"
TELEGRAM_BOT_TOKEN="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
```

### 2. Тестирование pipeline

1. Сделайте push в main ветку
2. Проверьте статус в GitHub Actions
3. Убедитесь, что деплой прошел успешно
4. Проверьте работу приложения

## Поддержка

При возникновении проблем:

1. Проверьте логи GitHub Actions
2. Убедитесь, что все секреты настроены правильно
3. Проверьте SSH подключения
4. Проверьте доступность всех сервисов
