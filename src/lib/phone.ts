/**
 * Normalises an Indian mobile number to the stored format "+91XXXXXXXXXX".
 * Accepts spaces/dashes and 10-digit, 0-, 91- or +91-prefixed input.
 * Returns null when the value is not a valid Indian mobile number.
 */
export function normalizeIndianMobile(value: string): string | null {
  const digits = value.replace(/[\s\-().]/g, "").replace(/^\+/, "");
  const match = /^(?:91|0)?([6-9]\d{9})$/.exec(digits);
  return match ? `+91${match[1]}` : null;
}

/** All formats a number may have been stored in (for legacy rows). */
export function mobileLookupVariants(normalized: string): string[] {
  const ten = normalized.slice(-10);
  return [normalized, `91${ten}`, ten, `0${ten}`];
}

export const PHONE_ALREADY_REGISTERED_MESSAGE =
  "This mobile number is already registered. Please login instead.";
