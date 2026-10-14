import { z } from "zod";

export const EMAIL_MIN_LENGTH = 5;
export const EMAIL_MAX_LENGTH = 254;

export const EMAIL_REQUIRED_MESSAGE = "Email is required";
export const EMAIL_INVALID_MESSAGE = "Please enter a valid email address";
export const EMAIL_TOO_LONG_MESSAGE = "Email must not exceed 254 characters";

const COMMON_GTLDS = new Set([
  "com",
  "org",
  "net",
  "edu",
  "gov",
  "mil",
  "int",
  "io",
  "biz",
  "info",
]);

/**
 * Validates email format thoroughly:
 * - Length between 5 and 254 characters
 * - Valid RFC 5322 structure: user@domain
 * - No leading/trailing dots or consecutive dots in local part or domain
 * - Valid TLD (2 to 24 letters)
 * - Rejects duplicated TLDs (e.g. .com.com, .in.in, .org.org, .net.net)
 * - Rejects double generic TLD combinations (e.g. .com.net, .org.com)
 * - Rejects well-known provider domain typos (e.g. gmail.com.com, gmail.con, gmail.co)
 */
export function getEmailError(raw: string): string | null {
  const val = (raw || "").trim();
  if (!val) {
    return EMAIL_REQUIRED_MESSAGE;
  }
  if (val.length > EMAIL_MAX_LENGTH) {
    return EMAIL_TOO_LONG_MESSAGE;
  }
  if (val.length < EMAIL_MIN_LENGTH) {
    return EMAIL_INVALID_MESSAGE;
  }

  // RFC basic regex structure
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!emailRegex.test(val)) {
    return EMAIL_INVALID_MESSAGE;
  }

  const parts = val.toLowerCase().split("@");
  if (parts.length !== 2) {
    return EMAIL_INVALID_MESSAGE;
  }

  const [local, domain] = parts;

  // Local part sanity checks
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) {
    return EMAIL_INVALID_MESSAGE;
  }

  const domainParts = domain.split(".");
  if (domainParts.length < 2) {
    return EMAIL_INVALID_MESSAGE;
  }

  const tld = domainParts[domainParts.length - 1];
  // TLD must be letters only, 2-24 chars
  if (!/^[a-z]{2,24}$/.test(tld)) {
    return EMAIL_INVALID_MESSAGE;
  }

  // Reject duplicate adjacent domain labels at the end (e.g. .com.com, .in.in, .org.org, .co.co)
  const secondToLast = domainParts[domainParts.length - 2];
  if (secondToLast === tld) {
    return EMAIL_INVALID_MESSAGE;
  }

  // Reject double generic TLDs (e.g. .com.org, .org.com, .com.net, .net.com, .io.com)
  if (COMMON_GTLDS.has(secondToLast) && COMMON_GTLDS.has(tld)) {
    return EMAIL_INVALID_MESSAGE;
  }

  // Common provider typos
  if (domain.startsWith("gmail.")) {
    if (domain !== "gmail.com") {
      return EMAIL_INVALID_MESSAGE;
    }
  }

  if (
    domain.startsWith("yahoo.") ||
    domain.startsWith("outlook.") ||
    domain.startsWith("hotmail.") ||
    domain.startsWith("icloud.")
  ) {
    if (
      domain.endsWith(".com.com") ||
      domain.endsWith(".con") ||
      domain.endsWith(".cpm")
    ) {
      return EMAIL_INVALID_MESSAGE;
    }
  }

  return null;
}

/**
 * Single source of truth for email validation (client forms and API routes).
 * Trims, rejects spaces / bad format, enforces 5–254 chars, lowercases.
 * Message order matters: react-hook-form shows the first issue.
 */
export const emailField = z
  .string({ message: EMAIL_REQUIRED_MESSAGE })
  .trim()
  .min(1, EMAIL_REQUIRED_MESSAGE)
  .max(EMAIL_MAX_LENGTH, EMAIL_TOO_LONG_MESSAGE)
  .min(EMAIL_MIN_LENGTH, EMAIL_INVALID_MESSAGE)
  .superRefine((val, ctx) => {
    const error = getEmailError(val);
    if (
      error &&
      error !== EMAIL_REQUIRED_MESSAGE &&
      error !== EMAIL_TOO_LONG_MESSAGE
    ) {
      ctx.addIssue({ code: "custom", message: error });
    }
  })
  .transform((val) => val.toLowerCase());

/** Same rules, but a blank value becomes null (optional email fields). */
export const optionalEmailField = z.preprocess(
  (val) => (typeof val === "string" && val.trim() === "" ? null : val),
  emailField.nullable().optional()
);
