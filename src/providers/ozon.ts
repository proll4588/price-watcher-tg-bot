import puppeteer from "puppeteer";
import { BaseProvider, ProviderConfig } from "./base";
import { ProviderResult } from "../types";
import { providerLogger } from "../utils/logger";
import { getRandomUserAgent } from "../utils/user-agents";
import { retryWithBackoff, sleep, getRandomDelay } from "../utils/retry";

export class OzonProvider extends BaseProvider {
  private browser: any = null;
  private requestCount = 0;
  private lastRequestTime = 0;

  constructor(affiliateToken?: string) {
    const config: ProviderConfig = {
      name: "Ozon",
      baseUrl: "https://www.ozon.ru",
      isEnabled: true,
      rateLimit: {
        requestsPerMinute: 10,
        requestsPerHour: 200,
      },
      retryConfig: {
        maxRetries: 2,
        backoffMs: 3000,
      },
    };
    super(config, affiliateToken);
  }

  async initBrowser(): Promise<void> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env["CHROME_BIN"] || "/usr/bin/chromium-browser",
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--no-first-run",
          "--disable-web-security",
          "--disable-features=VizDisplayCompositor",
          "--disable-background-timer-throttling",
          "--disable-backgrounding-occluded-windows",
          "--disable-renderer-backgrounding",
        ],
        defaultViewport: {
          width: 1920,
          height: 1080,
        },
      });
    }
  }

  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  canHandle(url: string): boolean {
    return url.includes("ozon.ru") && url.includes("/product/");
  }

  extractProductId(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split("/");

      for (let i = 0; i < pathParts.length; i++) {
        if (pathParts[i] === "product" && pathParts[i + 1]) {
          const productPart = pathParts[i + 1];

          if (productPart) {
            // Ищем ID в конце строки (после последнего дефиса)
            const parts = productPart.split("-");
            const lastPart = parts[parts.length - 1];

            // Проверяем, является ли последняя часть числом
            if (lastPart && /^\d+$/.test(lastPart)) {
              return lastPart;
            }

            // Fallback: ищем любое число в строке
            const numberMatch = productPart.match(/\d+/);
            if (numberMatch) {
              return numberMatch[0];
            }
          }
        }
      }

      return null;
    } catch (error) {
      providerLogger.error("Ошибка при извлечении ID товара Ozon:", { url, error });
      return null;
    }
  }

  async fetchProductInfo(productId: string): Promise<ProviderResult> {
    return retryWithBackoff(
      async () => {
        await this.rateLimit();
        await this.initBrowser();

        if (!this.browser) {
          throw new Error("Браузер не инициализирован");
        }

        const url = `${this.config.baseUrl}/product/${productId}/`;
        providerLogger.info("Запрос информации о товаре Ozon (Working):", {
          productId,
          url,
        });

        const page = await this.browser.newPage();

        try {
          // Устанавливаем User-Agent
          await page.setUserAgent(getRandomUserAgent());

          // Переходим на страницу
          await page.goto(url, {
            waitUntil: "networkidle2",
            timeout: 30000,
          });

          // Ждем загрузки контента
          await page.waitForTimeout(5000 + getRandomDelay(2000, 4000));

          // Ждем появления основных элементов
          await Promise.race([
            page.waitForSelector("h1", { timeout: 15000 }),
            page.waitForSelector('[data-widget="webProductHeading"]', { timeout: 15000 }),
            page.waitForSelector('[data-widget="webPrice"]', { timeout: 15000 }),
            page.waitForSelector(".price-block__price", { timeout: 15000 }),
          ]).catch(() => {
            // Игнорируем ошибки, если элементы не найдены
            providerLogger.debug("Не все элементы найдены, продолжаем");
          });

          // Извлекаем данные простым способом
          const productData = await page.evaluate(() => {
            // @ts-ignore - document доступен в контексте браузера
            const title =
              // @ts-ignore
              document.querySelector("h1")?.textContent?.trim() ||
              // @ts-ignore
              document.querySelector('[data-widget="webProductHeading"] h1')?.textContent?.trim() ||
              // @ts-ignore
              document.title;

            // @ts-ignore
            const priceElement =
              // @ts-ignore
              document.querySelector('[data-widget="webPrice"] [data-widget="price"] span') ||
              // @ts-ignore
              document.querySelector('[data-widget="webPrice"] span') ||
              // @ts-ignore
              document.querySelector('[data-widget="price"] span') ||
              // @ts-ignore
              document.querySelector(".price-block__price") ||
              // @ts-ignore
              document.querySelector('[data-widget="price"]') ||
              // @ts-ignore
              document.querySelector(".price");
            // @ts-ignore
            const price = priceElement?.textContent?.trim();

            // @ts-ignore
            const oldPriceElement =
              // @ts-ignore
              document.querySelector('[data-widget="webPrice"] [data-widget="price"] del') ||
              // @ts-ignore
              document.querySelector(".price-block__old-price") ||
              // @ts-ignore
              document.querySelector(".product-page__old-price");
            // @ts-ignore
            const oldPrice = oldPriceElement?.textContent?.trim();

            // @ts-ignore
            const imageElement =
              // @ts-ignore
              document.querySelector('[data-widget="webGallery"] img') ||
              // @ts-ignore
              document.querySelector(".product-image img") ||
              // @ts-ignore
              document.querySelector(".product-page__image img");
            // @ts-ignore
            const imageUrl =
              // @ts-ignore
              imageElement?.getAttribute("src") ||
              // @ts-ignore
              imageElement?.getAttribute("data-src");

            return {
              title,
              price,
              oldPrice,
              imageUrl,
            };
          });

          await page.close();

          console.log("DEBUG - Извлеченные данные:", productData);

          if (!productData.title || !productData.price) {
            throw new Error("Не удалось извлечь основные данные с страницы");
          }

          const price = this.extractPriceFromText(productData.price);
          const originalPrice = productData.oldPrice
            ? this.extractPriceFromText(productData.oldPrice)
            : undefined;

          const productInfo = this.createProductInfo(
            productId,
            productData.title,
            price,
            productData.imageUrl,
            url
          );

          providerLogger.info("Успешно получена информация о товаре Ozon (Working):", {
            productId,
            title: productData.title,
            price,
            originalPrice,
          });

          return { success: true, data: productInfo };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
          providerLogger.error("Ошибка при обработке страницы Ozon:", {
            productId,
            error: errorMessage,
          });
          await page.close();
          throw new Error(errorMessage);
        }
      },
      { maxRetries: 1, baseDelay: 3000, maxDelay: 10000 }
    );
  }

  private async rateLimit(): Promise<void> {
    this.requestCount++;
    const now = Date.now();

    const minDelay = 5000; // Увеличиваем задержку для Ozon
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < minDelay) {
      const delay = minDelay - timeSinceLastRequest + getRandomDelay(2000, 4000);
      await sleep(delay);
    }

    this.lastRequestTime = Date.now();
  }

  private extractPriceFromText(priceText: string): number {
    try {
      if (!priceText) {
        providerLogger.debug("Пустая цена Ozon:", { priceText });
        return 0;
      }

      providerLogger.debug("Извлечение цены Ozon:", { priceText });

      // Убираем все символы кроме цифр, точки и пробелов
      let cleanPrice = priceText.replace(/[^\d.,\s]/g, "");

      // Заменяем запятые на точки
      cleanPrice = cleanPrice.replace(",", ".");

      // Убираем лишние пробелы
      cleanPrice = cleanPrice.replace(/\s+/g, "");

      providerLogger.debug("Очищенная цена Ozon:", { priceText, cleanPrice });

      const price = parseFloat(cleanPrice);

      if (isNaN(price)) {
        providerLogger.warn("Не удалось распарсить цену Ozon:", { priceText, cleanPrice });
        return 0;
      }

      return price;
    } catch (error) {
      providerLogger.error("Ошибка при извлечении цены Ozon:", { priceText, error });
      return 0;
    }
  }

  createAffiliateUrl(originalUrl: string): string {
    if (!this.affiliateToken) {
      return originalUrl;
    }

    try {
      const url = new URL(originalUrl);
      url.searchParams.set("partner", this.affiliateToken);
      return url.toString();
    } catch (error) {
      providerLogger.error("Ошибка при создании партнерской ссылки Ozon:", { originalUrl, error });
      return originalUrl;
    }
  }

  normalizeUrl(url: string): string {
    try {
      const productId = this.extractProductId(url);

      if (productId) {
        return `${this.config.baseUrl}/product/${productId}/`;
      }

      return url;
    } catch (error) {
      providerLogger.error("Ошибка при нормализации URL Ozon:", { url, error });
      return url;
    }
  }
}
