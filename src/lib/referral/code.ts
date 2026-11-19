import { randomInt } from "node:crypto";

export const REFERRAL_CODE_PREFIX = "ZEL-";
const REFERRAL_CODE_LENGTH = 6;
/** No 0/O/1/I/L: codes are read aloud and typed by hand. 31 symbols ^ 6 = ~887M codes. */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** `ZEL-` + 6 random symbols. Pure randomness: nothing derived from an id, phone or email. */
export function generateReferralCode(): string {
  let suffix = "";
  for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) suffix += ALPHABET[randomInt(ALPHABET.length)];
  return REFERRAL_CODE_PREFIX + suffix;
}

export const GENERATED_REFERRAL_CODE_PATTERN = new RegExp(`^${REFERRAL_CODE_PREFIX}[${ALPHABET}]{${REFERRAL_CODE_LENGTH}}$`);

export function isGeneratedReferralCode(code: string | null | undefined): boolean {
  return GENERATED_REFERRAL_CODE_PATTERN.test(code ?? "");
}

/**
 * Picks a code `isTaken` reports free. The UNIQUE index on `users.referral_code` is the real
 * guard (a concurrent insert can still race this check and surface as P2002 to the caller's
 * retry); this just makes a collision a retry instead of a failed request.
 */
export async function allocateReferralCode(
  isTaken: (code: string) => Promise<boolean>,
  generate: () => string = generateReferralCode,
  maxAttempts = 10
): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const code = generate();
    if (!(await isTaken(code))) return code;
  }
  throw new Error("Could not allocate a unique referral code");
}
