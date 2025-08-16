import { ExtendedContext, getMessageText } from "../../types";
import { botLogger } from "../../utils/logger";
import { databaseService } from "../../services/database";
import { queueService } from "../../services/queue";

export async function removeCommand(ctx: ExtendedContext): Promise<void> {
  try {
    const user = ctx.user;
    if (!user) {
      await ctx.reply("❌ Ошибка: пользователь не найден");
      return;
    }

    const messageText = getMessageText(ctx);
    if (!messageText) {
      await ctx.reply("❌ Ошибка: не удалось получить текст сообщения");
      return;
    }

    const args = messageText.split(" ").slice(1);

    if (!args || args.length === 0) {
      await ctx.reply(
        "📝 Использование: /remove <ID товара>\n\n" +
          "Чтобы узнать ID товара, используйте команду /list\n\n" +
          "Или используйте inline-кнопки в списке товаров для удаления."
      );
      return;
    }

    const trackId = args[0];

    // Проверяем, что ID корректный
    if (!trackId || !/^[a-zA-Z0-9]+$/.test(trackId)) {
      await ctx.reply("❌ Неверный формат ID товара");
      return;
    }

    // Удаляем отслеживание
    const deleted = await databaseService.deleteTrack(trackId, user.id);

    if (deleted) {
      // Удаляем повторяющуюся задачу из очереди
      await queueService.removeRecurringPriceCheckJob(trackId);

      await ctx.reply("✅ Товар удален из отслеживания");

      botLogger.info("Пользователь удалил товар из отслеживания", {
        userId: user.id,
        trackId,
      });
    } else {
      await ctx.reply("❌ Товар не найден или уже удален");
    }
  } catch (error) {
    botLogger.error("Ошибка в команде remove:", { error });
    await ctx.reply("❌ Произошла ошибка при удалении товара. Попробуйте позже.");
  }
}
