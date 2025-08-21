import puppeteer, { Browser, Page } from "puppeteer";
import { BaseProvider } from "./base";
import { ProviderResult } from "../types";
import { providerLogger } from "../utils/logger";
import { retryWithBackoff, sleep, getRandomDelay } from "../utils/retry";
import { getRandomUserAgent } from "../utils/user-agents";

export class YandexMarketProvider extends BaseProvider {
  private browser: Browser | null = null;
  private requestCount = 0;
  private lastRequestTime = 0;

  constructor(affiliateToken?: string) {
    const config = {
      name: "YandexMarket",
      baseUrl: "https://market.yandex.ru",
      isEnabled: true,
      rateLimit: {
        requestsPerMinute: 8,
        requestsPerHour: 150,
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
          headless: "new",
          executablePath:
            process.env["CHROME_BIN"] ||
            (process.platform === "darwin"
              ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
              : "/usr/bin/chromium-browser"),
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
    return url.includes("market.yandex.ru") || url.includes("yandex.ru/market");
  }

  extractProductId(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split("/");

      // Ищем ID товара в URL формата /card/.../ID
      for (let i = 0; i < pathParts.length; i++) {
        if (pathParts[i] === "card" && pathParts[i + 2]) {
          const productId = pathParts[i + 2];
          if (productId && /^\d+$/.test(productId)) {
            return productId;
          }
        }
      }

      // Альтернативный поиск - ищем любую последовательность цифр в конце пути
      const lastPathPart = pathParts[pathParts.length - 1];
      if (lastPathPart && /^\d+$/.test(lastPathPart)) {
        return lastPathPart;
      }

      return null;
    } catch (error) {
      providerLogger.error("Ошибка при извлечении ID товара YandexMarket:", { url, error });
      return null;
    }
  }

  override async getCurrentPrice(url: string): Promise<ProviderResult> {
    try {
      const productId = this.extractProductId(url);
      if (!productId) {
        return {
          success: false,
          error: "Не удалось извлечь ID товара из URL",
        };
      }

      return await this.fetchProductInfo(productId, url);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Ошибка при получении цены: ${errorMessage}`,
      };
    }
  }

  async fetchProductInfo(productId: string, originalUrl?: string): Promise<ProviderResult> {
    return retryWithBackoff(
      async () => {
        await this.rateLimit();
        await this.initBrowser();

        if (!this.browser) {
          throw new Error("Браузер не инициализирован");
        }

        // Используем исходный URL или создаем новый
        const url =
          originalUrl ||
          `${this.config.baseUrl}/card/besprovodnyye-naushniki-a-pods-pro-2-premium-bluetooth-c-shumopodavleniyem-dlya-iphone-i-android/${productId}`;
        providerLogger.info("Запрос информации о товаре YandexMarket:", {
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
            waitUntil: "domcontentloaded",
            timeout: 20000,
          });

          // Устанавливаем viewport
          await page.setViewport({ width: 1366, height: 768 });

          // Ждем загрузки контента
          await page.waitForTimeout(5000);

          // Ждем появления основных элементов
          await Promise.race([
            page.waitForSelector("h1", { timeout: 10000 }),
            page.waitForSelector("[data-zone-name='price']", { timeout: 10000 }),
            page.waitForSelector(".price", { timeout: 10000 }),
            page.waitForSelector(".price-block", { timeout: 10000 }),
            page.waitForSelector("[data-zone-name='price-block']", { timeout: 10000 }),
            page.waitForSelector(".price-block__price", { timeout: 10000 }),
            page.waitForSelector(".price-block__final-price", { timeout: 10000 }),
          ]).catch(() => {
            // Игнорируем ошибки, если элементы не найдены
          });

          // Дополнительное ожидание для динамического контента
          await page.waitForTimeout(3000);

          // Извлекаем данные
          const productData = await page.evaluate(() => {
            // @ts-ignore - document доступен в контексте браузера
            // eslint-disable-next-line no-undef
            const h1Element = document.querySelector("h1");
            // @ts-ignore
            // eslint-disable-next-line no-undef
            const pageTitle = document.title;

            const title = h1Element?.textContent?.trim() || pageTitle;

            // Ищем цену в различных селекторах
            // @ts-ignore
            // eslint-disable-next-line no-undef
            const priceElement = document.querySelector("[data-zone-name='price']");
            // @ts-ignore
            const price = priceElement?.textContent?.trim();

            // Fallback: ищем цену в других селекторах
            // @ts-ignore
            const fallbackPriceElement =
              // @ts-ignore
              // eslint-disable-next-line no-undef
              document.querySelector(".price") ||
              // @ts-ignore
              // eslint-disable-next-line no-undef
              document.querySelector(".price-block") ||
              // @ts-ignore
              // eslint-disable-next-line no-undef
              document.querySelector("[data-zone-name='price-block']") ||
              // @ts-ignore
              // eslint-disable-next-line no-undef
              document.querySelector(".price-block__price") ||
              // @ts-ignore
              // eslint-disable-next-line no-undef
              document.querySelector(".price-block__final-price") ||
              // @ts-ignore
              // eslint-disable-next-line no-undef
              document.querySelector("[data-price]") ||
              // @ts-ignore
              // eslint-disable-next-line no-undef
              document.querySelector(".price-block__wallet-price");
            // @ts-ignore
            const fallbackPrice =
              fallbackPriceElement?.textContent?.trim() ||
              // @ts-ignore
              fallbackPriceElement?.getAttribute("data-price");

            // Определяем основную цену
            const mainPrice = price || fallbackPrice;

            // Ищем изображение товара по alt атрибуту с названием товара
            // @ts-ignore
            const imageElement =
              // @ts-ignore
              // eslint-disable-next-line no-undef
              document.querySelector(`img[alt*="${title}"]`) ||
              // @ts-ignore
              // eslint-disable-next-line no-undef
              document.querySelector(".product-image img") ||
              // @ts-ignore
              // eslint-disable-next-line no-undef
              document.querySelector(".gallery img") ||
              // @ts-ignore
              // eslint-disable-next-line no-undef
              document.querySelector("img[src*='avatars.mds.yandex.net']");
            // @ts-ignore
            const imageUrl =
              // @ts-ignore
              imageElement?.getAttribute("src") ||
              // @ts-ignore
              imageElement?.getAttribute("data-src");

            return {
              title,
              mainPrice,
              imageUrl,
            };
          });

          if (!productData.title || !productData.mainPrice) {
            throw new Error("Не удалось извлечь основные данные с страницы");
          }

          // Извлекаем цену
          const mainPrice = this.extractPriceFromText(productData.mainPrice);

          const productInfo = this.createProductInfo(
            productId,
            productData.title,
            mainPrice,
            productData.imageUrl || undefined,
            url
          );

          providerLogger.info("Успешно получена информация о товаре YandexMarket:", {
            productId,
            title: productData.title,
            mainPrice,
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
    const minDelay = 3000; // Увеличена задержка для Яндекс.Маркета
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < minDelay) {
      const delay = minDelay - timeSinceLastRequest + getRandomDelay(1000, 2000);
      await sleep(delay);
    }

    this.lastRequestTime = Date.now();
  }

  private extractPriceFromText(priceText: string): number {
    try {
      if (!priceText) return 0;

      // Ищем цену "без карты" - она обычно последняя в строке
      const withoutCardMatch = priceText.match(/без карты\s*(\d+(?:\s\d+)*)\s*₽/);

      if (withoutCardMatch && withoutCardMatch[1]) {
        // Убираем пробелы из числа и парсим
        const cleanPrice = withoutCardMatch[1].replace(/\s/g, "");
        const price = parseInt(cleanPrice, 10);
        return price;
      }

      // Если нет "без карты", ищем последнюю цену в строке
      const allPrices = priceText.match(/(\d+(?:\s\d+)*)\s*₽/g);
      if (allPrices && allPrices.length > 0) {
        const lastPrice = allPrices[allPrices.length - 1];
        if (lastPrice) {
          const priceMatch = lastPrice.match(/(\d+(?:\s\d+)*)\s*₽/);
          if (priceMatch && priceMatch[1]) {
            const cleanPrice = priceMatch[1].replace(/\s/g, "");
            const price = parseInt(cleanPrice, 10);
            return price;
          }
        }
      }

      // Fallback: старый метод
      let cleanPrice = priceText.replace(/[^\d.,]/g, "");
      cleanPrice = cleanPrice.replace(",", ".");

      const parts = cleanPrice.split(".");
      if (parts.length > 2) {
        cleanPrice = parts[0] + "." + parts.slice(1).join("");
      }

      const price = parseFloat(cleanPrice);

      return isNaN(price) ? 0 : price;
    } catch (error) {
      providerLogger.error("Ошибка при извлечении цены YandexMarket:", { priceText, error });
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
      providerLogger.error("Ошибка при создании партнерской ссылки YandexMarket:", {
        originalUrl,
        error,
      });
      return originalUrl;
    }
  }

  normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);

      // Убираем только параметры запроса, но сохраняем полный путь
      urlObj.search = "";

      return urlObj.toString();
    } catch (error) {
      providerLogger.error("Ошибка при нормализации URL YandexMarket:", { url, error });
      return url;
    }
  }
}
