import { Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import { botLogger } from "../utils/logger";
import config from "../config";
import { databaseService } from "../services/database";
import { ProviderManager } from "../providers/manager";
import { queueService } from "../services/queue";
import { ExtendedContext, getMessageText } from "../types";

// Импортируем обработчики команд
import { startCommand } from "./commands/start";
import { addCommand } from "./commands/add";
import { listCommand } from "./commands/list";
import { removeCommand } from "./commands/remove";
import { settingsCommand } from "./commands/settings";
import { proCommand } from "./commands/pro";
import { helpCommand } from "./commands/help";

// Импортируем обработчики callback-запросов
import { handleCallbackQuery } from "./handlers/callback";

class TelegramBot {
  private bot?: Telegraf<ExtendedContext>;
  public providerManager: ProviderManager;

  constructor() {
    this.providerManager = new ProviderManager();

    if (!config.telegram.botToken) {
      botLogger.warn("TELEGRAM_BOT_TOKEN не установлен, Telegram бот не будет запущен");
      return;
    }

    this.bot = new Telegraf(config.telegram.botToken);
    this.setupMiddleware();
    this.setupCommands();
    this.setupHandlers();
  }

  private setupMiddleware(): void {
    if (!this.bot) return;

    // Middleware для логирования
    this.bot.use(async (ctx, next) => {
      const start = Date.now();
      await next();
      const ms = Date.now() - start;

      botLogger.info("Обработка сообщения", {
        userId: ctx.from?.id,
        username: ctx.from?.username,
        messageType: ctx.message ? "message" : "callback",
        duration: ms,
      });
    });

    // Middleware для получения пользователя из БД
    this.bot.use(async (ctx: ExtendedContext, next) => {
      if (ctx.from) {
        try {
          const user = await databaseService.getOrCreateUser(ctx.from.id, {
            username: ctx.from.username || undefined,
            firstName: ctx.from.first_name || undefined,
            lastName: ctx.from.last_name || undefined,
          } as any);

          // Добавляем пользователя в контекст
          ctx.user = user;
        } catch (error) {
          botLogger.error("Ошибка при получении пользователя:", {
            telegramId: ctx.from.id,
            error,
          });
        }
      }
      await next();
    });
  }

  private setupCommands(): void {
    if (!this.bot) return;

    // Основные команды
    this.bot.command("start", startCommand);
    this.bot.command("add", addCommand);
    this.bot.command("list", listCommand);
    this.bot.command("remove", removeCommand);
    this.bot.command("settings", settingsCommand);
    this.bot.command("pro", proCommand);
    this.bot.command("help", helpCommand);

    // Обработка текстовых сообщений (ссылок на товары)
    this.bot.on(message("text"), this.handleTextMessage.bind(this));
  }

  private setupHandlers(): void {
    if (!this.bot) return;

    // Обработка callback-запросов от inline-кнопок
    this.bot.on("callback_query", handleCallbackQuery);
  }

  private async handleTextMessage(ctx: ExtendedContext): Promise<void> {
    const text = getMessageText(ctx);
    if (!text || !ctx.from) return;

    // Проверяем, является ли сообщение ссылкой
    if (this.isUrl(text)) {
      await this.handleProductUrl(ctx, text);
    } else {
      await ctx.reply(
        "Отправьте ссылку на товар, чтобы начать отслеживание цены.\n\n" +
          "Поддерживаемые маркетплейсы:\n" +
          "• Ozon (ozon.ru)\n" +
          "• Wildberries (wildberries.ru)\n\n" +
          "Используйте /help для получения справки."
      );
    }
  }

  private async handleProductUrl(ctx: ExtendedContext, url: string): Promise<void> {
    try {
      const user = ctx.user;
      if (!user) {
        await ctx.reply("Ошибка: пользователь не найден. Попробуйте /start");
        return;
      }

      // Проверяем лимиты пользователя
      const stats = await databaseService.getUserStats(user.id);
      const maxProducts =
        user.subscriptionTier === "PRO"
          ? config.priceCheck.proTierMaxProducts
          : config.priceCheck.freeTierMaxProducts;

      if (stats.trackCount >= maxProducts) {
        const message =
          user.subscriptionTier === "FREE"
            ? `Вы достигли лимита отслеживаемых товаров (${maxProducts}).\n\n` +
              "Перейдите на Pro-подписку для отслеживания до 50 товаров!"
            : "Вы достигли максимального количества отслеживаемых товаров.";

        await ctx.reply(message);
        return;
      }

      // Получаем информацию о товаре
      await ctx.reply("🔍 Получаю информацию о товаре...");

      const productResult = await this.providerManager.getProductInfo(url);

      if (!productResult.success || !productResult.data) {
        await ctx.reply(
          `❌ Не удалось получить информацию о товаре:\n${productResult.error}\n\n` +
            "Убедитесь, что ссылка корректна и товар доступен."
        );
        return;
      }

      const productInfo = productResult.data;
      const normalizedUrl = this.providerManager.normalizeUrl(url);

      // Сохраняем товар в БД
      const product = await databaseService.getOrCreateProduct(
        normalizedUrl,
        this.getProviderFromUrl(url),
        {
          productId: productInfo.id,
          title: productInfo.title,
          imageUrl: productInfo.imageUrl || undefined,
          currentPrice: Number(productInfo.price.price),
        } as any
      );

      // Проверяем, не отслеживает ли пользователь уже этот товар
      const isAlreadyTracking = await databaseService.isUserTrackingProduct(user.id, product.id);
      if (isAlreadyTracking) {
        await ctx.reply(
          `🔄 Вы уже отслеживаете этот товар!\n\n` +
            `📦 ${productInfo.title}\n` +
            `💰 Цена: ${productInfo.price.price} ₽\n\n` +
            `Используйте /list для просмотра всех отслеживаемых товаров.`
        );
        return;
      }

      // Получаем количество пользователей, отслеживающих этот товар
      const trackingCount = await databaseService.getProductTrackingCount(product.id);

      // Создаем отслеживание
      let track;
      try {
        track = await databaseService.createTrack(user.id, product.id, {
          checkIntervalHours:
            user.subscriptionTier === "PRO"
              ? config.priceCheck.proCheckIntervalHours
              : config.priceCheck.defaultIntervalHours,
        });
      } catch (error) {
        if (error instanceof Error && error.message === "Товар уже отслеживается") {
          await ctx.reply(
            `🔄 Вы уже отслеживаете этот товар!\n\n` +
              `📦 ${productInfo.title}\n` +
              `💰 Цена: ${productInfo.price.price} ₽\n\n` +
              `Используйте /list для просмотра всех отслеживаемых товаров.`
          );
          return;
        }
        throw error;
      }

      // Создаем снимок цены
      await databaseService.createPriceSnapshot(product.id, Number(productInfo.price.price));

      // Добавляем задачу в очередь для повторяющихся проверок
      await queueService.addRecurringPriceCheckJob(track.id, track.checkIntervalHours);

      // Формируем ответное сообщение
      const priceText = `💰 Цена: ${productInfo.price.price} ₽`;

      let message =
        `✅ Товар добавлен в отслеживание!\n\n` +
        `📦 ${productInfo.title}\n` +
        `${priceText}\n\n` +
        `⏰ Проверка каждые ${track.checkIntervalHours < 1 ? Math.round(track.checkIntervalHours * 60) + " мин" : track.checkIntervalHours + " ч"}\n` +
        `📊 Отслеживаемых товаров: ${stats.trackCount + 1}/${maxProducts}`;

      // Добавляем информацию о других отслеживающих
      if (trackingCount > 1) {
        message += `\n👥 Еще ${trackingCount - 1} ${trackingCount === 2 ? "пользователь" : "пользователей"} отслеживает этот товар`;
      }

      await ctx.reply(message);
    } catch (error) {
      botLogger.error("Ошибка при обработке ссылки на товар:", {
        url,
        error,
      });
      await ctx.reply(
        "❌ Произошла ошибка при добавлении товара. Попробуйте позже или обратитесь в поддержку."
      );
    }
  }

  private isUrl(text: string): boolean {
    try {
      new URL(text);
      return true;
    } catch {
      return false;
    }
  }

  private getProviderFromUrl(url: string): string {
    if (url.includes("ozon.ru") || url.includes("ozon.com")) {
      return "ozon";
    } else if (url.includes("wildberries.ru") || url.includes("wildberries.com")) {
      return "wildberries";
    }
    return "unknown";
  }

  /**
   * Отправляет уведомление пользователю
   */
  async sendNotification(
    telegramId: number,
    message: string,
    options?: {
      parseMode?: "HTML" | "Markdown";
      replyMarkup?: any;
    }
  ): Promise<boolean> {
    try {
      if (!this.bot) {
        botLogger.warn("Telegram бот не настроен, уведомление не отправлено");
        return false;
      }
      await this.bot.telegram.sendMessage(telegramId, message, options as any);
      return true;
    } catch (error) {
      botLogger.error("Ошибка при отправке уведомления:", {
        telegramId,
        error,
      });
      return false;
    }
  }

  /**
   * Запускает бота
   */
  async start(): Promise<void> {
    try {
      if (!this.bot) {
        botLogger.info("Telegram бот не настроен, пропускаем запуск");
        return;
      }

      if (config.telegram.webhookUrl) {
        // Запуск через webhook
        await this.bot.telegram.setWebhook(config.telegram.webhookUrl);
        botLogger.info("Бот запущен через webhook", {
          url: config.telegram.webhookUrl,
        });
      } else {
        // Запуск через polling
        await this.bot.launch();
        botLogger.info("Бот запущен через polling");
      }
    } catch (error) {
      botLogger.error("Ошибка при запуске бота:", { error });
      throw error;
    }
  }

  /**
   * Останавливает бота
   */
  async stop(): Promise<void> {
    try {
      if (!this.bot) {
        botLogger.info("Telegram бот не настроен, пропускаем остановку");
        return;
      }
      await this.bot.stop();
      botLogger.info("Бот остановлен");
    } catch (error) {
      botLogger.error("Ошибка при остановке бота:", { error });
      throw error;
    }
  }

  /**
   * Получает экземпляр бота для middleware
   */
  getBot(): Telegraf<ExtendedContext> | undefined {
    return this.bot;
  }
}

export const telegramBot = new TelegramBot();
