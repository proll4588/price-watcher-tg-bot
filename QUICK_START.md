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

**Кратко:**

1. Настройте WireGuard на home server
2. Сгенерируйте конфигурацию для GitHub Actions
3. Добавьте секреты в GitHub: `WIREGUARD_CONFIG`, `HOME_SERVER_VPN_IP`, `SSH_PRIVATE_KEY`
4. Добавьте peer на home server
5. **Создайте .env файл на сервере:** `cp env.example .env && nano .env`
6. Создайте тег для тестирования

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

### Проблемы с CI/CD

Если деплой не работает:

1. **Проверьте SSH подключение:**

   ```bash
   ssh user@home-server-ip "echo 'Подключение работает'"
   ```

2. **Проверьте WireGuard VPN:**

   ```bash
   sudo wg show
   sudo systemctl status wg-quick@wg0
   ```

3. **Проверьте .env файл:**

   ```bash
   ls -la .env
   ```

4. **Проверьте логи деплоя:**
   ```bash
   tail -f ~/logs/deployments.log
   ```

## Документация

- 📚 [Полная документация](docs/README.md)
- 🔐 [Настройка GitHub Secrets](docs/GITHUB_SECRETS_SETUP.md)
- ⚙️ [Настройка окружения](docs/ENVIRONMENT_SETUP.md)
