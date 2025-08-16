import { Context } from "telegraf";
import { botLogger } from "../../utils/logger";
import { databaseService } from "../../services/database";
import { queueService } from "../../services/queue";

export async function handleCallbackQuery(ctx: Context): Promise<void> {
  try {
    const callbackQuery = ctx.callbackQuery;
    if (!callbackQuery || !("data" in callbackQuery)) {
      return;
    }

    const data = callbackQuery.data;
    const user = (ctx as any).user;

    if (!user) {
      await ctx.answerCbQuery("❌ Ошибка: пользователь не найден");
      return;
    }

    botLogger.info("Обработка callback-запроса", {
      userId: user.id,
      data,
    });

    // Обрабатываем различные типы callback-запросов
    switch (data) {
      case "settings":
        await handleSettings(ctx);
        break;

      case "settings_interval":
        await handleSettingsInterval(ctx, user);
        break;

      case "settings_notifications":
        await handleSettingsNotifications(ctx);
        break;

      case "settings_clear_all":
        await handleSettingsClearAll(ctx);
        break;

      case "settings_export":
        await handleSettingsExport(ctx, user);
        break;

      case "pro_subscription":
        await handleProSubscription(ctx, user);
        break;

      case "pro_compare":
        await handleProCompare(ctx);
        break;

      case "pro_faq":
        await handleProFaq(ctx);
        break;

      case "remove_all":
        await handleRemoveAll(ctx, user);
        break;

      case "back_to_main":
        await handleBackToMain(ctx);
        break;

      default:
        // Проверяем, не является ли это callback для удаления конкретного товара
        if (data.startsWith("remove_")) {
          const trackId = data.replace("remove_", "");
          await handleRemoveTrack(ctx, user, trackId);
        } else {
          await ctx.answerCbQuery("❌ Неизвестная команда");
        }
        break;
    }
  } catch (error) {
    botLogger.error("Ошибка при обработке callback-запроса:", { error });
    await ctx.answerCbQuery("❌ Произошла ошибка");
  }
}

async function handleSettings(ctx: Context): Promise<void> {
  // Импортируем команду settings
  const { settingsCommand } = await import("../commands/settings");
  await settingsCommand(ctx);
  await ctx.answerCbQuery();
}

async function handleSettingsInterval(ctx: Context, user: any): Promise<void> {
  const message =
    `⏱ Настройка интервала проверки\n\n` +
    `Текущий интервал: каждые ${user.subscriptionTier === "PRO" ? "2" : "6"} часов\n\n` +
    `Доступные интервалы:\n` +
    `${user.subscriptionTier === "PRO" ? "• 1 час (Pro)\n• 2 часа (Pro)\n• 4 часа (Pro)\n" : ""}` +
    `• 6 часов\n• 12 часов\n• 24 часа\n\n` +
    `Для изменения интервала используйте команду:\n` +
    `/interval <часы>`;

  await ctx.editMessageText(message);
  await ctx.answerCbQuery();
}

async function handleSettingsNotifications(ctx: Context): Promise<void> {
  const message =
    `🔔 Настройки уведомлений\n\n` +
    `Типы уведомлений:\n` +
    `✅ Снижение цены\n` +
    `✅ Повышение цены\n` +
    `✅ Товар недоступен\n` +
    `✅ Системные уведомления\n\n` +
    `Настройки по умолчанию включены для всех типов.\n\n` +
    `Для изменения настроек обратитесь в поддержку.`;

  await ctx.editMessageText(message);
  await ctx.answerCbQuery();
}

async function handleSettingsClearAll(ctx: Context): Promise<void> {
  const message =
    `🗑 Удаление всех товаров\n\n` +
    `⚠️ Внимание! Это действие нельзя отменить.\n\n` +
    `Все отслеживаемые товары будут удалены безвозвратно.\n\n` +
    `Для подтверждения отправьте команду:\n` +
    `/clear_all confirm`;

  await ctx.editMessageText(message);
  await ctx.answerCbQuery();
}

async function handleSettingsExport(ctx: Context, user: any): Promise<void> {
  const message =
    `📊 Экспорт данных\n\n` +
    `Эта функция доступна только для Pro-пользователей.\n\n` +
    `Экспорт включает:\n` +
    `• Список отслеживаемых товаров\n` +
    `• История изменений цен\n` +
    `• Настройки аккаунта\n\n` +
    `${
      user.subscriptionTier === "PRO"
        ? "Для экспорта данных обратитесь в поддержку."
        : "Оформите Pro-подписку для доступа к этой функции."
    }`;

  await ctx.editMessageText(message);
  await ctx.answerCbQuery();
}

