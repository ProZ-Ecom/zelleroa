"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  FolderTree,
  Tag,
  ShoppingCart,
  Users,
  Shield,
  BarChart3,
  MessageCircle,
  Megaphone,
  Settings,
  LogOut,
  ChevronRight,
  ChevronLeft,
  Image as ImageIcon,
  BookOpen,
  Truck,
  Star,
  Crown,
  Receipt,
  Hash,
  type LucideIcon,
  Ruler,
  Layers,
  UserCheck,
  Mail,
  PackagePlus,
  HelpCircle,
  Menu,
  Wallet,
  Percent,
  Handshake,
} from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";
import { signOut, useSession } from "next-auth/react";
import { logoutApi } from "@/features/auth/api/auth.api";
import { Drawer } from "@/components/common/drawer";

interface SidebarItem {
  label: string;
  href: string;
  icon: LucideIcon;
  children?: SidebarItem[];
  section?: string;
}

const sidebarItems: SidebarItem[] = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  {
    label: "Sales",
    href: "/admin/dashboard/sales",
    icon: ShoppingCart,
    section: "Operations",
    children: [
      { label: "Orders", href: "/admin/dashboard/orders", icon: ShoppingCart },
      { label: "Bulk Orders", href: "/admin/dashboard/bulk-orders", icon: PackagePlus },
      { label: "Customers", href: "/admin/dashboard/customers", icon: Users },
      { label: "Deliveries", href: "/admin/dashboard/delivery", icon: Truck },
    ],
  },
  {
    label: "Catalog",
    href: "/admin/dashboard/catalog",
    icon: Package,
    children: [
      { label: "Categories", href: "/admin/dashboard/categories", icon: FolderTree },
      { label: "Header Menu", href: "/admin/dashboard/header-menu", icon: Menu },
      { label: "Products", href: "/admin/dashboard/products", icon: Package },
      { label: "Items", href: "/admin/dashboard/styles", icon: Layers },
      { label: "Colors", href: "/admin/dashboard/variants", icon: Layers },
      { label: "Brands", href: "/admin/dashboard/brands", icon: Crown },
      { label: "Attributes", href: "/admin/dashboard/attributes", icon: Tag },
      { label: "Units", href: "/admin/dashboard/units", icon: Ruler },
    ],
  },
  {
    label: "Tax & Compliance",
    href: "/admin/dashboard/tax-compliance",
    icon: Receipt,
    children: [
      { label: "GST Rates", href: "/admin/dashboard/gst-rates", icon: Receipt },
      { label: "HSN Codes", href: "/admin/dashboard/hsn-codes", icon: Hash },
    ],
  },
  {
    label: "Marketing",
    href: "/admin/dashboard/marketing",
    icon: Tag,
    children: [
      { label: "Coupons", href: "/admin/dashboard/coupons", icon: Tag },
      { label: "Offers", href: "/admin/dashboard/offers", icon: Star },
      { label: "Banners", href: "/admin/dashboard/banners", icon: ImageIcon },
    ],
  },
  {
    label: "CMS",
    href: "/admin/dashboard/cms",
    icon: BookOpen,
    children: [
      { label: "Blogs", href: "/admin/dashboard/blogs", icon: BookOpen },
      { label: "FAQs", href: "/admin/dashboard/faqs", icon: HelpCircle },
      { label: "Contact List", href: "/admin/dashboard/contacts", icon: Mail },
    ],
  },
  {
    label: "Agents",
    href: "/admin/dashboard/agents-menu",
    icon: Handshake,
    children: [
      { label: "Agents", href: "/admin/dashboard/agents", icon: UserCheck },
      { label: "Commission Rates", href: "/admin/dashboard/commission-rates", icon: Percent },
      { label: "Commissions", href: "/admin/dashboard/commissions", icon: Receipt },
      { label: "Payouts", href: "/admin/dashboard/agent-payouts", icon: Wallet },
      { label: "Commission Reports", href: "/admin/dashboard/commission-reports", icon: BarChart3 },
    ],
  },
  {
    label: "Team & Access",
    href: "/admin/dashboard/team-access",
    icon: Shield,
    section: "Administration",
    children: [
      { label: "Staff", href: "/admin/dashboard/staff", icon: UserCheck },
      { label: "Users", href: "/admin/dashboard/users", icon: Users },
      { label: "Roles", href: "/admin/dashboard/roles", icon: Shield },
      { label: "Permissions", href: "/admin/dashboard/permissions", icon: Shield },
    ],
  },
  { label: "Reports", href: "/admin/dashboard/reports", icon: BarChart3 },
  {
    label: "WhatsApp",
    href: "/admin/dashboard/whatsapp",
    icon: MessageCircle,
    children: [
      { label: "Overview", href: "/admin/dashboard/whatsapp", icon: LayoutDashboard },
      { label: "Campaigns", href: "/admin/dashboard/whatsapp/campaigns", icon: Megaphone },
      { label: "Templates", href: "/admin/dashboard/whatsapp/templates", icon: Tag },
      { label: "Reports", href: "/admin/dashboard/whatsapp/reports", icon: BarChart3 },
    ],
  },
  { label: "Settings", href: "/admin/dashboard/settings", icon: Settings },
];

