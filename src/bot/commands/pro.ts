import { Context } from "telegraf";
import { InlineKeyboardMarkup } from "telegraf/typings/core/types/typegram";
import { botLogger } from "../../utils/logger";
import { databaseService } from "../../services/database";

export async function proCommand(ctx: Context): Promise<void> {
  try {
    const user = (ctx as any).user;
    if (!user) {
      await ctx.reply("❌ Ошибка: пользователь не найден");
      return;
    }

    const isPro = user.subscriptionTier === "PRO";
    const stats = await databaseService.getUserStats(user.id);

    let message = "";

    if (isPro) {
      message =
        `⭐️ У вас активна Pro-подписка!\n\n` +
        `🎉 Преимущества Pro:\n` +
        `✅ До 50 отслеживаемых товаров\n` +
        `✅ Проверка цен каждые 2 часа\n` +
        `✅ Расширенные фильтры цен\n` +
        `✅ Приоритетная поддержка\n` +
        `✅ Экспорт данных\n\n` +
        `📊 Ваша статистика:\n` +
        `📦 Отслеживаемых товаров: ${stats.trackCount}/50\n` +
        `🔔 Непрочитанных уведомлений: ${stats.unreadNotifications}\n\n`;

      if (user.subscriptionExpiresAt) {
        const daysLeft = Math.ceil(
          (user.subscriptionExpiresAt.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        );
        message += `📅 Подписка активна еще ${daysLeft} дней\n\n`;
      }

      message += `💳 Для продления подписки нажмите кнопку ниже:`;
    } else {
      message =
        `⭐️ Pro-подписка - расширенные возможности\n\n` +
        `🆓 Текущий тариф: Бесплатный\n` +
        `📦 Отслеживаемых товаров: ${stats.trackCount}/3\n` +
        `⏰ Проверка цен: каждые 6 часов\n\n` +
        `🚀 Преимущества Pro (99₽/мес):\n` +
        `✅ До 50 отслеживаемых товаров\n` +
        `✅ Проверка цен каждые 2 часа\n` +
        `✅ Расширенные фильтры цен\n` +
        `✅ Приоритетная поддержка\n` +
        `✅ Экспорт данных\n` +
        `✅ Партнерские ссылки\n\n` +
        `💡 Пример экономии:\n` +
        `Если вы отслеживаете 10 товаров и один из них подешевеет на 1000₽, ` +
        `то Pro-подписка окупится за один день!\n\n` +
        `💳 Оформить Pro-подписку:`;
    }

    // Создаем inline-кнопки
    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: [
        [
          {
            text: isPro ? "🔄 Продлить подписку" : "💳 Оформить Pro",
            callback_data: "pro_subscription",
          },
        ],
        [{ text: "📊 Сравнить тарифы", callback_data: "pro_compare" }],
        [{ text: "❓ FAQ", callback_data: "pro_faq" }],
        [{ text: "🔙 Назад", callback_data: "back_to_main" }],
      ],
    };

    await ctx.reply(message, { reply_markup: keyboard });

    botLogger.info("Пользователь открыл информацию о Pro-подписке", {
      userId: user.id,
      isPro,
    });
  } catch (error) {
    botLogger.error("Ошибка в команде pro:", { error });
    await ctx.reply(
      "❌ Произошла ошибка при загрузке информации о Pro-подписке. Попробуйте позже."
    );
  }
}
