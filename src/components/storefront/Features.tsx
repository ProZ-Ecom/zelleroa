import { Truck, PackageCheck, Lock, BadgeCheck } from "lucide-react";

const FEATURES = [
  {
    icon: Truck,
    iconClass: "bg-theme-primary-light text-theme-primary",
    title: "Fast Delivery",
    description: "Get your products delivered quickly and safely right to your doorstep.",
  },
  {
    icon: PackageCheck,
    iconClass: "bg-amber-100 text-amber-700",
    title: "Easy Returns",
    description:
      "Simple, transparent, and hassle-free 3-day returns with instant refund tracking.",
  },
  {
    icon: Lock,
    iconClass: "bg-theme-surface-alt text-theme-text-subtle",
    title: "Secure Payments",
    description:
      "Your payments are 100% protected with encrypted UPI, Cards, NetBanking, and COD options.",
  },
  {
    icon: BadgeCheck,
    iconClass: "bg-theme-primary-light text-theme-primary",
    title: "Quality Products",
    description:
      "Every single piece is hand-checked for stitching, fabric durability, and finishing before dispatch.",
  },
];

export function Features() {
  return (
    <section className="w-full bg-white">
      <div className="w-full max-w-[1400px] 2xl:max-w-[1600px] 3xl:max-w-[1800px] mx-auto px-4 sm:px-6 md:px-8 py-10 sm:py-14">
        <div className="text-center">
          <span className="text-xs font-bold uppercase tracking-wide text-theme-primary">
            The Zellora Standard
          </span>
          <h2 className="mt-1 text-3xl sm:text-4xl font-extrabold uppercase tracking-tight text-theme-text-primary">
            Why Zellora?
          </h2>
          <p className="mt-2 text-sm text-theme-text-subtle">
            Built for trust, convenience, and uncompromising quality.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {FEATURES.map(({ icon: Icon, iconClass, title, description }) => (
            <div
              key={title}
              className="rounded-xl border border-theme-border bg-white p-6"
            >
              <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${iconClass}`}>
                <Icon className="h-5 w-5" strokeWidth={2} />
              </div>
              <h3 className="mt-4 text-base font-bold text-theme-text-primary">{title}</h3>
              <p className="mt-1.5 text-sm text-theme-text-subtle">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Features;
