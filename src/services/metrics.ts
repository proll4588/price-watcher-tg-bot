import { Counter, Gauge, Histogram, register } from "prom-client";
import { metricsLogger } from "../utils/logger";
import * as os from "os";

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

  // Новые метрики нагрузки на сервер
  private systemCpuUsageGauge!: Gauge;
  private systemMemoryUsageGauge!: Gauge;
  private systemMemoryTotalGauge!: Gauge;
  private systemMemoryFreeGauge!: Gauge;
  private systemLoadAverageGauge!: Gauge;
  private systemUptimeGauge!: Gauge;
  private systemDiskUsageGauge!: Gauge;
  private systemNetworkBytesGauge!: Gauge;
  private httpRequestsTotal!: Counter;
  private httpRequestDuration!: Histogram;
  private httpRequestsInProgress!: Gauge;
  private processCpuUsageGauge!: Gauge;
  private processMemoryUsageGauge!: Gauge;
  private processHeapUsageGauge!: Gauge;
  private processEventLoopLag!: Histogram;
  private databaseConnectionsGauge!: Gauge;
  private databaseQueryDuration!: Histogram;
  private databaseQueriesTotal!: Counter;

  constructor() {
    this.initializeMetrics();
    this.startSystemMetricsCollection();
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

    // Новые метрики нагрузки на сервер
    this.systemCpuUsageGauge = new Gauge({
      name: "price_watcher_system_cpu_usage_percent",
      help: "Использование CPU системой в процентах",
      labelNames: ["core"],
    });

    this.systemMemoryUsageGauge = new Gauge({
      name: "price_watcher_system_memory_usage_bytes",
      help: "Использование памяти системой в байтах",
      labelNames: ["type"],
    });

    this.systemMemoryTotalGauge = new Gauge({
      name: "price_watcher_system_memory_total_bytes",
      help: "Общий объем памяти системы в байтах",
    });

    this.systemMemoryFreeGauge = new Gauge({
      name: "price_watcher_system_memory_free_bytes",
      help: "Свободная память системы в байтах",
    });

    this.systemLoadAverageGauge = new Gauge({
      name: "price_watcher_system_load_average",
      help: "Средняя нагрузка на систему",
      labelNames: ["period"],
    });

    this.systemUptimeGauge = new Gauge({
      name: "price_watcher_system_uptime_seconds",
      help: "Время работы системы в секундах",
    });

    this.systemDiskUsageGauge = new Gauge({
      name: "price_watcher_system_disk_usage_bytes",
      help: "Использование диска в байтах",
      labelNames: ["mountpoint", "type"],
    });

    this.systemNetworkBytesGauge = new Gauge({
      name: "price_watcher_system_network_bytes_total",
      help: "Общее количество байт сетевого трафика",
      labelNames: ["interface", "direction"],
    });

    this.httpRequestsTotal = new Counter({
      name: "price_watcher_http_requests_total",
      help: "Общее количество HTTP запросов",
      labelNames: ["method", "path", "status_code"],
    });

    this.httpRequestDuration = new Histogram({
      name: "price_watcher_http_request_duration_seconds",
      help: "Время выполнения HTTP запросов",
      labelNames: ["method", "path"],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10, 30],
    });

    this.httpRequestsInProgress = new Gauge({
      name: "price_watcher_http_requests_in_progress",
      help: "Количество HTTP запросов в процессе выполнения",
      labelNames: ["method", "path"],
    });

    this.processCpuUsageGauge = new Gauge({
      name: "price_watcher_process_cpu_usage_percent",
      help: "Использование CPU процессом в процентах",
    });

    this.processMemoryUsageGauge = new Gauge({
      name: "price_watcher_process_memory_usage_bytes",
      help: "Использование памяти процессом в байтах",
      labelNames: ["type"],
    });

    this.processHeapUsageGauge = new Gauge({
      name: "price_watcher_process_heap_usage_bytes",
      help: "Использование кучи процессом в байтах",
      labelNames: ["type"],
    });

    this.processEventLoopLag = new Histogram({
      name: "price_watcher_process_event_loop_lag_seconds",
      help: "Задержка event loop в секундах",
      buckets: [0.001, 0.01, 0.1, 0.5, 1, 2, 5, 10],
    });

    this.databaseConnectionsGauge = new Gauge({
      name: "price_watcher_database_connections",
      help: "Количество подключений к базе данных",
      labelNames: ["state"],
    });

    this.databaseQueryDuration = new Histogram({
      name: "price_watcher_database_query_duration_seconds",
      help: "Время выполнения запросов к базе данных",
      labelNames: ["operation"],
      buckets: [0.001, 0.01, 0.1, 0.5, 1, 2, 5, 10],
    });

    this.databaseQueriesTotal = new Counter({
      name: "price_watcher_database_queries_total",
      help: "Общее количество запросов к базе данных",
      labelNames: ["operation", "status"],
    });
  }

  private startSystemMetricsCollection(): void {
    // Обновление системных метрик каждые 30 секунд
    setInterval(() => {
      this.updateSystemMetrics();
    }, 30000);

    // Обновление метрик процесса каждые 10 секунд
    setInterval(() => {
      this.updateProcessMetrics();
    }, 10000);

    // Обновление метрик event loop каждые 5 секунд
    setInterval(() => {
      this.updateEventLoopMetrics();
    }, 5000);
  }

  private updateSystemMetrics(): void {
    try {
      // CPU
      const cpus = os.cpus();
      cpus.forEach((cpu, index) => {
        const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
        const idle = cpu.times.idle;
        const usage = ((total - idle) / total) * 100;
        this.systemCpuUsageGauge.set({ core: `cpu${index}` }, usage);
      });

      // Память
      const memInfo = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = memInfo - freeMem;

      this.systemMemoryTotalGauge.set(memInfo);
      this.systemMemoryFreeGauge.set(freeMem);
      this.systemMemoryUsageGauge.set({ type: "used" }, usedMem);
      this.systemMemoryUsageGauge.set({ type: "available" }, freeMem);

      // Load average
      const loadAvg = os.loadavg();
      this.systemLoadAverageGauge.set({ period: "1m" }, loadAvg[0] || 0);
      this.systemLoadAverageGauge.set({ period: "5m" }, loadAvg[1] || 0);
      this.systemLoadAverageGauge.set({ period: "15m" }, loadAvg[2] || 0);

      // Uptime
      this.systemUptimeGauge.set(os.uptime());

      metricsLogger.debug("Обновлены системные метрики");
    } catch (error) {
      metricsLogger.error("Ошибка при обновлении системных метрик", { error });
    }
  }

  private updateProcessMetrics(): void {
    try {
      const usage = process.cpuUsage();
      const memUsage = process.memoryUsage();

      // CPU процессора
      const totalCpuTime = usage.user + usage.system;
      this.processCpuUsageGauge.set(totalCpuTime / 1000000); // конвертируем в секунды

      // Память процесса
      this.processMemoryUsageGauge.set({ type: "rss" }, memUsage.rss);
      this.processMemoryUsageGauge.set({ type: "heapTotal" }, memUsage.heapTotal);
      this.processMemoryUsageGauge.set({ type: "heapUsed" }, memUsage.heapUsed);
      this.processMemoryUsageGauge.set({ type: "external" }, memUsage.external);
      this.processMemoryUsageGauge.set({ type: "arrayBuffers" }, memUsage.arrayBuffers);

      // Куча
      this.processHeapUsageGauge.set({ type: "used" }, memUsage.heapUsed);
      this.processHeapUsageGauge.set({ type: "total" }, memUsage.heapTotal);

      metricsLogger.debug("Обновлены метрики процесса");
    } catch (error) {
      metricsLogger.error("Ошибка при обновлении метрик процесса", { error });
    }
  }

  private updateEventLoopMetrics(): void {
    try {
      const start = process.hrtime.bigint();
      setImmediate(() => {
        const end = process.hrtime.bigint();
        const lag = Number(end - start) / 1000000000; // конвертируем в секунды
        this.processEventLoopLag.observe(lag);
      });
    } catch (error) {
      metricsLogger.error("Ошибка при обновлении метрик event loop", { error });
    }
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

  // Новые методы для HTTP метрик
  incrementHttpRequest(method: string, path: string, statusCode: number): void {
    this.httpRequestsTotal.inc({ method, path, status_code: statusCode.toString() });
    metricsLogger.debug("Увеличен счетчик HTTP запросов", { method, path, statusCode });
  }

  observeHttpRequestDuration(method: string, path: string, duration: number): void {
    this.httpRequestDuration.observe({ method, path }, duration);
    metricsLogger.debug("Зафиксировано время HTTP запроса", { method, path, duration });
  }

  setHttpRequestsInProgress(method: string, path: string, count: number): void {
    this.httpRequestsInProgress.set({ method, path }, count);
    metricsLogger.debug("Обновлено количество HTTP запросов в процессе", { method, path, count });
  }

  // Новые методы для метрик базы данных
  setDatabaseConnections(state: string, count: number): void {
    this.databaseConnectionsGauge.set({ state }, count);
    metricsLogger.debug("Обновлено количество подключений к БД", { state, count });
  }

  observeDatabaseQueryDuration(operation: string, duration: number): void {
    this.databaseQueryDuration.observe({ operation }, duration);
    metricsLogger.debug("Зафиксировано время запроса к БД", { operation, duration });
  }

  incrementDatabaseQuery(operation: string, status: "success" | "error"): void {
    this.databaseQueriesTotal.inc({ operation, status });
    metricsLogger.debug("Увеличен счетчик запросов к БД", { operation, status });
  }

  // Новые методы для сетевых метрик
  setNetworkBytes(networkInterface: string, direction: "in" | "out", bytes: number): void {
    this.systemNetworkBytesGauge.set({ interface: networkInterface, direction }, bytes);
    metricsLogger.debug("Обновлены сетевые метрики", {
      interface: networkInterface,
      direction,
      bytes,
    });
  }

  // Новые методы для метрик диска
  setDiskUsage(mountpoint: string, type: "used" | "free" | "total", bytes: number): void {
    this.systemDiskUsageGauge.set({ mountpoint, type }, bytes);
    metricsLogger.debug("Обновлены метрики диска", { mountpoint, type, bytes });
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
