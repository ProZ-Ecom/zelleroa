"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { LOGOS, footerSocialIcons } from "@/constants/storefront";
import { ContactFormModal } from "@/features/contact/components/ContactFormModal";
import { useCustomerCompany } from "@/features/customers/hooks/use-customer-company";
import { getImageUrl } from "@/lib/utils";

const SHOP_LINKS = [
  { label: "Men's Collection", href: "/men" },
  { label: "Women's Wear", href: "/women" },
  { label: "Kids & Teens", href: "/kids" },
  { label: "Accessories & Footwear", href: "/accessories" },
  { label: "New Arrivals", href: "/products" },
  { label: "Offers & Clearance", href: "/products?sortBy=discount" },
];

const ABOUT_LINKS = [
  { label: "About Us", href: "/about" },
  { label: "Terms & Conditions", href: "/terms-and-conditions" },
  { label: "Privacy Policy", href: "/privacy-policy" },
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
            <p className="mt-4 text-sm text-theme-text-subtle">
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
              <li className="italic text-xs pt-1">Coming Soon: Home Living</li>
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
                <Link href="/offers" className="hover:text-theme-primary transition-colors">
                  Offers &amp; Deals
                </Link>
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

          {/* About */}
          <div>
            <h4 className="font-bold text-theme-text-primary">About {companyName}</h4>
            <ul className="mt-4 space-y-2.5 text-sm text-theme-text-subtle">
              {ABOUT_LINKS.map((link) => (
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
            <div className="mt-4 flex items-center gap-3">
              {footerSocialIcons.map((item) => (
                <span
                  key={item.id}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-theme-surface-alt"
                >
                  <Image src={item.icon} alt={item.name} width={16} height={16} />
                </span>
              ))}
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
