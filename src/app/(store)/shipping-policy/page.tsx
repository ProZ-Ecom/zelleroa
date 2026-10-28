import type { Metadata } from "next";
import { PolicyLayout } from "@/components/storefront/policy/PolicyLayout";
import { Truck, Clock, ShieldCheck, MapPin } from "lucide-react";

export const metadata: Metadata = {
  title: "Shipping & Delivery Policy | Zellora",
  description:
    "Learn about Zellora India shipping methods, delivery timelines, standard & express delivery charges, tracking, and pan-India shipping policy.",
};

const sectionClass =
  "space-y-3 pt-6 border-t border-[var(--theme-border-subtle,#F0E6D6)]";
const headingClass =
  "text-xl sm:text-2xl font-bold text-neutral-900 font-serif";

export default function ShippingPolicyPage() {
  return (
    <PolicyLayout
      title="Shipping & Delivery Policy"
      lastUpdated="October 20, 2026"
      icon={Truck}
    >
      {/* Intro */}
      <section className="space-y-4">
        <p className="text-base sm:text-lg text-neutral-800 leading-relaxed font-medium">
          At <strong className="text-neutral-900 font-semibold">ZELLORA INDIA</strong>, we strive to deliver your curated couture and lifestyle collections in the fastest and safest manner possible. Every package is quality-checked and dispatched in tamper-proof packaging.
        </p>

        {/* Highlights */}
        <div className="grid gap-3 sm:grid-cols-3 pt-2">
          <div className="flex items-start gap-3 rounded-xl border border-[var(--theme-border,#EBE0D0)] bg-[var(--theme-surface-alt,#FCF7EE)] p-4">
            <Clock className="h-5 w-5 shrink-0 text-[var(--theme-primary,#5C1512)] mt-0.5" />
            <div>
              <p className="font-semibold text-neutral-900">24–48h Dispatch</p>
              <p className="text-xs sm:text-sm text-neutral-700">
                Orders are processed and dispatched within 1–2 business days.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-[var(--theme-border,#EBE0D0)] bg-[var(--theme-surface-alt,#FCF7EE)] p-4">
            <MapPin className="h-5 w-5 shrink-0 text-[var(--theme-primary,#5C1512)] mt-0.5" />
            <div>
              <p className="font-semibold text-neutral-900">Pan-India Delivery</p>
              <p className="text-xs sm:text-sm text-neutral-700">
                Reliable courier coverage across all major PIN codes in India.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-[var(--theme-border,#EBE0D0)] bg-[var(--theme-surface-alt,#FCF7EE)] p-4">
            <ShieldCheck className="h-5 w-5 shrink-0 text-[var(--theme-primary,#5C1512)] mt-0.5" />
            <div>
              <p className="font-semibold text-neutral-900">Tamper-Proof Box</p>
              <p className="text-xs sm:text-sm text-neutral-700">
                Securely sealed packaging to protect your delicate apparel.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 1. Shipping Methods & Charges */}
      <section className={sectionClass}>
        <h2 className={headingClass}>1. Shipping Methods &amp; Charges</h2>
        <p className="text-neutral-700 leading-relaxed">
          We offer flexible shipping options to ensure your order arrives when you need it:
        </p>
        <div className="overflow-x-auto pt-2">
          <table className="w-full text-left text-sm text-neutral-700 border border-[var(--theme-border,#EBE0D0)] rounded-lg overflow-hidden">
            <thead className="bg-[var(--theme-surface-alt,#FCF7EE)] text-neutral-900 font-semibold">
              <tr>
                <th className="p-3 border-b border-[var(--theme-border,#EBE0D0)]">Delivery Type</th>
                <th className="p-3 border-b border-[var(--theme-border,#EBE0D0)]">Estimated Delivery Time</th>
                <th className="p-3 border-b border-[var(--theme-border,#EBE0D0)]">Shipping Fee</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--theme-border,#EBE0D0)]">
              <tr>
                <td className="p-3 font-medium text-neutral-900">Standard Delivery</td>
                <td className="p-3">3 to 5 business days</td>
                <td className="p-3">₹49 (or Free on select promotional offers)</td>
              </tr>
              <tr>
                <td className="p-3 font-medium text-neutral-900">Express Delivery</td>
                <td className="p-3">1 to 2 business days (metro &amp; Tier-1 cities)</td>
                <td className="p-3">₹99 flat</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 2. Order Processing & Dispatch */}
      <section className={sectionClass}>
        <h2 className={headingClass}>2. Order Processing &amp; Dispatch</h2>
        <ul className="list-disc pl-6 space-y-2 text-neutral-700">
          <li>Orders placed before 2:00 PM IST on business days are processed on the same day.</li>
          <li>Orders placed on Sundays or public holidays will be processed on the next business day.</li>
          <li>You will receive an automated confirmation SMS, WhatsApp, and email once your order has been dispatched.</li>
        </ul>
      </section>

      {/* 3. Tracking Your Order */}
      <section className={sectionClass}>
        <h2 className={headingClass}>3. Tracking Your Order</h2>
        <p className="text-neutral-700 leading-relaxed">
          Once your package is picked up by our courier partners (BlueDart, Delhivery, Shadowfax, or DTDC), an active tracking link is shared with you. You can also track your live shipment anytime from the{" "}
          <strong className="text-neutral-900 font-semibold">Track Order</strong> page using your Order ID.
        </p>
      </section>

      {/* 4. Undelivered Packages & Re-attempts */}
      <section className={sectionClass}>
        <h2 className={headingClass}>4. Delivery Attempts &amp; Re-delivery</h2>
        <p className="text-neutral-700 leading-relaxed">
          Our courier partners will make up to three attempts to deliver your order. If you are unreachable or the delivery cannot be completed, the package may be returned to our fulfillment warehouse. Please ensure your contact number and delivery address are accurate at checkout.
        </p>
      </section>

      {/* 5. Damaged or Tampered Packaging */}
      <section className={sectionClass}>
        <h2 className={headingClass}>5. Damaged or Tampered Packaging</h2>
        <p className="text-neutral-700 leading-relaxed">
          If you receive an outer package that appears physically damaged or tampered with, please do not accept the delivery or note it clearly on the delivery proof. Per our Return Policy, we strictly recommend recording a continuous unboxing video when opening your package.
        </p>
      </section>
    </PolicyLayout>
  );
}
