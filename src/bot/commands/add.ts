import { ExtendedContext, getMessageText } from "../../types";
import { botLogger } from "../../utils/logger";

export async function addCommand(ctx: ExtendedContext): Promise<void> {
  try {
    const messageText = getMessageText(ctx);
    if (!messageText) {
      await ctx.reply("❌ Ошибка: не удалось получить текст сообщения");
      return;
    }

    const args = messageText.split(" ").slice(1);

    if (!args || args.length === 0) {
      await ctx.reply(
        "📝 Использование: /add <ссылка на товар>\n\n" +
          "Примеры:\n" +
          "/add https://www.wildberries.ru/catalog/12345678/detail.aspx\n\n" +
          "Или просто отправьте ссылку на товар в чат!"
      );
      return;
    }

    const url = args[0];
    if (!url) {
      await ctx.reply("❌ Ошибка: не указана ссылка на товар");
      return;
    }

    // Проверяем, что это URL
    try {
      new URL(url);
    } catch {
      await ctx.reply(
        "❌ Неверный формат ссылки. Убедитесь, что ссылка начинается с http:// или https://"
      );
      return;
    }

    // Перенаправляем на обработку URL
    await ctx.reply("🔍 Обрабатываю ссылку...");

    // Вызываем обработчик URL из основного бота
    const bot = (ctx as any).bot;
    if (bot && typeof bot.handleProductUrl === "function") {
      await bot.handleProductUrl(ctx, url);
    } else {
      await ctx.reply("❌ Ошибка обработки. Попробуйте отправить ссылку напрямую в чат.");
    }
  } catch (error) {
    botLogger.error("Ошибка в команде add:", { error });
    await ctx.reply("❌ Произошла ошибка при добавлении товара. Попробуйте позже.");
  }
}
