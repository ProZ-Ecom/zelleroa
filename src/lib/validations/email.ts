import { z } from "zod";

export const EMAIL_MIN_LENGTH = 5;
export const EMAIL_MAX_LENGTH = 254;

export const EMAIL_REQUIRED_MESSAGE = "Email is required";
export const EMAIL_INVALID_MESSAGE = "Please enter a valid email address";
export const EMAIL_TOO_LONG_MESSAGE = "Email must not exceed 254 characters";

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
  .email(EMAIL_INVALID_MESSAGE)
  .transform((val) => val.toLowerCase());

/** Same rules, but a blank value becomes null (optional email fields). */
export const optionalEmailField = z.preprocess(
  (val) => (typeof val === "string" && val.trim() === "" ? null : val),
  emailField.nullable().optional()
);
