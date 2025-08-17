# Настройка GitHub Secrets для CI/CD

## Обзор

Для работы CI/CD pipeline необходимо настроить SSH ключи и секреты. Эта инструкция пошагово объясняет, где и что делать.

## Архитектура подключения

```
GitHub Actions → Jump Server (арендованный) → Home Server (домашний)
```

## Пошаговая настройка SSH ключей

### Шаг 1: Создание SSH ключа для GitHub Actions

**Где выполнять:** На вашем локальном компьютере

```bash
# Создаем SSH ключ для GitHub Actions
ssh-keygen -t rsa -b 4096 -f ~/.ssh/github_actions_key -N ""

# Показываем публичный ключ (добавим на jump server)
cat ~/.ssh/github_actions_key.pub

# Показываем приватный ключ (добавим в GitHub Secrets)
cat ~/.ssh/github_actions_key
```

### Шаг 2: Настройка Jump Server (арендованный сервер)

**Где выполнять:** На арендованном сервере

```bash
# Подключаемся к арендованному серверу
ssh user@jump-server-ip

# Добавляем публичный ключ GitHub Actions
echo "ssh-rsa AAAAB3NzaC1yc2E..." >> ~/.ssh/authorized_keys

# Создаем SSH ключ для подключения к домашнему серверу
ssh-keygen -t rsa -b 4096 -f ~/.ssh/home_server_key -N ""

# Показываем публичный ключ (добавим на home server)
cat ~/.ssh/home_server_key.pub
```

### Шаг 3: Настройка Home Server (домашний сервер)

**Где выполнять:** На домашнем сервере

```bash
# Подключаемся к домашнему серверу
ssh user@home-server-ip

# Добавляем публичный ключ jump server
echo "ssh-rsa AAAAB3NzaC1yc2E..." >> ~/.ssh/authorized_keys

# Проверяем права на .ssh
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

### Шаг 4: Настройка GitHub Secrets

**Где выполнять:** В веб-интерфейсе GitHub

1. Откройте ваш GitHub репозиторий
2. Перейдите в `Settings` → `Secrets and variables` → `Actions`
3. Нажмите `New repository secret`

#### Добавьте следующие секреты:

| Название | Значение | Откуда взять |
|----------|----------|--------------|
| `SSH_PRIVATE_KEY` | Приватный ключ GitHub Actions | Результат `cat ~/.ssh/github_actions_key` с локального компьютера |
| `JUMP_SERVER_HOST` | IP арендованного сервера | IP адрес вашего арендованного сервера |
| `JUMP_SERVER_USER` | Пользователь на jump server | Ваш пользователь на арендованном сервере |
| `HOME_SERVER_IP` | IP домашнего сервера | IP адрес вашего домашнего сервера в VPN |
| `HOME_SERVER_USER` | Пользователь на home server | Ваш пользователь на домашнем сервере |
| `PROJECT_PATH` | Путь к проекту | Полный путь к проекту на домашнем сервере |

## Проверка настроек

### Тест 1: GitHub Actions → Home Server

**Где выполнять:** На локальном компьютере

```bash
# Тестируем подключение к home server
ssh -i ~/.ssh/github_actions_key user@home-server-ip "echo 'Подключение к home server успешно'"
```

### Тест 2: Проверка .env файла

**Где выполнять:** На home server

```bash
# Проверяем наличие .env файла
ls -la .env

# Проверяем содержимое .env (без показа секретов)
head -5 .env
```

### Тест 3: Пошаговая диагностика

**Где выполнять:** На локальном компьютере

```bash
# 1. Тест подключения к home server
ssh -i ~/.ssh/github_actions_key user@home-server-ip "echo 'Home server доступен'"

# 2. Подробная диагностика SSH
ssh -v -i ~/.ssh/github_actions_key user@home-server-ip "echo 'Диагностика завершена'"
```

## Настройка остальных секретов

### Настройки приложения

**Примечание:** Переменные окружения (.env) должны храниться на сервере, а не в GitHub Secrets.

Для настройки переменных окружения на сервере:
```bash
# На home server
cd /path/to/project
cp env.example .env
nano .env  # отредактируйте переменные
```

Пример переменных в .env файле:
```bash
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:pass@localhost:5432/myapp
POSTGRES_DB=myapp
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_WEBHOOK_URL=https://your-domain.com/webhook
REDIS_URL=redis://localhost:6379
GRAFANA_ADMIN_PASSWORD=admin_password
PROMETHEUS_PASSWORD=prometheus_password
LOG_LEVEL=info
```

## Схема размещения SSH ключей

```
Локальный компьютер:
├── ~/.ssh/github_actions_key (приватный) → GitHub Secrets
└── ~/.ssh/github_actions_key.pub (публичный) → Home Server

