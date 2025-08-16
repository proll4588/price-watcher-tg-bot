#!/bin/bash

# Скрипт для настройки переменных окружения
# Использование: ./scripts/setup-env.sh

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функции для вывода
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Проверяем, что мы в корневой директории проекта
if [ ! -f "package.json" ]; then
    print_error "Скрипт должен быть запущен из корневой директории проекта"
    exit 1
fi

print_info "Настройка переменных окружения..."

# Проверяем существование .env файла
if [ -f ".env" ]; then
    print_warning "Файл .env уже существует!"
    read -p "Хотите перезаписать его? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Настройка отменена"
        exit 0
    fi
fi

# Проверяем существование env.example
if [ ! -f "env.example" ]; then
    print_error "Файл env.example не найден!"
    exit 1
fi

# Копируем пример
cp env.example .env

print_success "Файл .env создан из env.example"

# Функция для интерактивной настройки
setup_interactive() {
    print_info "Интерактивная настройка переменных окружения"
    echo
    
    # NODE_ENV
    read -p "Окружение (production/development) [production]: " node_env
    node_env=${node_env:-production}
    sed -i.bak "s/NODE_ENV=.*/NODE_ENV=$node_env/" .env
    
    # PORT
    read -p "Порт приложения [3000]: " port
    port=${port:-3000}
    sed -i.bak "s/PORT=.*/PORT=$port/" .env
    
    # DATABASE_URL
    print_info "Настройка базы данных PostgreSQL"
    read -p "Хост базы данных [localhost]: " db_host
    db_host=${db_host:-localhost}
    read -p "Порт базы данных [5432]: " db_port
    db_port=${db_port:-5432}
    read -p "Имя базы данных [myapp]: " db_name
    db_name=${db_name:-myapp}
    read -p "Пользователь базы данных [postgres]: " db_user
    db_user=${db_user:-postgres}
    read -s -p "Пароль базы данных: " db_password
    echo
    sed -i.bak "s|DATABASE_URL=.*|DATABASE_URL=postgresql://$db_user:$db_password@$db_host:$db_port/$db_name|" .env
    
    # TELEGRAM_BOT_TOKEN
    print_info "Настройка Telegram Bot"
    read -s -p "Токен Telegram бота: " bot_token
    echo
    if [ ! -z "$bot_token" ]; then
        sed -i.bak "s/TELEGRAM_BOT_TOKEN=.*/TELEGRAM_BOT_TOKEN=$bot_token/" .env
    fi
    
    # TELEGRAM_WEBHOOK_URL
    read -p "URL для webhook (https://your-domain.com/webhook): " webhook_url
    if [ ! -z "$webhook_url" ]; then
        sed -i.bak "s|TELEGRAM_WEBHOOK_URL=.*|TELEGRAM_WEBHOOK_URL=$webhook_url|" .env
    fi
    
    # REDIS_URL
    print_info "Настройка Redis"
    read -p "Хост Redis [localhost]: " redis_host
    redis_host=${redis_host:-localhost}
    read -p "Порт Redis [6379]: " redis_port
    redis_port=${redis_port:-6379}
    sed -i.bak "s|REDIS_URL=.*|REDIS_URL=redis://$redis_host:$redis_port|" .env
    
    # Удаляем временные файлы
    rm -f .env.bak
}

# Спрашиваем про интерактивную настройку
read -p "Хотите настроить переменные интерактивно? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    setup_interactive
    print_success "Интерактивная настройка завершена!"
else
    print_info "Пропускаем интерактивную настройку"
fi

print_info "Следующие шаги:"
echo "1. Отредактируйте файл .env с вашими реальными значениями"
echo "2. Убедитесь, что .env добавлен в .gitignore"
echo "3. Запустите приложение: docker-compose up -d"

# Проверяем .gitignore
if grep -q "\.env" .gitignore; then
    print_success ".env файл уже добавлен в .gitignore"
else
    print_warning ".env файл НЕ добавлен в .gitignore!"
    echo "Добавьте следующую строку в .gitignore:"
    echo "  .env"
fi

print_success "Настройка окружения завершена!"
