# 🚀 Быстрый старт

## Минимальная настройка для запуска

### 1. Клонирование

```bash
git clone <your-repo-url>
cd my-app
```

### 2. Настройка окружения

```bash
# Автоматическая настройка
./scripts/setup-env.sh

# Или ручная настройка
cp env.example .env
# Отредактируйте .env файл
```

### 3. Запуск с Docker

```bash
docker-compose up -d
```

### 4. Проверка работы

```bash
# Health check
curl http://localhost:3000/health

# Просмотр логов
docker-compose logs -f
```

## 📚 Документация

- **[📚 Полная документация](docs/README.md)** - Все инструкции и руководства
- **[⚙️ Настройка окружения](docs/ENVIRONMENT_SETUP.md)** - Переменные окружения
- **[🚀 Настройка CI/CD](docs/CI_CD_SETUP.md)** - Автоматический деплой
- **[🔐 GitHub Secrets](docs/GITHUB_SECRETS_SETUP.md)** - Настройка секретов

## 🛠️ Полезные команды

```bash
# Запуск/остановка
docker-compose up -d
docker-compose down

# Логи
docker-compose logs -f app

# Перезапуск
docker-compose restart

# Обновление кода
git pull && docker-compose up -d --build
```

## 🆘 Поддержка

- Создайте Issue в репозитории
- Обратитесь в Telegram: @support_username
- Проверьте [документацию](docs/README.md)
