import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const configSchema = z.object({
  // Telegram
  telegram: z.object({
    botToken: z.string().min(1),
    webhookUrl: z.string().url().optional().or(z.literal("")),
  }),

  // Database
  database: z.object({
    url: z.string().url(),
  }),

  // Redis
  redis: z.object({
    url: z.string().url(),
  }),

  // Server
  server: z.object({
    port: z.number().int().positive().default(3000),
    nodeEnv: z.enum(["development", "production", "test"]).default("development"),
  }),

  // Logging
  logging: z.object({
    level: z.enum(["error", "warn", "info", "debug"]).default("info"),
  }),

  // Price Check Settings
  priceCheck: z.object({
    defaultIntervalHours: z
      .number()
      .positive()
      .min(1 / 60) // Минимум 1 минута
      .default(6), // 6 часов по умолчанию
    freeTierMaxProducts: z.number().int().positive().default(3),
    proTierMaxProducts: z.number().int().positive().default(50),
    proCheckIntervalHours: z
      .number()
      .positive()
      .min(1 / 60) // Минимум 1 минута
      .default(1), // 1 час для PRO
  }),

  // Affiliate Links
  affiliate: z.object({
    wildberries: z.string().optional(),
    yandexMarket: z.string().optional(),
  }),

  // Monitoring
  monitoring: z.object({
    sentryDsn: z.string().optional(),
    prometheusPort: z.number().int().positive().default(9090),
  }),

  // Feature Flags
  features: z.object({
    enableWildberries: z.boolean().default(true),
    enableYandexMarket: z.boolean().default(true),
  }),
});

const config = configSchema.parse({
  telegram: {
    botToken: process.env["TELEGRAM_BOT_TOKEN"],
    webhookUrl: process.env["TELEGRAM_WEBHOOK_URL"],
  },
  database: {
    url: process.env["DATABASE_URL"],
  },
  redis: {
    url: process.env["REDIS_URL"] || "redis://localhost:6379",
  },
  server: {
    port: parseInt(process.env["PORT"] || "3000"),
    nodeEnv: process.env["NODE_ENV"],
  },
  logging: {
    level: process.env["LOG_LEVEL"],
  },
  priceCheck: {
    defaultIntervalHours: parseFloat(process.env["DEFAULT_CHECK_INTERVAL_HOURS"] || "6"), // 6 часов по умолчанию
    freeTierMaxProducts: parseInt(process.env["FREE_TIER_MAX_PRODUCTS"] || "3"),
    proTierMaxProducts: parseInt(process.env["PRO_TIER_MAX_PRODUCTS"] || "50"),
    proCheckIntervalHours: parseFloat(process.env["PRO_CHECK_INTERVAL_HOURS"] || "1"), // 1 час для PRO
  },
  affiliate: {
    wildberries: process.env["WILDBERRIES_AFFILIATE_TOKEN"],
    yandexMarket: process.env["YANDEX_MARKET_AFFILIATE_TOKEN"],
  },
  monitoring: {
    sentryDsn: process.env["SENTRY_DSN"],
    prometheusPort: parseInt(process.env["PROMETHEUS_PORT"] || "9090"),
  },
  features: {
    enableWildberries: process.env["ENABLE_WILDBERRIES_PROVIDER"] === "true",
    enableYandexMarket: process.env["ENABLE_YANDEX_MARKET_PROVIDER"] === "true",
  },
});

export default config;
