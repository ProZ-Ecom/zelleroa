"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, LockKeyhole, AlertCircle } from "lucide-react";

import AuthBanner from "@/components/auth/AuthBanner";
import AuthFormLayout from "@/components/auth/AuthFormLayout";
import { FormInput } from "@/components/forms/form-input";
import { FormPasswordInput } from "@/components/forms/FormPasswordInput";
import { FormSubmitButton } from "@/components/forms/form-submit-button";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";

import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { useLogin } from "@/features/auth";

function AdminLoginForm() {
  const [rememberMe, setRememberMe] = useState(false);
  const loginMutation = useLogin();
  const [phase, setPhase] = useState<"idle" | "signing-in" | "redirecting">("idle");
  const [redirectSlow, setRedirectSlow] = useState(false);
  const busy = phase !== "idle" || loginMutation.isPending;

  useEffect(() => {
    if (phase !== "redirecting") return;
    const t = setTimeout(() => setRedirectSlow(true), 15000);
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
    if (busy) return;
    setPhase("signing-in");
    loginMutation.mutate(
      {
        email: data.email.trim(),
        password: data.password,
      },
      {
        onSuccess: async (response) => {
          const userRole = response.data?.user?.role;
          if (userRole !== "ADMIN" && userRole !== "STAFF") {
            setPhase("idle");
            methods.setError("root", {
              type: "manual",
              message: "Access denied. You are not authorized to access the Admin portal.",
            });
            return;
          }

          // Keep the loader up through session sync and the page navigation.
          setPhase("redirecting");
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
          } catch {
            // Cookie auth is primary
          }

          // Full navigation so middleware sees the fresh auth cookies.
          window.location.assign("/admin/dashboard");
        },
        onError: (err: any) => {
          setPhase("idle");
          methods.setError("root", {
            type: "server",
            message:
              err?.message ||
              "Invalid email or password. Please check your credentials.",
          });
        },
      }
    );
  };

  return (
    <AuthFormLayout
      showLogo
      showFooter
      title="Welcome back"
      subtitle="Enter your credentials to access the Zellora admin portal."
    >
      <FormProvider {...methods}>
        <form
          onSubmit={methods.handleSubmit(onSubmit)}
          className="space-y-5 md:space-y-6"
        >
          {/* Server Error */}
          {methods.formState.errors.root?.message && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {methods.formState.errors.root.message}
            </div>
          )}

          <FormInput
            name="email"
            label="Email Address"
            type="email"
            placeholder="admin@zellora.com"
            autoComplete="email"
            leftIcon={<Mail size={18} />}
            required
          />

          <FormPasswordInput
            name="password"
            label="Password"
            placeholder="Enter your password"
            autoComplete="current-password"
            leftIcon={<LockKeyhole size={18} />}
            required
          />

          <div className="flex items-center justify-end">
            {/* <Checkbox
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              label="Remember me"
              className="border-neutral-300"
            /> */}

            <Link
              href="/forgot-password?from=admin"
              className="text-sm font-medium text-secondary-600 hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          <FormSubmitButton
            size="xl"
            disabled={busy}
            className="mt-2 h-10 w-full rounded-lg bg-secondary-600 text-sm text-white transition-all hover:bg-secondary-700 cursor-pointer disabled:opacity-50"
          >
            {busy ? (
              <span className="flex items-center gap-2">
                <Spinner size="sm" className="text-white" />
                {phase === "redirecting" ? "Loading dashboard..." : "Signing in..."}
              </span>
            ) : (
              "Sign In to Admin"
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
                href="/admin/dashboard"
                className="text-sm font-medium text-secondary-600 hover:underline"
              >
                Continue manually
              </a>
            </>
          ) : (
            <p className="text-sm text-neutral-700">Login successful. Loading dashboard...</p>
          )}
        </div>
      )}
    </AuthFormLayout>
  );
}

export default function AdminLoginPage() {
  return (
    <div className="grid h-screen w-full overflow-hidden bg-background lg:grid-cols-[45%_55%]">
      {/* Left Banner */}
      <div className="hidden h-screen min-h-0 w-full overflow-hidden lg:block">
        <AuthBanner />
      </div>

      {/* Right Form */}
      <main className="h-screen min-h-0 w-full overflow-y-auto bg-background">
        <div className="flex min-h-full w-full items-center justify-center px-6 py-12 sm:px-8 lg:px-16">
          <div className="my-auto w-full max-w-[440px]">
            <Suspense
              fallback={
                <div className="flex items-center justify-center">
                  <Spinner size="lg" />
                </div>
              }
            >
              <AdminLoginForm />
            </Suspense>
          </div>
        </div>
      </main>
    </div>
  );
}