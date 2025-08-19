#!/bin/bash

# Скрипт для запуска системы мониторинга Price Watcher

set -e

echo "🚀 Запуск системы мониторинга Price Watcher..."

# Проверяем, что Docker запущен
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker не запущен. Запустите Docker Desktop и попробуйте снова."
    exit 1
fi

# Останавливаем существующие контейнеры
echo "🛑 Остановка существующих контейнеров..."
docker-compose down

# Запускаем только сервисы мониторинга
echo "📊 Запуск Prometheus и Grafana..."
docker-compose up -d prometheus grafana

# Ждем запуска сервисов
echo "⏳ Ожидание запуска сервисов..."
sleep 10

# Проверяем статус
echo "🔍 Проверка статуса сервисов..."
docker-compose ps prometheus grafana

echo ""
echo "✅ Система мониторинга запущена!"
echo ""
echo "📊 Доступные сервисы:"
echo "   Prometheus: http://localhost:9090"
echo "   Grafana:    http://localhost:3001 (admin/admin)"
echo ""
echo "📋 Дашборды Grafana:"
echo "   - Price Watcher - Обзор"
echo "   - Price Watcher - Воркеры и очереди"
echo "   - Price Watcher - Аналитика по провайдерам"
echo ""
echo "🔧 Для запуска полного приложения выполните:"
echo "   docker-compose up -d"
echo ""
echo "🧪 Для тестирования аналитики выполните:"
echo "   npm run test:analytics"
