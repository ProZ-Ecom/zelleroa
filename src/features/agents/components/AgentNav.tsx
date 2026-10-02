"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Percent,
  Package,
  ShoppingBag,
  ReceiptText,
  ShoppingCart,
  UserRound,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";
import { logoutApi } from "@/features/auth/api/auth.api";

type NavItem = { href: string; label: string; icon: LucideIcon };

const LINKS: NavItem[] = [
  { href: "/agent/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/agent/profile", label: "My Profile", icon: UserRound },
  { href: "/products", label: "Purchase Products", icon: Package },
  { href: "/cart", label: "My Cart", icon: ShoppingCart },
  { href: "/orders", label: "My Orders", icon: ReceiptText },
  { href: "/agent/customers", label: "Customers", icon: Users },
  { href: "/agent/orders", label: "Referral Orders", icon: ShoppingBag },
  { href: "/agent/commissions", label: "Commissions", icon: Percent },
  { href: "/agent/payouts", label: "Payout History", icon: Wallet },
];

const STORAGE_KEY = "agent-sidebar-collapsed";

export function AgentShell({ name, children }: { name: string; children: ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      // storage unavailable
    }
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(STORAGE_KEY, c ? "0" : "1");
      } catch {
        // ignore
      }
      return !c;
    });
  };

  const handleLogout = async () => {
    try {
      await logoutApi();
    } catch {
      // ignore network errors on logout
    }
    await signOut({ callbackUrl: "/login" });
  };

  const initial = name.trim().charAt(0).toUpperCase() || "A";
  const current = LINKS.find((l) => pathname === l.href || pathname.startsWith(`${l.href}/`));

  const renderSidebar = (compact: boolean, mobile: boolean) => (
    <div className="flex h-full flex-col">
      <div className={cn("flex h-16 shrink-0 items-center border-b border-neutral-800 px-4", compact ? "justify-center" : "justify-between")}>
        <Link href="/agent/dashboard" className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-sm font-bold text-neutral-900">
            {APP_NAME.charAt(0)}
          </span>
          {!compact && (
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-white">{APP_NAME}</span>
              <span className="block text-[11px] text-neutral-400">Sales Partner Portal</span>
            </span>
          )}
        </Link>
        {mobile && (
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
            className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Sales Partner navigation">
        {!compact && <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Menu</p>}
        <ul className="flex flex-col gap-1">
          {LINKS.map((l) => {
            const active = l === current;
            const Icon = l.icon;
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  title={compact ? l.label : undefined}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex min-h-[42px] items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                    compact && "justify-center px-0",
                    active ? "bg-white/10 text-white" : "text-neutral-400 hover:bg-white/5 hover:text-white"
                  )}
                >
                  {active && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r bg-white" />}
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  {!compact && <span className="truncate">{l.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="shrink-0 border-t border-neutral-800 p-3">
        <div className={cn("flex items-center gap-3 rounded-lg px-2 py-2", compact && "justify-center px-0")}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-700 text-sm font-bold text-white">
            {initial}
          </span>
          {!compact && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{name}</p>
              <p className="text-[11px] text-neutral-400">Sales Partner</p>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={handleLogout}
          title={compact ? "Sign out" : undefined}
          className={cn(
            "mt-1 flex min-h-[40px] w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-neutral-400 transition-colors hover:bg-red-500/10 hover:text-red-400",
            compact && "justify-center px-0"
          )}
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" />
          {!compact && "Sign out"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden bg-neutral-900 transition-[width] duration-200 lg:block",
          collapsed ? "w-[72px]" : "w-64"
        )}
      >
        {renderSidebar(collapsed, false)}
      </aside>

      {/* Mobile drawer */}
      <div className={cn("fixed inset-0 z-50 lg:hidden", mobileOpen ? "" : "pointer-events-none")} aria-hidden={!mobileOpen}>
        <div
          onClick={() => setMobileOpen(false)}
          className={cn("absolute inset-0 bg-black/50 transition-opacity", mobileOpen ? "opacity-100" : "opacity-0")}
        />
        <aside
          className={cn(
            "absolute inset-y-0 left-0 w-72 max-w-[85%] bg-neutral-900 transition-transform duration-200",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          {renderSidebar(false, true)}
        </aside>
      </div>

      <div className={cn("flex min-h-screen flex-col transition-[padding] duration-200", collapsed ? "lg:pl-[72px]" : "lg:pl-64")}>
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-neutral-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="rounded-lg p-2 text-neutral-700 hover:bg-neutral-100 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden rounded-lg p-2 text-neutral-600 hover:bg-neutral-100 lg:block"
          >
            {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </button>
          <h1 className="min-w-0 flex-1 truncate text-base font-semibold text-neutral-900">{current?.label ?? "Sales Partner Portal"}</h1>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-neutral-600 sm:inline">{name}</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-900 text-sm font-bold text-white">{initial}</span>
          </div>
        </header>
        <main className="flex w-full flex-1 flex-col gap-5 px-4 py-5 sm:px-6 sm:py-6">{children}</main>
      </div>
    </div>
  );
}

export { AgentShell as AgentNav };
