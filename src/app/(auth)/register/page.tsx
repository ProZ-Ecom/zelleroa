"use client";
import { useMemo, Suspense, useState, useRef, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import AuthFormLayout from "@/components/auth/AuthFormLayout";
import { useSendEmailOtp, authFlowState } from "@/features/auth";
import { FormInput } from "@/components/forms/form-input";
import { FormPasswordInput } from "@/components/forms/FormPasswordInput";
import { FormSubmitButton } from "@/components/forms/form-submit-button";
import { Spinner } from "@/components/ui/spinner";
import { Checkbox } from "@/components/ui/checkbox";
import { Mail, LockKeyhole, User, Phone, AlertCircle } from "lucide-react";
import { z } from "zod";
import { emailField } from "@/lib/validations/email";
import { NAME_REGEX, NAME_INVALID_MESSAGE } from "@/lib/validations/name";
import { getMobileError } from "@/lib/validations/mobile";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";

const registerFormSchema = z
  .object({
    name: z
      .string({ message: "Full name is required" })
      .trim()
      .min(2, "Full name must be at least 2 characters")
      .max(100, "Full name must be less than 100 characters")
      .regex(NAME_REGEX, NAME_INVALID_MESSAGE),
    email: emailField,
    phone: z
      .string({ message: "Mobile number is required" })
      .trim()
      .superRefine((val, ctx) => {
        const message = getMobileError(val);
        if (message) ctx.addIssue({ code: "custom", message });
      }),
    password: z
      .string({ message: "Password is required" })
      .min(8, "Password must be at least 8 characters")
      .max(100, "Password cannot exceed 100 characters")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Password must contain at least one uppercase letter, one lowercase letter, and one number"
      ),
    confirmPassword: z
      .string({ message: "Please confirm your password" })
      .min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type RegisterFormData = z.infer<typeof registerFormSchema>;

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [acceptTerms, setAcceptTerms] = useState(false);
  const [termsError, setTermsError] = useState(false);
  const termsRef = useRef<HTMLInputElement>(null);
  const sendEmailOtpMutation = useSendEmailOtp();
  // Stays pending until the destination route has rendered, so the button
  // keeps spinning after the API call resolves.
  const [isNavigating, startNavigation] = useTransition();
  const busy = sendEmailOtpMutation.isPending || isNavigating;

  const methods = useForm<RegisterFormData>({
    resolver: zodResolver(registerFormSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      name: "",
      email: "",
      phone: "",
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
        suggestion: "Add an uppercase letter, number, or special character.",
      };
    }

    if (score === 4) {
      return {
        width: "75%",
        label: "Good",
        color: "bg-success-500",
        suggestion: "Add a special character to make it stronger.",
      };
    }

    return {
      width: "100%",
      label: "Strong",
      color: "bg-success-600",
      suggestion: "Your password is strong.",
    };
  }, [password]);

  const onSubmit = (data: RegisterFormData) => {
    if (busy) return;
    methods.clearErrors("root");

    if (!acceptTerms) {
      setTermsError(true);
      const el = termsRef.current;
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.focus({ preventScroll: true });
      return;
    }

    const regData = {
      name: data.name.trim(),
      email: data.email.trim().toLowerCase(),
      phone: data.phone.trim(),
      password: data.password,
      confirmPassword: data.confirmPassword,
    };

    if (typeof window !== "undefined") {
      sessionStorage.setItem("pending_registration", JSON.stringify(regData));
    }
    authFlowState.setRegistrationEmail(regData.email);

    sendEmailOtpMutation.mutate(
      { email: regData.email, phone: regData.phone },
      {
        onSuccess: () => {
          const targetUrl = `/register/verify-otp${
            callbackUrl !== "/"
              ? `?callbackUrl=${encodeURIComponent(callbackUrl)}`
              : ""
          }`;
          startNavigation(() => router.push(targetUrl));
        },
        onError: (err: any) => {
          // Surface field-level API validation errors ("phone: <message>") on the field
          const phoneError = (err?.errors as string[] | undefined)?.find((e) =>
            e.startsWith("phone:")
          );
          if (phoneError) {
            methods.setError("phone", {
              type: "server",
              message: phoneError.replace(/^phone:\s*/, ""),
            });
            return;
          }
          methods.setError("root", {
            type: "server",
            message:
              err?.message ||
              "Failed to send verification code. Please try again.",
          });
        },
      }
    );
  };

  return (
    <AuthFormLayout
      showLogo
      title="Create Account"
      subtitle="Welcome to Zellora"
      bottomContent={
        <div className="text-sm text-neutral-600">
          Already have an account?{" "}
          <Link
            href={
              callbackUrl !== "/"
                ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`
                : "/login"
            }
            className="font-medium text-secondary-600 hover:underline"
          >
            Sign In
          </Link>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Google One-Click Registration */}
        <GoogleAuthButton callbackUrl={callbackUrl} text="Continue with Google" />

        {/* Divider */}
        <div className="relative flex items-center justify-center py-1">
          <div className="w-full border-t border-neutral-200" />
          <span className="absolute bg-white px-3 text-xs font-medium uppercase tracking-wider text-neutral-400">
            Or register with email
          </span>
        </div>

        <FormProvider {...methods}>
          <form
            onSubmit={methods.handleSubmit(onSubmit, () => {
              // RHF focuses the first invalid field; also surface the terms error
              if (!acceptTerms) setTermsError(true);
            })}
            className="space-y-5 md:space-y-6"
          >
          {/* Server Error */}
          {methods.formState.errors.root?.message && (
            <div className="flex items-center gap-2 rounded-lg border border-error-200 bg-error-50 p-3 text-sm text-error-600">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {methods.formState.errors.root.message}
            </div>
          )}

          <FormInput
            name="name"
            label="Full Name"
            placeholder="Enter your full name"
            autoComplete="name"
            leftIcon={<User size={18} />}
            required
          />

          <FormInput
            name="email"
            label="Email Address"
            type="email"
            placeholder="Enter your email"
            autoComplete="email"
            leftIcon={<Mail size={18} />}
            required
          />

          <FormInput
            name="phone"
            label="Mobile Number"
            type="tel"
            placeholder="Enter 10-digit mobile number"
            autoComplete="tel"
            leftIcon={<Phone size={18} />}
            inputPrefix="+91"
            required
          />

          <FormPasswordInput
            name="password"
            label="Password"
            placeholder="Enter your password"
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

          <div
            className={`pt-1 ${
              termsError
                ? "rounded-lg border border-error-200 bg-error-50 p-3"
                : ""
            }`}
          >
            <Checkbox
              ref={termsRef}
              checked={acceptTerms}
              aria-invalid={termsError ? true : undefined}
              aria-describedby={termsError ? "terms-error" : undefined}
              onChange={(e) => {
                setAcceptTerms(e.target.checked);
                if (e.target.checked) setTermsError(false);
              }}
              label={
                <>
                  I agree to the{" "}
                  <Link
                    href="/terms-and-conditions"
                    onClick={(e) => e.stopPropagation()}
                    className="font-medium text-secondary-600 hover:underline"
                  >
                    Terms & Conditions
                  </Link>
                </>
              }
            />
            {termsError && (
              <p
                id="terms-error"
                role="alert"
                className="mt-2 flex items-center gap-1.5 text-xs font-medium text-error-600"
              >
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                Please agree to the Terms &amp; Conditions to create your
                account.
              </p>
            )}
          </div>

          <FormSubmitButton
            size="xl"
            disabled={busy}
            className="mt-2 h-10 w-full rounded-lg bg-secondary-600 text-sm text-white transition-all hover:bg-secondary-700 cursor-pointer disabled:opacity-50"
          >
            {busy ? (
              <Spinner size="sm" className="text-white" />
            ) : (
              "Create Account"
            )}
          </FormSubmitButton>
        </form>
      </FormProvider>
      </div>
    </AuthFormLayout>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
