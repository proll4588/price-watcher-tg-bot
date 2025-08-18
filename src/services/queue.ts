import { Queue, Worker, Job } from "bullmq";
import Redis from "ioredis";
import { queueLogger } from "../utils/logger";
import config from "../config";
import { PriceCheckJob, NotificationJob } from "../types";

class QueueService {
  private redis: Redis;
  private priceCheckQueue: Queue;
  private notificationQueue: Queue;
  private priceCheckWorker?: Worker;
  private notificationWorker?: Worker;

  constructor() {
    this.redis = new Redis(config.redis.url, {
      maxRetriesPerRequest: null,
    });

    // Создаем очереди
    this.priceCheckQueue = new Queue("price-check", {
      connection: this.redis,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
      },
    });

    this.notificationQueue = new Queue("notification", {
      connection: this.redis,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
      },
    });

    // Планировщик больше не нужен в новых версиях BullMQ

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Обработчики событий убраны из-за изменений в BullMQ API
    // Логирование перенесено в воркеры
  }

  /**
   * Добавляет задачу проверки цены в очередь
   */
  async addPriceCheckJob(data: PriceCheckJob["data"], delay?: number): Promise<void> {
    try {
      await this.priceCheckQueue.add("check-price", data, {
        ...(delay && { delay }),
        jobId: `price-check-${data.trackId}-${Date.now()}`,
      });

      queueLogger.info("Задача проверки цены добавлена в очередь", {
        trackId: data.trackId,
        delay,
      });
    } catch (error) {
      queueLogger.error("Ошибка при добавлении задачи проверки цены", { data, error });
      throw error;
    }
  }

  /**
   * Добавляет задачу уведомления в очередь
   */
  async addNotificationJob(data: NotificationJob["data"]): Promise<void> {
    try {
      // Создаем уникальный jobId на основе notificationId, если он есть
      const jobId = data.notificationData?.notificationId
        ? `notification-${data.notificationData.notificationId}`
        : `notification-${data.userId}-${Date.now()}`;

      await this.notificationQueue.add("send-notification", data, {
        jobId,
        priority: data.type === "PRICE_DROP" ? 1 : 2, // Приоритет для уведомлений о снижении цены
      });

      queueLogger.info("Задача уведомления добавлена в очередь", {
        userId: data.userId,
        type: data.type,
        jobId,
        notificationId: data.notificationData?.notificationId,
      });
    } catch (error) {
      queueLogger.error("Ошибка при добавлении задачи уведомления", { data, error });
      throw error;
    }
  }

  /**
   * Добавляет повторяющуюся задачу проверки цен
   */
  async addRecurringPriceCheckJob(trackId: string, intervalHours: number): Promise<void> {
    try {
      // Проверяем, не существует ли уже задача с таким jobId
      const existingJobs = await this.priceCheckQueue.getRepeatableJobs();
      const existingJob = existingJobs.find(job => job.id === `recurring-price-check-${trackId}`);

      if (existingJob) {
        // Удаляем существующую задачу перед созданием новой
        await this.priceCheckQueue.removeRepeatableByKey(existingJob.key);
        queueLogger.info("Существующая повторяющаяся задача удалена перед созданием новой", {
          trackId,
          existingJobId: existingJob.id,
        });
      }

      if (intervalHours >= 1) {
        // Для интервалов >= 1 часа используем cron pattern
        const pattern = `0 */${Math.floor(intervalHours)} * * *`;

        await this.priceCheckQueue.add(
          "recurring-price-check",
          { trackId },
          {
            repeat: {
              pattern,
            },
            jobId: `recurring-price-check-${trackId}`,
          }
        );

        queueLogger.info("Повторяющаяся задача проверки цен добавлена (cron)", {
          trackId,
          intervalHours,
          pattern,
        });
      } else {
        // Для интервалов < 1 часа используем delay
        const intervalMinutes = Math.round(intervalHours * 60);
        const delay = intervalMinutes * 60 * 1000; // конвертируем в миллисекунды

        await this.priceCheckQueue.add(
          "recurring-price-check",
          { trackId },
          {
            delay,
            repeat: {
              every: delay,
            },
            jobId: `recurring-price-check-${trackId}`,
          }
        );

        queueLogger.info("Повторяющаяся задача проверки цен добавлена (delay)", {
          trackId,
          intervalHours,
          intervalMinutes,
          delay,
        });
      }
    } catch (error) {
      queueLogger.error("Ошибка при добавлении повторяющейся задачи", { trackId, error });
      throw error;
    }
  }

  /**
   * Удаляет повторяющуюся задачу
   */
  async removeRecurringPriceCheckJob(trackId: string): Promise<void> {
    try {
      const repeatableJobs = await this.priceCheckQueue.getRepeatableJobs();
      const job = repeatableJobs.find(job => job.id === `recurring-price-check-${trackId}`);

      if (job) {
        await this.priceCheckQueue.removeRepeatableByKey(job.key);
        queueLogger.info("Повторяющаяся задача удалена", { trackId, jobId: job.id });
      } else {
        queueLogger.warn("Повторяющаяся задача не найдена для удаления", { trackId });
      }
    } catch (error) {
      queueLogger.error("Ошибка при удалении повторяющейся задачи", { trackId, error });
      throw error;
    }
  }

  /**
   * Получает повторяющиеся задачи
   */
  async getRepeatableJobs() {
    try {
      return await this.priceCheckQueue.getRepeatableJobs();
    } catch (error) {
      queueLogger.error("Ошибка при получении повторяющихся задач", { error });
      throw error;
    }
  }

  /**
   * Получает статистику очередей
   */
  async getQueueStats() {
    try {
      const [priceCheckStats, notificationStats] = await Promise.all([
        this.priceCheckQueue.getJobCounts(),
        this.notificationQueue.getJobCounts(),
      ]);

      return {
        priceCheck: priceCheckStats,
        notification: notificationStats,
      };
    } catch (error) {
      queueLogger.error("Ошибка при получении статистики очередей", { error });
      throw error;
    }
  }

  /**
   * Очищает все задачи в очереди
   */
  async clearQueue(queueName: "price-check" | "notification"): Promise<void> {
    try {
      const queue = queueName === "price-check" ? this.priceCheckQueue : this.notificationQueue;
      await queue.obliterate();
      queueLogger.info(`Очередь ${queueName} очищена`);
    } catch (error) {
      queueLogger.error(`Ошибка при очистке очереди ${queueName}`, { error });
      throw error;
    }
  }

  /**
   * Устанавливает обработчики для воркеров
   */
  setPriceCheckHandler(handler: (job: Job) => Promise<void>): void {
    this.priceCheckWorker = new Worker("price-check", handler, {
      connection: this.redis,
      concurrency: 5, // Максимум 5 одновременных задач
    });

    this.priceCheckWorker.on("completed", job => {
      queueLogger.info("Воркер проверки цен завершил задачу", { jobId: job.id });
    });

    this.priceCheckWorker.on("failed", (job, err) => {
      queueLogger.error("Воркер проверки цен провалил задачу", {
        jobId: job?.id,
        error: err.message,
      });
    });
  }

  setNotificationHandler(handler: (job: Job) => Promise<void>): void {
    this.notificationWorker = new Worker("notification", handler, {
      connection: this.redis,
      concurrency: 10, // Максимум 10 одновременных задач
    });

    this.notificationWorker.on("completed", job => {
      queueLogger.info("Воркер уведомлений завершил задачу", { jobId: job.id });
    });

    this.notificationWorker.on("failed", (job, err) => {
      queueLogger.error("Воркер уведомлений провалил задачу", {
        jobId: job?.id,
        error: err.message,
      });
    });
  }

  /**
   * Закрывает соединения
   */
  async close(): Promise<void> {
    try {
      await Promise.all([
        this.priceCheckWorker?.close(),
        this.notificationWorker?.close(),
        this.priceCheckQueue.close(),
        this.notificationQueue.close(),
        this.redis.quit(),
      ]);

      queueLogger.info("Сервис очередей закрыт");
    } catch (error) {
      queueLogger.error("Ошибка при закрытии сервиса очередей", { error });
      throw error;
    }
  }
}

export const queueService = new QueueService();
