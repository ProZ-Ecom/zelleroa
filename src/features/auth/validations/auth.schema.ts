import { z } from "zod";

export const sendEmailOtpSchema = z
  .object({
    email: z
      .string({ message: "Email is required" })
      .trim()
      .min(1, "Email is required")
      .email("Please enter a valid email address")
      .transform((val) => val.toLowerCase()),
    phone: z.string().trim().max(20).optional(),
  })
  .strict();

export type SendEmailOtpInput = z.infer<typeof sendEmailOtpSchema>;

export const resendRegisterOtpSchema = sendEmailOtpSchema;
export type ResendRegisterOtpInput = z.infer<typeof resendRegisterOtpSchema>;

export const verifyEmailOtpSchema = z
  .object({
    email: z
      .string({ message: "Email is required" })
      .trim()
      .min(1, "Email is required")
      .email("Please enter a valid email address")
      .transform((val) => val.toLowerCase()),
    otp: z
      .string({ message: "OTP is required" })
      .trim()
      .length(6, "OTP must be exactly 6 digits")
      .regex(/^\d{6}$/, "OTP must contain only numbers"),
  })
  .strict();

export type VerifyEmailOtpInput = z.infer<typeof verifyEmailOtpSchema>;

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
  password: z
    .string()
    .min(1, "Password is required")
    .min(6, "Password must be at least 6 characters"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

export const forgotPasswordSchema = z
  .object({
    email: z
      .string({ message: "Email is required" })
      .trim()
      .min(1, "Email is required")
      .email("Please enter a valid email address")
      .transform((val) => val.toLowerCase()),
  })
  .strict();

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resendForgotPasswordOtpSchema = forgotPasswordSchema;
export type ResendForgotPasswordOtpInput = z.infer<
  typeof resendForgotPasswordOtpSchema
>;

export const verifyOtpSchema = z
  .object({
    email: z
      .string({ message: "Email is required" })
      .trim()
      .min(1, "Email is required")
      .email("Please enter a valid email address")
      .transform((val) => val.toLowerCase()),
    otp: z
      .string({ message: "OTP is required" })
      .trim()
      .min(6, "OTP must be 6 digits")
      .max(6, "OTP must be 6 digits")
      .regex(/^\d{6}$/, "OTP must contain only numbers"),
  })
  .strict();

export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

// Deprecated alias
export const resendOtpSchema = forgotPasswordSchema;
export type ResendOtpInput = z.infer<typeof resendOtpSchema>;

export const resetPasswordSchema = z
  .object({
    resetToken: z.string().min(1, "Reset token is required"),
    password: z
      .string()
      .min(1, "Password is required")
      .min(8, "Password must be at least 8 characters")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Password must contain at least one uppercase letter, one lowercase letter, and one number"
      ),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
