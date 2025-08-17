#!/bin/bash

# Скрипт деплоя для сервера
# Использование: ./scripts/deploy.sh [environment]

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

# Параметры
ENVIRONMENT=${1:-production}
PROJECT_NAME="price-watcher-tg-bot"
PROJECT_DIR="$(pwd)"
BACKUP_DIR="$HOME/backups/$(date +%Y%m%d_%H%M%S)"
LOG_FILE="$HOME/logs/deployments.log"

# Создаем директории если не существуют
mkdir -p $HOME/backups
mkdir -p $HOME/logs

# Функция логирования
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a $HOME/logs/deployments.log
}

# Функция отката
rollback() {
    print_error "Ошибка деплоя! Выполняем откат..."
    log "ROLLBACK: Начинаем откат к предыдущей версии"
    
    if [ -d "$BACKUP_DIR" ]; then
        cd $PROJECT_DIR
        docker-compose down
        
        # Восстанавливаем из backup
        cp -r $BACKUP_DIR/* .
        
        # Запускаем старую версию
        docker-compose up -d
        
        log "ROLLBACK: Откат завершен"
        print_success "Откат выполнен успешно"
    else
        print_error "Backup не найден, откат невозможен"
        log "ROLLBACK: Backup не найден"
    fi
}

# Обработка ошибок
trap rollback ERR

# Начинаем деплой
log "DEPLOY: Начинаем деплой версии $(git rev-parse --short HEAD)"
print_info "Начинаем деплой в окружении: $ENVIRONMENT"

# Проверяем, что мы в правильной директории
if [ ! -f "docker-compose.yml" ]; then
    print_error "Файл docker-compose.yml не найден в текущей директории"
    exit 1
fi

# Создаем backup текущей версии
print_info "Создаем backup текущей версии..."
mkdir -p $BACKUP_DIR
cp -r . $BACKUP_DIR/
log "DEPLOY: Backup создан в $BACKUP_DIR"

# Останавливаем текущие контейнеры
print_info "Останавливаем текущие контейнеры..."
docker-compose down
log "DEPLOY: Контейнеры остановлены"

# Обновляем код
print_info "Обновляем код из репозитория..."
git fetch origin
git reset --hard origin/release
log "DEPLOY: Код обновлен до версии $(git rev-parse --short HEAD)"

# Проверяем наличие .env файла
if [ ! -f ".env" ]; then
    print_error "Файл .env не найден! Создайте его перед деплоем."
    print_error "Используйте: cp env.example .env && nano .env"
    exit 1
fi

# Пересобираем образы
print_info "Пересобираем Docker образы..."
docker-compose build --no-cache
log "DEPLOY: Образы пересобраны"

# Генерируем Prisma клиент
print_info "Генерируем Prisma клиент..."
docker-compose run --rm app npx prisma generate
log "DEPLOY: Prisma клиент сгенерирован"

# Применяем миграции БД
print_info "Применяем миграции базы данных..."
docker-compose run --rm app npx prisma migrate deploy
log "DEPLOY: Миграции применены"

# Запускаем новые контейнеры
print_info "Запускаем новые контейнеры..."
docker-compose up -d
log "DEPLOY: Контейнеры запущены"

# Ждем запуска
print_info "Ждем запуска сервисов..."
sleep 15

# Проверяем статус контейнеров
print_info "Проверяем статус контейнеров..."
docker-compose ps

# Удаляем старые backup'ы (оставляем последние 5)
ls -dt $HOME/backups/* | tail -n +6 | xargs -r rm -rf
log "DEPLOY: Старые backup'ы удалены"
    
# Очищаем старые образы
print_info "Очищаем неиспользуемые Docker образы..."
docker image prune -f
log "DEPLOY: Неиспользуемые образы удалены"
    
print_success "Деплой завершен успешно!"
log "DEPLOY: Деплой завершен успешно"

# Убираем обработчик ошибок
trap - ERR

# Показываем информацию о деплое
echo
print_info "Информация о деплое:"
echo "  Версия: $(git rev-parse --short HEAD)"
echo "  Время: $(date)"
echo "  Окружение: $ENVIRONMENT"
echo "  Backup: $BACKUP_DIR"
echo "  Логи: $LOG_FILE"

# Проверяем использование ресурсов
echo
print_info "Использование ресурсов:"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
