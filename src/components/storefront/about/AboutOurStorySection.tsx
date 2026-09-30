import React from "react";
import { Store, Users, ShoppingCart, CheckCircle2 } from "lucide-react";
import { Reveal } from "./Reveal";

const flow = [
  {
    id: "zellora",
    icon: Store,
    title: "ZELLORA INDIA",
    description: "Brings fashion products online.",
  },
  {
    id: "partner",
    icon: Users,
    title: "Sales Partners",
    description: "Promote our products and receive customer orders.",
  },
  {
    id: "customer",
    icon: ShoppingCart,
    title: "Customers",
    description: "Explore our products and place orders through the available online channels.",
  },
];

const highlights = [
  "Online-based fashion business",
  "Sales Partner network",
  "Smooth, simple ordering",
];

export function AboutOurStorySection() {
  return (
    <section
      id="our-business"
      className="relative bg-about-story-bg py-16 sm:py-24 px-6 lg:px-16 overflow-hidden scroll-mt-20"
    >
      {/* Soft background accents */}
      <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-about-card-icon-bg blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -left-24 w-72 h-72 rounded-full bg-theme-secondary-light blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto relative">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left Column: Business Text */}
          <Reveal className="lg:col-span-6 flex flex-col items-start text-left">
            {/* Eyebrow */}
            <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest text-about-eyebrow uppercase mb-3">
              <span className="w-6 h-0.5 rounded-full bg-tertiary-300" />
              OUR BUSINESS
            </span>

            {/* Heading */}
            <h2 className="text-3xl sm:text-4xl lg:text-[42px] font-bold text-about-heading leading-[1.2] tracking-tight mb-5">
              Fashion, connected through our{" "}
              <span className="text-about-card-icon-fg">Sales Partners</span>
            </h2>

            {/* Description */}
            <div className="space-y-4 text-about-body text-sm sm:text-base leading-relaxed">
              <p>
                ZELLORA INDIA operates through an online-based business model where our fashion products are promoted through our Sales Partner network. Customers can explore our products and place orders through the available online channels.
              </p>
              <p>
                We promote our products and receive customer orders through our Sales Partners, who play an important role in connecting our products with customers.
              </p>
              <p>
                We aim to provide customers with a smooth and simple shopping experience, from discovering our products to placing their orders.
              </p>
            </div>

            {/* Highlights */}
            <ul className="flex flex-wrap gap-2.5 mt-7">
              {highlights.map((item) => (
                <li
                  key={item}
                  className="inline-flex items-center gap-1.5 rounded-full border border-about-card-border bg-white px-3.5 py-1.5 text-xs sm:text-sm font-medium text-about-heading shadow-xs"
                >
                  <CheckCircle2 className="w-4 h-4 text-about-card-icon-fg" />
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>

          {/* Right Column: How It Works Flow */}
          <Reveal className="lg:col-span-6" delay={150}>
            <div className="relative w-full max-w-lg mx-auto">
              <div className="absolute inset-0 translate-x-3 translate-y-3 rounded-3xl bg-about-card-icon-fg/10 pointer-events-none" />
              <div className="relative bg-white border border-about-card-border rounded-3xl p-6 sm:p-8 shadow-xl">
                <div className="flex items-center justify-between mb-6">
                  <span className="text-[11px] tracking-widest text-about-eyebrow font-bold uppercase">
                    HOW IT WORKS
                  </span>
                  <span className="text-[11px] font-semibold text-about-body">3 simple steps</span>
                </div>

                <ol className="relative flex flex-col gap-5">
                  {/* Connector line */}
                  <span
                    aria-hidden
                    className="absolute left-[22px] top-6 bottom-6 w-0.5 bg-gradient-to-b from-about-card-icon-fg via-tertiary-300 to-about-card-icon-fg opacity-40"
                  />
                  {flow.map((step, index) => {
                    const IconComponent = step.icon;
                    return (
                      <li key={step.id} className="relative flex items-start gap-4 group">
                        <div className="relative z-10 w-11 h-11 rounded-xl bg-about-card-icon-fg text-white flex items-center justify-center shrink-0 shadow-md ring-4 ring-white transition-transform duration-300 group-hover:scale-110">
                          <IconComponent className="w-5 h-5" />
                          <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-tertiary-200 text-tertiary-900 text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
                            {index + 1}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0 rounded-xl border border-about-card-border bg-about-card-bg px-4 py-3 transition-all duration-300 group-hover:border-about-card-border-hover group-hover:bg-white group-hover:shadow-md">
                          <p className="text-sm sm:text-base font-bold text-about-heading">
                            {step.title}
                          </p>
                          <p className="text-xs sm:text-sm text-about-body leading-relaxed mt-0.5">
                            {step.description}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

export default AboutOurStorySection;
