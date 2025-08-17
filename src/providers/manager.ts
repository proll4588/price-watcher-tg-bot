import { BaseProvider } from "./base";
import { WildberriesProvider } from "./wildberries";
import { ProviderResult } from "../types";
import { providerLogger } from "../utils/logger";

export class ProviderManager {
  private providers: Map<string, BaseProvider> = new Map();

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders(): void {
    // Wildberries Puppeteer провайдер
    const wildberriesProvider = new WildberriesProvider();
    this.providers.set("wildberries", wildberriesProvider);
    providerLogger.info("Wildberries Puppeteer провайдер инициализирован");

    providerLogger.info(`Инициализировано провайдеров: ${this.providers.size}`);
  }

  /**
   * Находит подходящий провайдер для URL
   */
  findProvider(url: string): BaseProvider | null {
    for (const provider of this.providers.values()) {
      if (provider.canHandle(url)) {
        return provider;
      }
    }
    return null;
  }

  /**
   * Получает информацию о товаре по URL
   */
  async getProductInfo(url: string): Promise<ProviderResult> {
    const provider = this.findProvider(url);

    if (!provider) {
      return {
        success: false,
        error:
          "Неподдерживаемый маркетплейс. Поддерживается: Wildberries",
      };
    }

    if (!provider.isEnabled()) {
      return {
        success: false,
        error: `Провайдер ${provider.getConfig().name} временно недоступен`,
      };
    }

    try {
      return await provider.getCurrentPrice(url);
    } catch (error) {
      providerLogger.error("Ошибка при получении информации о товаре:", { url, error });
      return {
        success: false,
        error: `Ошибка при получении информации о товаре: ${error instanceof Error ? error.message : "Неизвестная ошибка"}`,
      };
    }
  }

  /**
   * Создает партнерскую ссылку для URL
   */
  createAffiliateUrl(url: string): string {
    const provider = this.findProvider(url);

    if (!provider) {
      return url; // Возвращаем оригинальную ссылку, если провайдер не найден
    }

    try {
      return provider.createAffiliateUrl(url);
    } catch (error) {
      providerLogger.error("Ошибка при создании партнерской ссылки:", { url, error });
      return url;
    }
  }

  /**
   * Нормализует URL для хранения
   */
  normalizeUrl(url: string): string {
    const provider = this.findProvider(url);

    if (!provider) {
      return url;
    }

    try {
      return provider.normalizeUrl(url);
    } catch (error) {
      providerLogger.error("Ошибка при нормализации URL:", { url, error });
      return url;
    }
  }

  /**
   * Получает список активных провайдеров
   */
  getActiveProviders(): string[] {
    return Array.from(this.providers.values())
      .filter(provider => provider.isEnabled())
      .map(provider => provider.getConfig().name);
  }

  /**
   * Получает статистику по провайдерам
   */
  getProvidersStats(): Record<string, any> {
    const stats: Record<string, any> = {};

    for (const [name, provider] of this.providers.entries()) {
      const config = provider.getConfig();
      stats[name] = {
        enabled: provider.isEnabled(),
        rateLimit: config.rateLimit,
        retryConfig: config.retryConfig,
      };
    }

    return stats;
  }

  /**
   * Включает/выключает провайдер
   */
  setProviderEnabled(providerName: string, enabled: boolean): boolean {
    const provider = this.providers.get(providerName);

    if (!provider) {
      return false;
    }

    // Обновляем конфигурацию провайдера
    const config = provider.getConfig();
    config.isEnabled = enabled;

    providerLogger.info(`Провайдер ${providerName} ${enabled ? "включен" : "выключен"}`);
    return true;
  }

  /**
   * Закрывает браузеры (для Puppeteer провайдеров)
   */
  async closeBrowsers(): Promise<void> {
    for (const provider of this.providers.values()) {
      if (provider && typeof (provider as any).closeBrowser === "function") {
        try {
          await (provider as any).closeBrowser();
        } catch (error) {
          providerLogger.error("Ошибка при закрытии браузера:", { error });
        }
      }
    }
    providerLogger.info("Все браузеры закрыты");
  }
}
