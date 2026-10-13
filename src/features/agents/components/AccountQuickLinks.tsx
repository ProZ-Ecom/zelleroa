import Link from "next/link";
import { ArrowRight, Landmark, Package, ShieldCheck, ShoppingBag, UserRound } from "lucide-react";

function statusChip(status: string) {
  const s = status.toLowerCase();
  if (/(approved|verified|complete)/.test(s)) return { label: status, cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" };
  if (/(pending|review|submitted)/.test(s) && !/not/.test(s)) return { label: status, cls: "bg-amber-50 text-amber-700 ring-amber-200" };
  if (/reject/.test(s)) return { label: status, cls: "bg-red-50 text-red-700 ring-red-200" };
  return { label: status, cls: "bg-neutral-100 text-neutral-600 ring-neutral-200" };
}

/** Personal account shortcuts (shopping, orders, KYC, bank) shown on the profile page. */
export function AccountQuickLinks({ kycStatus, bankStatus }: { kycStatus: string; bankStatus: string }) {
  const items = [
    { href: "/products", title: "Purchase Products", sub: "Shop for yourself", icon: ShoppingBag },
    { href: "/orders", title: "My Orders", sub: "Your purchases & tracking", icon: Package },
    { href: "/agent/profile?step=kyc", title: "KYC Details", status: kycStatus.replace("_", " "), icon: ShieldCheck },
    { href: "/agent/profile?step=bank", title: "Bank Details", status: bankStatus.replace("_", " "), icon: Landmark },
  ];
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-900 text-white">
          <UserRound className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-bold text-neutral-900">My Account & Shopping</h2>
          <p className="text-xs text-neutral-500">Your personal profile and purchases. Your own orders earn no commission.</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {items.map((q) => {
          const Icon = q.icon;
          const chip = q.status ? statusChip(q.status) : null;
          return (
            <Link
              key={q.href}
              href={q.href}
              className="group flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-xs transition-all hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-100 text-neutral-700 transition-colors group-hover:bg-neutral-900 group-hover:text-white">
                  <Icon className="h-4 w-4" />
                </span>
                <ArrowRight className="h-4 w-4 text-neutral-300 transition-all group-hover:translate-x-0.5 group-hover:text-neutral-700" />
              </div>
              <div>
                <p className="text-sm font-semibold text-neutral-900">{q.title}</p>
                {chip ? (
                  <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ring-1 ring-inset ${chip.cls}`}>
                    {chip.label}
                  </span>
                ) : (
                  <p className="mt-0.5 text-xs text-neutral-500">{q.sub}</p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
