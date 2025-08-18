import { Job } from "bullmq";
import { databaseService } from "../services/database";
import { ProviderManager } from "../providers/manager";
import { queueService } from "../services/queue";
import { queueLogger } from "../utils/logger";
import { formatPrice, formatDiscount } from "../utils/formatters";
import { Decimal } from "@prisma/client/runtime/library";
import { UnavailableNotificationData } from "../types";

class PriceCheckerWorker {
  private providerManager: ProviderManager;

  constructor() {
    this.providerManager = new ProviderManager();
    this.setupWorker();
  }

  private setupWorker(): void {
    queueService.setPriceCheckHandler(this.handlePriceCheck.bind(this));
    queueLogger.info("Воркер проверки цен запущен");

    // Логируем информацию о повторяющихся задачах при запуске
    this.logRepeatableJobs();
  }

  private async logRepeatableJobs(): Promise<void> {
    try {
      const repeatableJobs = await queueService.getRepeatableJobs();
      queueLogger.info("Найдены повторяющиеся задачи при запуске", {
        count: repeatableJobs.length,
        jobs: repeatableJobs.map((job: any) => ({
          id: job.id,
          pattern: job.pattern,
          every: job.every,
        })),
      });
    } catch (error) {
      queueLogger.error("Ошибка при получении повторяющихся задач", { error });
    }
  }

  private async handlePriceCheck(job: Job): Promise<void> {
    // Обрабатываем как обычные задачи, так и повторяющиеся
    const { trackId } = job.data as any;

    try {
      queueLogger.info("Начинаю проверку цены", { trackId, jobType: job.name });

      // Получаем информацию об отслеживании
      const track = await databaseService.getTrackById(trackId);
      if (!track || !track.isActive) {
        queueLogger.info("Отслеживание неактивно или не найдено", { trackId });
        return;
      }

      // Получаем информацию о товаре
      const product = track.product;
      if (!product || !product.isActive) {
        queueLogger.info("Товар неактивен или не найден", { productId: product?.id || "unknown" });
        return;
      }

      // Получаем текущую цену
      const priceResult = await this.providerManager.getProductInfo(product.url);

      if (!priceResult.success || !priceResult.data) {
        queueLogger.warn("Не удалось получить цену товара", {
          productId: product.id,
          error: priceResult.error,
        });

        // Создаем уведомление о недоступности товара
        await this.createUnavailableNotification(track, product);
        return;
      }

      const currentPrice = priceResult.data.price.price;
      const oldPrice = product.currentPrice;

      // Обновляем цену товара в БД
      await databaseService.updateProductPrice(product.id, Number(currentPrice));

      // Создаем снимок цены
      await databaseService.createPriceSnapshot(product.id, Number(currentPrice));

      // Обновляем время последней проверки
      await databaseService.updateTrackLastChecked(trackId);

      // Проверяем изменение цены
      if (oldPrice && oldPrice.comparedTo(currentPrice) !== 0) {
        const priceChange = oldPrice.comparedTo(currentPrice);

        if (priceChange > 0) {
          // Цена снизилась
          await this.handlePriceDrop(track, product, oldPrice, currentPrice);
        } else {
          // Цена повысилась
          await this.handlePriceIncrease(track, product, oldPrice, currentPrice);
        }
      }

      queueLogger.info("Проверка цены завершена", {
        trackId,
        productId: product.id,
        oldPrice: oldPrice?.toString(),
        newPrice: currentPrice.toString(),
      });
    } catch (error) {
      queueLogger.error("Ошибка при проверке цены", {
        trackId,
        error,
      });
      throw error;
    }
  }

