# 🚀 Быстрый старт

## Минимальная настройка

### 1. Клонируйте репозиторий

```bash
git clone <your-repo-url>
cd my-app
```

### 2. Настройте окружение

```bash
# Автоматическая настройка
./scripts/setup-env.sh

# Или вручную
cp env.example .env
# Отредактируйте .env файл
```

### 3. Запустите проект

```bash
docker-compose up -d
```

### 4. Проверьте работу

```bash
# Статус контейнеров
docker-compose ps

# Логи приложения
docker-compose logs -f app
```

## CI/CD настройка

### Вариант 1: WireGuard VPN (рекомендуемый)

Следуйте инструкции: [🔧 WireGuard Setup](docs/WIREGUARD_SETUP.md)

**Кратко:**

1. Настройте WireGuard на home server: `sudo ./scripts/setup-wireguard.sh`
2. Сгенерируйте конфигурацию: `./scripts/generate-wireguard-config.sh`
3. Добавьте секреты в GitHub: `WIREGUARD_CONFIG`, `HOME_SERVER_VPN_IP`
4. Добавьте peer на home server
5. Создайте тег для тестирования

### Вариант 2: SSH через Jump Server

Следуйте пошаговой инструкции: [🔐 Настройка GitHub Secrets](docs/GITHUB_SECRETS_SETUP.md)

**Кратко:**

- Создайте SSH ключ на локальном компьютере
- Добавьте публичный ключ на jump server
- Создайте SSH ключ на jump server
- Добавьте публичный ключ на home server
- Добавьте приватный ключ в GitHub Secrets

### 3. Создайте тег для деплоя

```bash
git tag v1.0.0
git push origin v1.0.0
```

## Полезные команды

```bash
# Остановить все контейнеры
docker-compose down

# Пересобрать образы
docker-compose build --no-cache

# Посмотреть логи
docker-compose logs -f [service-name]

# Подключиться к контейнеру
docker-compose exec [service-name] bash

# Проверить статус
docker-compose ps
```

## Troubleshooting

### Проблемы с Puppeteer

Если возникают ошибки с Chrome, см. [🐛 Troubleshooting Puppeteer](docs/PUPPETEER_TROUBLESHOOTING.md)

### Проблемы с CI/CD

Если деплой не работает:

1. **Запустите диагностику SSH:**

   ```bash
   # На jump server
   ./scripts/ssh-diagnostic.sh jump user@home-server-ip

   # На home server
   ./scripts/ssh-diagnostic.sh home
   ```

2. **Исправьте SSH ключи:**

   ```bash
   # На jump server
   ./scripts/fix-ssh-keys.sh jump user@home-server-ip

   # На home server
   ./scripts/fix-ssh-keys.sh home
   ```

3. **Проверьте документацию:** [🔧 Troubleshooting GitHub Actions](docs/GITHUB_ACTIONS_TROUBLESHOOTING.md)

## Документация

- 📚 [Полная документация](docs/README.md)
- 🔐 [Настройка SSH ключей](docs/GITHUB_SECRETS_SETUP.md)
- 🚀 [Настройка CI/CD](docs/CI_CD_SETUP.md)
- ⚙️ [Настройка окружения](docs/ENVIRONMENT_SETUP.md)
