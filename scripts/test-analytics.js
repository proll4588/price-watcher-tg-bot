#!/usr/bin/env node

/**
 * Скрипт для тестирования системы аналитики
 * Проверяет API endpoints и метрики Prometheus
 */

const http = require("http");
const https = require("https");

const config = {
  baseUrl: process.env.BASE_URL || "http://localhost:3000",
  timeout: 10000,
};

// Цвета для консоли
const colors = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  reset: "\x1b[0m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith("https");
    const client = isHttps ? https : http;

    const requestOptions = {
      timeout: config.timeout,
      ...options,
    };

    const req = client.request(url, requestOptions, res => {
      let data = "";

      res.on("data", chunk => {
        data += chunk;
      });

      res.on("end", () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data,
        });
      });
    });

    req.on("error", error => {
      reject(error);
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

async function testHealthCheck() {
  log("\n🔍 Тестирование Health Check...", "blue");

  try {
    const response = await makeRequest(`${config.baseUrl}/health`);

    if (response.statusCode === 200) {
      const data = JSON.parse(response.data);
      log("✅ Health Check успешен", "green");
      log(`   Статус: ${data.status}`, "green");
      log(`   Uptime: ${Math.round(data.uptime)}s`, "green");
      log(`   Версия: ${data.version}`, "green");
      return true;
    } else {
      log(`❌ Health Check неудачен: ${response.statusCode}`, "red");
      return false;
    }
  } catch (error) {
    log(`❌ Ошибка Health Check: ${error.message}`, "red");
    return false;
  }
}

async function testMetrics() {
  log("\n📊 Тестирование метрик Prometheus...", "blue");

  try {
    const response = await makeRequest(`${config.baseUrl}/metrics`);

    if (response.statusCode === 200) {
      const data = response.data;

      // Проверяем наличие ключевых метрик
      const requiredMetrics = [
        "price_watcher_total_users",
        "price_watcher_active_users",
        "price_watcher_total_tracks",
        "price_watcher_active_tracks",
        "price_watcher_price_checks_total",
        "price_watcher_notifications_sent_total",
      ];

      const foundMetrics = requiredMetrics.filter(metric => data.includes(metric));

      log("✅ Метрики Prometheus доступны", "green");
      log(`   Найдено метрик: ${foundMetrics.length}/${requiredMetrics.length}`, "green");

      if (foundMetrics.length < requiredMetrics.length) {
        const missing = requiredMetrics.filter(metric => !data.includes(metric));
        log(`   Отсутствующие метрики: ${missing.join(", ")}`, "yellow");
      }

      return true;
    } else {
      log(`❌ Метрики недоступны: ${response.statusCode}`, "red");
      return false;
    }
  } catch (error) {
    log(`❌ Ошибка получения метрик: ${error.message}`, "red");
    return false;
  }
}

async function testStatsAPI() {
  log("\n📈 Тестирование API статистики...", "blue");

  try {
    const response = await makeRequest(`${config.baseUrl}/api/stats`);

    if (response.statusCode === 200) {
      const data = JSON.parse(response.data);
      log("✅ API статистики работает", "green");
      log(`   Пользователи: ${data.users?.total || 0}`, "green");
      log(`   Активные пользователи: ${data.users?.active || 0}`, "green");
      log(`   Отслеживания: ${data.tracks?.total || 0}`, "green");
      log(`   Активные отслеживания: ${data.tracks?.active || 0}`, "green");
      log(`   Товары: ${data.products?.total || 0}`, "green");
      log(`   Активные товары: ${data.products?.active || 0}`, "green");
      return true;
    } else {
      log(`❌ API статистики недоступен: ${response.statusCode}`, "red");
      return false;
    }
  } catch (error) {
    log(`❌ Ошибка API статистики: ${error.message}`, "red");
    return false;
  }
}

async function testAnalyticsAPI() {
  log("\n📊 Тестирование API аналитики...", "blue");

  try {
    const response = await makeRequest(`${config.baseUrl}/api/analytics`);

    if (response.statusCode === 200) {
      const data = JSON.parse(response.data);
      log("✅ API аналитики работает", "green");
      log(`   Новые пользователи (сегодня): ${data.users?.new?.today || 0}`, "green");
      log(`   Новые пользователи (неделя): ${data.users?.new?.week || 0}`, "green");
      log(`   Новые пользователи (месяц): ${data.users?.new?.month || 0}`, "green");
      log(`   Запросы на отслеживание (сегодня): ${data.tracks?.requests?.today || 0}`, "green");
      log(`   Запросы на отслеживание (неделя): ${data.tracks?.requests?.week || 0}`, "green");
      log(`   Уведомления (сегодня): ${data.notifications?.today || 0}`, "green");
      log(`   Уведомления (неделя): ${data.notifications?.week || 0}`, "green");
      return true;
    } else {
      log(`❌ API аналитики недоступен: ${response.statusCode}`, "red");
      return false;
    }
  } catch (error) {
    log(`❌ Ошибка API аналитики: ${error.message}`, "red");
    return false;
  }
}

async function testGrafanaConnection() {
  log("\n📊 Проверка подключения к Grafana...", "blue");

  const grafanaUrl = process.env.GRAFANA_URL || "http://localhost:3001";

  try {
    const response = await makeRequest(`${grafanaUrl}/api/health`);

    if (response.statusCode === 200) {
      const data = JSON.parse(response.data);
      log("✅ Grafana доступен", "green");
      log(`   Статус: ${data.database}`, "green");
      return true;
    } else {
      log(`❌ Grafana недоступен: ${response.statusCode}`, "red");
      return false;
    }
  } catch (error) {
    log(`❌ Ошибка подключения к Grafana: ${error.message}`, "red");
    log("   Убедитесь, что Grafana запущен и доступен", "yellow");
    return false;
  }
}

async function runAllTests() {
  log("🚀 Запуск тестов системы аналитики", "blue");
  log(`   Базовый URL: ${config.baseUrl}`, "blue");

  const results = {
    healthCheck: await testHealthCheck(),
    metrics: await testMetrics(),
    statsAPI: await testStatsAPI(),
    analyticsAPI: await testAnalyticsAPI(),
    grafana: await testGrafanaConnection(),
  };

  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;

  log("\n📋 Результаты тестирования:", "blue");
  log(`   Пройдено: ${passed}/${total}`, passed === total ? "green" : "yellow");

  if (passed === total) {
    log("\n🎉 Все тесты пройдены успешно!", "green");
    log("   Система аналитики работает корректно", "green");
  } else {
    log("\n⚠️  Некоторые тесты не пройдены", "yellow");
    log("   Проверьте логи и настройки", "yellow");
  }

  return passed === total;
}

// Запуск тестов
if (require.main === module) {
  runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      log(`❌ Критическая ошибка: ${error.message}`, "red");
      process.exit(1);
    });
}

module.exports = {
  runAllTests,
  testHealthCheck,
  testMetrics,
  testStatsAPI,
  testAnalyticsAPI,
  testGrafanaConnection,
};
