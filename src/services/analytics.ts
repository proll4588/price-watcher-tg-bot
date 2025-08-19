import { databaseService } from "./database";
import { metricsService } from "./metrics";
import { analyticsLogger } from "../utils/logger";

class AnalyticsService {
  private updateInterval: NodeJS.Timeout | null = null;
  private readonly UPDATE_INTERVAL_MS = 60000; // 1 минута

  constructor() {
    analyticsLogger.info("Сервис аналитики инициализирован");
  }

  /**
   * Запускает периодическое обновление метрик
   */
  start(): void {
    if (this.updateInterval) {
      analyticsLogger.warn("Сервис аналитики уже запущен");
      return;
    }

    analyticsLogger.info("Запускаю периодическое обновление метрик");

    // Первоначальное обновление
    this.updateMetrics();

    // Периодическое обновление
    this.updateInterval = setInterval(() => {
      this.updateMetrics();
    }, this.UPDATE_INTERVAL_MS);
  }

  /**
   * Останавливает периодическое обновление метрик
   */
  stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
      analyticsLogger.info("Сервис аналитики остановлен");
    }
  }

  /**
   * Обновляет все метрики из базы данных
   */
  private async updateMetrics(): Promise<void> {
    try {
      analyticsLogger.debug("Начинаю обновление метрик");

      // Обновляем метрики пользователей
      await this.updateUserMetrics();

      // Обновляем метрики отслеживаний
      await this.updateTrackMetrics();

      // Обновляем метрики товаров
      await this.updateProductMetrics();

      analyticsLogger.debug("Метрики успешно обновлены");
    } catch (error) {
      analyticsLogger.error("Ошибка при обновлении метрик", { error });
    }
  }

  /**
   * Обновляет метрики пользователей
   */
  private async updateUserMetrics(): Promise<void> {
    try {
      const [totalUsers, activeUsers] = await Promise.all([
        databaseService.getTotalUsers(),
        databaseService.getActiveUsersCount(),
      ]);

      metricsService.setTotalUsers(totalUsers);
      metricsService.setActiveUsers(activeUsers);

      analyticsLogger.debug("Метрики пользователей обновлены", {
        total: totalUsers,
        active: activeUsers,
      });
    } catch (error) {
      analyticsLogger.error("Ошибка при обновлении метрик пользователей", { error });
    }
  }

  /**
   * Обновляет метрики отслеживаний
   */
  private async updateTrackMetrics(): Promise<void> {
    try {
      const [totalTracks, activeTracks] = await Promise.all([
        databaseService.getTotalTracks(),
        databaseService.getActiveTracksCount(),
      ]);

      metricsService.setTotalTracks(totalTracks);
      metricsService.setActiveTracks(activeTracks);

      analyticsLogger.debug("Метрики отслеживаний обновлены", {
        total: totalTracks,
        active: activeTracks,
      });
    } catch (error) {
      analyticsLogger.error("Ошибка при обновлении метрик отслеживаний", { error });
    }
  }

  /**
   * Обновляет метрики товаров
   */
  private async updateProductMetrics(): Promise<void> {
    try {
      const [totalProducts, activeProducts] = await Promise.all([
        databaseService.getTotalProducts(),
        databaseService.getActiveProductsCount(),
      ]);

      metricsService.setProductsTracked(activeProducts);

      analyticsLogger.debug("Метрики товаров обновлены", {
        total: totalProducts,
        active: activeProducts,
      });
    } catch (error) {
      analyticsLogger.error("Ошибка при обновлении метрик товаров", { error });
    }
  }

  /**
   * Обновляет метрики очередей
   */
  async updateQueueMetrics(queueStats: any): Promise<void> {
    try {
      if (queueStats.priceCheck) {
        metricsService.setQueueJobsWaiting("price_check", queueStats.priceCheck.waiting || 0);
        metricsService.setQueueJobsActive("price_check", queueStats.priceCheck.active || 0);
        metricsService.setQueueJobsCompleted("price_check", queueStats.priceCheck.completed || 0);
        metricsService.setQueueJobsFailed("price_check", queueStats.priceCheck.failed || 0);
      }

      if (queueStats.notifications) {
        metricsService.setQueueJobsWaiting("notifications", queueStats.notifications.waiting || 0);
        metricsService.setQueueJobsActive("notifications", queueStats.notifications.active || 0);
        metricsService.setQueueJobsCompleted(
          "notifications",
          queueStats.notifications.completed || 0
        );
        metricsService.setQueueJobsFailed("notifications", queueStats.notifications.failed || 0);
      }

      analyticsLogger.debug("Метрики очередей обновлены", { queueStats });
    } catch (error) {
      analyticsLogger.error("Ошибка при обновлении метрик очередей", { error });
    }
  }

  /**
   * Получает детальную аналитику для API
   */
  async getDetailedAnalytics(): Promise<any> {
    try {
      const [
        totalUsers,
        activeUsers,
        totalTracks,
        activeTracks,
        totalProducts,
        activeProducts,
        newUsersToday,
        newUsersWeek,
        newUsersMonth,
        trackRequestsToday,
        trackRequestsWeek,
        notificationsToday,
        notificationsWeek,
      ] = await Promise.all([
        databaseService.getTotalUsers(),
        databaseService.getActiveUsersCount(),
        databaseService.getTotalTracks(),
        databaseService.getActiveTracksCount(),
        databaseService.getTotalProducts(),
        databaseService.getActiveProductsCount(),
        databaseService.getNewUsersCount("1 day"),
        databaseService.getNewUsersCount("7 days"),
        databaseService.getNewUsersCount("30 days"),
        databaseService.getTrackRequestsCount("1 day"),
        databaseService.getTrackRequestsCount("7 days"),
        databaseService.getNotificationsCount("1 day"),
        databaseService.getNotificationsCount("7 days"),
      ]);

      return {
        users: {
          total: totalUsers,
          active: activeUsers,
          new: {
            today: newUsersToday,
            week: newUsersWeek,
            month: newUsersMonth,
          },
        },
        tracks: {
          total: totalTracks,
          active: activeTracks,
          requests: {
            today: trackRequestsToday,
            week: trackRequestsWeek,
          },
        },
        products: {
          total: totalProducts,
          active: activeProducts,
        },
        notifications: {
          today: notificationsToday,
          week: notificationsWeek,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      analyticsLogger.error("Ошибка при получении детальной аналитики", { error });
      throw error;
    }
  }
}

export const analyticsService = new AnalyticsService();
