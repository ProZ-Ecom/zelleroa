import { z } from "zod";

/** Indian mobile number: exactly 10 digits, first digit 6-9. No country code. */
export const MOBILE_REGEX = /^[6-9][0-9]{9}$/;
export const STORED_MOBILE_REGEX = /^\+91[6-9][0-9]{9}$/;
export const MOBILE_INVALID_MESSAGE =
  "Provide valid Mobile Number";

/** Returns the error message for an invalid bare mobile number, or null if valid. */
export function getMobileError(raw: string): string | null {
  const val = raw.trim();
  if (!val) return "Mobile number is required";
  return MOBILE_REGEX.test(val) ? null : MOBILE_INVALID_MESSAGE;
}

/**
 * Strict form/API input: a bare 10-digit number (+91 / other country codes
 * rejected). Output is the stored format "+91XXXXXXXXXX".
 */
export const mobileInputField = z
  .string({ message: "Mobile number is required" })
  .trim()
  .superRefine((val, ctx) => {
    const message = getMobileError(val);
    if (message) ctx.addIssue({ code: "custom", message });
  })
  .transform((val) => `+91${val}`);

/**
 * Same rule, but also accepts a value already in stored "+91XXXXXXXXXX" form
 * (for payloads that round-trip numbers read back from the database).
 */
export const mobileStoredOrInputField = z
  .string({ message: "Mobile number is required" })
  .trim()
  .superRefine((val, ctx) => {
    if (STORED_MOBILE_REGEX.test(val)) return;
    const message = getMobileError(val);
    if (message) ctx.addIssue({ code: "custom", message });
  })
  .transform((val) => (MOBILE_REGEX.test(val) ? `+91${val}` : val));
