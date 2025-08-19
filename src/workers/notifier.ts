import { Job } from "bullmq";
import { databaseService } from "../services/database";
import { telegramBot } from "../bot";
import { queueService } from "../services/queue";
import { queueLogger } from "../utils/logger";
import { metricsService } from "../services/metrics";

class NotifierWorker {
  constructor() {
    this.setupWorker();
  }

  private setupWorker(): void {
    queueService.setNotificationHandler(this.handleNotification.bind(this));
    queueLogger.info("Воркер уведомлений запущен");
  }

  private async handleNotification(job: Job): Promise<void> {
    const { userId, type, title, message, notificationData } = job.data;

    try {
      queueLogger.info("Отправка уведомления", {
        userId,
        type,
        title,
        notificationId: notificationData?.notificationId,
      });

      // Получаем пользователя
      const user = await databaseService.getUserById(userId);
      if (!user) {
        queueLogger.warn("Пользователь не найден", { userId });
        return;
      }

      // Проверяем, не заблокирован ли бот пользователем
      const telegramId = Number(user.telegramId);

      // Отправляем уведомление
      const success = await telegramBot.sendNotification(telegramId, message, {
        parseMode: "HTML",
        replyMarkup: this.createNotificationKeyboard(type, notificationData),
      });

      if (success) {
        // Помечаем уведомление как отправленное по ID уведомления
        if (notificationData?.notificationId) {
          await databaseService.markNotificationAsSent(notificationData.notificationId);
        } else if (job.id) {
          // Fallback для старых уведомлений без notificationId
          await databaseService.markNotificationAsSent(job.id);
        }

        // Увеличиваем счетчик отправленных уведомлений
        metricsService.incrementNotificationSent(type, "success");

        queueLogger.info("Уведомление отправлено успешно", {
          userId,
          type,
          telegramId,
          notificationId: notificationData?.notificationId,
        });
      } else {
        queueLogger.error("Не удалось отправить уведомление", {
          userId,
          type,
          telegramId,
          notificationId: notificationData?.notificationId,
        });

        // Увеличиваем счетчик неудачных уведомлений
        metricsService.incrementNotificationFailed(type, "user_blocked");

        // Если пользователь заблокировал бота, деактивируем отслеживания
        await this.handleBlockedUser(userId);
      }
    } catch (error) {
      queueLogger.error("Ошибка при отправке уведомления", {
        userId,
        type,
        error,
        notificationId: notificationData?.notificationId,
      });

      // Увеличиваем счетчик ошибок воркера
      metricsService.incrementWorkerError("notifier", "notification_failed");

      throw error;
    }
  }

  private createNotificationKeyboard(type: string, notificationData?: any): any {
    const keyboard = {
      inline_keyboard: [] as any[][],
    };

    switch (type) {
      case "PRICE_DROP":
        if (notificationData?.affiliateUrl) {
          keyboard.inline_keyboard.push([
            { text: "🛒 Купить со скидкой", url: notificationData.affiliateUrl },
          ]);
        }
        keyboard.inline_keyboard.push([
          { text: "📋 Мои товары", callback_data: "list_products" },
          { text: "⚙️ Настройки", callback_data: "settings" },
        ]);
        break;

      case "PRICE_INCREASE":
        keyboard.inline_keyboard.push([
          { text: "📋 Мои товары", callback_data: "list_products" },
          {
            text: "🗑 Удалить отслеживание",
            callback_data: `remove_${notificationData?.trackId || ""}`,
          },
        ]);
        break;

      case "PRODUCT_UNAVAILABLE":
        keyboard.inline_keyboard.push([
          { text: "📋 Мои товары", callback_data: "list_products" },
          {
            text: "🗑 Удалить отслеживание",
            callback_data: `remove_${notificationData?.trackId || ""}`,
          },
        ]);
        break;

      case "SYSTEM":
        keyboard.inline_keyboard.push([
          { text: "📋 Мои товары", callback_data: "list_products" },
          { text: "❓ Помощь", callback_data: "help" },
        ]);
        break;
    }

    return keyboard;
  }

