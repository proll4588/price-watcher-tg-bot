import { Decimal } from "@prisma/client/runtime/library";

/**
 * Форматирует цену в читаемом виде
 */
export function formatPrice(price: number | Decimal | string): string {
  const numPrice = typeof price === "string" ? parseFloat(price) : Number(price);

  if (isNaN(numPrice)) {
    return "Цена не указана";
  }

  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numPrice);
}

/**
 * Форматирует процент скидки
 */
export function formatDiscount(oldPrice: number | Decimal, newPrice: number | Decimal): string {
  const old = Number(oldPrice);
  const new_ = Number(newPrice);

  if (old <= new_) {
    return "0%";
  }

  const discount = ((old - new_) / old) * 100;
  return `${discount.toFixed(1)}%`;
}

/**
 * Форматирует время последней проверки
 */
export function formatLastChecked(date: Date | null): string {
  if (!date) {
    return "Никогда";
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `${diffDays} дн. назад`;
  } else if (diffHours > 0) {
    return `${diffHours} ч. назад`;
  } else {
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    return `${diffMinutes} мин. назад`;
  }
}

/**
 * Форматирует интервал проверки
 */
export function formatCheckInterval(hours: number): string {
  if (hours === 1) {
    return "каждый час";
  } else if (hours < 24) {
    return `каждые ${hours} ч.`;
  } else {
    const days = hours / 24;
    return `каждые ${days} дн.`;
  }
}

/**
 * Обрезает текст до указанной длины
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + "...";
}

/**
 * Форматирует размер файла
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Б";

  const k = 1024;
  const sizes = ["Б", "КБ", "МБ", "ГБ"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Форматирует дату в читаемом виде
 */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * Форматирует относительное время
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 7) {
    return formatDate(date);
  } else if (diffDays > 0) {
    return `${diffDays} дн. назад`;
  } else if (diffHours > 0) {
    return `${diffHours} ч. назад`;
  } else if (diffMinutes > 0) {
    return `${diffMinutes} мин. назад`;
  } else {
    return "только что";
  }
}
