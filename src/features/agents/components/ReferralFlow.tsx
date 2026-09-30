import { Fragment } from "react";
import { ArrowDown, ArrowRight, Calculator, Globe, Link2, ShoppingBag, ShoppingCart, UserCheck, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { Panel } from "./shared";

const STEPS = [
  { icon: UserCheck, title: "Sales Partner", text: "You share your unique referral details." },
  { icon: Link2, title: "Referral link / code", text: "Identifies you on every visit." },
  { icon: Globe, title: "Customer visits", text: "Customer opens the website via your link." },
  { icon: ShoppingCart, title: "Purchases any product", text: "Any product from the catalogue counts." },
  { icon: ShoppingBag, title: "Order created", text: "That order - and only that order - is linked to you." },
  { icon: Calculator, title: "Commission calculated", text: "Product amount × commission rate." },
  { icon: Wallet, title: "Credited to Sales Partner", text: "Payable once the return period ends." },
] as const;

/** Read-only explainer of the referral-to-earnings journey. Vertical on mobile, wrapped grid on desktop. */
export function ReferralFlow({ className }: { className?: string }) {
  return (
    <Panel title="How referrals turn into earnings" className={className}>
      <ol className="flex flex-col items-stretch gap-1 p-4 sm:p-5 lg:flex-row lg:items-stretch lg:gap-0">
        {STEPS.map((s, i) => (
          <Fragment key={s.title}>
            <li className="flex flex-1 items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3 transition-colors hover:bg-white lg:flex-col lg:items-start lg:gap-2">
              <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neutral-900 text-white">
                <s.icon className="h-4 w-4" aria-hidden />
                <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-neutral-200 bg-white text-[10px] font-bold text-neutral-700">
                  {i + 1}
                </span>
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-neutral-900">{s.title}</p>
                <p className="text-xs text-neutral-500">{s.text}</p>
              </div>
            </li>
            {i < STEPS.length - 1 && (
              <li aria-hidden className="flex items-center justify-center text-neutral-300 lg:px-1">
                <ArrowDown className={cn("h-4 w-4 lg:hidden")} />
                <ArrowRight className="hidden h-4 w-4 lg:block" />
              </li>
            )}
          </Fragment>
        ))}
      </ol>
    </Panel>
  );
}
