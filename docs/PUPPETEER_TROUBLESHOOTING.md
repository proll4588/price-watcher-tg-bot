# 🔧 Устранение проблем с Puppeteer

## Проблема

При сборке Docker образа может возникнуть ошибка:

```
npm error Error: ERROR: Failed to set up Chrome v121.0.6167.85! 
Set "PUPPETEER_SKIP_DOWNLOAD" env variable to skip download.
```

## Причины

1. **Проблемы с сетью** - Puppeteer не может скачать Chrome
2. **Ограничения ресурсов** - недостаточно места на диске
3. **Блокировка файрвола** - доступ к серверам Google заблокирован
4. **Проблемы с DNS** - не удается разрешить доменные имена

## Решения

### 1. Пропуск загрузки Chrome (рекомендуется)

Используйте системный Chrome/Chromium вместо загрузки:

```bash
# В .env файле
PUPPETEER_SKIP_DOWNLOAD=true
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
CHROME_BIN=/usr/bin/chromium-browser
```

### 2. Использование альтернативного Dockerfile

Для случаев, когда нужен полный Chrome:

```bash
# Сборка с Chrome
docker-compose -f docker-compose.chrome.yml up -d

# Или напрямую
docker build -f Dockerfile.chrome -t my-app:chrome .
```

### 3. Настройка прокси (если нужно)

```bash
# В .env файле
HTTP_PROXY=http://proxy:port
HTTPS_PROXY=http://proxy:port
NO_PROXY=localhost,127.0.0.1
```

### 4. Увеличение таймаутов

```bash
# В Dockerfile
ENV PUPPETEER_DOWNLOAD_TIMEOUT=300000
ENV PUPPETEER_DOWNLOAD_RETRIES=3
```

## Конфигурации

### Базовый Dockerfile (без Chrome)

```dockerfile
# Пропуск загрузки Chrome
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Использование системного Chromium
ENV CHROME_BIN=/usr/bin/chromium-browser
```

### Dockerfile с Chrome

```dockerfile
# Полная установка Chrome
ENV CHROME_BIN=/usr/bin/chromium-browser
ENV CHROME_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

## Переменные окружения

| Переменная | Описание | Значение по умолчанию |
|------------|----------|----------------------|
| `PUPPETEER_SKIP_DOWNLOAD` | Пропустить загрузку Chrome | `false` |
| `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD` | Пропустить загрузку Chromium | `false` |
| `CHROME_BIN` | Путь к Chrome/Chromium | `/usr/bin/chromium-browser` |
| `CHROME_PATH` | Путь к Chrome | `/usr/bin/chromium-browser` |
| `PUPPETEER_EXECUTABLE_PATH` | Путь к исполняемому файлу | `/usr/bin/chromium-browser` |

## Проверка установки

### Проверка Chrome

```bash
# Проверка наличия Chrome
docker-compose exec app which chromium-browser

# Проверка версии
docker-compose exec app chromium-browser --version
```

### Тест Puppeteer

```bash
# Запуск теста
docker-compose exec app node -e "
const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({headless: true});
  console.log('Puppeteer работает!');
  await browser.close();
})();
"
```

## Альтернативные решения

### 1. Использование Playwright

Если Puppeteer вызывает проблемы, можно перейти на Playwright:

```bash
npm uninstall puppeteer
npm install playwright
```

### 2. Использование headless-chrome

```bash
npm install puppeteer-core
```

И настройка:

```javascript
const puppeteer = require('puppeteer-core');
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium-browser',
  headless: true
});
```

### 3. Использование Selenium

```bash
npm install selenium-webdriver
```

## Мониторинг

### Логи Puppeteer

```bash
# Просмотр логов
docker-compose logs -f app | grep -i puppeteer

# Отладка
DEBUG=puppeteer:* docker-compose up
```

### Метрики

```bash
# Проверка использования памяти
docker stats

# Проверка процессов Chrome
docker-compose exec app ps aux | grep chrome
```

## Профилактика

### 1. Регулярная очистка

```bash
# Очистка Docker образов
docker image prune -f

# Очистка кэша npm
npm cache clean --force
```

### 2. Мониторинг ресурсов

```bash
# Проверка места на диске
df -h

# Проверка памяти
free -h
```

### 3. Обновление зависимостей

```bash
# Обновление Puppeteer
npm update puppeteer

# Проверка уязвимостей
npm audit
```

## Поддержка

При возникновении проблем:

1. Проверьте логи: `docker-compose logs -f app`
2. Проверьте переменные окружения: `docker-compose config`
3. Попробуйте альтернативный Dockerfile: `docker-compose -f docker-compose.chrome.yml up -d`
4. Создайте Issue в репозитории с логами ошибки
