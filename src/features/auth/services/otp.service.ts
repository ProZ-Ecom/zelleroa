import crypto from "crypto";
import bcrypt from "bcryptjs";
import { ApiError } from "@/lib/api/api-error";
import { userRepository } from "@/features/users/repositories/user.repository";
import { otpRepository } from "../repositories/otp.repository";
import { emailService } from "@/lib/email/email.service";
import {
  generateResetPasswordToken,
  verifyResetPasswordToken,
  generateEmailVerificationToken,
} from "@/lib/auth/jwt";
import {
  normalizeIndianMobile,
  mobileLookupVariants,
  PHONE_ALREADY_REGISTERED_MESSAGE,
} from "@/lib/phone";
import { getMobileError, MOBILE_INVALID_MESSAGE } from "@/lib/validations/mobile";
import type { ResetPasswordInput } from "@/lib/validations/auth";
import { checkRateLimit } from "@/lib/security/rate-limiter";

/**
 * Caps OTP guesses per account (not per IP - the client IP header is
 * spoofable), so a 6-digit code cannot be brute-forced within its 5 minute life.
 */
const OTP_MAX_ATTEMPTS = 5;
const OTP_ATTEMPT_WINDOW_MS = 5 * 60 * 1000;

function assertOtpAttemptAllowed(purpose: string, email: string) {
  const result = checkRateLimit(`otp-verify:${purpose}:${email}`, {
    limit: OTP_MAX_ATTEMPTS,
    windowMs: OTP_ATTEMPT_WINDOW_MS,
  });
  if (!result.allowed) {
    throw ApiError.tooManyRequests(
      "Too many incorrect attempts. Please wait a few minutes or request a new code."
    );
  }
}