Home Server:
├── ~/.ssh/authorized_keys (содержит github_actions_key.pub)
└── .env файл (переменные окружения)
```

## Частые ошибки и решения

### Ошибка: "Permission denied (publickey)"

**Причина:** Неправильно размещен публичный ключ

**Решение:**
1. Проверьте, что публичный ключ добавлен в `~/.ssh/authorized_keys`
2. Проверьте права: `chmod 600 ~/.ssh/authorized_keys`
3. Проверьте права на .ssh: `chmod 700 ~/.ssh`

### Ошибка: "Could not scan home server"

**Причина:** GitHub Actions не может подключиться к home server напрямую

**Решение:**
1. Убедитесь, что используется SSH ProxyJump (`-J` флаг)
2. Проверьте, что jump server может подключиться к home server

### Ошибка: "Connection timeout"

**Причина:** Проблемы с сетевым подключением

**Решение:**
1. Проверьте доступность серверов: `ping server-ip`
2. Проверьте SSH порт: `nc -zv server-ip 22`
3. Проверьте firewall на серверах

### Ошибка: "Host key verification failed"

**Причина:** SSH ключи не настроены правильно или jump server не может подключиться к home server

**Решение:**
1. Проверьте, что SSH ключ jump server добавлен в `~/.ssh/authorized_keys` на home server
2. Проверьте права на SSH ключи: `chmod 600 ~/.ssh/home_server_key`
3. Проверьте права на authorized_keys: `chmod 600 ~/.ssh/authorized_keys`
4. Проверьте подключение с jump server к home server напрямую

## Команды для диагностики

### Проверка SSH конфигурации

```bash
# Подробный вывод SSH подключения
ssh -v -J user@jump-server-ip user@home-server-ip

# Проверка SSH агента
ssh-add -l

# Проверка известных хостов
cat ~/.ssh/known_hosts
```

### Проверка прав доступа

```bash
# Проверка прав на SSH директорию
ls -la ~/.ssh/

# Проверка прав на ключи
ls -la ~/.ssh/id_rsa*
```

### Проверка SSH ключей на серверах

**На home server:**
```bash
# Запускаем диагностику
echo "🔍 Проверяем SSH директорию..."
ls -la ~/.ssh/

echo "🔍 Проверяем authorized_keys..."
grep "ssh-rsa" ~/.ssh/authorized_keys

echo "🔍 Проверяем SSH сервис..."
sudo systemctl status ssh

# Или вручную:
# Проверяем, что ключ GitHub Actions добавлен
grep "ssh-rsa" ~/.ssh/authorized_keys

# Проверяем права на authorized_keys
chmod 600 ~/.ssh/authorized_keys

# Проверяем SSH конфигурацию
sudo systemctl status ssh

# Проверяем .env файл
ls -la .env
```

## Безопасность

### ✅ Рекомендации

- Используйте разные SSH ключи для разных сервисов
- Регулярно обновляйте SSH ключи (раз в 6 месяцев)
- Ограничивайте доступ по IP в firewall
- Используйте VPN для дополнительной защиты
- Ведите логи SSH подключений

### ❌ Что НЕ делать

- Не используйте один SSH ключ для всего
- Не коммитьте приватные ключи в Git
- Не передавайте ключи в открытом виде
- Не давайте доступ посторонним

## Пример полной настройки

### 1. Локальный компьютер

```bash
# Создаем ключ для GitHub Actions
ssh-keygen -t rsa -b 4096 -f ~/.ssh/github_actions_key -N ""
echo "Добавьте этот ключ в GitHub Secrets:"
cat ~/.ssh/github_actions_key
echo "Добавьте этот ключ на home server:"
cat ~/.ssh/github_actions_key.pub
```

### 2. Home Server

```bash
# Добавляем ключ GitHub Actions
echo "ssh-rsa AAAAB3NzaC1yc2E..." >> ~/.ssh/authorized_keys

# Проверяем права
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys

# Настраиваем переменные окружения
cd /path/to/project
cp env.example .env
nano .env  # отредактируйте переменные
```

### 3. GitHub Secrets

Добавьте только необходимые секреты в GitHub репозиторий:
- `SSH_PRIVATE_KEY` - приватный ключ GitHub Actions
- `HOME_SERVER_USER` - пользователь на home server
- `PROJECT_PATH` - путь к проекту

### 4. Тестирование

```bash
# Тест подключения
ssh user@home-server-ip "echo 'Все работает!'"
```

## Поддержка

При возникновении проблем:

1. Проверьте логи GitHub Actions
2. Убедитесь, что все SSH ключи размещены правильно
3. Проверьте права доступа на всех серверах
4. Проверьте сетевую доступность серверов
5. Используйте команды диагностики выше