async function handleProSubscription(ctx: Context, user: any): Promise<void> {
  const isPro = user.subscriptionTier === "PRO";

  const message = isPro
    ? `🔄 Продление Pro-подписки\n\n` +
      `У вас уже активна Pro-подписка.\n\n` +
      `Для продления или изменения подписки обратитесь в поддержку:\n` +
      `@support_username`
    : `💳 Оформление Pro-подписки\n\n` +
      `Стоимость: 99₽/месяц\n\n` +
      `Способы оплаты:\n` +
      `• Telegram Payments\n` +
      `• Банковская карта\n` +
      `• СБП\n\n` +
      `Для оформления подписки обратитесь в поддержку:\n` +
      `@support_username`;

  await ctx.editMessageText(message);
  await ctx.answerCbQuery();
}

async function handleProCompare(ctx: Context): Promise<void> {
  const message =
    `📊 Сравнение тарифов\n\n` +
    `🆓 Бесплатный:\n` +
    `• До 3 товаров\n` +
    `• Проверка каждые 6 часов\n` +
    `• Базовые уведомления\n` +
    `• Стандартная поддержка\n\n` +
    `⭐️ Pro (99₽/мес):\n` +
    `• До 50 товаров\n` +
    `• Проверка каждые 2 часа\n` +
    `• Расширенные фильтры\n` +
    `• Приоритетная поддержка\n` +
    `• Экспорт данных\n` +
    `• Партнерские ссылки`;

  await ctx.editMessageText(message);
  await ctx.answerCbQuery();
}

async function handleProFaq(ctx: Context): Promise<void> {
  const message =
    `❓ Часто задаваемые вопросы\n\n` +
    `Q: Как отменить подписку?\n` +
    `A: Обратитесь в поддержку за 3 дня до списания.\n\n` +
    `Q: Можно ли перенести подписку?\n` +
    `A: Да, при смене аккаунта.\n\n` +
    `Q: Есть ли пробный период?\n` +
    `A: Да, 3 дня бесплатно для новых пользователей.\n\n` +
    `Q: Что происходит при отмене?\n` +
    `A: Подписка остается активной до конца оплаченного периода.`;

  await ctx.editMessageText(message);
  await ctx.answerCbQuery();
}

async function handleRemoveAll(ctx: Context, user: any): Promise<void> {
  try {
    const tracks = await databaseService.getUserTracks(user.id);

    if (tracks.length === 0) {
      await ctx.editMessageText("📝 У вас нет отслеживаемых товаров для удаления.");
      await ctx.answerCbQuery();
      return;
    }

    // Удаляем все отслеживания
    for (const track of tracks) {
      await databaseService.deleteTrack(track.id, user.id);
      await queueService.removeRecurringPriceCheckJob(track.id);
    }

    await ctx.editMessageText(`✅ Удалено ${tracks.length} товаров из отслеживания.`);
    await ctx.answerCbQuery();

    botLogger.info("Пользователь удалил все товары", {
      userId: user.id,
      count: tracks.length,
    });
  } catch (error) {
    botLogger.error("Ошибка при удалении всех товаров:", { error });
    await ctx.editMessageText("❌ Произошла ошибка при удалении товаров.");
    await ctx.answerCbQuery();
  }
}

async function handleRemoveTrack(ctx: Context, user: any, trackId: string): Promise<void> {
  try {
    const deleted = await databaseService.deleteTrack(trackId, user.id);

    if (deleted) {
      await queueService.removeRecurringPriceCheckJob(trackId);
      await ctx.answerCbQuery("✅ Товар удален");

      botLogger.info("Пользователь удалил товар через callback", {
        userId: user.id,
        trackId,
      });
    } else {
      await ctx.answerCbQuery("❌ Товар не найден");
    }
  } catch (error) {
    botLogger.error("Ошибка при удалении товара через callback:", { error });
    await ctx.answerCbQuery("❌ Ошибка при удалении");
  }
}

async function handleBackToMain(ctx: Context): Promise<void> {
  // Импортируем команду start
  const { startCommand } = await import("../commands/start");
  await startCommand(ctx);
  await ctx.answerCbQuery();
}
