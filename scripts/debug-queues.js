const Redis = require("ioredis");
const { Queue } = require("bullmq");

async function debugQueues() {
  const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
  const priceCheckQueue = new Queue("price-check", { connection: redis });

  try {
    console.log("🔍 Диагностика очередей...\n");

    // Получаем статистику очереди
    const jobCounts = await priceCheckQueue.getJobCounts();
    console.log("📊 Статистика очереди price-check:");
    console.log(JSON.stringify(jobCounts, null, 2));

    // Получаем повторяющиеся задачи
    const repeatableJobs = await priceCheckQueue.getRepeatableJobs();
    console.log("\n🔄 Повторяющиеся задачи:");
    console.log(`Всего: ${repeatableJobs.length}`);

    if (repeatableJobs.length > 0) {
      repeatableJobs.forEach((job, index) => {
        console.log(`\n${index + 1}. ID: ${job.id}`);
        console.log(`   Pattern: ${job.pattern || "N/A"}`);
        console.log(`   Every: ${job.every || "N/A"} ms`);
        console.log(`   Key: ${job.key}`);
      });
    }

    // Получаем последние задачи
    const recentJobs = await priceCheckQueue.getJobs(
      ["completed", "failed", "waiting", "active"],
      0,
      10
    );
    console.log("\n📋 Последние задачи:");
    console.log(`Всего: ${recentJobs.length}`);

    recentJobs.forEach((job, index) => {
      console.log(`\n${index + 1}. ID: ${job.id}`);
      console.log(`   Name: ${job.name}`);
      console.log(
        `   Status: ${job.finishedOn ? "completed" : job.failedReason ? "failed" : "active"}`
      );
      console.log(`   Data: ${JSON.stringify(job.data)}`);
      console.log(`   Created: ${new Date(job.timestamp).toLocaleString()}`);
    });
  } catch (error) {
    console.error("❌ Ошибка при диагностике:", error);
  } finally {
    await redis.quit();
    await priceCheckQueue.close();
  }
}

debugQueues();
