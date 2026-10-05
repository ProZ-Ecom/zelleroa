import { apiClient } from "@/lib/api/api-client";
import type {
  LoginInput,
  ForgotPasswordInput,
  VerifyOtpInput,
  ResendOtpInput,
  ResendRegisterOtpInput,
  ResendForgotPasswordOtpInput,
  ResetPasswordInput,
  SendEmailOtpInput,
  VerifyEmailOtpInput,
} from "../types";
import { RegisterInput } from "@/features/users/validations/user.schema";

export async function loginApi(data: LoginInput) {
  const response = await apiClient.post<{
    user: { id: string; name: string; email: string; phone: string | null; role: string };
  }>("/api/auth/login", {
    email: data.email.trim(),
    password: data.password,
  });

  return response;
}

export async function registerApi(data: RegisterInput) {
  const response = await apiClient.post<{ id: string; name: string; email: string; phone: string | null }>(
    "/api/auth/register",
    {
      name: (data.name || data.fullName || "").trim(),
      email: data.email.trim(),
      phone: (data.phone || data.mobileNumber || "").trim(),
      password: data.password,
      confirmPassword: data.confirmPassword,
      emailVerificationToken: data.emailVerificationToken,
    }
  );

  return response;
}

export async function sendEmailOtpApi(data: SendEmailOtpInput) {
  return apiClient.post<null>("/api/auth/send-email-otp", {
    email: data.email.trim(),
    ...(data.phone ? { phone: data.phone.trim() } : {}),
  });
}

export async function resendRegisterOtpApi(data: ResendRegisterOtpInput) {
  return apiClient.post<null>("/api/auth/resend-register-otp", {
    email: data.email.trim(),
  });
}

export async function verifyEmailOtpApi(data: VerifyEmailOtpInput) {
  return apiClient.post<{ verificationToken: string }>("/api/auth/verify-email-otp", {
    email: data.email.trim(),
    otp: data.otp.trim(),
  });
}

export async function forgotPasswordApi(data: ForgotPasswordInput) {
  const response = await apiClient.post<null>("/api/auth/forgot-password", {
    email: data.email.trim(),
  });

  return response;
}

export async function resendForgotPasswordOtpApi(data: ResendForgotPasswordOtpInput) {
  const response = await apiClient.post<null>("/api/auth/forgot-password", {
    email: data.email.trim(),
  });

  return response;
}

export async function verifyOtpApi(data: VerifyOtpInput) {
  const response = await apiClient.post<{ resetToken: string }>("/api/auth/verify-otp", {
    email: data.email.trim(),
    otp: data.otp.trim(),
  });

  return response;
}

// Deprecated alias for backward compatibility
export async function resendOtpApi(data: ResendOtpInput) {
  return resendForgotPasswordOtpApi(data);
}

export async function resetPasswordApi(data: ResetPasswordInput) {
  const response = await apiClient.post<null>("/api/auth/reset-password", {
    resetToken: data.resetToken || "",
    password: data.password.trim(),
    confirmPassword: data.confirmPassword.trim(),
  });

  return response;
}

export async function refreshTokenApi(tokenArg?: string) {
  const response = await apiClient.post<null>("/api/auth/refresh", {
    refreshToken: tokenArg || "",
  });

  return response;
}

export async function logoutApi() {
  const response = await apiClient.post<null>("/api/auth/logout");
  return response;
}
