import { metricsService } from "../services/metrics";

export function trackDatabaseQuery<T>(operation: string, queryFn: () => Promise<T>): Promise<T> {
  const startTime = Date.now();

  return queryFn()
    .then(result => {
      const duration = (Date.now() - startTime) / 1000;
      metricsService.observeDatabaseQueryDuration(operation, duration);
      metricsService.incrementDatabaseQuery(operation, "success");
      return result;
    })
    .catch(error => {
      const duration = (Date.now() - startTime) / 1000;
      metricsService.observeDatabaseQueryDuration(operation, duration);
      metricsService.incrementDatabaseQuery(operation, "error");
      throw error;
    });
}

export function updateDatabaseConnections(active: number, idle: number): void {
  metricsService.setDatabaseConnections("active", active);
  metricsService.setDatabaseConnections("idle", idle);
}