  private async handleBlockedUser(userId: string): Promise<void> {
    try {
      // Получаем все отслеживания пользователя
      const tracks = await databaseService.getUserTracks(userId);

      // Деактивируем все отслеживания
      for (const track of tracks) {
        await databaseService.deactivateTrack(track.id);
        await queueService.removeRecurringPriceCheckJob(track.id);
      }

      // Создаем системное уведомление в БД
      await databaseService.createNotification(userId, {
        type: "SYSTEM",
        title: "Бот заблокирован",
        message: "Пользователь заблокировал бота. Все отслеживания деактивированы.",
      });

      queueLogger.info("Пользователь заблокировал бота, отслеживания деактивированы", {
        userId,
        tracksCount: tracks.length,
      });
    } catch (error) {
      queueLogger.error("Ошибка при обработке заблокированного пользователя", {
        userId,
        error,
      });
    }
  }

  /**
   * Отправляет массовое уведомление всем пользователям
   */
  async sendBroadcastNotification(
    message: string,
    options?: {
      type?: "SYSTEM" | "PRICE_DROP" | "PRICE_INCREASE" | "PRODUCT_UNAVAILABLE";
      title?: string;
      excludeInactive?: boolean;
    }
  ): Promise<{ sent: number; failed: number }> {
    try {
      const users = await databaseService.getAllActiveUsers();
      let sent = 0;
      let failed = 0;

      for (const user of users) {
        try {
          const success = await telegramBot.sendNotification(Number(user.telegramId), message, {
            parseMode: "HTML",
          });

          if (success) {
            sent++;

            // Создаем запись в БД
            await databaseService.createNotification(user.id, {
              type: options?.type || "SYSTEM",
              title: options?.title || "Системное уведомление",
              message,
            });
          } else {
            failed++;
          }

          // Небольшая задержка между отправками
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          failed++;
          queueLogger.error("Ошибка при массовой отправке", {
            userId: user.id,
            error,
          });
        }
      }

      queueLogger.info("Массовая рассылка завершена", { sent, failed });
      return { sent, failed };
    } catch (error) {
      queueLogger.error("Ошибка при массовой рассылке", { error });
      throw error;
    }
  }

  /**
   * Отправляет уведомление о скором окончании Pro-подписки
   */
  async sendProExpirationReminder(userId: string, daysLeft: number): Promise<void> {
    try {
      const user = await databaseService.getUserById(userId);
      if (!user || user.subscriptionTier !== "PRO") {
        return;
      }

      const message =
        `⚠️ Напоминание о Pro-подписке\n\n` +
        `Ваша Pro-подписка истекает через ${daysLeft} ${this.getDaysWord(daysLeft)}.\n\n` +
        `Для продления подписки обратитесь в поддержку:\n` +
        `@support_username`;

      const success = await telegramBot.sendNotification(Number(user.telegramId), message);

      if (success) {
        await databaseService.createNotification(userId, {
          type: "SYSTEM",
          title: "Напоминание о Pro-подписке",
          message,
        });
      }
    } catch (error) {
      queueLogger.error("Ошибка при отправке напоминания о Pro-подписке", {
        userId,
        error,
      });
    }
  }

  private getDaysWord(days: number): string {
    if (days === 1) return "день";
    if (days >= 2 && days <= 4) return "дня";
    return "дней";
  }
}

// Запускаем воркер
const notifierWorker = new NotifierWorker();

// Экспортируем для использования в других модулях
export { notifierWorker };

// Обработка сигналов завершения
process.on("SIGINT", async () => {
  queueLogger.info("Получен сигнал SIGINT, завершаю работу...");
  await queueService.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  queueLogger.info("Получен сигнал SIGTERM, завершаю работу...");
  await queueService.close();
  process.exit(0);
});
