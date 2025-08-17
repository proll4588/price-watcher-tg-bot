const { PrismaClient } = require("@prisma/client");
const Redis = require("ioredis");
const { Queue } = require("bullmq");

async function restoreRecurringJobs() {
  const prisma = new PrismaClient();
  const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
  const priceCheckQueue = new Queue("price-check", { connection: redis });

  try {
    console.log("🔧 Восстановление повторяющихся задач...\n");

    // Получаем все активные треки
    const activeTracks = await prisma.track.findMany({
      where: { isActive: true },
      include: {
        product: true,
        user: true,
      },
    });

    console.log(`📊 Найдено активных треков: ${activeTracks.length}\n`);

    // Получаем существующие повторяющиеся задачи
    const existingJobs = await priceCheckQueue.getRepeatableJobs();
    console.log(`🔄 Существующих повторяющихся задач: ${existingJobs.length}\n`);

    let restored = 0;
    let skipped = 0;

    for (const track of activeTracks) {
      const jobId = `recurring-price-check-${track.id}`;
      const existingJob = existingJobs.find(job => job.id === jobId);

      if (existingJob) {
        console.log(`⏭️  Пропускаю ${track.product?.title || "Товар"}: задача уже существует`);
        skipped++;
        continue;
      }

      try {
        // Создаем повторяющуюся задачу
        if (track.checkIntervalHours >= 1) {
          // Для интервалов >= 1 часа используем cron pattern
          const pattern = `0 */${Math.floor(track.checkIntervalHours)} * * *`;

          await priceCheckQueue.add(
            "recurring-price-check",
            { trackId: track.id },
            {
              repeat: { pattern },
              jobId,
            }
          );

          console.log(`✅ Восстановлен: ${track.product?.title || "Товар"} (${pattern})`);
        } else {
          // Для интервалов < 1 часа используем delay
          const intervalMinutes = Math.round(track.checkIntervalHours * 60);
          const delay = intervalMinutes * 60 * 1000;

          await priceCheckQueue.add(
            "recurring-price-check",
            { trackId: track.id },
            {
              delay,
              repeat: { every: delay },
              jobId,
            }
          );

          console.log(
            `✅ Восстановлен: ${track.product?.title || "Товар"} (${intervalMinutes} мин)`
          );
        }

        restored++;
      } catch (error) {
        console.error(`❌ Ошибка при восстановлении трека ${track.id}:`, error.message);
      }
    }

    console.log("\n📈 Результат:");
    console.log(`   Восстановлено: ${restored}`);
    console.log(`   Пропущено: ${skipped}`);

    // Проверяем итоговое количество
    const finalJobs = await priceCheckQueue.getRepeatableJobs();
    console.log(`   Всего повторяющихся задач: ${finalJobs.length}`);
  } catch (error) {
    console.error("❌ Ошибка при восстановлении задач:", error);
  } finally {
    await prisma.$disconnect();
    await redis.quit();
    await priceCheckQueue.close();
  }
}

restoreRecurringJobs();
