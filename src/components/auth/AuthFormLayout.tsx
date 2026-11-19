"use client";

import Image from "next/image";
import Link from "next/link";
import { ReactNode, useState } from "react";
import { ContactFormModal } from "@/features/contact/components/ContactFormModal";

interface AuthFormLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  showLogo?: boolean;
  bottomContent?: ReactNode;
  showFooter?: boolean;
}

export default function AuthFormLayout({
  title,
  subtitle,
  children,
  showLogo = false,
  bottomContent,
  showFooter = false,
}: AuthFormLayoutProps) {
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);

  return (
    <div className="mx-auto flex w-full max-w-[300px] flex-col justify-center sm:max-w-[420px] lg:max-w-[420px]">
      {/* Logo */}
      {showLogo && (
        <div className="mb-3 flex justify-center">
          <Link
            href="/"
            aria-label="Go to home page"
            className="flex h-14 w-14 items-center justify-center rounded-xl bg-secondary-900 p-2 shadow-sm md:h-16 md:w-16 lg:h-[4.5rem] lg:w-[4.5rem]"
          >
            <Image
              src="/logo-mark.png"
              alt="Zellora"
              width={64}
              height={64}
              className="h-full w-full object-contain"
              priority
            />
          </Link>
        </div>
      )}

      {/* Heading */}
      <div className="text-center">
        <h1
          className="text-3xl font-bold leading-tight text-neutral-900 md:text-4xl lg:text-4xl"
          style={{ fontFamily: "var(--font-hanken)" }}
        >
          {title}
        </h1>

        <p className="pb-3 text-sm leading-7 text-neutral-600 md:text-base">
          {subtitle}
        </p>
      </div>

      {/* Form */}
      <div>{children}</div>

      {/* Bottom Content */}
      {bottomContent && (
        <div className="mt-5 text-center">
          {bottomContent}
        </div>
      )}

      {/* Footer */}
      {showFooter && (
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3 text-xs text-neutral-500 md:text-sm">
          <Link
            href="/privacy-policy"
            className="transition-colors hover:text-secondary-600"
          >
            Privacy Policy
          </Link>

          <span>•</span>

          <Link
            href="/terms-and-conditions"
            className="transition-colors hover:text-secondary-600"
          >
            Terms & Conditions
          </Link>

          <span>•</span>

          <button
            type="button"
            onClick={() => setIsContactModalOpen(true)}
            className="cursor-pointer transition-colors hover:text-secondary-600"
          >
            Contact Us
          </button>
        </div>
      )}

      {/* Contact Form Modal */}
      <ContactFormModal
        open={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
      />
    </div>
  );
}