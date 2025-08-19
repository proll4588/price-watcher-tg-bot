# Настройка системы мониторинга

## Обзор

Система мониторинга Price Watcher включает:
- **Prometheus** - сбор и хранение метрик
- **Grafana** - визуализация и дашборды
- **Автоматический импорт** дашбордов и источников данных

## Быстрый старт

### 1. Запуск системы мониторинга

```bash
# Автоматический запуск
npm run monitoring:start

# Или вручную
docker-compose up -d prometheus grafana
```

### 2. Доступ к сервисам

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001
  - Логин: `admin`
  - Пароль: `admin`

### 3. Проверка дашбордов

После запуска Grafana автоматически импортируются дашборды:
- **Price Watcher - Обзор** - основные метрики системы
- **Price Watcher - Воркеры и очереди** - мониторинг производительности
- **Price Watcher - Аналитика по провайдерам** - анализ по торговым площадкам

## Структура файлов

```
monitoring/
├── grafana/
│   └── provisioning/
│       ├── dashboards/
│       │   ├── dashboard.yml          # Конфигурация импорта дашбордов
│       │   ├── price-watcher-overview.json
│       │   ├── price-watcher-workers.json
│       │   └── price-watcher-providers.json
│       └── datasources/
│           └── datasource.yml         # Конфигурация Prometheus
└── prometheus.yml                     # Конфигурация Prometheus
```

## Конфигурация

### Prometheus (monitoring/prometheus.yml)

```yaml
scrape_configs:
  - job_name: "price-watcher"
    static_configs:
      - targets: ["app:3000"]
    metrics_path: "/metrics"
    scrape_interval: 30s
```

### Grafana Provisioning

#### Дашборды (monitoring/grafana/provisioning/dashboards/dashboard.yml)

```yaml
apiVersion: 1

providers:
  - name: 'price-watcher-dashboards'
    orgId: 1
    folder: 'Price Watcher'
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /etc/grafana/provisioning/dashboards
```

#### Источники данных (monitoring/grafana/provisioning/datasources/datasource.yml)

```yaml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true
```

## Docker Compose

```yaml
# Prometheus
prometheus:
  image: prom/prometheus:latest
  ports:
    - "9090:9090"
  volumes:
    - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
    - prometheus_data:/prometheus

# Grafana
grafana:
  image: grafana/grafana:latest
  ports:
    - "3001:3000"
  environment:
    - GF_SECURITY_ADMIN_PASSWORD=admin
    - GF_SECURITY_ADMIN_USER=admin
  volumes:
    - grafana_data:/var/lib/grafana
    - ./monitoring/grafana/provisioning:/etc/grafana/provisioning
```

## Метрики

### Доступные метрики

#### Пользователи
- `price_watcher_new_users_total` - новые пользователи
- `price_watcher_active_users` - активные пользователи
- `price_watcher_total_users` - общее количество пользователей

#### Отслеживания
- `price_watcher_track_requests_total` - запросы на отслеживание
- `price_watcher_active_tracks` - активные отслеживания
- `price_watcher_track_removals_total` - удаления отслеживаний

#### Воркеры
- `price_watcher_price_checks_total` - проверки цен
- `price_watcher_price_check_duration_seconds` - время выполнения
- `price_watcher_notifications_sent_total` - отправленные уведомления
- `price_watcher_worker_errors_total` - ошибки воркеров

#### Очереди
- `price_watcher_queue_jobs_waiting` - ожидающие задачи
- `price_watcher_queue_jobs_active` - активные задачи
- `price_watcher_queue_jobs_completed` - завершенные задачи
- `price_watcher_queue_jobs_failed` - неудачные задачи

### Проверка метрик

```bash
# Проверка метрик Prometheus
curl http://localhost:3000/metrics

# Проверка API аналитики
curl http://localhost:3000/api/analytics

# Тестирование системы
npm run test:analytics
```

## Troubleshooting

### Дашборды не отображаются

1. Проверьте логи Grafana:
```bash
docker-compose logs grafana
```

2. Убедитесь, что файлы дашбордов находятся в правильной папке:
```bash
ls -la monitoring/grafana/provisioning/dashboards/
```

3. Перезапустите Grafana:
```bash
docker-compose restart grafana
```

### Prometheus не собирает метрики

1. Проверьте, что приложение запущено:
```bash
docker-compose ps app
```

2. Проверьте доступность метрик:
```bash
curl http://localhost:3000/metrics
```

3. Проверьте конфигурацию Prometheus:
```bash
docker-compose exec prometheus cat /etc/prometheus/prometheus.yml
```

### Ошибки подключения

1. Проверьте сеть Docker:
```bash
docker network ls
docker network inspect my-app_price-watcher-network
```

2. Проверьте DNS резолвинг:
```bash
docker-compose exec grafana nslookup prometheus
```

## Расширение

### Добавление новых дашбордов

1. Создайте JSON файл дашборда
2. Поместите в `monitoring/grafana/provisioning/dashboards/`
3. Перезапустите Grafana

### Добавление новых метрик

1. Добавьте метрику в `src/services/metrics.ts`
2. Обновите соответствующий сервис
3. Добавьте панель в дашборд Grafana

### Настройка алертов

1. Создайте правила в Prometheus
2. Настройте AlertManager
3. Добавьте алерты в Grafana

## Полезные команды

```bash
# Запуск только мониторинга
npm run monitoring:start

# Запуск полного приложения
docker-compose up -d

# Просмотр логов
docker-compose logs -f grafana
docker-compose logs -f prometheus

# Остановка
docker-compose down

# Очистка данных
docker-compose down -v
```
