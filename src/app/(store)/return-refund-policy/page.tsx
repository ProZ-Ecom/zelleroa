import type { Metadata } from "next";
import { PolicyLayout } from "@/components/storefront/policy/PolicyLayout";
import { RotateCcw, Clock, Video } from "lucide-react";

export const metadata: Metadata = {
  title: "Return & Refund Policy | Zellora",
  description:
    "Zellora India return, replacement, and refund policy: requests within 3 days of delivery with a mandatory unboxing video, for wrong, damaged, size, or quality issues.",
};

const sectionClass =
  "space-y-3 pt-6 border-t border-[var(--theme-border-subtle,#F0E6D6)]";
const headingClass =
  "text-xl sm:text-2xl font-bold text-neutral-900 font-serif";

export default function ReturnRefundPolicyPage() {
  return (
    <PolicyLayout
      title="Return & Refund Policy"
      lastUpdated="September 22, 2026"
      icon={RotateCcw}
    >
      {/* Intro */}
      <section className="space-y-4">
        <p className="text-base sm:text-lg text-neutral-800 leading-relaxed font-medium">
          At <strong className="text-neutral-900 font-semibold">ZELLORA INDIA</strong>, we aim to provide our customers with quality fashion products. If you receive a product with an issue, you may be eligible for a return, replacement, or refund subject to the following terms.
        </p>

        {/* Key requirements at a glance */}
        <div className="grid gap-3 sm:grid-cols-2 pt-2">
          <div className="flex items-start gap-3 rounded-xl border border-[var(--theme-border,#EBE0D0)] bg-[var(--theme-surface-alt,#FCF7EE)] p-4">
            <Clock className="h-5 w-5 shrink-0 text-[var(--theme-primary,#5C1512)] mt-0.5" />
            <div>
              <p className="font-semibold text-neutral-900">3-day window</p>
              <p className="text-sm text-neutral-700">
                Raise your request within 3 days of delivery.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-[var(--theme-border,#EBE0D0)] bg-[var(--theme-surface-alt,#FCF7EE)] p-4">
            <Video className="h-5 w-5 shrink-0 text-[var(--theme-primary,#5C1512)] mt-0.5" />
            <div>
              <p className="font-semibold text-neutral-900">Unboxing video required</p>
              <p className="text-sm text-neutral-700">
                Record a clear, continuous video while opening your package.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 1. Return Period */}
      <section className={sectionClass}>
        <h2 className={headingClass}>1. Return Period</h2>
        <ul className="list-disc pl-6 space-y-2 text-neutral-700">
          <li>
            Return requests must be raised within{" "}
            <strong className="text-neutral-900 font-semibold">3 days of delivery</strong>.
          </li>
          <li>Requests submitted after 3 days will not be accepted.</li>
        </ul>
      </section>

      {/* 2. Unboxing Video Required */}
      <section className={sectionClass}>
        <h2 className={headingClass}>2. Unboxing Video Required</h2>
        <ul className="list-disc pl-6 space-y-2 text-neutral-700">
          <li>
            A clear, continuous unboxing video is{" "}
            <strong className="text-neutral-900 font-semibold">mandatory</strong> for all return or replacement requests.
          </li>
          <li>
            The video should clearly show the package, shipping label, and the product while opening the package.
          </li>
          <li>
            Without a valid unboxing video, the return/replacement request may not be accepted.
          </li>
        </ul>
      </section>

      {/* 3. Eligible Reasons for Return */}
      <section className={sectionClass}>
        <h2 className={headingClass}>3. Eligible Reasons for Return</h2>
        <p className="text-neutral-700 leading-relaxed">
          Returns or replacements are accepted only for the following reasons:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-neutral-700">
          <li>
            <strong className="text-neutral-900 font-semibold">Wrong Product:</strong> A different product was delivered than the one ordered.
          </li>
          <li>
            <strong className="text-neutral-900 font-semibold">Damaged Product:</strong> The product was damaged when received.
          </li>
          <li>
            <strong className="text-neutral-900 font-semibold">Size Issue:</strong> The received size has an issue, subject to our applicable size/return conditions.
          </li>
          <li>
            <strong className="text-neutral-900 font-semibold">Quality Issue:</strong> The product has a genuine manufacturing or quality defect.
          </li>
        </ul>
      </section>

      {/* 4. Replacement and Refund */}
      <section className={sectionClass}>
        <h2 className={headingClass}>4. Replacement and Refund</h2>
        <p className="text-neutral-700 leading-relaxed">
          For eligible return requests, ZELLORA INDIA may provide:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-neutral-700">
          <li>Replacement with the correct product, subject to availability; or</li>
          <li>Refund, where replacement is not possible or applicable.</li>
        </ul>
        <p className="text-neutral-700 leading-relaxed">
          The final resolution will be provided after verification of the return request and supporting unboxing video.
        </p>
      </section>

      {/* 5. Non-Returnable Products */}
      <section className={sectionClass}>
        <h2 className={headingClass}>5. Non-Returnable Products</h2>
        <ul className="list-disc pl-6 space-y-2 text-neutral-700">
          <li>Products without an eligible issue are not returnable.</li>
          <li>
            If the customer simply changes their mind or no longer wants the product, the product cannot be returned.
          </li>
          <li>The same product cannot be returned without a valid eligible reason.</li>
        </ul>
      </section>

      {/* 6. Return Verification */}
      <section className={sectionClass}>
        <h2 className={headingClass}>6. Return Verification</h2>
        <p className="text-neutral-700 leading-relaxed">
          All return requests are subject to verification. ZELLORA INDIA reserves the right to reject requests that do not meet the above conditions or where the required unboxing video is not provided.
        </p>
      </section>
    </PolicyLayout>
  );
}
