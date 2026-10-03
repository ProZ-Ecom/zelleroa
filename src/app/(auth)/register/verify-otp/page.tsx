"use client";

import { Suspense, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/Toast";
import {
  useVerifyEmailOtp,
  useResendRegisterOtp,
  useRegister,
  authFlowState,
} from "@/features/auth";

function RegisterVerifyOtpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  // Recover email strictly from frontend state (NEVER from URL params)
  const [email, setEmail] = useState(() => authFlowState.getRegistrationEmail());
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [timeLeft, setTimeLeft] = useState(59);
  const [infoMessage, setInfoMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const verifyEmailOtpMutation = useVerifyEmailOtp();
  const resendRegisterOtpMutation = useResendRegisterOtp();
  const registerMutation = useRegister();
  // Stays pending until the destination route has rendered.
  const [isNavigating, startNavigation] = useTransition();

  useEffect(() => {
    if (!email) {
      const stored = authFlowState.getRegistrationEmail();
      if (stored) {
        setEmail(stored);
      } else {
        setErrorMessage(
          "Registration session not found. Please fill out the registration form."
        );
        const redirectTimer = setTimeout(() => {
          router.replace("/register");
        }, 1500);
        return () => clearTimeout(redirectTimer);
      }
    }
  }, [email, router]);

  useEffect(() => {
    if (timeLeft === 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  const handleChange = (value: string, index: number) => {
    if (!/^\d?$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    index: number
  ) => {
    if (e.key === "Backspace") {
      if (otp[index]) {
        const newOtp = [...otp];
        newOtp[index] = "";
        setOtp(newOtp);
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    }

    if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }

    if (e.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();

    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);

    if (!pasted) return;

    const newOtp = [...otp];
    pasted.split("").forEach((digit, i) => {
      newOtp[i] = digit;
    });

    setOtp(newOtp);

    const nextIndex = Math.min(pasted.length, 5);
    inputRefs.current[nextIndex]?.focus();
  };

  const handleVerify = () => {
    const code = otp.join("");
    if (!email || code.length !== 6 || isLoading) return;

    setInfoMessage("");
    setErrorMessage("");

    verifyEmailOtpMutation.mutate(
      { email, otp: code },
      {
        onSuccess: (res) => {
          const verificationToken = res.data?.verificationToken;
          if (!verificationToken) {
            setErrorMessage("Unable to verify OTP. Please try again.");
            return;
          }

          let pendingData: any = null;
          if (typeof window !== "undefined") {
            const saved = sessionStorage.getItem("pending_registration");
            if (saved) {
              try {
                pendingData = JSON.parse(saved);
              } catch {
                pendingData = null;
              }
            }
          }

          if (!pendingData) {
            setErrorMessage(
              "Registration session expired. Please fill out the registration form again."
            );
            setTimeout(() => {
              router.push("/register");
            }, 1500);
            return;
          }

          registerMutation.mutate(
            {
              ...pendingData,
              emailVerificationToken: verificationToken,
            },
            {
              onSuccess: (regRes) => {
                if (typeof window !== "undefined") {
                  sessionStorage.removeItem("pending_registration");
                }
                authFlowState.clearRegistrationEmail();

                const successMsg =
                  regRes.message || "Account created successfully. Redirecting to login...";
                toast.success("Account created successfully", successMsg);
                setInfoMessage(successMsg);

                const loginUrl =
                  callbackUrl !== "/"
                    ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`
                    : "/login";
                startNavigation(() => router.push(loginUrl));
              },
              onError: (regErr: any) => {
                const msg =
                  regErr?.message ||
                  "Failed to create account. Please try again.";
                setErrorMessage(msg);
              },
            }
          );
        },
        onError: (err: any) => {
          const msg =
            err?.message || "Invalid or expired verification code. Please try again.";
          setErrorMessage(msg);
        },
      }
    );
  };

  const handleResend = () => {
    if (!email) return;

    setInfoMessage("");
    setErrorMessage("");

    resendRegisterOtpMutation.mutate(
      { email },
      {
        onSuccess: (res) => {
          const msg = res.message || "A new verification code has been sent.";
          setInfoMessage(msg);
          setTimeLeft(59);
          setOtp(["", "", "", "", "", ""]);
          inputRefs.current[0]?.focus();
        },
        onError: (err: any) => {
          const msg =
            err?.message || "Failed to resend verification code. Please try again.";
          setErrorMessage(msg);
        },
      }
    );
  };

  const isLoading =
    verifyEmailOtpMutation.isPending ||
    registerMutation.isPending ||
    resendRegisterOtpMutation.isPending ||
    isNavigating;

  return (
    <div className="mx-auto w-full max-w-[480px]">
      <div className="w-full rounded-2xl border border-neutral-200 bg-white px-5 py-7 shadow-sm sm:px-8 sm:py-10">
        {/* Logo */}
        <div className="mb-6 flex justify-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-secondary-900 p-2 shadow-sm sm:h-[4.5rem] sm:w-[4.5rem]">
            <Image
              src="/logo-mark.png"
              alt="Zellora"
              width={64}
              height={64}
              className="h-full w-full object-contain"
              priority
            />
          </span>
        </div>

        {/* Heading */}
        <div className="text-center">
          <h1
            className="text-[28px] font-bold text-neutral-900 sm:text-[34px] md:text-[38px]"
            style={{ fontFamily: "var(--font-hanken)" }}
          >
            Verify Your Email
          </h1>

          <p className="mt-3 text-sm leading-6 text-neutral-600 sm:text-[15px] sm:leading-7 md:text-base">
            We&apos;ve sent a 6-digit verification code to{" "}
            <span className="font-semibold text-neutral-900">
              {email || "your email"}
            </span>
            .
          </p>
        </div>

        {/* Info / Success Message */}
        {infoMessage && (
          <div className="mt-6 flex items-center gap-2 rounded-lg border border-success-200 bg-success-50 p-3 text-sm text-success-600">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {infoMessage}
          </div>
        )}

        {/* Error Message */}
        {errorMessage && (
          <div className="mt-6 flex items-center gap-2 rounded-lg border border-error-200 bg-error-50 p-3 text-sm text-error-600">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {errorMessage}
          </div>
        )}

        {/* OTP Inputs */}
        <div className="mt-8 sm:mt-10">
          <div className="grid grid-cols-6 gap-2 sm:gap-3 md:gap-4">
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                value={digit}
                onChange={(e) => handleChange(e.target.value, index)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                onPaste={handlePaste}
                inputMode="numeric"
                maxLength={1}
                disabled={isLoading}
                aria-label={`Digit ${index + 1}`}
                className="
                  aspect-square
                  w-full
                  min-w-0
                  rounded-xl
                  border
                  border-neutral-200
                  bg-white
                  text-center
                  text-base
                  font-semibold
                  text-neutral-900
                  outline-none
                  transition-all
                  focus:border-secondary-600
                  focus:ring-2
                  focus:ring-secondary-600/20
                  disabled:bg-neutral-100
                  sm:text-lg
                  md:text-xl
                "
              />
            ))}
          </div>
        </div>

        {/* Timer */}
        <div className="mt-6 flex items-center justify-between text-sm">
          <span className="text-neutral-600">
            Resend in{" "}
            <span className="font-medium text-neutral-900">
              00:{timeLeft.toString().padStart(2, "0")}
            </span>
          </span>

          <button
            type="button"
            onClick={handleResend}
            disabled={timeLeft !== 0 || isLoading}
            className={`font-medium transition-colors ${
              timeLeft === 0
                ? "cursor-pointer text-secondary-600 hover:underline"
                : "cursor-not-allowed text-neutral-400"
            }`}
          >
            Resend OTP
          </button>
        </div>

        {/* Verify Button */}
        <Button
          onClick={handleVerify}
          disabled={isLoading || otp.join("").length !== 6}
          className="mt-8 h-14 w-full cursor-pointer rounded-xl bg-secondary-600 text-white hover:bg-secondary-700 disabled:opacity-50"
        >
          {isLoading ? (
            <Spinner size="sm" className="text-white" />
          ) : (
            <>
              Verify &amp; Create Account
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>

        {/* Change Email */}
        <div className="mt-6 text-center">
          <Link
            href={`/register${
              callbackUrl !== "/"
                ? `?callbackUrl=${encodeURIComponent(callbackUrl)}`
                : ""
            }`}
            className="text-sm font-medium text-secondary-600 hover:underline"
          >
            Change Email
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function RegisterVerifyOtpPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      }
    >
      <RegisterVerifyOtpForm />
    </Suspense>
  );
}