export const otpService = {
  generateNumericOtp(): string {
    return crypto.randomInt(100000, 1000000).toString();
  },

  hashOtp(otp: string): string {
    return crypto.createHash("sha256").update(otp).digest("hex");
  },

  // -------------------------------------------------------------
  // REGISTRATION FLOW (purpose = "register")
  // -------------------------------------------------------------

  async sendRegistrationEmailOtp(email: string, phone?: string) {
    const normalizedEmail = email.toLowerCase().trim();

    // Reject an already-registered mobile number before any OTP is generated/sent
    if (phone && phone.trim()) {
      const trimmedPhone = phone.trim();
      const phoneError = getMobileError(trimmedPhone);
      const normalizedPhone = phoneError
        ? null
        : normalizeIndianMobile(trimmedPhone);
      if (!normalizedPhone) {
        throw ApiError.badRequest(phoneError ?? MOBILE_INVALID_MESSAGE);
      }
      const existingPhone = await userRepository.findByPhoneVariants(
        mobileLookupVariants(normalizedPhone)
      );
      if (existingPhone) {
        throw ApiError.conflict(PHONE_ALREADY_REGISTERED_MESSAGE);
      }
    }

    // Check if user already exists
    const existingUser = await userRepository.findByEmail(normalizedEmail);
    if (existingUser) {
      throw ApiError.conflict(
        "This email address is already registered. Please login instead."
      );
    }

    // Perform cleanup of expired OTP records
    await otpRepository.deleteExpired();

    // Rate-limiting check: 60s cooldown for registration OTP
    const latest = await otpRepository.findLatestValidOtp(
      normalizedEmail,
      "register"
    );
    if (latest) {
      const timeDiff =
        (Date.now() - new Date(latest.createdAt).getTime()) / 1000;
      if (timeDiff < 60) {
        const secondsRemaining = Math.ceil(60 - timeDiff);
        throw ApiError.tooManyRequests(
          `Please wait ${secondsRemaining} second(s) before requesting a new verification code.`
        );
      }
    }

    const otp = this.generateNumericOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await otpRepository.createOtp({
      email: normalizedEmail,
      otpCode: this.hashOtp(otp),
      purpose: "register",
      expiresAt,
    });

    const sent = await emailService.sendOtpEmail(
      normalizedEmail,
      otp,
      "register"
    );
    if (!sent) {
      await otpRepository.deleteByEmail(normalizedEmail, "register");
      throw ApiError.internal(
        "Unable to send verification email. Please try again later."
      );
    }

    return {
      success: true,
      data: null,
      message: "OTP sent successfully",
    };
  },

  async resendRegistrationEmailOtp(email: string) {
    return this.sendRegistrationEmailOtp(email);
  },

  async verifyRegistrationEmailOtp(email: string, otp: string) {
    const normalizedEmail = email.toLowerCase().trim();
    assertOtpAttemptAllowed("register", normalizedEmail);

    await otpRepository.deleteExpired();

    const record = await otpRepository.findLatestValidOtp(
      normalizedEmail,
      "register"
    );
    if (!record) {
      throw ApiError.badRequest("Invalid or expired verification code.");
    }

    if (new Date() > new Date(record.expiresAt)) {
      throw ApiError.badRequest(
        "Verification code has expired. Please request a new one."
      );
    }

    const hashedOtp = this.hashOtp(otp);
    if (
      record.otpCode.length !== hashedOtp.length ||
      !crypto.timingSafeEqual(
        Buffer.from(record.otpCode),
        Buffer.from(hashedOtp)
      )
    ) {
      throw ApiError.badRequest("Invalid verification code.");
    }

    // Generate unique token JTI & 30m token expiration time
    const jti = crypto.randomUUID();
    const tokenExpiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    // Mark OTP as consumed & issue token identifier in DB
    await otpRepository.markOtpConsumedAndIssueToken(
      record.id,
      jti,
      tokenExpiresAt
    );

    // Sign one-time verification JWT token containing email & jti
    const verificationToken = generateEmailVerificationToken({
      email: normalizedEmail,
      jti,
    });

    return {
      success: true,
      data: {
        verificationToken,
      },
      message: "Email verified successfully",
    };
  },

  // -------------------------------------------------------------
  // FORGOT PASSWORD FLOW (purpose = "reset_password")
  // -------------------------------------------------------------

  async sendForgotPasswordOtp(email: string) {
    const normalizedEmail = email.toLowerCase().trim();

    // Perform cleanup of expired OTP records
    await otpRepository.deleteExpired();

    const user = await userRepository.findByEmail(normalizedEmail);
    if (!user) {
      throw ApiError.notFound("No account found with this email address");
    }

    if (user.status !== "active") {
      throw ApiError.forbidden(
        "Your account is inactive or blocked. Please contact support."
      );
    }

    // Rate-limiting check: 60s cooldown for reset password OTP
    const latest = await otpRepository.findLatestValidOtp(
      normalizedEmail,
      "reset_password"
    );
    if (latest) {
      const timeDiff =
        (Date.now() - new Date(latest.createdAt).getTime()) / 1000;
      if (timeDiff < 60) {
        const secondsRemaining = Math.ceil(60 - timeDiff);
        throw ApiError.tooManyRequests(
          `Please wait ${secondsRemaining} second(s) before requesting a new verification code.`
        );
      }
    }

    const otp = this.generateNumericOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await otpRepository.createOtp({
      email: normalizedEmail,
      otpCode: this.hashOtp(otp),
      purpose: "reset_password",
      expiresAt,
    });

    await emailService.sendOtpEmail(normalizedEmail, otp, "reset_password");

    return {
      success: true,
      data: null,
      message: "Verification code sent to your email.",
    };
  },

  async resendForgotPasswordOtp(email: string) {
    return this.sendForgotPasswordOtp(email);
  },

  async verifyForgotPasswordOtp(email: string, otp: string) {
    const normalizedEmail = email.toLowerCase().trim();
    assertOtpAttemptAllowed("reset_password", normalizedEmail);

    await otpRepository.deleteExpired();

    const record = await otpRepository.findLatestValidOtp(
      normalizedEmail,
      "reset_password"
    );
    if (!record) {
      throw ApiError.badRequest("Invalid or expired verification code.");
    }

    if (new Date() > new Date(record.expiresAt)) {
      await otpRepository.deleteByEmail(normalizedEmail, "reset_password");
      throw ApiError.badRequest(
        "Verification code has expired. Please request a new one."
      );
    }

    const hashedOtp = this.hashOtp(otp);
    if (
      record.otpCode.length !== hashedOtp.length ||
      !crypto.timingSafeEqual(
        Buffer.from(record.otpCode),
        Buffer.from(hashedOtp)
      )
    ) {
      throw ApiError.badRequest("Invalid verification code.");
    }

    // OTP is single-use: mark as consumed immediately after successful verification
    await otpRepository.markOtpConsumed(record.id);

    // Generate 5-minute Reset Password Token
    const resetToken = generateResetPasswordToken({ email: normalizedEmail });

    return {
      resetToken,
      message: "OTP verified successfully",
    };
  },

  // Alias for backward compatibility
  async verifyOtp(email: string, otp: string) {
    return this.verifyForgotPasswordOtp(email, otp);
  },

  async resetPassword(data: ResetPasswordInput) {
    // Verify reset password token (signature, 5m expiry, purpose)
    const payload = verifyResetPasswordToken(data.resetToken);

    const user = await userRepository.findByEmail(payload.email);
    if (!user || user.status !== "active") {
      throw ApiError.forbidden(
        "Account is inactive, blocked, or no longer exists."
      );
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);
    await userRepository.resetPassword(user.id, hashedPassword);

    return {
      message:
        "Password reset successfully. You can now log in with your new password.",
    };
  },
};
