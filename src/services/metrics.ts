import { Counter, Gauge, Histogram, register } from "prom-client";
import { metricsLogger } from "../utils/logger";

class MetricsService {
  // Метрики пользователей
  private newUsersCounter!: Counter;
  private activeUsersGauge!: Gauge;
  private totalUsersGauge!: Gauge;

  // Метрики отслеживаний
  private trackRequestsCounter!: Counter;
  private activeTracksGauge!: Gauge;
  private totalTracksGauge!: Gauge;
  private trackRemovalsCounter!: Counter;

  // Метрики воркеров
  private priceChecksCounter!: Counter;
  private priceChecksDuration!: Histogram;
  private notificationsSentCounter!: Counter;
  private notificationsFailedCounter!: Counter;
  private workerErrorsCounter!: Counter;
  private workerHealthGauge!: Gauge;
  private workerUptimeGauge!: Gauge;
  private workerMemoryGauge!: Gauge;

  // Метрики товаров
  private productsTrackedGauge!: Gauge;
  private priceSnapshotsCounter!: Counter;
  private priceChangesCounter!: Counter;

  // Метрики очередей
  private queueJobsGauge!: Gauge;
  private queueJobsWaitingGauge!: Gauge;
  private queueJobsActiveGauge!: Gauge;
  private queueJobsCompletedGauge!: Gauge;
  private queueJobsFailedGauge!: Gauge;

  constructor() {
    this.initializeMetrics();
    metricsLogger.info("Сервис метрик инициализирован");
  }

  private initializeMetrics(): void {
    // Метрики пользователей
    this.newUsersCounter = new Counter({
      name: "price_watcher_new_users_total",
      help: "Общее количество новых пользователей",
      labelNames: ["source"],
    });

    this.activeUsersGauge = new Gauge({
      name: "price_watcher_active_users",
      help: "Количество активных пользователей",
    });

    this.totalUsersGauge = new Gauge({
      name: "price_watcher_total_users",
      help: "Общее количество пользователей",
    });

    // Метрики отслеживаний
    this.trackRequestsCounter = new Counter({
      name: "price_watcher_track_requests_total",
      help: "Общее количество запросов на отслеживание товаров",
      labelNames: ["provider", "status"],
    });

    this.activeTracksGauge = new Gauge({
      name: "price_watcher_active_tracks",
      help: "Количество активных отслеживаний",
      labelNames: ["provider"],
    });

    this.totalTracksGauge = new Gauge({
      name: "price_watcher_total_tracks",
      help: "Общее количество отслеживаний",
    });

    this.trackRemovalsCounter = new Counter({
      name: "price_watcher_track_removals_total",
      help: "Общее количество удалений отслеживаний",
      labelNames: ["reason"],
    });

    // Метрики воркеров
    this.priceChecksCounter = new Counter({
      name: "price_watcher_price_checks_total",
      help: "Общее количество проверок цен",
      labelNames: ["provider", "status"],
    });

    this.priceChecksDuration = new Histogram({
      name: "price_watcher_price_check_duration_seconds",
      help: "Время выполнения проверки цены",
      labelNames: ["provider"],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
    });

    this.notificationsSentCounter = new Counter({
      name: "price_watcher_notifications_sent_total",
      help: "Общее количество отправленных уведомлений",
      labelNames: ["type", "status"],
    });

    this.notificationsFailedCounter = new Counter({
      name: "price_watcher_notifications_failed_total",
      help: "Общее количество неудачных отправок уведомлений",
      labelNames: ["type", "reason"],
    });

    this.workerErrorsCounter = new Counter({
      name: "price_watcher_worker_errors_total",
      help: "Общее количество ошибок воркеров",
      labelNames: ["worker", "error_type"],
    });

    this.workerHealthGauge = new Gauge({
      name: "price_watcher_worker_health",
      help: "Состояние здоровья воркеров (1 = здоров, 0 = нездоров)",
      labelNames: ["worker"],
    });

    this.workerUptimeGauge = new Gauge({
      name: "price_watcher_worker_uptime_seconds",
      help: "Время работы воркера в секундах",
      labelNames: ["worker"],
    });

    this.workerMemoryGauge = new Gauge({
      name: "price_watcher_worker_memory_bytes",
      help: "Использование памяти воркером в байтах",
      labelNames: ["worker", "type"],
    });

    // Метрики товаров
    this.productsTrackedGauge = new Gauge({
      name: "price_watcher_products_tracked",
      help: "Количество отслеживаемых товаров",
      labelNames: ["provider"],
    });

    this.priceSnapshotsCounter = new Counter({
      name: "price_watcher_price_snapshots_total",
      help: "Общее количество снимков цен",
      labelNames: ["provider"],
    });

    this.priceChangesCounter = new Counter({
      name: "price_watcher_price_changes_total",
      help: "Общее количество изменений цен",
      labelNames: ["provider", "direction"],
    });

    // Метрики очередей
    this.queueJobsGauge = new Gauge({
      name: "price_watcher_queue_jobs",
      help: "Количество задач в очереди",
      labelNames: ["queue", "state"],
    });

    this.queueJobsWaitingGauge = new Gauge({
      name: "price_watcher_queue_jobs_waiting",
      help: "Количество ожидающих задач",
      labelNames: ["queue"],
    });

    this.queueJobsActiveGauge = new Gauge({
      name: "price_watcher_queue_jobs_active",
      help: "Количество активных задач",
      labelNames: ["queue"],
    });

    this.queueJobsCompletedGauge = new Gauge({
      name: "price_watcher_queue_jobs_completed",
      help: "Количество завершенных задач",
      labelNames: ["queue"],
    });

    this.queueJobsFailedGauge = new Gauge({
      name: "price_watcher_queue_jobs_failed",
      help: "Количество неудачных задач",
      labelNames: ["queue"],
    });
  }

