import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Reveal } from "./Reveal";
import { MousePointerClick, Shirt, Headset, ClipboardCheck, ArrowUpRight, Clock } from "lucide-react";

const commitments: { id: string; icon: typeof Shirt; title: string; detail?: string }[] = [
  {
    id: "convenient",
    icon: MousePointerClick,
    title: "A convenient online shopping experience",
  },
  {
    id: "fashion",
    icon: Shirt,
    title: "Fashion products for our customers",
  },
  {
    id: "support",
    icon: Headset,
    title: "Customer care support",
    detail: "10 AM – 6 PM · All days",
  },
  {
    id: "ordering",
    icon: ClipboardCheck,
    title: "A simple and accessible ordering process",
  },
];

/** "Our Commitment" and closing "Thank You" sections of the About page. */
export function AboutFounderSection() {
  return (
    <section className="relative bg-about-founder-bg py-16 sm:py-24 px-6 lg:px-16 overflow-hidden">
      {/* Decorative background */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-60 pointer-events-none [background-image:radial-gradient(var(--primary-200)_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]"
      />
      <div className="about-blob absolute top-20 -left-32 w-96 h-96 rounded-full bg-primary-100 blur-3xl pointer-events-none" />
      <div
        className="about-blob absolute top-40 -right-32 w-96 h-96 rounded-full bg-tertiary-100/70 blur-3xl pointer-events-none"
        style={{ animationDelay: "-6s" }}
      />

      <div className="max-w-7xl mx-auto relative">
        {/* Commitment Header */}
        <Reveal className="flex flex-col items-center text-center max-w-2xl mx-auto mb-10 sm:mb-14">
          <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest text-about-eyebrow uppercase mb-3">
            <span className="w-6 h-0.5 rounded-full bg-tertiary-300" />
            OUR COMMITMENT
            <span className="w-6 h-0.5 rounded-full bg-tertiary-300" />
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-[42px] font-bold text-about-heading leading-[1.2] tracking-tight mb-5">
            A reliable,{" "}
            <span className="text-about-card-icon-fg">customer-focused</span>
            <br className="hidden sm:inline" />
            {" "}fashion business
          </h2>
          <p className="text-about-body text-sm sm:text-base leading-relaxed">
            We are committed to building a reliable and customer-focused online fashion business by providing:
          </p>
        </Reveal>

        {/* Commitment Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {commitments.map((item, index) => {
            const IconComponent = item.icon;
            return (
              <Reveal key={item.id} delay={index * 100}>
              <div
                className="group relative h-full bg-white/90 backdrop-blur-sm border border-about-card-border rounded-2xl p-6 flex flex-col gap-5 shadow-xs overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-about-card-border-hover"
              >
                {/* Top accent bar */}
                <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-about-card-icon-fg to-tertiary-300 scale-x-0 origin-left transition-transform duration-300 group-hover:scale-x-100" />

                <div className="flex items-start justify-between">
                  <div className="relative z-10 w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-400 text-white flex items-center justify-center shadow-lg shadow-primary-500/30 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                    <IconComponent className="w-6 h-6" />
                  </div>
                  <span className="text-3xl font-extrabold text-about-card-border leading-none transition-colors duration-300 group-hover:text-primary-200">
                    0{index + 1}
                  </span>
                </div>
                <p className="relative z-10 text-base font-semibold text-about-heading leading-snug">
                  {item.title}
                </p>
                {item.detail && (
                  <p className="relative z-10 -mt-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-about-card-icon-fg">
                    <Clock className="w-3.5 h-3.5" />
                    {item.detail}
                  </p>
                )}

                {/* Faded corner icon */}
                <IconComponent
                  aria-hidden
                  className="absolute -bottom-4 -right-4 w-24 h-24 text-primary-50 transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6"
                />
              </div>
              </Reveal>
            );
          })}
        </div>

        {/* Thank You Card */}
        <Reveal>
        <div className="relative mt-14 sm:mt-20 overflow-hidden rounded-3xl bg-gradient-to-br from-about-quote-bg via-about-hero-bg-dark to-about-hero-bg text-white p-8 sm:p-12 shadow-2xl">
          {/* Decorations */}
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full border-[28px] border-white/5 pointer-events-none" />
          <div className="absolute -bottom-24 left-1/3 w-56 h-56 rounded-full bg-tertiary-200/10 blur-3xl pointer-events-none" />
          <Image
            src="/logo-mark.png"
            alt=""
            width={220}
            height={220}
            className="absolute -bottom-6 right-6 sm:right-16 w-40 h-40 sm:w-52 sm:h-52 object-contain opacity-10 pointer-events-none"
          />

          <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest text-about-quote-accent uppercase mb-3">
                <span className="w-6 h-0.5 rounded-full bg-about-quote-accent" />
                THANK YOU
              </span>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight mb-4">
                Thank you for choosing{" "}
                <span className="text-about-quote-accent">ZELLORA INDIA.</span>
              </h2>
              <p className="text-about-hero-subtext text-sm sm:text-base leading-relaxed">
                We look forward to serving you and being a part of your fashion journey.
              </p>
            </div>

            <Link
              href="/products"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full bg-about-hero-gold hover:bg-about-hero-gold-hover text-about-hero-btn-dark font-semibold text-sm transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-0.5 shrink-0 self-start lg:self-center"
            >
              Start Shopping
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
        </Reveal>
      </div>
    </section>
  );
}

export default AboutFounderSection;