  private async handlePriceDrop(
    track: any,
    product: any,
    oldPrice: Decimal,
    newPrice: Decimal
  ): Promise<void> {
    const discount = formatDiscount(oldPrice, newPrice);
    const discountPercent = Number(discount.replace("%", ""));

    // Проверяем фильтры пользователя
    if (track.discountThreshold && discountPercent < Number(track.discountThreshold)) {
      queueLogger.info("Скидка меньше порога пользователя", {
        trackId: track.id,
        discount: discountPercent,
        threshold: track.discountThreshold,
      });
      return;
    }

    if (track.minPrice && newPrice.comparedTo(track.minPrice) < 0) {
      queueLogger.info("Цена ниже минимальной", {
        trackId: track.id,
        price: newPrice.toString(),
        minPrice: track.minPrice.toString(),
      });
      return;
    }

    // Создаем партнерскую ссылку
    const affiliateUrl = this.providerManager.createAffiliateUrl(product.url);

    // Создаем уведомление только в базе данных
    const notificationData = {
      oldPrice,
      newPrice,
      discount: discountPercent,
      productUrl: product.url,
      affiliateUrl,
    };

    const notification = await databaseService.createNotification(track.userId, {
      type: "PRICE_DROP",
      title: "💰 Цена снизилась!",
      message: this.formatPriceDropMessage(product, oldPrice, newPrice, discount, affiliateUrl),
      trackId: track.id,
      notificationData,
    });

    // Добавляем задачу отправки уведомления в очередь с ID уведомления
    await queueService.addNotificationJob({
      userId: track.userId,
      type: "PRICE_DROP",
      title: "💰 Цена снизилась!",
      message: this.formatPriceDropMessage(product, oldPrice, newPrice, discount, affiliateUrl),
      notificationData: {
        ...notificationData,
        notificationId: notification.id,
      },
    });

    queueLogger.info("Уведомление о снижении цены создано", {
      trackId: track.id,
      discount,
      notificationId: notification.id,
    });
  }

  private async handlePriceIncrease(
    track: any,
    product: any,
    oldPrice: Decimal,
    newPrice: Decimal
  ): Promise<void> {
    const increase = ((Number(newPrice) - Number(oldPrice)) / Number(oldPrice)) * 100;

    // Создаем уведомление о повышении цены только в базе данных
    const notification = await databaseService.createNotification(track.userId, {
      type: "PRICE_INCREASE",
      title: "📈 Цена повысилась",
      message: this.formatPriceIncreaseMessage(product, oldPrice, newPrice, increase),
      trackId: track.id,
      notificationData: {
        oldPrice,
        newPrice,
        discount: increase,
        productUrl: product.url,
      },
    });

    // Добавляем задачу отправки уведомления в очередь с ID уведомления
    await queueService.addNotificationJob({
      userId: track.userId,
      type: "PRICE_INCREASE",
      title: "📈 Цена повысилась",
      message: this.formatPriceIncreaseMessage(product, oldPrice, newPrice, increase),
      notificationData: {
        oldPrice,
        newPrice,
        discount: increase,
        productUrl: product.url,
        notificationId: notification.id,
      },
    });

    queueLogger.info("Уведомление о повышении цены создано", {
      trackId: track.id,
      increase: `${increase.toFixed(1)}%`,
      notificationId: notification.id,
    });
  }

  private async createUnavailableNotification(track: any, product: any): Promise<void> {
    // Создаем уведомление о недоступности товара только в базе данных
    const notification = await databaseService.createNotification(track.userId, {
      type: "PRODUCT_UNAVAILABLE",
      title: "❌ Товар недоступен",
      message: `Товар "${product.title}" временно недоступен или был удален с сайта.`,
      trackId: track.id,
    });

    // Добавляем задачу отправки уведомления в очередь с ID уведомления
    await queueService.addNotificationJob({
      userId: track.userId,
      type: "PRODUCT_UNAVAILABLE",
      title: "❌ Товар недоступен",
      message: `Товар "${product.title}" временно недоступен или был удален с сайта.`,
      notificationData: {
        notificationId: notification.id,
      } as UnavailableNotificationData,
    });

    queueLogger.info("Уведомление о недоступности товара создано", {
      trackId: track.id,
      notificationId: notification.id,
    });
  }

  private formatPriceDropMessage(
    product: any,
    oldPrice: Decimal,
    newPrice: Decimal,
    discount: string,
    affiliateUrl: string
  ): string {
    return (
      `🎉 Цена снизилась!\n\n` +
      `📦 ${product.title}\n` +
      `💰 Было: ${formatPrice(oldPrice)}\n` +
      `💰 Стало: ${formatPrice(newPrice)}\n` +
      `📉 Скидка: ${discount}\n\n` +
      `🔗 ${affiliateUrl}`
    );
  }

  private formatPriceIncreaseMessage(
    product: any,
    oldPrice: Decimal,
    newPrice: Decimal,
    increase: number
  ): string {
    return (
      `📈 Цена повысилась\n\n` +
      `📦 ${product.title}\n` +
      `💰 Было: ${formatPrice(oldPrice)}\n` +
      `💰 Стало: ${formatPrice(newPrice)}\n` +
      `📈 Повышение: +${increase.toFixed(1)}%\n\n` +
      `🔗 ${product.url}`
    );
  }
}

// Запускаем воркер
new PriceCheckerWorker();

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
