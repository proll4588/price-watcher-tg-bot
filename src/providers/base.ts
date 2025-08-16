import { ProductInfo, ProviderResult } from "../types";
import { Decimal } from "@prisma/client/runtime/library";

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

export abstract class BaseProvider {
  protected config: ProviderConfig;
  protected affiliateToken?: string | undefined;

  constructor(config: ProviderConfig, affiliateToken?: string) {
    this.config = config;
    this.affiliateToken = affiliateToken;
  }

  /**
   * Проверяет, может ли провайдер обработать данную ссылку
   */
  abstract canHandle(url: string): boolean;

  /**
   * Извлекает ID товара из URL
   */
  abstract extractProductId(url: string): string | null;

  /**
   * Получает информацию о товаре по ID
   */
  abstract fetchProductInfo(productId: string): Promise<ProviderResult>;

  /**
   * Создает партнерскую ссылку
   */
  abstract createAffiliateUrl(originalUrl: string): string;

  /**
   * Нормализует URL для хранения
   */
  abstract normalizeUrl(url: string): string;

  /**
   * Получает текущую цену товара
   */
  async getCurrentPrice(url: string): Promise<ProviderResult> {
    try {
      const productId = this.extractProductId(url);
      if (!productId) {
        return {
          success: false,
          error: "Не удалось извлечь ID товара из URL",
        };
      }

      return await this.fetchProductInfo(productId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Ошибка при получении цены: ${errorMessage}`,
      };
    }
  }

  /**
   * Проверяет, активен ли провайдер
   */
  isEnabled(): boolean {
    return this.config.isEnabled;
  }

  /**
   * Получает конфигурацию провайдера
   */
  getConfig(): ProviderConfig {
    return this.config;
  }

  /**
   * Создает объект ProductInfo из данных провайдера
   */
  protected createProductInfo(
    id: string,
    title: string,
    price: number,
    imageUrl?: string,
    url?: string,
    walletPrice?: number,
    finalPrice?: number
  ): ProductInfo {
    return {
      id,
      title,
      ...(imageUrl && { imageUrl }),
      url: url || "",
      price: {
        price: new Decimal(price),
        currency: "RUB",
        walletPrice: walletPrice ? new Decimal(walletPrice) : undefined,
        finalPrice: finalPrice ? new Decimal(finalPrice) : undefined,
      },
    };
  }
}
