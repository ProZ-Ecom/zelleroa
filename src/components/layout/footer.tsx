"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { LOGOS, ICONS } from "@/constants/storefront";
import { ContactFormModal } from "@/features/contact/components/ContactFormModal";
import { useCustomerCompany } from "@/features/customers/hooks/use-customer-company";
import { getImageUrl, cn } from "@/lib/utils";

const SHOP_LINKS = [
  { label: "Men's Collection", href: "/category/men" },
  { label: "Women's Wear", href: "/category/women" },
  { label: "Kids & Teens", href: "/category/kids" },
  { label: "Accessories & Footwear", href: "/category/bags-leather" },
  { label: "New Arrivals", href: "/products" },
  { label: "Offers & Deals", href: "/offers" },
];

const POLICY_LINKS = [
  { label: "About Us", href: "/about" },
  { label: "Terms & Conditions", href: "/terms-and-conditions" },
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Return & Refund Policy", href: "/return-refund-policy" },
  { label: "Shipping & Delivery Policy", href: "/shipping-policy" },
];

const SOCIAL_PLATFORMS = [
  {
    name: "facebook",
    label: "Facebook",
    icon: ICONS.facebook,
    bgClass: "bg-[#1877F2] hover:bg-[#1567d3] shadow-sm shadow-[#1877F2]/25",
    href: "https://facebook.com",
  },
  {
    name: "instagram",
    label: "Instagram",
    icon: ICONS.instagram,
    bgClass: "bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] hover:opacity-90 shadow-sm shadow-pink-500/25",
    href: "https://instagram.com",
  },
  {
    name: "youtube",
    label: "YouTube",
    icon: ICONS.youtube,
    bgClass: "bg-[#FF0000] hover:bg-[#d90000] shadow-sm shadow-red-500/25",
    href: "https://youtube.com",
  },
  {
    name: "whatsapp",
    label: "WhatsApp",
    icon: ICONS.whatsapp1,
    bgClass: "bg-[#25D366] hover:bg-[#1ebc59] shadow-sm shadow-green-500/25",
    href: null,
  },
];

const PAYMENT_METHODS = ["UPI", "Visa", "Mastercard", "RuPay", "NetBanking"];

export function Footer() {
  const [isContactModalOpen, setIsContactModalOpen] = React.useState(false);

  const { data: company } = useCustomerCompany();

  const companyName = company?.companyName?.trim() || "Zellora";
  const companyLogo = company?.logo ? getImageUrl(company.logo) : LOGOS.logo;

  const whatsappLink = React.useMemo(() => {
    const phone = company?.phone?.trim();
    const digits = (phone || "8667380899").replace(/\D/g, "");
    const clean = digits.length === 10 ? `91${digits}` : digits;
    return `https://wa.me/${clean}`;
  }, [company]);

  return (
    <footer className="w-full bg-white border-t border-theme-border">
      {/* Main footer columns */}
      <div className="w-full max-w-[1400px] 2xl:max-w-[1600px] 3xl:max-w-[1800px] mx-auto px-4 sm:px-6 md:px-8 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2">
              <Image src={companyLogo} alt={companyName} width={32} height={32} className="object-contain" />
              <div>
                <p className="text-lg font-extrabold uppercase tracking-tight text-theme-text-primary leading-none">
                  {companyName}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-theme-text-subtle">
                  Lifestyle &amp; Beyond
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm text-theme-text-subtle leading-relaxed">
              Shop smarter. Shop better. Quality essentials and contemporary lifestyle picks
              for every day.
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-theme-text-subtle">
              <ShieldCheck className="h-4 w-4 text-theme-primary" />
              100% Authentic Products
            </div>
          </div>

          {/* Shop */}
          <div>
            <h4 className="font-bold text-theme-text-primary">Shop</h4>
            <ul className="mt-4 space-y-2.5 text-sm text-theme-text-subtle">
              {SHOP_LINKS.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="hover:text-theme-primary transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Customer Service */}
          <div>
            <h4 className="font-bold text-theme-text-primary">Customer Service</h4>
            <ul className="mt-4 space-y-2.5 text-sm text-theme-text-subtle">
              <li>
                <button
                  type="button"
                  onClick={() => setIsContactModalOpen(true)}
                  className="hover:text-theme-primary transition-colors text-left cursor-pointer"
                >
                  Contact Us
                </button>
              </li>
              <li>
                <Link href="/orders" className="hover:text-theme-primary transition-colors">
                  Track Order
                </Link>
              </li>
              <li>
                <Link href="/return-refund-policy" className="hover:text-theme-primary transition-colors">
                  Returns &amp; Refunds
                </Link>
              </li>
              <li>
                <Link href="/faqs" className="hover:text-theme-primary transition-colors">
                  Help &amp; FAQs
                </Link>
              </li>
              <li>
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-theme-primary font-medium hover:text-theme-primary-hover transition-colors"
                >
                  WhatsApp Support
                </a>
              </li>
            </ul>
          </div>

          {/* Policies & Legal */}
          <div>
            <h4 className="font-bold text-theme-text-primary">Policies &amp; Legal</h4>
            <ul className="mt-4 space-y-2.5 text-sm text-theme-text-subtle">
              {POLICY_LINKS.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="hover:text-theme-primary transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Connect */}
          <div>
            <h4 className="font-bold text-theme-text-primary">Connect With Us</h4>
            <p className="mt-2 text-xs text-theme-text-subtle">
              Follow our official channels for new arrivals &amp; exclusive offers.
            </p>
            <div className="mt-4 flex items-center gap-3">
              {SOCIAL_PLATFORMS.map((item) => {
                const targetHref = item.name === "whatsapp" ? whatsappLink : item.href;
                return (
                  <a
                    key={item.name}
                    href={targetHref ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Follow Zellora on ${item.label}`}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full text-white transition-all duration-200 hover:scale-110 cursor-pointer",
                      item.bgClass
                    )}
                  >
                    <Image
                      src={item.icon}
                      alt={item.label}
                      width={17}
                      height={17}
                      className="object-contain"
                    />
                  </a>
                );
              })}
            </div>
            <div className="mt-5 space-y-1 text-xs text-theme-text-subtle">
              <p className="font-semibold text-theme-text-primary">Customer Support</p>
              <p>
                <a href="mailto:support@zellora.com" className="hover:text-theme-primary transition-colors">
                  support@zellora.com
                </a>
              </p>
              <p>Mon – Sun: 10:00 AM – 6:00 PM</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-theme-border">
        <div className="w-full max-w-[1400px] 2xl:max-w-[1600px] 3xl:max-w-[1800px] mx-auto px-4 sm:px-6 md:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-theme-text-subtle">
          <p>
            © {new Date().getFullYear()} {companyName}. All Rights Reserved. Built for
            contemporary lifestyle.
          </p>
          <div className="flex items-center gap-4 font-semibold uppercase tracking-wide">
            {PAYMENT_METHODS.map((method) => (
              <span key={method}>{method}</span>
            ))}
          </div>
        </div>
      </div>

      <ContactFormModal
        open={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
      />
    </footer>
  );
}

export default Footer;