  // Методы для пользователей
  incrementNewUser(source: string = "telegram"): void {
    this.newUsersCounter.inc({ source });
    metricsLogger.debug("Увеличен счетчик новых пользователей", { source });
  }

  setActiveUsers(count: number): void {
    this.activeUsersGauge.set(count);
    metricsLogger.debug("Обновлено количество активных пользователей", { count });
  }

  setTotalUsers(count: number): void {
    this.totalUsersGauge.set(count);
    metricsLogger.debug("Обновлено общее количество пользователей", { count });
  }

  // Методы для отслеживаний
  incrementTrackRequest(provider: string, status: "success" | "failed" | "duplicate"): void {
    this.trackRequestsCounter.inc({ provider, status });
    metricsLogger.debug("Увеличен счетчик запросов на отслеживание", { provider, status });
  }

  setActiveTracks(count: number, provider?: string): void {
    if (provider) {
      this.activeTracksGauge.set({ provider }, count);
    } else {
      this.activeTracksGauge.set(count);
    }
    metricsLogger.debug("Обновлено количество активных отслеживаний", { count, provider });
  }

  setTotalTracks(count: number): void {
    this.totalTracksGauge.set(count);
    metricsLogger.debug("Обновлено общее количество отслеживаний", { count });
  }

  incrementTrackRemoval(
    reason: "user_request" | "product_unavailable" | "bot_blocked" | "error"
  ): void {
    this.trackRemovalsCounter.inc({ reason });
    metricsLogger.debug("Увеличен счетчик удалений отслеживаний", { reason });
  }

  // Методы для воркеров
  incrementPriceCheck(provider: string, status: "success" | "failed" | "unavailable"): void {
    this.priceChecksCounter.inc({ provider, status });
    metricsLogger.debug("Увеличен счетчик проверок цен", { provider, status });
  }

