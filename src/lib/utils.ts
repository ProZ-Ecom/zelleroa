import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(amount: number, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

/**
 * Formats a date, string, or timestamp into the standardized application format: DD-MM-YYYY
 * Handles Date objects, ISO strings, YYYY-MM-DD, already-formatted DD-MM-YYYY / DD/MM/YYYY, etc.
 */
export function formatDate(
  date: Date | string | number | null | undefined,
  separator: "-" | "/" = "-"
): string {
  if (!date) return "—";

  if (typeof date === "string") {
    const trimmed = date.trim();
    if (!trimmed) return "—";

    // If already in DD-MM-YYYY or DD/MM/YYYY
    if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(trimmed)) {
      return separator === "-" ? trimmed.replace(/\//g, "-") : trimmed.replace(/-/g, "/");
    }

    // If in YYYY-MM-DD format (standard ISO date-only)
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [year, month, day] = trimmed.split("-");
      return `${day}${separator}${month}${separator}${year}`;
    }
  }

  const d = new Date(date);
  if (isNaN(d.getTime())) {
    return typeof date === "string" ? date : "—";
  }

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();

  return `${day}${separator}${month}${separator}${year}`;
}

export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function generateOrderNumber(): string {
  const date = new Date();
  const prefix = "RS";
  const timestamp = date.getFullYear().toString().slice(-2) +
    String(date.getMonth() + 1).padStart(2, "0") +
    String(date.getDate()).padStart(2, "0");
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}${timestamp}${random}`;
}

export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.slice(0, length) + "...";
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function getImageUrl(path: string | null | undefined): string {
  const trimmed = path?.trim();
  if (!trimmed) return "/images/placeholder.png";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("/")) {
    return trimmed;
  }
  return `/${trimmed}`;
}

export function calculateDiscountPrice(
  price: number,
  discountPercent: number
): number {
  return price - (price * discountPercent) / 100;
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function toTitleCase(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/(?:^|\s|-|\/)\S/g, (match) => match.toUpperCase());
}