const activeRowClasses =
  "relative bg-white text-secondary-600 shadow-sm ring-1 ring-black/[0.04] before:absolute before:left-0 before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-r-full before:bg-secondary-600";
const inactiveRowClasses = "text-neutral-600 hover:bg-white/60 hover:text-neutral-900";

function IconChip({
  icon: Icon,
  active,
  size = "h-4 w-4",
  chipSize = "h-7 w-7",
}: {
  icon: LucideIcon;
  active: boolean;
  size?: string;
  chipSize?: string;
}) {
  return (
    <span
      className={cn(
        "flex flex-shrink-0 items-center justify-center rounded-md transition-all duration-200",
        chipSize,
        active
          ? "bg-secondary-600 text-white shadow-sm"
          : "text-neutral-500 group-hover:bg-black/[0.04] group-hover:text-neutral-700"
      )}
    >
      <Icon className={size} />
    </span>
  );
}

function SidebarItemComponent({
  item,
  pathname,
  onNavigate,
  collapsed,
  onExpandSidebar,
}: {
  item: SidebarItem;
  pathname: string;
  onNavigate?: () => void;
  collapsed?: boolean;
  onExpandSidebar?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(() => {
    if (item.children) {
      return item.children.some(
        (child) => pathname === child.href || pathname.startsWith(child.href + "/")
      );
    }
    return false;
  });

  const isActive =
    pathname === item.href || (item.href !== "/admin/dashboard" && pathname.startsWith(item.href));
  const hasChildren = item.children && item.children.length > 0;

  if (hasChildren) {
    if (collapsed) {
      return (
        <button
          title={item.label}
          onClick={() => {
            onExpandSidebar?.();
            setIsOpen(true);
          }}
          className={cn(
            "group flex w-full items-center justify-center rounded-lg py-2 transition-all duration-200 cursor-pointer",
            isActive ? activeRowClasses : inactiveRowClasses
          )}
        >
          <IconChip icon={item.icon} active={isActive} />
        </button>
      );
    }

    return (
      <div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "group flex w-full items-center gap-2.5 rounded-lg py-2 pl-2 pr-3 text-sm font-medium transition-all duration-200 cursor-pointer",
            isActive ? activeRowClasses : inactiveRowClasses
          )}
        >
          <IconChip icon={item.icon} active={isActive} />
          <span className={cn("flex-1 text-left", isActive && "font-semibold")}>{item.label}</span>
          <ChevronRight
            className={cn(
              "h-4 w-4 flex-shrink-0 transition-transform duration-200",
              isOpen && "rotate-90"
            )}
          />
        </button>
        {isOpen && (
          <div className="mt-1 ml-[1.15rem] space-y-0.5 border-l border-neutral-300/70 pl-3">
            {item.children &&
              item.children.map((child) => {
                const childActive = pathname === child.href;
                return (
                  <Link
                    key={child.href}
                    href={child.href}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-all duration-200",
                      childActive
                        ? "bg-white text-secondary-600 font-medium shadow-sm ring-1 ring-black/[0.04]"
                        : "text-neutral-600 hover:bg-white/60 hover:text-neutral-900 hover:translate-x-0.5"
                    )}
                  >
                    <child.icon className="h-3.5 w-3.5 flex-shrink-0" />
                    {child.label}
                  </Link>
                );
              })}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={cn(
        "group flex items-center gap-2.5 rounded-lg py-2 text-sm font-medium transition-all duration-200",
        collapsed ? "justify-center px-0" : "pl-2 pr-3",
        isActive ? activeRowClasses : inactiveRowClasses
      )}
    >
      <IconChip icon={item.icon} active={isActive} />
      {!collapsed && <span className={isActive ? "font-semibold" : undefined}>{item.label}</span>}
    </Link>
  );
}

function SidebarBrand({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-secondary-900 p-1 shadow-sm ring-1 ring-black/[0.06]">
        <Image
          src="/logo-mark.png"
          alt="Zellora"
          width={64}
          height={64}
          className="h-full w-full object-contain"
        />
      </span>
      {!collapsed && (
        <span className="flex flex-col">
          <span className="font-hanken text-secondary-600 text-base font-bold">
            {APP_NAME} Admin
          </span>
          <span className="text-xs text-neutral-500">Enterprise management</span>
        </span>
      )}
    </div>
  );
}

