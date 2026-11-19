import { db } from "@/lib/db/prisma";
import { ApiError } from "@/lib/api/api-error";
import {
  MOBILE_VERIFICATION_REQUIRED_CODE,
  MOBILE_VERIFICATION_REQUIRED_MESSAGE,
} from "@/lib/constants/mobile-verification";

/**
 * Whether orders require a verified mobile number, driven by
 * REQUIRE_MOBILE_VERIFICATION_FOR_ORDER ("true"/"false"; also accepts 1/0,
 * yes/no, on/off). Set it per environment (local, testing, staging, prod).
 *
 * Unset or unrecognised values fail closed (required), so a deployment that
 * forgets the variable can never silently skip verification.
 */
export function isMobileVerificationRequiredForOrder(): boolean {
  const raw = process.env.REQUIRE_MOBILE_VERIFICATION_FOR_ORDER?.trim().toLowerCase();
  return !["false", "0", "no", "off"].includes(raw ?? "");
}

/**
 * Throws a 403 MOBILE_VERIFICATION_REQUIRED unless the flag is off or the user
 * has a verified mobile number. Enforced in the order service so every order
 * entry point (COD, guest, Razorpay) is covered.
 */
export async function assertMobileVerifiedForOrder(userId: bigint | number): Promise<void> {
  if (!isMobileVerificationRequiredForOrder()) return;

  const user = await db.user.findUnique({
    where: { id: BigInt(userId) },
    select: { phone_verified_at: true },
  });

  if (!user?.phone_verified_at) {
    throw new ApiError(
      MOBILE_VERIFICATION_REQUIRED_MESSAGE,
      403,
      undefined,
      true,
      undefined,
      MOBILE_VERIFICATION_REQUIRED_CODE
    );
  }
}
