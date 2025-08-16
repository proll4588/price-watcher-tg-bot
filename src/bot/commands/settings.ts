import { Context } from "telegraf";
import { InlineKeyboardMarkup } from "telegraf/typings/core/types/typegram";
import { botLogger } from "../../utils/logger";
import { databaseService } from "../../services/database";
import config from "../../config";

export async function settingsCommand(ctx: Context): Promise<void> {
  try {
    const user = (ctx as any).user;
    if (!user) {
      await ctx.reply("❌ Ошибка: пользователь не найден");
      return;
    }

    const stats = await databaseService.getUserStats(user.id);
    const maxProducts =
      user.subscriptionTier === "PRO"
        ? config.priceCheck.proTierMaxProducts
        : config.priceCheck.freeTierMaxProducts;

    const checkInterval =
      user.subscriptionTier === "PRO"
        ? config.priceCheck.proCheckIntervalHours
        : config.priceCheck.defaultIntervalHours;

    const settingsMessage =
      `⚙️ Настройки аккаунта\n\n` +
      `👤 Пользователь: ${user.firstName || user.username || "Не указано"}\n` +
      `📊 Тариф: ${user.subscriptionTier === "PRO" ? "⭐️ Pro" : "🆓 Бесплатный"}\n` +
      `📦 Отслеживаемых товаров: ${stats.trackCount}/${maxProducts}\n` +
      `⏰ Интервал проверки: каждые ${checkInterval} ч.\n` +
      `🔔 Непрочитанных уведомлений: ${stats.unreadNotifications}\n\n` +
      `📅 Дата регистрации: ${user.createdAt.toLocaleDateString("ru-RU")}\n` +
      `${user.subscriptionExpiresAt ? `📅 Pro до: ${user.subscriptionExpiresAt.toLocaleDateString("ru-RU")}\n` : ""}` +
      `\n` +
      `🔧 Доступные действия:`;

    // Создаем inline-кнопки для настроек
    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: [
        [
          { text: "⏱ Изменить интервал", callback_data: "settings_interval" },
          { text: "🔔 Настройки уведомлений", callback_data: "settings_notifications" },
        ],
        [
          { text: "🗑 Удалить все товары", callback_data: "settings_clear_all" },
          { text: "📊 Экспорт данных", callback_data: "settings_export" },
        ],
        [{ text: "⭐️ Pro-подписка", callback_data: "pro_subscription" }],
        [{ text: "🔙 Назад", callback_data: "back_to_main" }],
      ],
    };

    await ctx.reply(settingsMessage, { reply_markup: keyboard });

    botLogger.info("Пользователь открыл настройки", {
      userId: user.id,
    });
  } catch (error) {
    botLogger.error("Ошибка в команде settings:", { error });
    await ctx.reply("❌ Произошла ошибка при загрузке настроек. Попробуйте позже.");
  }
}