function SidebarNavigation({
  pathname,
  onNavigate,
  collapsed,
  onExpandSidebar,
}: {
  pathname: string;
  onNavigate?: () => void;
  collapsed?: boolean;
  onExpandSidebar?: () => void;
}) {
  const { data: session } = useSession();
  const userRole = (session?.user as { role?: string })?.role;
  const isStaff = userRole === "STAFF";

  const navigationItems = useMemo(() => {
    return sidebarItems
      .map((item) => {
        if (!item.children) return item;
        const filteredChildren = item.children.filter((child) => {
          if (child.href === "/admin/dashboard/delivery") {
            return isStaff;
          }
          if (child.href === "/admin/dashboard/orders") {
            return !isStaff;
          }
          return true;
        });
        return { ...item, children: filteredChildren };
      })
      .filter((item) => !item.children || item.children.length > 0);
  }, [isStaff]);

  return (
    <nav className="flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden scrollbar-hide px-3 pb-4">
      {navigationItems.map((item) => (
        <div key={item.href}>
          {item.section &&
            (collapsed ? (
              <div className="my-2.5 border-t border-neutral-300/60" />
            ) : (
              <p className="mt-4 mb-1.5 px-2.5 text-[10px] font-semibold tracking-wider text-neutral-500/80 uppercase">
                {item.section}
              </p>
            ))}
          <SidebarItemComponent
            item={item}
            pathname={pathname}
            onNavigate={onNavigate}
            collapsed={collapsed}
            onExpandSidebar={onExpandSidebar}
          />
        </div>
      ))}
    </nav>
  );
}

function SidebarFooter({ collapsed }: { collapsed?: boolean }) {
  const { data: session } = useSession();
  const name = session?.user?.name || "Admin";
  const role = (session?.user as { role?: string })?.role;
  const roleLabel = role ? role.charAt(0) + role.slice(1).toLowerCase() : "Administrator";

  const handleLogout = async () => {
    try {
      await logoutApi();
    } catch {
      // ignore network errors on logout
    }
    await signOut({ callbackUrl: "/admin/login" });
  };

  return (
    <div className="border-t border-neutral-300/70 p-3">
      {!collapsed && (
        <div className="mb-2 flex items-center gap-2.5 rounded-xl bg-white/70 px-2.5 py-2.5 shadow-sm ring-1 ring-black/[0.04]">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-secondary-600 text-xs font-semibold text-white ring-2 ring-white">
            {getInitials(name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-neutral-800">{name}</p>
            <p className="truncate text-xs text-neutral-500">{roleLabel}</p>
          </div>
        </div>
      )}
      <button
        onClick={handleLogout}
        title={collapsed ? "Logout" : undefined}
        className={cn(
          "group flex w-full items-center gap-2.5 rounded-lg py-2 text-sm font-medium text-neutral-600 transition-all duration-200 cursor-pointer hover:bg-white/70 hover:text-secondary-600",
          collapsed ? "justify-center px-0" : "pl-2 pr-3"
        )}
      >
        <LogOut className="h-4 w-4 flex-shrink-0 transition-transform duration-200 group-hover:-translate-x-0.5" />
        {!collapsed && "Logout"}
      </button>
    </div>
  );
}

interface AdminSidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

function AdminSidebar({
  mobileOpen,
  onMobileClose,
  collapsed,
  onToggleCollapse,
}: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <>
      <Drawer
        open={mobileOpen}
        onClose={onMobileClose}
        side="left"
        title={<SidebarBrand />}
        className="w-[280px] max-w-[calc(100vw-2rem)] bg-neutral-50"
      >
        <div className="flex h-full flex-col">
          <SidebarNavigation pathname={pathname} onNavigate={onMobileClose} />
          <SidebarFooter />
        </div>
      </Drawer>
      <aside
        className={cn(
          "relative hidden h-screen flex-col border-r border-neutral-300/80 bg-secondary-100 shadow-[2px_0_12px_-4px_rgba(0,0,0,0.06)] transition-[width] duration-200 lg:flex",
          collapsed ? "w-20" : "w-64"
        )}
      >
        <button
          onClick={onToggleCollapse}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute top-20 -right-3 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-neutral-300 bg-white text-neutral-500 shadow-sm transition-all duration-200 hover:scale-110 hover:text-secondary-600 hover:shadow-md cursor-pointer"
        >
          <ChevronLeft
            className={cn("h-3.5 w-3.5 transition-transform duration-200", collapsed && "rotate-180")}
          />
        </button>
        <div
          className={cn(
            "border-b border-neutral-300/60 p-5 pb-4",
            collapsed && "flex justify-center px-3"
          )}
        >
          <Link href="/admin/dashboard" className="rounded-lg">
            <SidebarBrand collapsed={collapsed} />
          </Link>
        </div>
        <SidebarNavigation
          pathname={pathname}
          collapsed={collapsed}
          onExpandSidebar={onToggleCollapse}
        />
        <SidebarFooter collapsed={collapsed} />
      </aside>
    </>
  );
}

export { AdminSidebar };
