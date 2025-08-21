import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { register } from "prom-client";
import { botLogger, apiLogger } from "./utils/logger";
import { telegramBot } from "./bot";
import { databaseService } from "./services/database";
import { queueService } from "./services/queue";
import { analyticsService } from "./services/analytics";
import { metricsService } from "./services/metrics";
import config from "./config";

// Импортируем воркеры для их запуска в основном процессе
import "./workers/price-checker";
import "./workers/notifier";

class Application {
  private app: express.Application;
  private server: any;

  constructor() {
    botLogger.info("Создаю экземпляр приложения...");
    this.app = express();
    botLogger.info("Настраиваю middleware...");
    this.setupMiddleware();
    botLogger.info("Настраиваю маршруты...");
    this.setupRoutes();
    botLogger.info("Экземпляр приложения создан успешно");
  }

  private setupMiddleware(): void {
    // Безопасность
    this.app.use(helmet());

    // CORS
    this.app.use(
      cors({
        origin: process.env["NODE_ENV"] === "production" ? ["https://your-domain.com"] : true,
        credentials: true,
      })
    );

    // Сжатие
    this.app.use(compression());

    // Парсинг JSON
    this.app.use(express.json({ limit: "10mb" }));
    this.app.use(express.urlencoded({ extended: true }));

    // Логирование запросов
    this.app.use((req, _res, next) => {
      apiLogger.info("HTTP Request", {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });
      next();
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get("/health", (_req, res) => {
      res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env["npm_package_version"] || "1.0.0",
      });
    });

    // Метрики Prometheus
    this.app.get("/metrics", async (_req, res) => {
      try {
        res.set("Content-Type", register.contentType);
        res.end(await metricsService.getMetrics());
      } catch (error) {
        apiLogger.error("Ошибка при получении метрик:", { error });
        res.status(500).end();
      }
    });

    // Статистика API
    this.app.get("/api/stats", async (_req, res) => {
      try {
        const stats = await this.getSystemStats();
        res.json(stats);
      } catch (error) {
        apiLogger.error("Ошибка при получении статистики:", { error });
        res.status(500).json({ error: "Internal server error" });
      }
    });

    // Детальная аналитика API
    this.app.get("/api/analytics", async (_req, res) => {
      try {
        const analytics = await analyticsService.getDetailedAnalytics();
        res.json(analytics);
      } catch (error) {
        apiLogger.error("Ошибка при получении аналитики:", { error });
        res.status(500).json({ error: "Internal server error" });
      }
    });

    // Webhook для Telegram (если используется)
    if (config.telegram.webhookUrl) {
      this.app.post("/webhook", (req, res) => {
        // Обработка webhook от Telegram
        const bot = telegramBot.getBot();
        if (bot) {
          bot.handleUpdate(req.body);
        }
        res.sendStatus(200);
      });
    }

    // Обработка 404
    this.app.use("*", (_req, res) => {
      res.status(404).json({ error: "Not found" });
    });

    // Обработка ошибок
    this.app.use(
      (error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        apiLogger.error("Unhandled error:", { error });
        res.status(500).json({ error: "Internal server error" });
      }
    );
  }

  private async getSystemStats(): Promise<any> {
    try {
      const [totalUsers, totalTracks, totalProducts, queueStats] = await Promise.all([
        databaseService.getTotalUsers(),
        databaseService.getTotalTracks(),
        databaseService.getTotalProducts(),
        queueService.getQueueStats(),
      ]);

      return {
        users: {
          total: totalUsers,
          active: await databaseService.getActiveUsersCount(),
        },
        tracks: {
          total: totalTracks,
          active: await databaseService.getActiveTracksCount(),
        },
        products: {
          total: totalProducts,
          active: await databaseService.getActiveProductsCount(),
        },
        queues: queueStats,
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          version: process.env["npm_package_version"] || "1.0.0",
        },
      };
    } catch (error) {
      apiLogger.error("Ошибка при получении системной статистики:", { error });
      throw error;
    }
  }

  async start(): Promise<void> {
    try {
      botLogger.info("Начинаю запуск приложения...");

      // Проверяем подключение к базе данных
      await databaseService.testConnection();
      botLogger.info("Подключение к базе данных установлено");

      // Запускаем сервис аналитики
      botLogger.info("Запускаю сервис аналитики...");
      analyticsService.start();
      botLogger.info("Сервис аналитики запущен");

      // Запускаем HTTP-сервер
      botLogger.info(`Запускаю HTTP-сервер на порту ${config.server.port}...`);
      this.server = this.app.listen(config.server.port, () => {
        botLogger.info(`HTTP-сервер запущен на порту ${config.server.port}`);
      });

      // Запускаем Telegram-бота (неблокирующий)
      botLogger.info("Запускаю Telegram-бота...");
      telegramBot
        .start()
        .then(() => {
          botLogger.info("Telegram-бот запущен");
        })
        .catch(error => {
          botLogger.error("Ошибка при запуске бота:", { error });
        });

      // Настраиваем graceful shutdown
      this.setupGracefulShutdown();

      botLogger.info("Приложение успешно запущено", {
        port: config.server.port,
        nodeEnv: config.server.nodeEnv,
        webhookUrl: config.telegram.webhookUrl,
      });
    } catch (error) {
      botLogger.error("Ошибка при запуске приложения:", { error });
      process.exit(1);
    }
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      botLogger.info(`Получен сигнал ${signal}, начинаю graceful shutdown...`);

      // Останавливаем прием новых запросов
      if (this.server) {
        this.server.close(() => {
          botLogger.info("HTTP-сервер остановлен");
        });
      }

      // Останавливаем бота
      await telegramBot.stop();

      // Закрываем браузеры (Puppeteer)
      await telegramBot.providerManager.closeBrowsers();

      // Останавливаем сервис аналитики
      analyticsService.stop();

      // Закрываем очереди
      await queueService.close();

      // Закрываем соединение с БД
      await databaseService.disconnect();

      botLogger.info("Приложение корректно остановлено");
      process.exit(0);
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));

    // Обработка необработанных ошибок
    process.on("uncaughtException", error => {
      botLogger.error("Необработанная ошибка:", { error });
      shutdown("uncaughtException");
    });

    process.on("unhandledRejection", (reason, promise) => {
      botLogger.error("Необработанное отклонение промиса:", { reason, promise });
      shutdown("unhandledRejection");
    });
  }
}

// Запускаем приложение
const app = new Application();

// Обработка ошибок при инициализации
process.on("exit", code => {
  botLogger.info(`Процесс завершается с кодом ${code}`);
});

process.on("warning", warning => {
  botLogger.warn("Предупреждение процесса:", { warning });
});

// Запуск приложения
app.start().catch(error => {
  botLogger.error("Критическая ошибка при запуске:", { error });
  process.exit(1);
});
