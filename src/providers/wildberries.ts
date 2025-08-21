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
    try {
      // Проверяем, что браузер существует и не закрыт
      if (this.browser && !this.browser.isConnected()) {
        this.browser = null;
      }

      if (!this.browser) {
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
            "--disable-background-networking",
            "--disable-default-apps",
            "--disable-extensions",
            "--disable-sync",
            "--disable-translate",
            "--hide-scrollbars",
            "--mute-audio",
            "--no-zygote",
            "--single-process",
          ],
          defaultViewport: {
            width: 1366,
            height: 768,
          },
          ignoreHTTPSErrors: true,
          timeout: 30000,
        });

        // Добавляем обработчик события закрытия браузера
        this.browser.on("disconnected", () => {
          providerLogger.warn("Браузер был отключен");
          this.browser = null;
        });
      }
    } catch (error) {
      console.error("DEBUG - Ошибка при инициализации браузера:", error);
      this.browser = null;
      throw error;
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

  /**
   * Ждет полной загрузки страницы
   */
  private async waitForPageLoad(page: Page): Promise<void> {
    try {
      // Сначала ждем загрузки DOM
      await page.waitForFunction(
        () => {
          // @ts-ignore - document доступен в контексте браузера
          // eslint-disable-next-line no-undef
          return (document as any).readyState === "complete";
        },
        { timeout: 15000 }
      );

      // Ждем исчезновения страницы "Почти готово..."
      await page.waitForFunction(
        () => {
          // @ts-ignore - document доступен в контексте браузера
          // eslint-disable-next-line no-undef
          const title = (document as any).title;
          return title && !title.includes("Почти готово");
        },
        { timeout: 20000 }
      );

      // Ждем исчезновения элементов загрузки
      await page.waitForFunction(
        () => {
          // @ts-ignore - document доступен в контексте браузера
          // eslint-disable-next-line no-undef
          return (
            !(document as any).querySelector(".loading") &&
            // @ts-ignore
            // eslint-disable-next-line no-undef
            !(document as any).querySelector('[data-loading="true"]') &&
            // @ts-ignore
            // eslint-disable-next-line no-undef
            !(document as any).querySelector(".spinner") &&
            // @ts-ignore
            // eslint-disable-next-line no-undef
            !(document as any).querySelector(".loader") &&
            // @ts-ignore
            // eslint-disable-next-line no-undef
            !(document as any).querySelector(".preloader")
          );
        },
        { timeout: 10000 }
      );

      providerLogger.info("Страница полностью загружена");
    } catch (error) {
      providerLogger.warn("Таймаут ожидания загрузки страницы, продолжаем парсинг");
    }
  }

  /**
   * Ждет появления основных элементов товара
   */
  private async waitForProductElements(page: Page): Promise<boolean> {
    try {
      // Ждем появления заголовка товара
      try {
        await Promise.race([
          page.waitForSelector("h1", { timeout: 10000 }),
          page.waitForSelector(".product-page__title", { timeout: 10000 }),
          page.waitForSelector(".product-page__header h1", { timeout: 10000 }),
          page.waitForSelector(".product-page__header", { timeout: 10000 }),
          page.waitForSelector(".product-title", { timeout: 10000 }),
          page.waitForSelector(".product__title", { timeout: 10000 }),
        ]);
        providerLogger.info("Заголовок товара найден");
      } catch (error) {
        providerLogger.warn("Заголовок товара не найден в течение 10 секунд");
      }

      // Ждем появления хотя бы одного элемента с ценой
      try {
        await Promise.race([
          page.waitForSelector(".price-block__price", { timeout: 10000 }),
          page.waitForSelector(".price-block__wallet-price", { timeout: 10000 }),
          page.waitForSelector(".price-block__final-price", { timeout: 10000 }),
          page.waitForSelector("[data-price]", { timeout: 10000 }),
          page.waitForSelector(".price", { timeout: 10000 }),
          page.waitForSelector(".product-price", { timeout: 10000 }),
          page.waitForSelector(".price-current", { timeout: 10000 }),
          page.waitForSelector(".price__current", { timeout: 10000 }),
          page.waitForSelector(".price-block", { timeout: 10000 }),
        ]);
        providerLogger.info("Элемент с ценой найден");
        return true;
      } catch (error) {
        providerLogger.warn("Элементы с ценой не найдены в течение 10 секунд");
        return false;
      }
    } catch (error) {
      providerLogger.warn("Не удалось дождаться элементов товара", { error });
      return false;
    }
  }

  /**
   * Проверяет, что страница загружена корректно и не является ошибкой
   */
  private async validatePage(page: Page): Promise<boolean> {
    try {
      const validationResult = await page.evaluate(() => {
        // @ts-ignore - document доступен в контексте браузера
        // eslint-disable-next-line no-undef
        // Проверяем, что это не страница ошибки
        const errorSelectors = [
          ".error-page",
          ".not-found",
          ".error-404",
          "[data-error]",
          ".error",
          ".page-not-found",
          ".product-not-found",
        ];

        const foundErrorElements = [];
        for (const selector of errorSelectors) {
          // @ts-ignore
          // eslint-disable-next-line no-undef
          if (document.querySelector(selector)) {
            foundErrorElements.push(selector);
          }
        }

        // Проверяем наличие основного контента
        const contentSelectors = [
          "h1",
          ".product-page__title",
          ".product-page__header",
          ".product-title",
          ".product__title",
          ".product-page__content",
        ];

        const foundContentElements = contentSelectors.filter(selector => {
          // @ts-ignore
          // eslint-disable-next-line no-undef
          return document.querySelector(selector);
        });

        // Проверяем, что страница не пустая
        // @ts-ignore
        // eslint-disable-next-line no-undef
        const bodyText = (document as any).body.textContent?.trim() || "";
        const hasText = bodyText.length > 100;

        // @ts-ignore
        // eslint-disable-next-line no-undef
        const pageTitle = (document as any).title || "";

        // @ts-ignore
        // eslint-disable-next-line no-undef
        const url = (document as any).location.href;

        return {
          hasErrorElements: foundErrorElements.length > 0,
          foundErrorElements,
          hasContentElements: foundContentElements.length > 0,
          foundContentElements,
          hasText,
          bodyTextLength: bodyText.length,
          pageTitle,
          url,
          isValid: foundErrorElements.length === 0 && foundContentElements.length > 0 && hasText,
        };
      });

      providerLogger.info("Результат валидации страницы:", {
        isValid: validationResult.isValid,
        hasContentElements: validationResult.hasContentElements,
        foundContentElements: validationResult.foundContentElements,
        pageTitle: validationResult.pageTitle,
      });

      return validationResult.isValid;
    } catch (error) {
      providerLogger.error("Ошибка при валидации страницы:", { error });
      return false;
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
          // Проверяем состояние браузера перед созданием страницы
          if (!this.browser || !this.browser.isConnected()) {
            throw new Error("Браузер недоступен или отключен");
          }

          page = await this.browser.newPage();

          // Устанавливаем User-Agent
          await page.setUserAgent(getRandomUserAgent());

          // Устанавливаем viewport
          await page.setViewport({ width: 1366, height: 768 });

          // Дополнительные настройки страницы для стабильности
          // Отключаем блокировку ресурсов для лучшей совместимости
          // await page.setRequestInterception(true);
          // page.on('request', (req) => {
          //   // Блокируем ненужные ресурсы для ускорения загрузки
          //   if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
          //     req.abort();
          //   } else {
          //     req.continue();
          //   }
          // });

          // Переходим на страницу с улучшенным ожиданием
          await page.goto(url, {
            waitUntil: "networkidle2", // Ждем завершения сетевых запросов
            timeout: 60000, // Увеличиваем таймаут
          });

          // Ждем полной загрузки страницы
          await this.waitForPageLoad(page);

          // Дополнительное ожидание для динамического контента
          await page.waitForTimeout(5000);

          // Проверяем, что страница не заблокирована
          const isBlocked = await page.evaluate(() => {
            // @ts-ignore - document доступен в контексте браузера
            // eslint-disable-next-line no-undef
            const blockedSelectors = [
              ".captcha",
              ".recaptcha",
              ".cloudflare-challenge",
              ".cf-browser-verification",
              "[data-captcha]",
            ];

            return blockedSelectors.some(selector => {
              // @ts-ignore
              // eslint-disable-next-line no-undef
              return document.querySelector(selector);
            });
          });

          if (isBlocked) {
            throw new Error("Страница заблокирована (капча или проверка)");
          }

          // Проверяем валидность страницы
          const isValidPage = await this.validatePage(page);
          if (!isValidPage) {
            throw new Error("Страница не является валидной страницей товара");
          }

          // Ждем появления элементов товара
          const elementsLoaded = await this.waitForProductElements(page);
          if (!elementsLoaded) {
            // Если элементы не загрузились, даем дополнительное время
            await page.waitForTimeout(5000);
          }

          // Дополнительное ожидание для динамического контента
          await page.waitForTimeout(3000);

          // Ждем загрузки изображений (если есть)
          try {
            await page.waitForFunction(
              () => {
                // @ts-ignore - document доступен в контексте браузера
                // eslint-disable-next-line no-undef
                const images = document.querySelectorAll("img");
                return Array.from(images).every((img: any) => img.complete);
              },
              { timeout: 5000 }
            );
          } catch (error) {
            // Игнорируем ошибки загрузки изображений
          }

          // Извлекаем данные с учетом всех типов цен
          const productData = await page.evaluate(() => {
            // @ts-ignore - document доступен в контексте браузера
            // eslint-disable-next-line no-undef
            const h1Element = document.querySelector("h1");
            // @ts-ignore
            // eslint-disable-next-line no-undef
            const titleElement = document.querySelector(".product-page__title");
            // @ts-ignore
            // eslint-disable-next-line no-undef
            const pageTitle = document.title;

            const title =
              h1Element?.textContent?.trim() || titleElement?.textContent?.trim() || pageTitle;

            // 1. Цена по карте WB (приоритетная)
            // @ts-ignore
            // eslint-disable-next-line no-undef
            const walletPriceElement = document.querySelector(".price-block__wallet-price");
            // @ts-ignore
            const walletPrice = walletPriceElement?.textContent?.trim();

            // 2. Цена без карты (основная цена)
            // @ts-ignore
            // eslint-disable-next-line no-undef
            const finalPriceElement = document.querySelector(".price-block__final-price");
            // @ts-ignore
            const finalPrice = finalPriceElement?.textContent?.trim();

            // 3. Старая цена (зачеркнутая)
            // @ts-ignore
            // eslint-disable-next-line no-undef
            const oldPriceElement = document.querySelector(".price-block__old-price");
            // @ts-ignore
            const oldPrice = oldPriceElement?.textContent?.trim();

            // Fallback: ищем любую цену если основные не найдены
            // @ts-ignore
            const fallbackPriceElement =
              // @ts-ignore
              // eslint-disable-next-line no-undef
              document.querySelector(".price-block__price") ||
              // @ts-ignore
              // eslint-disable-next-line no-undef
              document.querySelector("[data-price]") ||
              // @ts-ignore
              // eslint-disable-next-line no-undef
              document.querySelector(".price");
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
              // eslint-disable-next-line no-undef
              document.querySelector(".zoom-image-container img") ||
              // @ts-ignore
              // eslint-disable-next-line no-undef
              document.querySelector(".photo-zoom__preview img") ||
              // @ts-ignore
              // eslint-disable-next-line no-undef
              document.querySelector(".product-page__image img");
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

          if (!productData.title) {
            throw new Error("Не удалось извлечь название товара");
          }

          if (!productData.mainPrice) {
            providerLogger.warn("Не удалось извлечь цену товара, попытка дополнительного поиска", {
              productId,
              title: productData.title,
            });

            // Дополнительная попытка найти цену
            const additionalPrice = await page.evaluate(() => {
              // @ts-ignore - document доступен в контексте браузера
              // eslint-disable-next-line no-undef
              // Ищем цену в различных форматах
              const priceSelectors = [
                ".price-block__price",
                ".price-block__wallet-price",
                ".price-block__final-price",
                "[data-price]",
                ".price",
                ".product-price",
                ".price-current",
                ".price__current",
              ];

              for (const selector of priceSelectors) {
                // @ts-ignore
                // eslint-disable-next-line no-undef
                const element = document.querySelector(selector);
                if (element && element.textContent?.trim()) {
                  return element.textContent.trim();
                }
              }

              return null;
            });

            if (additionalPrice) {
              productData.mainPrice = additionalPrice;
            } else {
              throw new Error("Не удалось извлечь цену товара после дополнительного поиска");
            }
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
            productData.imageUrl || undefined,
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
          const errorMessage = error instanceof Error ? error.message : String(error);

          // Если браузер закрылся, сбрасываем его состояние
          if (
            errorMessage.includes("Target closed") ||
            errorMessage.includes("Protocol error") ||
            errorMessage.includes("Session closed")
          ) {
            providerLogger.warn("Браузер был закрыт, сбрасываем состояние", { productId });
            this.browser = null;
          }

          providerLogger.error("Ошибка при обработке страницы:", {
            productId,
            error: errorMessage,
          });
          throw error;
        } finally {
          if (page) {
            try {
              // Проверяем, что страница не закрыта перед закрытием
              if (!page.isClosed()) {
                await page.close();
              }
            } catch (error) {
              console.error("DEBUG - Ошибка при закрытии страницы:", error);
            }
          }
        }
      },
      {
        maxRetries: 3, // Увеличиваем количество попыток
        baseDelay: 3000, // Увеличиваем базовую задержку
        maxDelay: 10000, // Увеличиваем максимальную задержку
      }
    );
  }

  private async rateLimit(): Promise<void> {
    this.requestCount++;
    const now = Date.now();

    // Увеличиваем минимальную задержку между запросами
    const minDelay = 3000;
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
