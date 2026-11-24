/**
 * Formats a phone number as `+91 9897567488` (country code + space + phone number).
 * Examples:
 *   "9897567488" -> "+91 9897567488"
 *   "+919897567488" -> "+91 9897567488"
 *   "+91 98975 67488" -> "+91 9897567488"
 *   "919897567488" -> "+91 9897567488"
 */
export function formatPhone(raw?: string | null, fallback = "—"): string {
  if (!raw || typeof raw !== "string") return fallback;
  const trimmed = raw.trim();
  if (!trimmed) return fallback;

  // Extract all digits
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return fallback;

  // Standard 10-digit Indian mobile number
  if (digits.length === 10) {
    return `+91 ${digits}`;
  }

  // 12-digit Indian mobile number starting with 91
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+91 ${digits.slice(2)}`;
  }

  // International with existing +
  if (trimmed.startsWith("+")) {
    if (digits.startsWith("91") && digits.length >= 12) {
      return `+91 ${digits.slice(2)}`;
    }
    const countryCodeLen = digits.length > 10 ? digits.length - 10 : 2;
    return `+${digits.slice(0, countryCodeLen)} ${digits.slice(countryCodeLen)}`;
  }

  // More than 10 digits without leading +
  if (digits.length > 10) {
    const national = digits.slice(-10);
    const cc = digits.slice(0, digits.length - 10);
    return `+${cc} ${national}`;
  }

  return `+91 ${digits}`;
}
