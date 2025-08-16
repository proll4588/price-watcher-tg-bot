import { Context } from "telegraf";
import { InlineKeyboardMarkup } from "telegraf/typings/core/types/typegram";
import { botLogger } from "../../utils/logger";
import { databaseService } from "../../services/database";
import { formatPrice } from "../../utils/formatters";

export async function listCommand(ctx: Context): Promise<void> {
  try {
    const user = (ctx as any).user;
    if (!user) {
      await ctx.reply("❌ Ошибка: пользователь не найден");
      return;
    }

    const tracks = await databaseService.getUserTracks(user.id);

    if (tracks.length === 0) {
      await ctx.reply(
        "📝 У вас пока нет отслеживаемых товаров.\n\n" +
          "Отправьте ссылку на товар с Ozon или Wildberries, чтобы начать отслеживание!"
      );
      return;
    }

    // Группируем товары по провайдерам
    const tracksByProvider = tracks.reduce(
      (acc, track) => {
        const provider = track.product.provider;
        if (!acc[provider]) {
          acc[provider] = [];
        }
        acc[provider].push(track);
        return acc;
      },
      {} as Record<string, typeof tracks>
    );

    let message = `📋 Ваши отслеживаемые товары (${tracks.length}):\n\n`;

    for (const [provider, providerTracks] of Object.entries(tracksByProvider)) {
      const providerName = getProviderDisplayName(provider);
      message += `🏪 ${providerName} (${providerTracks.length}):\n`;

      for (const track of providerTracks) {
        const priceText = track.product.currentPrice
          ? formatPrice(track.product.currentPrice)
          : "Цена не указана";

        const title = track.product.title || "Без названия";
        const shortTitle = title.length > 50 ? title.substring(0, 47) + "..." : title;

        message += `• ${shortTitle}\n`;
        message += `  💰 ${priceText}\n`;
        message += `  ⏰ Проверка каждые ${track.checkIntervalHours < 1 ? Math.round(track.checkIntervalHours * 60) + " мин" : track.checkIntervalHours + " ч"}\n`;

        if (track.minPrice || track.maxPrice || track.discountThreshold) {
          const filters: string[] = [];
          if (track.minPrice) filters.push(`мин: ${formatPrice(track.minPrice)}`);
          if (track.maxPrice) filters.push(`макс: ${formatPrice(track.maxPrice)}`);
          if (track.discountThreshold) filters.push(`скидка: ${track.discountThreshold}%`);
          message += `  🔍 Фильтры: ${filters.join(", ")}\n`;
        }

        message += "\n";
      }
    }

    // Создаем inline-кнопки для управления
    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: [
        [
          { text: "⚙️ Настройки", callback_data: "settings" },
          { text: "🗑 Удалить все", callback_data: "remove_all" },
        ],
        [{ text: "⭐️ Pro-подписка", callback_data: "pro_subscription" }],
      ],
    };

    await ctx.reply(message, { reply_markup: keyboard });

    botLogger.info("Пользователь запросил список товаров", {
      userId: user.id,
      trackCount: tracks.length,
    });
  } catch (error) {
    botLogger.error("Ошибка в команде list:", { error });
    await ctx.reply("❌ Произошла ошибка при получении списка товаров. Попробуйте позже.");
  }
}

function getProviderDisplayName(provider: string): string {
  switch (provider) {
    case "ozon":
      return "Ozon";
    case "wildberries":
      return "Wildberries";
    case "yandex_market":
      return "Яндекс.Маркет";
    default:
      return provider.charAt(0).toUpperCase() + provider.slice(1);
  }
}
