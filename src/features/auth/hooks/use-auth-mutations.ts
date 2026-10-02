"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { signOut } from "next-auth/react";
import {
  loginApi,
  registerApi,
  forgotPasswordApi,
  verifyOtpApi,
  resendOtpApi,
  resendRegisterOtpApi,
  resendForgotPasswordOtpApi,
  resetPasswordApi,
  refreshTokenApi,
  logoutApi,
  sendEmailOtpApi,
  verifyEmailOtpApi,
} from "../api/auth.api";
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
import { RegisterInput } from "@/features/users";

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: LoginInput) => loginApi(data),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: (data: RegisterInput) => registerApi(data),
  });
}

export function useSendEmailOtp() {
  return useMutation({
    mutationFn: (data: SendEmailOtpInput) => sendEmailOtpApi(data),
  });
}

export function useVerifyEmailOtp() {
  return useMutation({
    mutationFn: (data: VerifyEmailOtpInput) => verifyEmailOtpApi(data),
  });
}

export function useResendRegisterOtp() {
  return useMutation({
    mutationFn: (data: ResendRegisterOtpInput) => resendRegisterOtpApi(data),
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (data: ForgotPasswordInput) => forgotPasswordApi(data),
  });
}

export function useVerifyOtp() {
  return useMutation({
    mutationFn: (data: VerifyOtpInput) => verifyOtpApi(data),
  });
}

export function useResendForgotPasswordOtp() {
  return useMutation({
    mutationFn: (data: ResendForgotPasswordOtpInput) =>
      resendForgotPasswordOtpApi(data),
  });
}

export function useResendOtp() {
  return useMutation({
    mutationFn: (data: ResendOtpInput) => resendOtpApi(data),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (data: ResetPasswordInput) => resetPasswordApi(data),
  });
}

export function useRefreshToken() {
  return useMutation({
    mutationFn: (refreshToken?: string) => refreshTokenApi(refreshToken),
    meta: {
      skipToast: true, // Silent background token refresh operation
    },
  });
}

/** Storage keys that may hold auth/session data; removed on logout. */
const AUTH_STORAGE_KEY_PATTERN =
  /token|jwt|next-?auth|authjs|pending_registration|fp_verification_email/i;

function clearAuthStorage() {
  for (const store of [window.localStorage, window.sessionStorage]) {
    try {
      Object.keys(store)
        .filter((key) => AUTH_STORAGE_KEY_PATTERN.test(key))
        .forEach((key) => store.removeItem(key));
    } catch {
      // storage can be unavailable (private mode / blocked)
    }
  }
}

/**
 * Full logout: server clears the JWT + Auth.js cookies, then the client drops
 * the NextAuth session state, cached queries and stored auth data, and does a
 * hard navigation so nothing stale survives in memory or the bfcache.
 *
 * If the server call fails the mutation errors (toasted globally) and the user
 * stays signed in - we never show a logged-out UI for a live session.
 */
export function useLogout(redirectTo: string = "/login") {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await logoutApi();
      // Cookies are already expired by the response above; this resets the
      // in-memory SessionProvider state. A failure here is not fatal.
      try {
        await signOut({ redirect: false });
      } catch {
        // ignore
      }
    },
    onSuccess: () => {
      queryClient.clear();
      clearAuthStorage();
      window.location.replace(redirectTo);
    },
  });
}
