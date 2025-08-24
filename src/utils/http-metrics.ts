import { Request, Response, NextFunction } from "express";
import { metricsService } from "../services/metrics";

export function httpMetricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const method = req.method;
  const path = req.route?.path || req.path;

  // Увеличиваем счетчик активных запросов
  metricsService.setHttpRequestsInProgress(method, path, 1);

  // Перехватываем завершение запроса
  res.on("finish", () => {
    const duration = (Date.now() - startTime) / 1000; // конвертируем в секунды
    const statusCode = res.statusCode;

    // Увеличиваем счетчик запросов
    metricsService.incrementHttpRequest(method, path, statusCode);

    // Записываем время выполнения
    metricsService.observeHttpRequestDuration(method, path, duration);

    // Уменьшаем счетчик активных запросов
    metricsService.setHttpRequestsInProgress(method, path, 0);
  });

  next();
}
