import { Decimal } from "@prisma/client/runtime/library";

export interface PriceInfo {
  price: Decimal;
  currency: string;
  discount?: number | undefined; // Percentage
  // Дополнительные цены для Wildberries
  walletPrice?: Decimal | undefined; // Цена по карте WB
  finalPrice?: Decimal | undefined; // Цена без карты
}

export interface ProductInfo {
  id: string;
  title: string;
  imageUrl?: string;
  price: PriceInfo;
  url: string;
}

export interface ProviderResult {
  success: boolean;
  data?: ProductInfo;
  error?: string;
}

export interface TrackSettings {
  minPrice?: Decimal;
  maxPrice?: Decimal;
  discountThreshold?: Decimal;
  checkIntervalHours: number;
}

export interface NotificationData {
  oldPrice: Decimal;
  newPrice: Decimal;
  discount: number;
  productUrl: string;
  affiliateUrl?: string;
}

import { Context } from "telegraf";

export interface BotContext {
  userId: string;
  telegramId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
}

// Расширенный контекст Telegraf с пользователем из БД
export interface ExtendedContext extends Context {
  user?: {
    id: string;
    telegramId: bigint;
    username?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    subscriptionTier: "FREE" | "PRO";
    createdAt: Date;
    updatedAt: Date;
  };
}

// Утилитарная функция для извлечения текста из сообщения
export function getMessageText(ctx: ExtendedContext): string | undefined {
  return (ctx.message as any)?.text;
}

export interface QueueJob<T = unknown> {
  id: string;
  data: T;
  attemptsMade: number;
  timestamp: number;
}

export interface PriceCheckJob extends QueueJob {
  data: {
    trackId: string;
    productId: string;
    userId: string;
  };
}

export interface RecurringPriceCheckJob extends QueueJob {
  data: {
    trackId: string;
  };
}

export interface NotificationJob extends QueueJob {
  data: {
    userId: string;
    type: "PRICE_DROP" | "PRICE_INCREASE" | "PRODUCT_UNAVAILABLE" | "SYSTEM";
    title: string;
    message: string;
    notificationData?: NotificationData;
  };
}

export interface ProviderConfig {
  name: string;
  baseUrl: string;
  isEnabled: boolean;
  rateLimit: {
    requestsPerMinute: number;
    requestsPerHour: number;
  };
  retryConfig: {
    maxRetries: number;
    backoffMs: number;
  };
}

export interface AffiliateConfig {
  provider: string;
  token: string;
  isActive: boolean;
}

export interface SubscriptionInfo {
  tier: "FREE" | "PRO";
  expiresAt?: Date;
  maxProducts: number;
  checkIntervalHours: number;
  features: string[];
}

export interface Metrics {
  totalUsers: number;
  totalTracks: number;
  totalProducts: number;
  priceChecksToday: number;
  notificationsSentToday: number;
  activeProviders: string[];
}
