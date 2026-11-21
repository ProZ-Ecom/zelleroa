"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { LOGOS, ICONS } from "@/constants/storefront";
import { ContactFormModal } from "@/features/contact/components/ContactFormModal";
import { useCustomerCompany } from "@/features/customers/hooks/use-customer-company";
import { cn } from "@/lib/utils";

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
    defaultHref: "https://facebook.com",
  },
  {
    name: "instagram",
    label: "Instagram",
    icon: ICONS.instagram,
    bgClass: "bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] hover:opacity-90 shadow-sm shadow-pink-500/25",
    defaultHref: "https://instagram.com",
  },
  {
    name: "youtube",
    label: "YouTube",
    icon: ICONS.youtube,
    bgClass: "bg-[#FF0000] hover:bg-[#d90000] shadow-sm shadow-red-500/25",
    defaultHref: "https://youtube.com",
  },
  {
    name: "whatsapp",
    label: "WhatsApp",
    icon: ICONS.whatsapp1,
    bgClass: "bg-[#25D366] hover:bg-[#1ebc59] shadow-sm shadow-green-500/25",
    defaultHref: null,
  },
];

const PAYMENT_METHODS = ["UPI", "Visa", "Mastercard", "RuPay", "NetBanking"];

interface FooterLinkProps extends React.ComponentProps<typeof Link> {
  children: React.ReactNode;
}

function FooterLink({ href, onClick, children, ...props }: FooterLinkProps) {
  const pathname = usePathname();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented) return;

    if (typeof window !== "undefined") {
      const hrefStr = typeof href === "string" ? href : href.pathname || "";
      const targetPath = hrefStr.split("?")[0].split("#")[0];
      const normalizePath = (p: string) => (p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p);

      if (normalizePath(pathname || "") === normalizePath(targetPath)) {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: "smooth" });
        document.documentElement.scrollTo?.({ top: 0, behavior: "smooth" });
        document.body.scrollTo?.({ top: 0, behavior: "smooth" });
      } else {
        window.scrollTo({ top: 0, behavior: "instant" });
      }
    }
  };

  return (
    <Link href={href} onClick={handleClick} scroll={true} {...props}>
      {children}
    </Link>
  );
}

export function Footer() {
  const [isContactModalOpen, setIsContactModalOpen] = React.useState(false);

  const { data: company } = useCustomerCompany();

  const companyName = company?.companyName?.trim() || "Zellora";
  const socialLinks = company?.socialLinks;

  const whatsappLink = React.useMemo(() => {
    const custom = socialLinks?.whatsapp?.trim();
    if (custom) {
      if (custom.startsWith("http://") || custom.startsWith("https://")) {
        return custom;
      }
      const digits = custom.replace(/\D/g, "");
      if (digits) {
        const clean = digits.length === 10 ? `91${digits}` : digits;
        return `https://wa.me/${clean}`;
      }
    }
    const phone = company?.phone?.trim();
    const digits = (phone || "8667380899").replace(/\D/g, "");
    const clean = digits.length === 10 ? `91${digits}` : digits;
    return `https://wa.me/${clean}`;
  }, [company?.phone, socialLinks?.whatsapp]);

  const resolvedSocialPlatforms = React.useMemo(() => {
    const normalizeUrl = (url?: string | null) => {
      if (!url || !url.trim()) return null;
      const t = url.trim();
      return t.startsWith("http://") || t.startsWith("https://") ? t : `https://${t}`;
    };

    const list: Array<{
      name: string;
      label: string;
      icon: string | null;
      bgClass: string;
      href: string;
    }> = [];

    for (const platform of SOCIAL_PLATFORMS) {
      let targetHref: string | null = null;
      if (platform.name === "whatsapp") {
        targetHref = whatsappLink;
      } else if (platform.name === "facebook") {
        targetHref = normalizeUrl(socialLinks?.facebook) ?? (socialLinks ? null : platform.defaultHref);
      } else if (platform.name === "instagram") {
        targetHref = normalizeUrl(socialLinks?.instagram) ?? (socialLinks ? null : platform.defaultHref);
      } else if (platform.name === "youtube") {
        targetHref = normalizeUrl(socialLinks?.youtube) ?? (socialLinks ? null : platform.defaultHref);
      }

      if (targetHref) {
        list.push({
          name: platform.name,
          label: platform.label,
          icon: platform.icon,
          bgClass: platform.bgClass,
          href: targetHref,
        });
      }
    }

    if (socialLinks?.twitter?.trim()) {
      const twitterUrl = normalizeUrl(socialLinks.twitter);
      if (twitterUrl) {
        list.push({
          name: "twitter",
          label: "X (Twitter)",
          icon: null,
          bgClass: "bg-black hover:bg-neutral-800 shadow-sm shadow-black/25",
          href: twitterUrl,
        });
      }
    }

    return list;
  }, [socialLinks, whatsappLink]);

  return (
    <footer className="w-full bg-white border-t border-theme-border">
      {/* Main footer columns */}
      <div className="w-full max-w-[1400px] 2xl:max-w-[1600px] 3xl:max-w-[1800px] mx-auto px-4 sm:px-6 md:px-8 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <FooterLink href="/" className="inline-flex items-center gap-2 select-none group">
              <Image
                src={LOGOS.logo}
                alt="Zellora logo"
                width={100}
                height={100}
                className="h-8 sm:h-9 w-auto aspect-square object-contain group-hover:scale-105 transition-transform duration-300 shrink-0"
              />
              <Image
                src={LOGOS.title}
                alt="Zellora"
                width={160}
                height={48}
                className="h-7 sm:h-8 w-auto object-contain group-hover:scale-105 transition-transform duration-300 shrink-0"
              />
            </FooterLink>
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
                  <FooterLink href={link.href} className="hover:text-theme-primary transition-colors">
                    {link.label}
                  </FooterLink>
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
                <FooterLink href="/orders" className="hover:text-theme-primary transition-colors">
                  Track Order
                </FooterLink>
              </li>
              <li>
                <FooterLink href="/return-refund-policy" className="hover:text-theme-primary transition-colors">
                  Returns &amp; Refunds
                </FooterLink>
              </li>
              <li>
                <FooterLink href="/faqs" className="hover:text-theme-primary transition-colors">
                  Help &amp; FAQs
                </FooterLink>
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
                  <FooterLink href={link.href} className="hover:text-theme-primary transition-colors">
                    {link.label}
                  </FooterLink>
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
              {resolvedSocialPlatforms.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Follow Zellora on ${item.label}`}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full text-white transition-all duration-200 hover:scale-110 cursor-pointer",
                    item.bgClass
                  )}
                >
                  {item.icon ? (
                    <Image
                      src={item.icon}
                      alt={item.label}
                      width={17}
                      height={17}
                      className="object-contain"
                    />
                  ) : (
                    <svg className="w-3.5 h-3.5 fill-current text-white" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  )}
                </a>
              ))}
            </div>
            <div className="mt-5 space-y-1.5 text-xs text-theme-text-subtle">
              <p className="font-semibold text-theme-text-primary">Customer Support</p>
              <p className="text-theme-text-muted">
                For any enquiries or assistance, reach us at:
              </p>
              <p>
                <a href="mailto:support@zellora.com" className="font-medium text-theme-primary hover:underline transition-colors">
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
