import { botLogger } from "../../utils/logger";
import { databaseService } from "../../services/database";
import config from "../../config";
import { ExtendedContext } from "../../types";

export async function startCommand(ctx: ExtendedContext): Promise<void> {
  try {
    const user = ctx.user;
    if (!user) {
      await ctx.reply("❌ Ошибка: пользователь не найден");
      return;
    }

    const stats = await databaseService.getUserStats(user.id);
    const maxProducts =
      user.subscriptionTier === "PRO"
        ? config.priceCheck.proTierMaxProducts
        : config.priceCheck.freeTierMaxProducts;

    const welcomeMessage =
      `👋 Привет! Я Price Watcher - бот для отслеживания цен на товары.\n\n` +
      `🎯 Как это работает:\n` +
      `• Отправьте ссылку на товар с Wildberries\n` +
      `• Я буду проверять цену каждые ${user.subscriptionTier === "PRO" ? (config.priceCheck.proCheckIntervalHours < 1 ? Math.round(config.priceCheck.proCheckIntervalHours * 60) + " минут" : config.priceCheck.proCheckIntervalHours + " часов") : config.priceCheck.defaultIntervalHours < 1 ? Math.round(config.priceCheck.defaultIntervalHours * 60) + " минут" : config.priceCheck.defaultIntervalHours + " часов"}\n` +
      `• При снижении цены вы получите уведомление\n\n` +
      `📊 Ваша статистика:\n` +
      `• Отслеживаемых товаров: ${stats.trackCount}/${maxProducts}\n` +
      `• Непрочитанных уведомлений: ${stats.unreadNotifications}\n` +
      `• Тариф: ${user.subscriptionTier === "PRO" ? "Pro" : "Бесплатный"}\n\n` +
      `🚀 Начните отслеживание, отправив ссылку на товар!\n\n` +
      `📋 Доступные команды:\n` +
      `/list - Список отслеживаемых товаров\n` +
      `/settings - Настройки\n` +
      `/pro - Pro-подписка\n` +
      `/help - Справка`;

    await ctx.reply(welcomeMessage);

    botLogger.info("Пользователь запустил бота", {
      userId: user.id,
      telegramId: user.telegramId,
      subscriptionTier: user.subscriptionTier,
    });
  } catch (error) {
    botLogger.error("Ошибка в команде start:", { error });
    await ctx.reply("❌ Произошла ошибка. Попробуйте позже.");
  }
}
