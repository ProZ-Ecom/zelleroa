export type {
  LoginInput,
  RefreshTokenInput,
  ForgotPasswordInput,
  VerifyOtpInput,
  ResendOtpInput,
  ResendRegisterOtpInput,
  ResendForgotPasswordOtpInput,
  ResetPasswordInput,
  SendEmailOtpInput,
  VerifyEmailOtpInput,
} from "../validations/auth.schema";

export interface AuthTokensResult {
  user: {
    id: string; // Exposed UUID
    name: string;
    email: string;
    phone: string | null;
    role: string;
  };
  accessToken: string;
  refreshToken: string;
}

export interface RefreshTokenResult {
  accessToken: string;
}

/** Shown when login is refused because the account is blocked or inactive. */
export const ACCOUNT_BLOCKED_TITLE = "Unable to sign in";
export const ACCOUNT_BLOCKED_MESSAGE =
  "We couldn't sign you in. Please contact support if you believe this is an error.";

/** Error codes for failed-login protection (temporary, not an admin block). */
export const LOGIN_LOCKED_CODE = "LOGIN_LOCKED";
export const LOGIN_THROTTLED_CODE = "LOGIN_THROTTLED";
