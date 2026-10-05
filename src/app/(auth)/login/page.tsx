"use client";

import AuthFormLayout from "@/components/auth/AuthFormLayout";
import { Suspense, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { useLogin, useLoginCooldown, ACCOUNT_BLOCKED_MESSAGE, ACCOUNT_BLOCKED_TITLE } from "@/features/auth";
import { resolvePostLoginTarget } from "@/lib/auth/role-routes";
import { FormInput } from "@/components/forms/form-input";
import { FormPasswordInput } from "@/components/forms/FormPasswordInput";
import { FormSubmitButton } from "@/components/forms/form-submit-button";
import { Spinner } from "@/components/ui/spinner";
import { LockKeyhole, Mail, AlertCircle } from "lucide-react";
import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const loginMutation = useLogin();
  const [phase, setPhase] = useState<"idle" | "signing-in" | "redirecting">("idle");
  const [redirectSlow, setRedirectSlow] = useState(false);
  const [destination, setDestination] = useState<string | null>(null);
  const cooldown = useLoginCooldown();
  const busy = phase !== "idle" || loginMutation.isPending;

  // If navigation hasn't completed after a while, tell the user rather than
  // leaving an indefinite spinner.
  useEffect(() => {
    if (phase !== "redirecting") return;
    const t = setTimeout(() => setRedirectSlow(true), 12000);
    return () => clearTimeout(t);
  }, [phase]);

  const methods = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = (data: LoginInput) => {
    if (busy || cooldown.coolingDown) return;
    setPhase("signing-in");
    loginMutation.mutate(
      {
        email: data.email.trim(),
        password: data.password,
      },
      {
        onSuccess: async (response) => {
          // Sync NextAuth session and redirect
          // The API login already set the auth cookies, so a NextAuth sync
          // failure must not block the redirect.
          try {
            // Bounded wait: a stalled NextAuth request must not block the redirect.
            await Promise.race([
              signIn("credentials", {
                email: data.email.trim(),
                password: data.password,
                redirect: false,
              }),
              new Promise((resolve) => setTimeout(resolve, 4000)),
            ]);
          } catch (err) {
            console.error("NextAuth session sync failed", err);
          }
          const userRole = response?.data?.user?.role;
          // Role decides the landing page; callbackUrl is honoured only when
          // this role is allowed to open it.
          const target = resolvePostLoginTarget(userRole, callbackUrl);
          setDestination(target);
          setPhase("redirecting");
          // Full navigation so the fresh auth cookies are picked up by
          // middleware and server components; soft navigation can stall here.
          window.location.assign(target);
        },
        onError: (error) => {
          setPhase("idle");
          cooldown.startFromError(error);
          methods.setError("root", {
            message: error instanceof Error ? error.message : "Login failed. Please try again.",
          });
        },
      }
    );
  };

  return (
    <AuthFormLayout
      showLogo
      showFooter
      title="Welcome Back"
      subtitle="Sign in to access your curated couture & lifestyle collections."
      bottomContent={
        <div className="text-sm text-neutral-600">
          New to Zellora?{" "}
          <Link
            href={
              callbackUrl !== "/"
                ? `/register?callbackUrl=${encodeURIComponent(callbackUrl)}`
                : "/register"
            }
            className="font-medium text-secondary-600 hover:underline"
          >
            Create an account
          </Link>
        </div>
      }
    >
      <FormProvider {...methods}>
        <form
          onSubmit={methods.handleSubmit(onSubmit)}
          className="space-y-5 md:space-y-6"
        >
          {/* Server Error */}
          {methods.formState.errors.root?.message && (
            <div className="flex items-center gap-2 rounded-lg border border-error-200 bg-error-50 p-3 text-sm text-error-600">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {methods.formState.errors.root.message === ACCOUNT_BLOCKED_MESSAGE ? (
                <div>
                  <p className="font-semibold">{ACCOUNT_BLOCKED_TITLE}</p>
                  <p>{ACCOUNT_BLOCKED_MESSAGE}</p>
                </div>
              ) : (
                methods.formState.errors.root.message
              )}
            </div>
          )}

          <FormInput
            name="email"
            label="Email Address"
            type="email"
            placeholder="Enter your email"
            autoComplete="email"
            leftIcon={<Mail size={18} />}
            required
          />

          <FormPasswordInput
            name="password"
            label="Password"
            placeholder="Enter your password"
            leftIcon={<LockKeyhole size={18} />}
            required
          />

          <div className="flex items-center justify-end">
            {/* <Checkbox label="Remember Me" className="border-neutral-300" /> */}

            <Link
              href="/forgot-password"
              className="text-sm font-medium text-secondary-600 hover:underline"
            >
              Forgot Password?
            </Link>
          </div>

          <FormSubmitButton
            size="xl"
            disabled={busy || cooldown.coolingDown}
            className="mt-2 h-12 md:h-14 w-full rounded-lg bg-secondary-600 text-sm text-white hover:bg-secondary-700 cursor-pointer disabled:opacity-50"
          >
            {busy ? (
              <span className="flex items-center gap-2">
                <Spinner size="sm" className="text-white" />
                {phase === "redirecting" ? "Signed in..." : "Signing in..."}
              </span>
            ) : (
              cooldown.coolingDown ? `Try again in ${cooldown.label}` : "Sign In"
            )}
          </FormSubmitButton>
        </form>
      </FormProvider>

      {phase === "redirecting" && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-white/95 px-6 text-center"
        >
          <Spinner size="lg" />
          {redirectSlow ? (
            <>
              <p className="text-sm text-neutral-700">
                You&apos;re signed in, but this is taking longer than usual.
              </p>
              <a
                href={destination ?? "/"}
                className="text-sm font-medium text-secondary-600 hover:underline"
              >
                Continue manually
              </a>
            </>
          ) : (
            <p className="text-sm text-neutral-700">
              Login successful. Loading {destination?.includes("dashboard") ? "dashboard" : "your account"}...
            </p>
          )}
        </div>
      )}
    </AuthFormLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}