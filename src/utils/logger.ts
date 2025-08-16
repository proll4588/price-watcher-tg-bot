import pino from "pino";
import config from "../config";

const logger = pino({
  level: config.logging.level,
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:standard",
      ignore: "pid,hostname",
    },
  },
  base: {
    env: config.server.nodeEnv,
  },
});

export default logger;

// Создаем специализированные логгеры для разных компонентов
export const botLogger = logger.child({ component: "bot" });
export const providerLogger = logger.child({ component: "provider" });
export const queueLogger = logger.child({ component: "queue" });
export const dbLogger = logger.child({ component: "database" });
export const apiLogger = logger.child({ component: "api" });
