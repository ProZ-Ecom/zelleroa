import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db/prisma";
import { otpService } from "@/features/auth/services/otp.service";
import { otpRepository } from "@/features/auth/repositories/otp.repository";

/**
 * LOCAL DEBUG ONLY. Hashes cannot be decrypted, so this lets you
 *  - "check": test whether a plain password matches a user's stored hash
 *  - "set":   overwrite a user's password with a known value
 *  - "otp":   recover the latest pending OTP for an email (6-digit space is
 *             tiny, so the SHA-256 is brute-forced). Works for register too,
 *             where no user exists yet.
 * Disabled unless NODE_ENV !== "production" AND the request host is localhost.
 */

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("check"), identifier: z.string().min(1), password: z.string().min(1) }),
  z.object({ action: z.literal("set"), identifier: z.string().min(1), password: z.string().min(1) }),
  z.object({
    action: z.literal("otp"),
    identifier: z.string().min(1),
    purpose: z.enum(["register", "reset_password"]).default("reset_password"),
  }),
]);

function isLocal(request: NextRequest) {
  if (process.env.NODE_ENV === "production") return false;
  // The Host header is client-controlled, so a hostname check alone is not a
  // safe gate on a shared dev/staging server: require an explicit opt-in too.
  if (process.env.ENABLE_DEV_PASSWORD_ROUTE !== "true") return false;
  const host = (request.headers.get("host") ?? "").split(":")[0];
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

const json = (body: object, status = 200) => NextResponse.json(body, { status });

export async function POST(request: NextRequest) {
  if (!isLocal(request)) return json({ success: false, message: "Not found" }, 404);

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return json({ success: false, errors: parsed.error.issues }, 400);
  const input = parsed.data;

  if (input.action === "otp") {
    const email = input.identifier.toLowerCase().trim();
    const record = await otpRepository.findLatestValidOtp(email, input.purpose);
    if (!record) return json({ success: false, message: "No valid OTP for this email/purpose" }, 404);

    for (let n = 100000; n < 1000000; n++) {
      const otp = String(n);
      if (otpService.hashOtp(otp) === record.otpCode) {
        return json({ success: true, otp, expiresAt: record.expiresAt });
      }
    }
    return json({ success: false, message: "Could not recover OTP" }, 500);
  }

  const user = await db.user.findFirst({
    where: { OR: [{ email: input.identifier }, { phone: input.identifier }] },
    select: { id: true, email: true, phone: true, password_hash: true },
  });
  if (!user) return json({ success: false, message: "User not found" }, 404);

  if (input.action === "check") {
    const match = user.password_hash ? await bcrypt.compare(input.password, user.password_hash) : false;
    return json({ success: true, match, hasPassword: !!user.password_hash });
  }

  await db.user.update({
    where: { id: user.id },
    data: { password_hash: await bcrypt.hash(input.password, 12) },
  });
  return json({ success: true, message: `Password updated for ${user.email ?? user.phone}` });
}
