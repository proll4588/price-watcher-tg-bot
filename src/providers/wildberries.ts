import puppeteer, { Browser, Page } from "puppeteer";
import { BaseProvider } from "./base";
import { ProviderResult } from "../types";
import { providerLogger } from "../utils/logger";
import { retryWithBackoff, sleep, getRandomDelay } from "../utils/retry";
import { getRandomUserAgent } from "../utils/user-agents";

export class WildberriesProvider extends BaseProvider {
  private browser: Browser | null = null;
  private requestCount = 0;
  private lastRequestTime = 0;

  constructor(affiliateToken?: string) {
    const config = {
      name: "Wildberries",
      baseUrl: "https://www.wildberries.ru",
      isEnabled: true,
      rateLimit: {
        requestsPerMinute: 10,
        requestsPerHour: 200,
      },
      retryConfig: {
        maxRetries: 1,
        backoffMs: 2000,
      },
    };
    super(config, affiliateToken);
  }

  async initBrowser(): Promise<void> {
    if (!this.browser) {
      try {
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
            width: 1366,
            height: 768,
          },
          ignoreHTTPSErrors: true,
          timeout: 20000,
        });
      } catch (error) {
        console.error("DEBUG - Ошибка при инициализации браузера:", error);
        this.browser = null;
        throw error;
      }
    }
  }

  async closeBrowser(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (error) {
        console.error("DEBUG - Ошибка при закрытии браузера:", error);
      }
      this.browser = null;
    }
  }

  canHandle(url: string): boolean {
    return url.includes("wildberries.ru") || url.includes("wildberries.com");
  }

  extractProductId(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split("/");

      for (let i = 0; i < pathParts.length; i++) {
        if (pathParts[i] === "catalog" && pathParts[i + 1]) {
          const productId = pathParts[i + 1];
          if (productId && /^\d+$/.test(productId)) {
            return productId;
          }
        }
      }

      return null;
    } catch (error) {
      providerLogger.error("Ошибка при извлечении ID товара Wildberries:", { url, error });
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

        const url = `${this.config.baseUrl}/catalog/${productId}/detail.aspx`;
        providerLogger.info("Запрос информации о товаре Wildberries:", {
          productId,
          url,
        });

        let page: Page | null = null;

        try {
          page = await this.browser.newPage();

          // Устанавливаем User-Agent
          await page.setUserAgent(getRandomUserAgent());

          // Переходим на страницу
          await page.goto(url, {
            waitUntil: "networkidle0", // Ждем полной загрузки
            timeout: 30000,
          });

          // Устанавливаем viewport
          await page.setViewport({ width: 1366, height: 768 });

          // Ждем загрузки контента
          await page.waitForTimeout(5000);

          // Ждем появления основных элементов
          await Promise.race([
            page.waitForSelector("h1", { timeout: 15000 }),
            page.waitForSelector(".product-page__title", { timeout: 15000 }),
            page.waitForSelector(".price-block__price", { timeout: 15000 }),
            page.waitForSelector(".price-block__wallet-price", { timeout: 15000 }),
            page.waitForSelector(".price-block__final-price", { timeout: 15000 }),
          ]).catch(() => {
            // Игнорируем ошибки, если элементы не найдены
          });

          // Дополнительное ожидание для динамического контента
          await page.waitForTimeout(3000);

          // Извлекаем данные с учетом всех типов цен
          const productData = await page.evaluate(() => {
            // @ts-ignore - document доступен в контексте браузера
            const h1Element = document.querySelector("h1");
            // @ts-ignore
            const titleElement = document.querySelector(".product-page__title");
            // @ts-ignore
            const pageTitle = document.title;

            const title =
              h1Element?.textContent?.trim() || titleElement?.textContent?.trim() || pageTitle;

            // 1. Цена по карте WB (приоритетная)
            // @ts-ignore
            const walletPriceElement = document.querySelector(".price-block__wallet-price");
            // @ts-ignore
            const walletPrice = walletPriceElement?.textContent?.trim();

            // 2. Цена без карты (основная цена)
            // @ts-ignore
            const finalPriceElement = document.querySelector(".price-block__final-price");
            // @ts-ignore
            const finalPrice = finalPriceElement?.textContent?.trim();

            // 3. Старая цена (зачеркнутая)
            // @ts-ignore
            const oldPriceElement = document.querySelector(".price-block__old-price");
            // @ts-ignore
            const oldPrice = oldPriceElement?.textContent?.trim();

            // Fallback: ищем любую цену если основные не найдены
            // @ts-ignore
            const fallbackPriceElement =
              // @ts-ignore
              document.querySelector(".price-block__price") ||
              // @ts-ignore
              document.querySelector("[data-price]");
            // @ts-ignore
            const fallbackPrice =
              fallbackPriceElement?.textContent?.trim() ||
              // @ts-ignore
              fallbackPriceElement?.getAttribute("data-price");

            // Определяем основную цену (приоритет: без карты > карта WB > fallback)
            const mainPrice = finalPrice || walletPrice || fallbackPrice;

            // @ts-ignore
            const imageElement =
              // @ts-ignore
              document.querySelector(".zoom-image-container img") ||
              // @ts-ignore
              document.querySelector(".photo-zoom__preview img");
            // @ts-ignore
            const imageUrl =
              // @ts-ignore
              imageElement?.getAttribute("src") ||
              // @ts-ignore
              imageElement?.getAttribute("data-src");

            return {
              title,
              mainPrice,
              walletPrice,
              finalPrice,
              oldPrice,
              imageUrl,
            };
          });

          if (!productData.title || !productData.mainPrice) {
            throw new Error("Не удалось извлечь основные данные с страницы");
          }

          // Извлекаем все типы цен
          const mainPrice = this.extractPriceFromText(productData.mainPrice);
          const walletPrice = productData.walletPrice
            ? this.extractPriceFromText(productData.walletPrice)
            : undefined;
          const finalPrice = productData.finalPrice
            ? this.extractPriceFromText(productData.finalPrice)
            : undefined;

          const productInfo = this.createProductInfo(
            productId,
            productData.title,
            mainPrice,
            productData.imageUrl,
            url,
            walletPrice,
            finalPrice
          );

          providerLogger.info("Успешно получена информация о товаре Wildberries:", {
            productId,
            title: productData.title,
            mainPrice,
            walletPrice,
            finalPrice,
          });

          return {
            success: true,
            data: productInfo,
          };
        } catch (error) {
          providerLogger.error("Ошибка при обработке страницы:", {
            productId,
            error: error instanceof Error ? error.message : error,
          });
          throw error;
        } finally {
          if (page) {
            try {
              await page.close();
            } catch (error) {
              console.error("DEBUG - Ошибка при закрытии страницы:", error);
            }
          }
        }
      },
      {
        maxRetries: 1,
        baseDelay: 2000,
        maxDelay: 5000,
      }
    );
  }

  private async rateLimit(): Promise<void> {
    this.requestCount++;
    const now = Date.now();

    // Минимальная задержка между запросами
    const minDelay = 2000;
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < minDelay) {
      const delay = minDelay - timeSinceLastRequest + getRandomDelay(500, 1500);
      await sleep(delay);
    }

    this.lastRequestTime = Date.now();
  }

  private extractPriceFromText(priceText: string): number {
    try {
      if (!priceText) return 0;

      // Убираем все символы кроме цифр и точки
      const cleanPrice = priceText.replace(/[^\d.,]/g, "").replace(",", ".");
      const price = parseFloat(cleanPrice);

      return isNaN(price) ? 0 : price;
    } catch (error) {
      providerLogger.error("Ошибка при извлечении цены Wildberries:", { priceText, error });
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
      providerLogger.error("Ошибка при создании партнерской ссылки Wildberries:", {
        originalUrl,
        error,
      });
      return originalUrl;
    }
  }

  normalizeUrl(url: string): string {
    try {
      const productId = this.extractProductId(url);

      if (productId) {
        return `${this.config.baseUrl}/catalog/${productId}/detail.aspx`;
      }

      return url;
    } catch (error) {
      providerLogger.error("Ошибка при нормализации URL Wildberries:", { url, error });
      return url;
    }
  }
}
