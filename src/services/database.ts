import { PrismaClient } from "@prisma/client";
import { dbLogger } from "../utils/logger";

class DatabaseService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient({
      log: ["error", "warn"],
    });
  }

  /**
   * Получает или создает пользователя
   */
  async getOrCreateUser(
    telegramId: number,
    userData?: {
      username?: string;
      firstName?: string;
      lastName?: string;
    }
  ) {
    try {
      const user = await this.prisma.user.upsert({
        where: { telegramId: BigInt(telegramId) },
        update: {
          ...(userData && {
            username: userData.username,
            firstName: userData.firstName,
            lastName: userData.lastName,
          }),
        },
        create: {
          telegramId: BigInt(telegramId),
          username: userData?.username || null,
          firstName: userData?.firstName || null,
          lastName: userData?.lastName || null,
        },
      });

      return user;
    } catch (error) {
      dbLogger.error("Ошибка при получении/создании пользователя:", {
        telegramId,
        error,
      });
      throw error;
    }
  }

  /**
   * Получает или создает товар
   */
  async getOrCreateProduct(
    url: string,
    provider: string,
    productData?: {
      productId?: string;
      title?: string;
      imageUrl?: string;
      currentPrice?: number;
    }
  ) {
    try {
      const product = await this.prisma.product.upsert({
        where: { url },
        update: {
          ...(productData && {
            productId: productData.productId,
            title: productData.title,
            imageUrl: productData.imageUrl,
            currentPrice: productData.currentPrice,
          }),
        },
        create: {
          url,
          provider,
          productId: productData?.productId || null,
          title: productData?.title || null,
          imageUrl: productData?.imageUrl || null,
          currentPrice: productData?.currentPrice || null,
        },
      });

      return product;
    } catch (error) {
      dbLogger.error("Ошибка при получении/создании товара:", {
        url,
        error,
      });
      throw error;
    }
  }

  /**
   * Создает отслеживание товара
   */
  async createTrack(
    userId: string,
    productId: string,
    settings?: {
      minPrice?: number;
      maxPrice?: number;
      discountThreshold?: number;
      checkIntervalHours?: number;
    }
  ) {
    try {
      const track = await this.prisma.track.create({
        data: {
          userId,
          productId,
          minPrice: settings?.minPrice || null,
          maxPrice: settings?.maxPrice || null,
          discountThreshold: settings?.discountThreshold || null,
          checkIntervalHours: settings?.checkIntervalHours || 6,
        },
        include: {
          product: true,
          user: true,
        },
      });

      return track;
    } catch (error) {
      // Проверяем, является ли это ошибкой дублирования
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
        dbLogger.warn("Попытка создать дублирующее отслеживание:", {
          userId,
          productId,
        });
        throw new Error("Товар уже отслеживается");
      }

      dbLogger.error("Ошибка при создании отслеживания:", {
        userId,
        productId,
        error,
      });
      throw error;
    }
  }

  /**
   * Проверяет, отслеживает ли пользователь товар
   */
  async isUserTrackingProduct(userId: string, productId: string): Promise<boolean> {
    try {
      const track = await this.prisma.track.findFirst({
        where: {
          userId,
          productId,
          isActive: true,
        },
      });

      return !!track;
    } catch (error) {
      dbLogger.error("Ошибка при проверке отслеживания пользователем:", {
        userId,
        productId,
        error,
      });
      return false;
    }
  }

  /**
   * Получает количество пользователей, отслеживающих товар
   */
  async getProductTrackingCount(productId: string): Promise<number> {
    try {
      const count = await this.prisma.track.count({
        where: {
          productId,
          isActive: true,
        },
      });

      return count;
    } catch (error) {
      dbLogger.error("Ошибка при получении количества отслеживаний товара:", {
        productId,
        error,
      });
      return 0;
    }
  }

  /**
   * Получает отслеживания пользователя
   */
  async getUserTracks(userId: string) {
    try {
      const tracks = await this.prisma.track.findMany({
        where: { userId, isActive: true },
        include: {
          product: true,
        },
        orderBy: { createdAt: "desc" },
      });

      return tracks;
    } catch (error) {
      dbLogger.error("Ошибка при получении отслеживаний пользователя:", {
        userId,
        error,
      });
      throw error;
    }
  }

  /**
   * Удаляет отслеживание
   */
  async deleteTrack(trackId: string, userId: string) {
    try {
      const track = await this.prisma.track.deleteMany({
        where: { id: trackId, userId },
      });

      return track.count > 0;
    } catch (error) {
      dbLogger.error("Ошибка при удалении отслеживания:", {
        trackId,
        userId,
        error,
      });
      throw error;
    }
  }

  /**
   * Создает снимок цены
   */
  async createPriceSnapshot(productId: string, price: number, currency: string = "RUB") {
    try {
      const snapshot = await this.prisma.priceSnapshot.create({
        data: {
          productId,
          price,
          currency,
        },
      });

      return snapshot;
    } catch (error) {
      dbLogger.error("Ошибка при создании снимка цены:", {
        productId,
        price,
        error,
      });
      throw error;
    }
  }

  /**
   * Создает уведомление
   */
  async createNotification(
    userId: string,
    data: {
      type: "PRICE_DROP" | "PRICE_INCREASE" | "PRODUCT_UNAVAILABLE" | "SYSTEM";
      title: string;
      message: string;
      trackId?: string;
      notificationData?: any;
    }
  ) {
    try {
      // Проверяем, не существует ли уже уведомление для этого отслеживания за последние 5 минут
      if (data.trackId) {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const existingNotification = await this.prisma.notification.findFirst({
          where: {
            userId,
            trackId: data.trackId,
            type: data.type,
            createdAt: {
              gte: fiveMinutesAgo,
            },
          },
        });

        if (existingNotification) {
          dbLogger.warn("Уведомление уже существует для этого отслеживания", {
            userId,
            trackId: data.trackId,
            type: data.type,
            existingNotificationId: existingNotification.id,
          });
          return existingNotification;
        }
      }

      const notification = await this.prisma.notification.create({
        data: {
          userId,
          type: data.type,
          title: data.title,
          message: data.message,
          trackId: data.trackId || null,
          data: data.notificationData as any,
        },
      });

      return notification;
    } catch (error) {
      dbLogger.error("Ошибка при создании уведомления:", {
        userId,
        data,
        error,
      });
      throw error;
    }
  }

  /**
   * Получает отслеживания для проверки цен
   */
  async getTracksForPriceCheck() {
    try {
      const now = new Date();
      const tracks = await this.prisma.track.findMany({
        where: {
          isActive: true,
          OR: [
            { lastChecked: null },
            {
              lastChecked: {
                lt: new Date(now.getTime() - 6 * 60 * 60 * 1000), // 6 часов назад
              },
            },
          ],
        },
        include: {
          product: true,
          user: true,
        },
      });

      return tracks;
    } catch (error) {
      dbLogger.error("Ошибка при получении отслеживаний для проверки цен:", { error });
      throw error;
    }
  }

  /**
   * Обновляет время последней проверки отслеживания
   */
  async updateTrackLastChecked(trackId: string) {
    try {
      await this.prisma.track.update({
        where: { id: trackId },
        data: { lastChecked: new Date() },
      });
    } catch (error) {
      dbLogger.error("Ошибка при обновлении времени проверки:", {
        trackId,
        error,
      });
      throw error;
    }
  }

  /**
   * Получает статистику пользователя
   */
  async getUserStats(userId: string) {
    try {
      const [trackCount, notificationCount] = await Promise.all([
        this.prisma.track.count({
          where: { userId, isActive: true },
        }),
        this.prisma.notification.count({
          where: { userId, isRead: false },
        }),
      ]);

      return {
        trackCount,
        unreadNotifications: notificationCount,
      };
    } catch (error) {
      dbLogger.error("Ошибка при получении статистики пользователя:", {
        userId,
        error,
      });
      throw error;
    }
  }

  /**
   * Получает отслеживание по ID
   */
  async getTrackById(trackId: string) {
    try {
      const track = await this.prisma.track.findUnique({
        where: { id: trackId },
        include: {
          product: true,
          user: true,
        },
      });

      return track;
    } catch (error) {
      dbLogger.error("Ошибка при получении отслеживания:", {
        trackId,
        error,
      });
      throw error;
    }
  }

  /**
   * Обновляет цену товара
   */
  async updateProductPrice(productId: string, price: number) {
    try {
      await this.prisma.product.update({
        where: { id: productId },
        data: { currentPrice: price },
      });
    } catch (error) {
      dbLogger.error("Ошибка при обновлении цены товара:", {
        productId,
        price,
        error,
      });
      throw error;
    }
  }

  /**
   * Получает пользователя по ID
   */
  async getUserById(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      return user;
    } catch (error) {
      dbLogger.error("Ошибка при получении пользователя:", {
        userId,
        error,
      });
      throw error;
    }
  }

  /**
   * Деактивирует отслеживание
   */
  async deactivateTrack(trackId: string) {
    try {
      await this.prisma.track.update({
        where: { id: trackId },
        data: { isActive: false },
      });
    } catch (error) {
      dbLogger.error("Ошибка при деактивации отслеживания:", {
        trackId,
        error,
      });
      throw error;
    }
  }

  /**
   * Помечает уведомление как отправленное
   */
  async markNotificationAsSent(notificationId: string) {
    try {
      await this.prisma.notification.update({
        where: { id: notificationId },
        data: { isRead: true },
      });
    } catch (error) {
      dbLogger.error("Ошибка при пометке уведомления как отправленного:", {
        notificationId,
        error,
      });
      throw error;
    }
  }

  /**
   * Получает всех активных пользователей
   */
  async getAllActiveUsers() {
    try {
      const users = await this.prisma.user.findMany({
        where: {
          tracks: {
            some: {
              isActive: true,
            },
          },
        },
      });

      return users;
    } catch (error) {
      dbLogger.error("Ошибка при получении активных пользователей:", {
        error,
      });
      throw error;
    }
  }

  /**
   * Тестирует подключение к базе данных
   */
  async testConnection() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      dbLogger.error("Ошибка подключения к базе данных:", { error });
      throw error;
    }
  }

  /**
   * Получает общее количество пользователей
   */
  async getTotalUsers(): Promise<number> {
    try {
      return await this.prisma.user.count();
    } catch (error) {
      dbLogger.error("Ошибка при получении количества пользователей:", {
        error,
      });
      throw error;
    }
  }

  /**
   * Получает общее количество отслеживаний
   */
  async getTotalTracks(): Promise<number> {
    try {
      return await this.prisma.track.count();
    } catch (error) {
      dbLogger.error("Ошибка при получении количества отслеживаний:", {
        error,
      });
      throw error;
    }
  }

  /**
   * Получает общее количество товаров
   */
  async getTotalProducts(): Promise<number> {
    try {
      return await this.prisma.product.count();
    } catch (error) {
      dbLogger.error("Ошибка при получении количества товаров:", {
        error,
      });
      throw error;
    }
  }

  /**
   * Получает количество активных пользователей
   */
  async getActiveUsersCount(): Promise<number> {
    try {
      return await this.prisma.user.count({
        where: {
          tracks: {
            some: {
              isActive: true,
            },
          },
        },
      });
    } catch (error) {
      dbLogger.error("Ошибка при получении количества активных пользователей:", { error });
      throw error;
    }
  }

  /**
   * Получает количество активных отслеживаний
   */
  async getActiveTracksCount(): Promise<number> {
    try {
      return await this.prisma.track.count({
        where: { isActive: true },
      });
    } catch (error) {
      dbLogger.error("Ошибка при получении количества активных отслеживаний:", { error });
      throw error;
    }
  }

  /**
   * Получает количество активных товаров
   */
  async getActiveProductsCount(): Promise<number> {
    try {
      return await this.prisma.product.count({
        where: { isActive: true },
      });
    } catch (error) {
      dbLogger.error("Ошибка при получении количества активных товаров:", { error });
      throw error;
    }
  }

  /**
   * Закрывает соединение с базой данных
   */
  async disconnect() {
    await this.prisma.$disconnect();
  }
}

export const databaseService = new DatabaseService();
