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
PROJECT_DIR="/home/punk/projects/$PROJECT_NAME"
BACKUP_DIR="/backups/$(date +%Y%m%d_%H%M%S)"
LOG_FILE="/var/log/deployments/$PROJECT_NAME.log"

# Создаем директории если не существуют
mkdir -p /backups
mkdir -p /var/log/deployments

# Функция логирования
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a $LOG_FILE
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
if [ ! -f "$PROJECT_DIR/docker-compose.yml" ]; then
    print_error "Файл docker-compose.yml не найден в $PROJECT_DIR"
    exit 1
fi

cd $PROJECT_DIR

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
git reset --hard origin/main
log "DEPLOY: Код обновлен до версии $(git rev-parse --short HEAD)"

# Создаем .env файл если не существует
if [ ! -f ".env" ]; then
    print_warning "Файл .env не найден, создаем из примера..."
    cp env.example .env
    print_warning "Пожалуйста, отредактируйте .env файл с реальными значениями!"
fi

# Пересобираем образы
print_info "Пересобираем Docker образы..."
docker-compose build --no-cache
log "DEPLOY: Образы пересобраны"

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

# Health check
print_info "Выполняем health check..."
if curl -f http://localhost:3000/health; then
    print_success "Health check прошел успешно!"
    log "DEPLOY: Health check прошел успешно"
    
    # Удаляем старые backup'ы (оставляем последние 5)
    ls -dt /backups/* | tail -n +6 | xargs -r rm -rf
    log "DEPLOY: Старые backup'ы удалены"
    
    # Очищаем старые образы
    print_info "Очищаем неиспользуемые Docker образы..."
    docker image prune -f
    log "DEPLOY: Неиспользуемые образы удалены"
    
    print_success "Деплой завершен успешно!"
    log "DEPLOY: Деплой завершен успешно"
    
    # Убираем обработчик ошибок
    trap - ERR
    
else
    print_error "Health check не прошел!"
    log "DEPLOY: Health check не прошел"
    exit 1
fi

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
