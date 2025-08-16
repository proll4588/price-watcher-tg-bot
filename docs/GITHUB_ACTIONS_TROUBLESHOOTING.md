# 🔧 Устранение проблем с GitHub Actions

## Проблема: Деплой пропускается

### Возможные причины

1. **Неправильные триггеры** - workflow не настроен на нужные события
2. **Неправильные условия** - условие `if` не выполняется
3. **Отсутствующие секреты** - не настроены необходимые переменные
4. **Проблемы с правами** - недостаточно прав для выполнения

## Диагностика

### 1. Проверка триггеров

Убедитесь, что workflow настроен на правильные события:

```yaml
on:
  push:
    branches: [release]     # Деплой при push в release
    tags: ["v*.*.*"]        # Деплой при создании тега
  pull_request:
    branches: [release]     # Тесты при PR
```

### 2. Проверка условий деплоя

```yaml
jobs:
  deploy:
    if: github.ref == 'refs/heads/release' || startsWith(github.ref, 'refs/tags/')
```

### 3. Проверка секретов

Необходимые секреты в `Settings → Secrets and variables → Actions`:

```
SSH_PRIVATE_KEY          # Приватный SSH ключ
JUMP_SERVER_HOST         # IP арендованного сервера
JUMP_SERVER_USER         # Пользователь на арендованном сервере
HOME_SERVER_IP           # IP домашнего сервера
HOME_SERVER_USER         # Пользователь на домашнем сервере
PROJECT_PATH             # Путь к проекту
DATABASE_URL             # Строка подключения к БД
TELEGRAM_BOT_TOKEN       # Токен Telegram бота
```

## Решения

### 1. Исправление триггеров

Если деплой не запускается при push в release:

```yaml
on:
  push:
    branches: [release, main]  # Добавьте нужные ветки
  pull_request:
    branches: [release, main]
```

### 2. Исправление условий

```yaml
# Для деплоя только на release
if: github.ref == 'refs/heads/release'

# Для деплоя на release и теги
if: github.ref == 'refs/heads/release' || startsWith(github.ref, 'refs/tags/')
```

# Для деплоя только на теги
if: startsWith(github.ref, 'refs/tags/')
```

### 3. Проверка секретов

Проверьте секреты в GitHub:
1. Перейдите в `Settings → Secrets and variables → Actions`
2. Убедитесь, что все необходимые секреты настроены

### 4. Ручная проверка

```bash
# Проверьте workflow файл
cat .github/workflows/deploy.yml

# Проверьте текущую ветку
git branch

# Проверьте последние коммиты
git log --oneline -5
```

## Частые проблемы

### Проблема: "No jobs matched for this workflow"

**Причина:** Неправильные триггеры или условия

**Решение:**
```yaml
on:
  push:
    branches: [main]
  workflow_dispatch:  # Добавьте ручной запуск
```

### Проблема: "Job was skipped"

**Причина:** Условие `if` не выполняется

**Решение:**
```yaml
# Уберите условие для тестирования
if: always()

# Или упростите условие
if: github.ref == 'refs/heads/release'
```

### Проблема: "Secret not found"

**Причина:** Секрет не настроен в GitHub

**Решение:**
1. Перейдите в `Settings → Secrets and variables → Actions`
2. Нажмите `New repository secret`
3. Добавьте все необходимые секреты

### Проблема: "Permission denied"

**Причина:** Недостаточно прав

**Решение:**
```yaml
permissions:
  contents: read
  actions: write
```

## Тестирование

### 1. Ручной запуск

Добавьте `workflow_dispatch` для ручного запуска:

```yaml
on:
  push:
    branches: [release]
  workflow_dispatch:  # Ручной запуск
```

### 2. Тестовый деплой

Создайте тестовую ветку:

```bash
git checkout -b test-deploy
git push origin test-deploy
# Или используйте существующую ветку release
git push origin release
```

### 3. Проверка логов

```bash
# В GitHub репозитории:
# 1. Actions → CI/CD Pipeline
# 2. Выберите последний запуск
# 3. Проверьте логи каждого шага
```

## Отладка

### 1. Включение отладки

```yaml
env:
  ACTIONS_STEP_DEBUG: true
  ACTIONS_RUNNER_DEBUG: true
```

### 2. Проверка переменных

```yaml
- name: Debug variables
  run: |
    echo "GITHUB_REF: ${{ github.ref }}"
    echo "GITHUB_SHA: ${{ github.sha }}"
    echo "GITHUB_EVENT_NAME: ${{ github.event_name }}"
```

### 3. Проверка секретов

```yaml
- name: Check secrets
  run: |
    if [ -n "${{ secrets.SSH_PRIVATE_KEY }}" ]; then
      echo "SSH_PRIVATE_KEY: OK"
    else
      echo "SSH_PRIVATE_KEY: MISSING"
    fi
```

## Альтернативные решения

### 1. Упрощенный workflow

```yaml
name: Simple Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy
        run: echo "Deploy to server"
```

### 2. Workflow только для тегов

```yaml
name: Deploy on Tag

on:
  push:
    tags: ["v*.*.*"]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy
        run: echo "Deploy version ${{ github.ref_name }}"
```

### 3. Workflow с ручным запуском

```yaml
name: Manual Deploy

on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to deploy to'
        required: true
        default: 'production'
        type: choice
        options:
        - production
        - staging

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to ${{ github.event.inputs.environment }}
        run: echo "Deploying to ${{ github.event.inputs.environment }}"
```

## Мониторинг

### 1. Уведомления

Добавьте уведомления в workflow:

```yaml
- name: Notify success
  if: success()
  run: |
    echo "✅ Деплой успешен!"
    # curl -X POST "https://api.telegram.org/bot${{ secrets.TELEGRAM_BOT_TOKEN }}/sendMessage" \
    #   -d "chat_id=${{ secrets.TELEGRAM_CHAT_ID }}" \
    #   -d "text=✅ Деплой успешен!"

- name: Notify failure
  if: failure()
  run: |
    echo "❌ Деплой провален!"
    # curl -X POST "https://api.telegram.org/bot${{ secrets.TELEGRAM_BOT_TOKEN }}/sendMessage" \
    #   -d "chat_id=${{ secrets.TELEGRAM_CHAT_ID }}" \
    #   -d "text=❌ Деплой провален!"
```

### 2. Статус бадж

Добавьте статус бадж в README:

```markdown
![Deploy Status](https://github.com/username/repo/workflows/CI%2FCD%20Pipeline/badge.svg)
```

## Поддержка

При возникновении проблем:

1. **Проверьте логи** в GitHub Actions
2. **Проверьте секреты** в настройках репозитория
3. **Создайте Issue** с логами ошибки
4. **Попробуйте ручной запуск** через `workflow_dispatch`
