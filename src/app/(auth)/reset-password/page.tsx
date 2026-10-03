"use client";

import { Suspense, useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, LockKeyhole, AlertCircle, CheckCircle2 } from "lucide-react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormSubmitButton } from "@/components/forms/form-submit-button";
import { FormPasswordInput } from "@/components/forms/FormPasswordInput";
import { Spinner } from "@/components/ui/spinner";
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/validations/auth";
import { useResetPassword } from "@/features/auth";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get("token") || "";
  const fromAdmin = searchParams.get("from") === "admin";
  const [success, setSuccess] = useState("");
  const resetPasswordMutation = useResetPassword();
  // Stays pending until the destination route has rendered.
  const [isNavigating, startNavigation] = useTransition();
  const busy = resetPasswordMutation.isPending || isNavigating;

  const methods = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      resetToken: tokenFromUrl || "http_only_cookie",
      password: "",
      confirmPassword: "",
    },
  });

  const password = methods.watch("password") || "";

  const strength = useMemo(() => {
    if (!password) return null;

    let score = 0;

    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 2) {
      return {
        width: "25%",
        label: "Weak",
        color: "bg-error-600",
        suggestion:
          "Use at least 8 characters with uppercase, lowercase, a number, and a special character.",
      };
    }

    if (score === 3) {
      return {
        width: "50%",
        label: "Fair",
        color: "bg-primary-400",
        suggestion:
          "Add an uppercase letter, number, or special character.",
      };
    }

    if (score === 4) {
      return {
        width: "75%",
        label: "Good",
        color: "bg-success-500",
        suggestion:
          "Add a special character to make it stronger.",
      };
    }

    return {
      width: "100%",
      label: "Strong",
      color: "bg-success-600",
      suggestion: "Your password is strong.",
    };
  }, [password]);

  const onSubmit = (data: ResetPasswordInput) => {
    if (busy) return;
    setSuccess("");
    methods.clearErrors("root");
    const activeToken = data.resetToken || tokenFromUrl || "http_only_cookie";

    resetPasswordMutation.mutate(
      {
        resetToken: activeToken,
        password: data.password.trim(),
        confirmPassword: data.confirmPassword.trim(),
      },
      {
        onSuccess: (res) => {
          setSuccess(
            res.message || "Password reset successfully. Redirecting to login..."
          );
          methods.reset();
          const targetLogin = fromAdmin ? "/admin/login" : "/login";
          startNavigation(() => router.push(targetLogin));
        },
        onError: (err: any) => {
          methods.setError("root", {
            type: "server",
            message:
              err?.message ||
              "Failed to reset password. Your token may have expired. Please try again.",
          });
        },
      }
    );
  };

  return (
    <div className="mx-auto w-full max-w-[300px] xs:max-w-[320px] sm:max-w-[360px] lg:max-w-[500px]">
      <div className="rounded-2xl border border-neutral-200 bg-white px-6 py-8 shadow-sm sm:px-8 sm:py-10">
        {/* Heading */}
        <div>
          <h1
            className="text-[32px] font-bold leading-tight text-neutral-900"
            style={{ fontFamily: "var(--font-hanken)" }}
          >
            Set New Password
          </h1>

          <p className="mt-3 text-[15px] leading-7 text-neutral-600">
            Your new password must be different from previous used passwords.
          </p>
        </div>

        {/* Success Message */}
        {success && (
          <div className="mt-6 flex items-center gap-2 rounded-lg border border-success-200 bg-success-50 p-3 text-sm text-success-600">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {success}
          </div>
        )}

        {/* Server Error */}
        {methods.formState.errors.root?.message && (
          <div className="mt-6 flex items-center gap-2 rounded-lg border border-error-200 bg-error-50 p-3 text-sm text-error-600">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {methods.formState.errors.root.message}
          </div>
        )}

        {/* Form */}
        <FormProvider {...methods}>
          <form
            onSubmit={methods.handleSubmit(onSubmit)}
            className="mt-8 space-y-6"
          >
            <FormPasswordInput
              name="password"
              label="New Password"
              placeholder="Enter your new password"
              leftIcon={<LockKeyhole size={18} />}
              required
            />

            {password.length > 0 && strength && (
              <div className="mt-3">
                <div className="mb-2 flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                  <span>Password Strength</span>
                  <span>{strength.label}</span>
                </div>

                <div className="h-[4px] w-full rounded-full bg-neutral-200">
                  <div
                    className={`h-[4px] rounded-full transition-all duration-300 ${strength.color}`}
                    style={{ width: strength.width }}
                  />
                </div>

                <p className="mt-2 text-xs text-neutral-500">
                  {strength.suggestion}
                </p>
              </div>
            )}

            <FormPasswordInput
              name="confirmPassword"
              label="Confirm Password"
              placeholder="Confirm your password"
              leftIcon={<LockKeyhole size={18} />}
              required
            />

            <FormSubmitButton
              size="xl"
              disabled={busy}
              className="mt-2 h-12 w-full rounded-lg bg-secondary-600 text-sm font-semibold text-white hover:bg-secondary-700 cursor-pointer disabled:opacity-50"
            >
              {busy ? (
                <Spinner size="sm" className="text-white" />
              ) : (
                "Reset Password"
              )}
            </FormSubmitButton>
          </form>
        </FormProvider>

        {/* Back Link */}
        <div className="mt-8 text-center">
          <Link
            href={fromAdmin ? "/admin/login" : "/login"}
            className="inline-flex items-center gap-2 text-sm font-medium text-neutral-600 transition-colors hover:text-secondary-600"
          >
            <ArrowLeft size={16} />
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}