"use client";

import { Suspense, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validations/auth";
import { useForgotPassword, authFlowState } from "@/features/auth";
import { Mail, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import { FormInput } from "@/components/forms/form-input";
import { FormSubmitButton } from "@/components/forms/form-submit-button";
import { Spinner } from "@/components/ui/spinner";

function ForgotPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromAdmin = searchParams.get("from") === "admin";
  const [success, setSuccess] = useState("");
  const forgotPasswordMutation = useForgotPassword();
  // Stays pending until the destination route has rendered.
  const [isNavigating, startNavigation] = useTransition();
  const busy = forgotPasswordMutation.isPending || isNavigating;

  const methods = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = (data: ForgotPasswordInput) => {
    if (busy) return;
    setSuccess("");
    methods.clearErrors("root");
    const userEmail = data.email.trim();

    authFlowState.setForgotPasswordEmail(userEmail);

    forgotPasswordMutation.mutate(
      { email: userEmail },
      {
        onSuccess: (res) => {
          setSuccess(res.message || "OTP sent to your email.");
          const targetUrl = `/forgot-password/verify-otp${
            fromAdmin ? "?from=admin" : ""
          }`;
          startNavigation(() => router.push(targetUrl));
        },
        onError: (err: any) => {
          methods.setError("root", {
            type: "server",
            message:
              err?.message ||
              "Failed to send OTP. Please check your email and try again.",
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
            className="text-[30px] font-bold leading-tight text-neutral-900 sm:text-[34px]"
            style={{ fontFamily: "var(--font-hanken)" }}
          >
            Forgot Password?
          </h1>

          <p className="mt-3 text-[15px] leading-7 text-neutral-600">
            Enter your registered email address and we&apos;ll send you a
            one-time password (OTP) to reset your account.
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
            <FormInput
              name="email"
              label="Email Address"
              type="email"
              placeholder="hello@example.com"
              autoComplete="email"
              leftIcon={<Mail size={18} />}
              required
            />

            <FormSubmitButton
              size="xl"
              disabled={busy}
              className="h-12 w-full rounded-lg bg-secondary-600 text-sm font-semibold text-white hover:bg-secondary-700 cursor-pointer disabled:opacity-50"
            >
              {busy ? (
                <Spinner size="sm" className="text-white" />
              ) : (
                "Send OTP"
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

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      }
    >
      <ForgotPasswordForm />
    </Suspense>
  );
}