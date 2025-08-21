#!/usr/bin/env node

const Redis = require("ioredis");
const { Queue } = require("bullmq");

// Конфигурация Redis
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const redis = new Redis(redisUrl);

async function debugWorkers() {
  console.log("🔍 Проверка состояния воркеров...\n");

  try {
    // Создаем экземпляры очередей
    const priceCheckQueue = new Queue("price-check", { connection: redis });
    const notificationQueue = new Queue("notification", { connection: redis });

    // Получаем статистику очередей
    const [priceCheckStats, notificationStats] = await Promise.all([
      priceCheckQueue.getJobCounts(),
      notificationQueue.getJobCounts(),
    ]);

    console.log("📊 Статистика очередей:");
    console.log("┌─────────────────────┬─────────────┬─────────────┐");
    console.log("│ Очередь             │ Проверка цен│ Уведомления │");
    console.log("├─────────────────────┼─────────────┼─────────────┤");
    console.log(
      `│ Ожидающие           │ ${String(priceCheckStats.waiting || 0).padStart(11)} │ ${String(notificationStats.waiting || 0).padStart(11)} │`
    );
    console.log(
      `│ Активные            │ ${String(priceCheckStats.active || 0).padStart(11)} │ ${String(notificationStats.active || 0).padStart(11)} │`
    );
    console.log(
      `│ Завершенные         │ ${String(priceCheckStats.completed || 0).padStart(11)} │ ${String(notificationStats.completed || 0).padStart(11)} │`
    );
    console.log(
      `│ Неудачные           │ ${String(priceCheckStats.failed || 0).padStart(11)} │ ${String(notificationStats.failed || 0).padStart(11)} │`
    );
    console.log(
      `│ Отложенные          │ ${String(priceCheckStats.delayed || 0).padStart(11)} │ ${String(notificationStats.delayed || 0).padStart(11)} │`
    );
    console.log("└─────────────────────┴─────────────┴─────────────┘\n");

    // Получаем повторяющиеся задачи
    const repeatableJobs = await priceCheckQueue.getRepeatableJobs();
    console.log(`🔄 Повторяющиеся задачи: ${repeatableJobs.length}`);

    if (repeatableJobs.length > 0) {
      console.log("┌─────────────────────┬─────────────────────┬─────────────────────┐");
      console.log("│ ID                  │ Pattern             │ Next Run            │");
      console.log("├─────────────────────┼─────────────────────┼─────────────────────┤");

      repeatableJobs.slice(0, 10).forEach(job => {
        const id = job.id.substring(0, 18);
        const pattern = job.pattern || job.every || "N/A";
        const nextRun = job.next ? new Date(job.next).toLocaleString() : "N/A";
        console.log(`│ ${id.padEnd(19)} │ ${String(pattern).padEnd(19)} │ ${nextRun.padEnd(19)} │`);
      });

      if (repeatableJobs.length > 10) {
        console.log(`│ ... и еще ${repeatableJobs.length - 10} задач`);
      }
      console.log("└─────────────────────┴─────────────────────┴─────────────────────┘\n");
    }

    // Получаем последние задачи
    const [recentPriceChecks, recentNotifications] = await Promise.all([
      priceCheckQueue.getJobs(["completed", "failed"], 0, 5),
      notificationQueue.getJobs(["completed", "failed"], 0, 5),
    ]);

    console.log("📋 Последние задачи проверки цен:");
    recentPriceChecks.forEach(job => {
      const status = job.finishedOn ? "✅" : "❌";
      const time = job.finishedOn ? new Date(job.finishedOn).toLocaleString() : "N/A";
      console.log(`${status} ${job.id} - ${job.name} - ${time}`);
    });

    console.log("\n📋 Последние задачи уведомлений:");
    recentNotifications.forEach(job => {
      const status = job.finishedOn ? "✅" : "❌";
      const time = job.finishedOn ? new Date(job.finishedOn).toLocaleString() : "N/A";
      console.log(`${status} ${job.id} - ${job.name} - ${time}`);
    });

    // Проверяем подключение к Redis
    const redisInfo = await redis.info("server");
    console.log("\n🔗 Состояние Redis:");
    console.log("✅ Подключение активно");

    // Проверяем метрики приложения
    try {
      const response = await fetch("http://localhost:3000/metrics");
      if (response.ok) {
        const metrics = await response.text();
        const workerHealthMatches = metrics.match(
          /price_watcher_worker_health\{worker="([^"]+)"\} (\d+)/g
        );
        const workerUptimeMatches = metrics.match(
          /price_watcher_worker_uptime_seconds\{worker="([^"]+)"\} (\d+)/g
        );

        console.log("\n📈 Метрики воркеров:");
        if (workerHealthMatches) {
          workerHealthMatches.forEach(match => {
            const [, worker, health] = match.match(
              /price_watcher_worker_health\{worker="([^"]+)"\} (\d+)/
            );
            const status = health === "1" ? "🟢" : "🔴";
            console.log(`${status} ${worker}: ${health === "1" ? "Здоров" : "Нездоров"}`);
          });
        }

        if (workerUptimeMatches) {
          workerUptimeMatches.forEach(match => {
            const [, worker, uptime] = match.match(
              /price_watcher_worker_uptime_seconds\{worker="([^"]+)"\} (\d+)/
            );
            const hours = Math.floor(uptime / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            console.log(`⏱️  ${worker}: ${hours}ч ${minutes}м`);
          });
        }
      }
    } catch (error) {
      console.log("\n⚠️  Не удалось получить метрики приложения:", error.message);
    }
  } catch (error) {
    console.error("❌ Ошибка при проверке воркеров:", error);
  } finally {
    await redis.quit();
    process.exit(0);
  }
}

// Запускаем отладку
debugWorkers();
