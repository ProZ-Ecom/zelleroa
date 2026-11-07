import jwt from "jsonwebtoken";
import { ApiError } from "@/lib/api/api-error";

function getAccessSecret(): string {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) {
    throw new Error("JWT_ACCESS_SECRET environment variable is not defined");
  }
  return secret;
}

function getRefreshSecret(): string {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) {
    throw new Error("JWT_REFRESH_SECRET environment variable is not defined");
  }
  return secret;
}

function getResetPasswordSecret(): string {
  const secret = process.env.JWT_RESET_PASSWORD_SECRET || process.env.JWT_SECRET || "default_secret_key";
  return secret;
}

export interface AccessTokenPayload {
  userId: string; // User UUID
  email: string;
  role: string;
  /** Area the role belongs to (roles.scope): "ADMIN" | "AGENT" | "CUSTOMER". */
  scope?: string;
}

export interface RefreshTokenPayload {
  userId: string; // User UUID or numeric ID string
}

export interface ResetPasswordTokenPayload {
  email: string;
  purpose: "reset_password";
}

export interface EmailVerificationTokenPayload {
  email: string;
  purpose: "EMAIL_VERIFICATION";
  jti: string;
}

export function generateAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(
    {
      userId: payload.userId, // Expose string UUID, never numeric DB integer ID
      email: payload.email,
      role: payload.role || "CUSTOMER",
      scope: payload.scope || undefined,
    },
    getAccessSecret(),
    { expiresIn: "15m" }
  );
}

export function generateRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(
    {
      userId: payload.userId,
    },
    getRefreshSecret(),
    { expiresIn: "30d" }
  );
}

export function generateResetPasswordToken(payload: { email: string }): string {
  return jwt.sign(
    {
      email: payload.email,
      purpose: "reset_password",
    },
    getResetPasswordSecret(),
    { expiresIn: "5m" }
  );
}

export function generateEmailVerificationToken(payload: { email: string; jti: string }): string {
  return jwt.sign(
    {
      email: payload.email.toLowerCase().trim(),
      purpose: "EMAIL_VERIFICATION",
      jti: payload.jti,
    },
    getResetPasswordSecret(),
    { expiresIn: "30m" }
  );
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, getAccessSecret()) as jwt.JwtPayload & AccessTokenPayload;
  return {
    userId: String(decoded.userId),
    email: String(decoded.email),
    role: decoded.role ? String(decoded.role) : "CUSTOMER",
    scope: decoded.scope ? String(decoded.scope) : undefined,
  };
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const decoded = jwt.verify(token, getRefreshSecret()) as jwt.JwtPayload & RefreshTokenPayload;
  return {
    userId: String(decoded.userId),
  };
}

export function verifyResetPasswordToken(token: string): ResetPasswordTokenPayload {
  try {
    const decoded = jwt.verify(token, getResetPasswordSecret()) as jwt.JwtPayload & ResetPasswordTokenPayload;

    if (decoded.purpose !== "reset_password" || !decoded.email) {
      throw ApiError.unauthorized("Invalid reset password token.");
    }

    return {
      email: String(decoded.email),
      purpose: "reset_password",
    };
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      throw err;
    }
    if (typeof err === "object" && err !== null && "name" in err && err.name === "TokenExpiredError") {
      throw ApiError.unauthorized("Reset password token has expired. Please verify OTP again.");
    }
    throw ApiError.unauthorized("Invalid or tampered reset password token.");
  }
}

export function verifyEmailVerificationToken(token: string): EmailVerificationTokenPayload {
  try {
    const decoded = jwt.verify(token, getResetPasswordSecret()) as jwt.JwtPayload & EmailVerificationTokenPayload;

    if (decoded.purpose !== "EMAIL_VERIFICATION" || !decoded.email || !decoded.jti) {
      throw ApiError.unauthorized("Invalid verification token.");
    }

    return {
      email: String(decoded.email).toLowerCase().trim(),
      purpose: "EMAIL_VERIFICATION",
      jti: String(decoded.jti),
    };
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      throw err;
    }
    if (typeof err === "object" && err !== null && "name" in err && err.name === "TokenExpiredError") {
      throw ApiError.unauthorized("Verification token has expired. Please verify OTP again.");
    }
    throw ApiError.unauthorized("Invalid or tampered verification token.");
  }
}
