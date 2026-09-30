import React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  Compass,
  ShoppingBag,
  Headset,
  CircleCheckBig,
  Users,
  MousePointerClick,
} from "lucide-react";
import { AboutFashionIllustration } from "./AboutFashionIllustration";

const features = [
  { icon: MousePointerClick, label: "Easy online shopping" },
  { icon: Users, label: "Sales Partner network" },
  { icon: Headset, label: "Customer care, all days" },
];

export function AboutHeroSection() {
  return (
    <section className="relative bg-gradient-to-br from-about-hero-bg-dark via-about-hero-bg to-primary-500 text-white pt-12 pb-16 sm:pt-16 sm:pb-20 lg:pt-20 lg:pb-24 px-6 lg:px-16 overflow-hidden">
      {/* Animated glow blobs */}
      <div className="about-blob absolute -top-32 -left-20 w-[28rem] h-[28rem] rounded-full bg-primary-400/40 blur-3xl pointer-events-none" />
      <div
        className="about-blob absolute -bottom-40 right-0 w-[30rem] h-[30rem] rounded-full bg-tertiary-200/15 blur-3xl pointer-events-none"
        style={{ animationDelay: "-7s" }}
      />
      {/* Dot grid pattern */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.08] pointer-events-none [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]"
      />

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-14 lg:gap-16 items-center">
          {/* Left Column: Heading, Subtext & CTAs */}
          <div className="lg:col-span-6 flex flex-col items-start text-left">
            {/* Pill Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-about-hero-badge-border bg-white/10 backdrop-blur-md text-white text-[11px] sm:text-xs tracking-widest uppercase font-semibold mb-6 shadow-lg">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-tertiary-200 opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-tertiary-200" />
              </span>
              ABOUT ZELLORA INDIA
            </div>

            {/* Main Title */}
            <h1 className="text-4xl sm:text-5xl lg:text-[64px] text-white font-extrabold leading-[1.05] tracking-tight">
              Welcome to
              <br />
              <span className="about-shine-text italic">ZELLORA INDIA</span>
            </h1>

            {/* Subtext */}
            <p className="text-about-hero-subtext text-base sm:text-lg leading-relaxed max-w-md mt-6 mb-8">
              An online-based fashion business focused on bringing fashion products to customers through a convenient and accessible online shopping experience.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/products"
                className="group inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-about-hero-gold hover:bg-about-hero-gold-hover text-about-hero-btn-dark font-semibold text-sm transition-all duration-300 shadow-xl shadow-primary-900/30 hover:-translate-y-0.5 cursor-pointer"
              >
                Explore Products
                <ArrowUpRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>

              <a
                href="#our-business"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full border border-about-hero-border bg-white/10 hover:bg-white/20 text-white font-medium text-sm transition-all duration-300 backdrop-blur-md cursor-pointer"
              >
                <Compass className="w-4 h-4" />
                Our business
              </a>
            </div>

            {/* Feature row */}
            <ul className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-xl">
              {features.map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  className="flex items-center gap-2.5 rounded-2xl border border-white/15 bg-white/[0.07] backdrop-blur-md px-3 py-2.5"
                >
                  <span className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-tertiary-100" />
                  </span>
                  <span className="text-xs font-medium text-white/90 leading-tight">{label}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Right Column: Illustration Panel with Floating Cards */}
          <div className="lg:col-span-6">
            <div className="relative w-full max-w-lg lg:max-w-none mx-auto">
              {/* Rotated backdrop card */}
              <div className="absolute inset-0 rotate-3 rounded-[2rem] bg-white/10 border border-white/15 pointer-events-none" />

              <div className="relative rounded-[2rem] overflow-hidden shadow-2xl shadow-primary-900/40 border border-white/20 aspect-[4/3] w-full bg-white/10 backdrop-blur-xl flex items-center justify-center">
                <div className="absolute w-2/3 aspect-square rounded-full bg-primary-300/30 blur-3xl pointer-events-none" />
                <AboutFashionIllustration className="about-float relative w-[85%] sm:w-[78%] sm:mt-8 h-auto drop-shadow-2xl" />
                <div className="absolute top-6 right-6 sm:top-8 sm:right-8 hidden sm:flex items-center gap-2">
                  <Image
                    src="/logo-mark.png"
                    alt=""
                    width={40}
                    height={40}
                    className="w-8 h-8 object-contain"
                    priority
                  />
                  <span className="text-tertiary-100 text-xs font-bold tracking-[0.25em] uppercase">
                    Zellora India
                  </span>
                </div>
              </div>

              {/* Floating glass card: customer care */}
              <div
                className="about-float absolute -top-5 -left-3 sm:-left-8 z-10 flex items-center gap-3 rounded-2xl bg-white/95 text-about-heading px-4 py-3 shadow-2xl"
                style={{ animationDelay: "-2s" }}
              >
                <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-400 text-white flex items-center justify-center shadow-md">
                  <Headset className="w-4 h-4" />
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-bold leading-tight">Customer care</span>
                  <span className="text-[11px] font-semibold text-about-card-icon-fg">10 AM – 6 PM · All days</span>
                </span>
              </div>

              {/* Floating glass card: simple ordering */}
              <div
                className="about-float absolute -bottom-6 right-2 sm:-right-6 z-10 flex items-center gap-3 rounded-2xl bg-white/95 text-about-heading px-4 py-3 shadow-2xl"
                style={{ animationDelay: "-4s" }}
              >
                <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-tertiary-200 to-tertiary-300 text-tertiary-900 flex items-center justify-center shadow-md">
                  <CircleCheckBig className="w-4 h-4" />
                </span>
                <span className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider text-about-body font-semibold">Accessible</span>
                  <span className="text-sm font-bold leading-tight">Simple ordering</span>
                </span>
              </div>

              {/* Floating Circular Badge */}
              <div className="absolute -bottom-8 -left-5 sm:-bottom-10 sm:-left-8 z-10 w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-about-hero-circle-bg text-about-hero-btn-dark flex flex-col items-center justify-center text-center p-2 shadow-xl border-4 border-white/80 select-none">
                <ShoppingBag className="w-5 h-5 text-about-hero-btn-dark mb-1" />
                <span className="text-[10px] sm:text-xs font-bold tracking-wider leading-tight uppercase">
                  SHOP
                  <br />
                  ONLINE
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default AboutHeroSection;
