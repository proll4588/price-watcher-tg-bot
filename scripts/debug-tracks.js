const { PrismaClient } = require("@prisma/client");

async function debugTracks() {
  const prisma = new PrismaClient();

  try {
    console.log("🔍 Диагностика треков в базе данных...\n");

    // Получаем все треки с информацией о товарах и пользователях
    const tracks = await prisma.track.findMany({
      include: {
        product: true,
        user: {
          select: {
            id: true,
            telegramId: true,
            username: true,
            subscriptionTier: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    console.log(`📊 Всего треков: ${tracks.length}\n`);

    tracks.forEach((track, index) => {
      console.log(`${index + 1}. Трек ID: ${track.id}`);
      console.log(`   Активен: ${track.isActive ? "✅" : "❌"}`);
      console.log(`   Интервал проверки: ${track.checkIntervalHours} часов`);
      console.log(
        `   Последняя проверка: ${track.lastChecked ? new Date(track.lastChecked).toLocaleString() : "Никогда"}`
      );
      console.log(`   Создан: ${new Date(track.createdAt).toLocaleString()}`);

      if (track.product) {
        console.log(`   Товар: ${track.product.title}`);
        console.log(`   URL: ${track.product.url}`);
        console.log(`   Текущая цена: ${track.product.currentPrice} ₽`);
        console.log(`   Товар активен: ${track.product.isActive ? "✅" : "❌"}`);
      }

      if (track.user) {
        console.log(`   Пользователь: @${track.user.username || "без username"}`);
        console.log(`   Telegram ID: ${track.user.telegramId}`);
        console.log(`   Подписка: ${track.user.subscriptionTier}`);
      }

      console.log("");
    });

    // Статистика по активным трекам
    const activeTracks = tracks.filter(t => t.isActive);
    const inactiveTracks = tracks.filter(t => !t.isActive);

    console.log("📈 Статистика:");
    console.log(`   Активных треков: ${activeTracks.length}`);
    console.log(`   Неактивных треков: ${inactiveTracks.length}`);

    // Группировка по интервалам
    const intervalStats = {};
    activeTracks.forEach(track => {
      const interval = track.checkIntervalHours;
      intervalStats[interval] = (intervalStats[interval] || 0) + 1;
    });

    console.log("\n⏰ Распределение по интервалам:");
    Object.entries(intervalStats).forEach(([interval, count]) => {
      console.log(`   ${interval} часов: ${count} треков`);
    });
  } catch (error) {
    console.error("❌ Ошибка при диагностике треков:", error);
  } finally {
    await prisma.$disconnect();
  }
}

debugTracks();