  observePriceCheckDuration(provider: string, duration: number): void {
    this.priceChecksDuration.observe({ provider }, duration);
    metricsLogger.debug("Зафиксировано время проверки цены", { provider, duration });
  }

  incrementNotificationSent(type: string, status: "success" | "failed"): void {
    this.notificationsSentCounter.inc({ type, status });
    metricsLogger.debug("Увеличен счетчик отправленных уведомлений", { type, status });
  }

  incrementNotificationFailed(
    type: string,
    reason: "user_blocked" | "network_error" | "invalid_user"
  ): void {
    this.notificationsFailedCounter.inc({ type, reason });
    metricsLogger.debug("Увеличен счетчик неудачных уведомлений", { type, reason });
  }

  incrementWorkerError(worker: string, errorType: string): void {
    this.workerErrorsCounter.inc({ worker, error_type: errorType });
    metricsLogger.debug("Увеличен счетчик ошибок воркера", { worker, errorType });
  }

  setWorkerHealth(worker: string, isHealthy: boolean): void {
    this.workerHealthGauge.set({ worker }, isHealthy ? 1 : 0);
    metricsLogger.debug("Обновлено состояние здоровья воркера", { worker, isHealthy });
  }

  setWorkerUptime(worker: string, uptimeSeconds: number): void {
    this.workerUptimeGauge.set({ worker }, uptimeSeconds);
    metricsLogger.debug("Обновлено время работы воркера", { worker, uptimeSeconds });
  }

  setWorkerMemory(worker: string, memoryType: string, bytes: number): void {
    this.workerMemoryGauge.set({ worker, type: memoryType }, bytes);
    metricsLogger.debug("Обновлено использование памяти воркером", { worker, memoryType, bytes });
  }

  // Методы для товаров
  setProductsTracked(count: number, provider?: string): void {
    if (provider) {
      this.productsTrackedGauge.set({ provider }, count);
    } else {
      this.productsTrackedGauge.set(count);
    }
    metricsLogger.debug("Обновлено количество отслеживаемых товаров", { count, provider });
  }

  incrementPriceSnapshot(provider: string): void {
    this.priceSnapshotsCounter.inc({ provider });
    metricsLogger.debug("Увеличен счетчик снимков цен", { provider });
  }

  incrementPriceChange(provider: string, direction: "increase" | "decrease"): void {
    this.priceChangesCounter.inc({ provider, direction });
    metricsLogger.debug("Увеличен счетчик изменений цен", { provider, direction });
  }

  // Методы для очередей
  setQueueJobs(queue: string, state: string, count: number): void {
    this.queueJobsGauge.set({ queue, state }, count);
    metricsLogger.debug("Обновлено количество задач в очереди", { queue, state, count });
  }

  setQueueJobsWaiting(queue: string, count: number): void {
    this.queueJobsWaitingGauge.set({ queue }, count);
    metricsLogger.debug("Обновлено количество ожидающих задач", { queue, count });
  }

  setQueueJobsActive(queue: string, count: number): void {
    this.queueJobsActiveGauge.set({ queue }, count);
    metricsLogger.debug("Обновлено количество активных задач", { queue, count });
  }

  setQueueJobsCompleted(queue: string, count: number): void {
    this.queueJobsCompletedGauge.set({ queue }, count);
    metricsLogger.debug("Обновлено количество завершенных задач", { queue, count });
  }

  setQueueJobsFailed(queue: string, count: number): void {
    this.queueJobsFailedGauge.set({ queue }, count);
    metricsLogger.debug("Обновлено количество неудачных задач", { queue, count });
  }

  // Получение метрик
  async getMetrics(): Promise<string> {
    return await register.metrics();
  }

  // Сброс метрик (для тестирования)
  async resetMetrics(): Promise<void> {
    await register.clear();
    this.initializeMetrics();
    metricsLogger.info("Метрики сброшены");
  }
}

export const metricsService = new MetricsService();
