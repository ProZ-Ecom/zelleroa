"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { LogIn, Search, Heart, ShoppingCart } from "lucide-react";
import { LOGOS, ICONS, mobileBottomIcons } from "@/constants/storefront";
import { NavButton } from "@/components/storefront/buttons/NavButton";
import { IconButton } from "@/components/storefront/buttons/IconButton";
import { getRoleHome } from "@/lib/auth/role-routes";
import { useClickOutside } from "@/hooks/useClickOutside";
import { getInitials } from "@/lib/utils";
import { useCustomerWishlistCount } from "@/features/customers/hooks/use-customer-wishlist";
import { useCustomerCartCount } from "@/features/customers/hooks/use-customer-cart";
import { useCustomerProfile } from "@/features/customers/hooks/use-customer-profile";
import { useHeaderMenu } from "@/features/header-menu/hooks";
import { categoryHref } from "@/features/customers/utils/catalog-listing-query";
import type { CategoryTreeNode } from "@/features/categories/types";
import type { HeaderNavItem } from "@/features/header-menu/types";
import { MegaMenuTrigger, MegaMenuPanel, type NavNode } from "./MegaMenu";
import { MobileCategoryAccordion } from "./MobileCategoryAccordion";

/** True when the current page is this category's listing or one of its descendants'. */
function isInCategoryTree(node: CategoryTreeNode, pathname: string): boolean {
  return (
    pathname.toLowerCase() === categoryHref(node).toLowerCase() ||
    node.children.some((child) => isInCategoryTree(child, pathname))
  );
}

/** True when the current page matches any of this nav item's category subtrees, or its plain link. */
function isNavItemActive(item: HeaderNavItem, pathname: string): boolean {
  if (item.categories.some((c) => isInCategoryTree(c, pathname))) return true;
  return item.link ? pathname === item.link : false;
}

/**
 * Builds the node MegaMenu/MobileCategoryAccordion render for a nav item that
 * carries one or more categories. A single category behaves exactly as
 * before (its own real page + subtree, with the admin's label as display
 * text); two or more are grouped into one synthetic dropdown, clicking
 * through to the item's own link (or /products as a safe fallback).
 */
function buildNavNode(item: HeaderNavItem): NavNode {
  if (item.categories.length === 1 && !item.link) {
    return { ...item.categories[0], name: item.label, gender: item.gender };
  }
  return {
    id: item.id,
    name: item.label,
    slug: "",
    icon: null,
    children: item.categories,
    href: item.link ?? "/products",
    gender: item.gender,
  };
}

export function Header() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const [openNavId, setOpenNavId] = React.useState<string | null>(null);
  const megaMenuCloseTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelMegaMenuClose = React.useCallback(() => {
    if (megaMenuCloseTimer.current) clearTimeout(megaMenuCloseTimer.current);
  }, []);
  const scheduleMegaMenuClose = React.useCallback(() => {
    cancelMegaMenuClose();
    megaMenuCloseTimer.current = setTimeout(() => setOpenNavId(null), 150);
  }, [cancelMegaMenuClose]);
  const openMegaMenu = React.useCallback(
    (id: string) => {
      cancelMegaMenuClose();
      setOpenNavId(id);
    },
    [cancelMegaMenuClose]
  );
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated";
  // Admin/staff manage the store from /admin; they have no customer account,
  // wishlist or purchase UI, so those entry points are role-aware.
  const userRole = (session?.user as { role?: string } | undefined)?.role;
  const isStaffUser = userRole === "ADMIN" || userRole === "STAFF";
  const accountHref = isAuthenticated ? getRoleHome(userRole) : "/login";
  // `status` is "loading" until /api/auth/session resolves on every page load.
  // Treating that as logged-out would flash the Login button at signed-in users,
  // so the account cell renders a placeholder until the session is known.
  // If that request is slow or down, fall back to the signed-out UI rather than
  // stranding the user behind a skeleton with nothing to click.
  const [authGraceExpired, setAuthGraceExpired] = React.useState(false);
  React.useEffect(() => {
    if (status !== "loading") return;
    const timer = setTimeout(() => setAuthGraceExpired(true), 1500);
    return () => clearTimeout(timer);
  }, [status]);
  const isAuthLoading = status === "loading" && !authGraceExpired;
  const { data: profile } = useCustomerProfile({ enabled: isAuthenticated && !isStaffUser });

  // Get user name and initials for authenticated header state
  const userName = profile?.name || session?.user?.name || "";
  const userInitials = React.useMemo(() => {
    if (userName && userName.trim().length > 0) {
      return getInitials(userName) || "U";
    }
    if (session?.user?.email) {
      return session.user.email.slice(0, 2).toUpperCase();
    }
    return "U";
  }, [userName, session?.user?.email]);

  // Wishlist requires an account; cart works for guests too (guest-session cookie).
  const { data: wishlistCount = 0 } = useCustomerWishlistCount({ enabled: isAuthenticated && !isStaffUser });
  const { data: cartCountData } = useCustomerCartCount();
  const cartCount =
    typeof cartCountData === "number"
      ? cartCountData
      : (cartCountData as { count?: number; totalQuantity?: number })?.totalQuantity ??
        (cartCountData as { count?: number })?.count ??
        0;

  // Curated, admin-managed nav items (category-linked or plain custom links)
  // drive both the desktop mega-menu and the mobile accordion.
  const { data: headerMenu = [], isLoading: isCategoriesLoading } = useHeaderMenu();

  const menuRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLDivElement>(null);

  useClickOutside([menuRef, buttonRef], () => {
    setIsOpen(false);
  });

  React.useEffect(() => {
    if (!openNavId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenNavId(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openNavId]);

  const resolvePath = React.useCallback(
    (item: { id: number; path?: string; alt?: string; text?: string }) => {
      const isUser =
        item.alt === "user" || item.text === "Account" || item.path === "/profile";
      const isWishlist =
        item.alt === "wishlist" || item.text === "Wishlist" || item.path === "/wishlist";
      const isCart =
        item.alt === "cart" || item.text === "Cart" || item.path === "/cart";

      if (isUser) {
        return accountHref;
      }
      if (isWishlist) {
        return isAuthenticated ? "/wishlist" : "/login?callbackUrl=/wishlist";
      }
      if (isCart) {
        // Guests can view/checkout their cart too - no login gate here.
        return "/cart";
      }
      return item.path || "/";
    },
    [isAuthenticated, accountHref]
  );

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    router.push(`/products?search=${encodeURIComponent(trimmed)}`);
    setIsSearchOpen(false);
  };

  React.useEffect(() => {
    if (isSearchOpen) searchInputRef.current?.focus();
  }, [isSearchOpen]);

  const wishlistHref = isAuthenticated ? "/wishlist" : "/login?callbackUrl=/wishlist";

  const openNavItem = headerMenu.find(
    (item) => item.id === openNavId && item.categories.length > 0
  );

  return (
    <>
      {/* Top promo bar */}
      <div className="w-full bg-[var(--brown-600)] text-white text-[11px] sm:text-xs font-medium">
        <div className="w-full max-w-[1400px] 2xl:max-w-[1600px] 3xl:max-w-[1800px] mx-auto px-4 sm:px-6 md:px-8 h-8 flex items-center justify-center gap-2 sm:gap-6 text-center">
          <span className="truncate">Free Delivery Across Tamil Nadu · ₹80 for Other States</span>
          <span className="hidden sm:inline text-white/40">|</span>
          <span className="hidden sm:inline truncate">Delivered in 3–7 Days</span>
          <span className="hidden md:inline text-white/40">|</span>
          <span className="hidden md:inline truncate">Easy 3-Day Hassle-Free Returns</span>
        </div>
      </div>

      <header className="sticky top-0 z-50 w-full bg-white shadow-xs header-font">
      <div className="w-full max-w-[1400px] 2xl:max-w-[1600px] 3xl:max-w-[1800px] mx-auto h-20 sm:h-24 px-4 sm:px-6 md:px-8 flex items-center justify-between">
        {/* Left Section (Logo + Brand Title) */}
        <div className="flex items-center gap-1 sm:gap-2 md:gap-3">
          <Link href="/" className="inline-block">
            <Image
              src={LOGOS.logo}
              alt="logo"
              width={100}
              height={100}
              priority
              className="w-[55px] sm:w-[65px] md:w-[80px] hover:scale-105 transition-transform duration-300 active:scale-95"
            />
          </Link>

          {/* Mobile Title */}
          <Link href="/" className="block md:hidden">
            <Image
              src={LOGOS.mobileTitle}
              alt="mobile title"
              width={80}
              height={40}
              priority
              className="w-[95px] sm:w-[120px] h-auto hover:scale-105 transition-transform duration-300"
            />
          </Link>

          {/* Desktop Title */}
          <Link href="/" className="hidden md:block">
            <Image
              src={LOGOS.title}
              alt="title"
              width={80}
              height={80}
              priority
              className="w-auto h-auto hover:scale-105 transition-transform duration-300"
            />
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-1">
          <Link
            href="/"
            className={`rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
              pathname === "/"
                ? "bg-theme-primary text-theme-primary-fg font-semibold"
                : "text-hover-primary hover:text-theme-primary"
            }`}
          >
            Home
          </Link>

          {isCategoriesLoading ? (
            <div className="flex items-center gap-2" aria-hidden="true">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={`nav-skel-${n}`}
                  className="h-8 w-20 rounded-full bg-theme-surface-alt animate-pulse"
                />
              ))}
            </div>
          ) : (
            headerMenu.map((item) =>
              item.categories.length > 0 ? (
                <MegaMenuTrigger
                  key={item.id}
                  root={buildNavNode(item)}
                  isActive={isNavItemActive(item, pathname)}
                  isOpen={openNavId === item.id}
                  onMouseEnter={() => openMegaMenu(item.id)}
                  onMouseLeave={scheduleMegaMenuClose}
                  onFocus={() => openMegaMenu(item.id)}
                />
              ) : (
                <Link
                  key={item.id}
                  href={item.link ?? "#"}
                  className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
                    isNavItemActive(item, pathname)
                      ? "bg-theme-primary text-theme-primary-fg font-semibold"
                      : "text-red-600 hover:bg-red-50"
                  }`}
                >
                  {item.label}
                </Link>
              )
            )
          )}
        </nav>

        {/* Right Section (Icons & Hamburger) */}
        <div className="flex items-center gap-2 sm:gap-3 md:gap-5">
          <div className="hidden lg:flex items-center gap-5">
            {/* Inline search */}
            <form onSubmit={handleSearchSubmit} className="relative flex items-center">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onBlur={() => {
                  if (!searchQuery.trim()) setIsSearchOpen(false);
                }}
                placeholder="Search"
                className={`h-9 pl-3 pr-9 rounded-full border border-theme-border bg-theme-surface-alt text-sm text-theme-text-primary placeholder:text-theme-text-subtle outline-none focus:border-theme-primary transition-all duration-200 overflow-hidden ${
                  isSearchOpen ? "w-40 xl:w-56 opacity-100" : "w-0 px-0 border-transparent opacity-0"
                }`}
              />
              <button
                type={isSearchOpen ? "submit" : "button"}
                onClick={() => {
                  if (!isSearchOpen) setIsSearchOpen(true);
                }}
                aria-label="Search"
                className={`flex items-center justify-center text-neutral-700 hover:text-theme-primary transition-colors ${
                  isSearchOpen ? "absolute right-2.5" : "static"
                }`}
              >
                <Search className="h-[18px] w-[18px]" strokeWidth={1.75} />
              </button>
            </form>

            {/* Wishlist */}
            {!isStaffUser && (
            <Link
              href={wishlistHref}
              aria-label="Wishlist"
              className="relative flex items-center text-neutral-700 hover:text-theme-primary transition-colors"
            >
              <Heart className="h-[18px] w-[18px]" strokeWidth={1.75} />
              {wishlistCount > 0 && (
                <span className="absolute -top-2 -right-2 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-theme-status-can-fg text-white text-[10px] font-bold">
                  {wishlistCount > 99 ? "99+" : wishlistCount}
                </span>
              )}
            </Link>
            )}

            {/* Cart */}
            {!isStaffUser && (
            <Link
              href="/cart"
              aria-label="Cart"
              className="relative flex items-center text-neutral-700 hover:text-theme-primary transition-colors"
            >
              <ShoppingCart className="h-[18px] w-[18px]" strokeWidth={1.75} />
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-theme-primary text-white text-[10px] font-bold">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </Link>
            )}

            {/* Account */}
            {/* The account cell is the last item in a right-anchored row, so the
                Login pill (~92px) collapsing to the 26px avatar would drag every
                icon beside it. A fixed slot keeps the swap contained: siblings
                never move, whichever state wins. */}
            <div
              className={`flex justify-end ${
                isAuthLoading || isAuthenticated ? "" : "min-w-[92px]"
              }`}
            >
              {isAuthLoading ? (
                <div
                  className="w-[26px] h-[26px] rounded-full bg-theme-surface-alt animate-pulse"
                  aria-hidden="true"
                />
              ) : !isAuthenticated ? (
                <Link
                  href="/login"
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-sm bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-fg border border-theme-primary text-xs sm:text-sm font-semibold transition-all duration-150 shadow-xs hover:shadow-sm active:scale-95 cursor-pointer"
                  aria-label="Login"
                >
                  <span>Login</span>
                  <LogIn
                    className="w-4 h-4 text-inherit shrink-0"
                    strokeWidth={2}
                  />
                </Link>
              ) : (
                <IconButton
                  alt={userName ? `${userName}'s profile` : "Profile"}
                  href={accountHref}
                  customIcon={
                    <div className="w-[26px] h-[26px] rounded-full bg-theme-primary text-theme-primary-fg text-[11px] font-bold flex items-center justify-center border border-theme-border-accent shadow-2xs select-none leading-none">
                      {userInitials}
                    </div>
                  }
                />
              )}
            </div>
          </div>

          {/* Hamburger Menu Trigger */}
          <div ref={buttonRef} className="lg:hidden">
            <IconButton
              icon={ICONS.menu}
              alt="menu"
              onClick={() => setIsOpen(!isOpen)}
              imageClassName="w-[22px] h-[22px]"
            />
          </div>
        </div>
      </div>

      {/* Mega-menu dropdown: in normal document flow (not absolutely
          positioned) so opening it pushes the page content below the header
          down instead of floating over it. */}
      {openNavItem && (
        <div className="hidden lg:block" onMouseEnter={cancelMegaMenuClose} onMouseLeave={scheduleMegaMenuClose}>
          <MegaMenuPanel
            root={buildNavNode(openNavItem)}
            enableProductPreview={openNavItem.categories.length === 1 && !openNavItem.link}
            onNavigate={() => setOpenNavId(null)}
          />
        </div>
      )}

      {/* Mobile Drawer Menu */}
      <>
        {/* Overlay */}
        <div
          onClick={() => {
            setIsOpen(false);
          }}
          className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-xs transition-all duration-500 ${
            isOpen ? "opacity-100 visible" : "opacity-0 invisible"
          }`}
        />

        {/* Drawer Panel */}
        <div
          ref={menuRef}
          className={`fixed top-0 right-0 z-50 h-screen w-72 bg-[var(--brown-600)] border-l border-white/20 transform transition-all duration-500 ease-in-out flex flex-col ${
            isOpen ? "translate-x-0 shadow-2xl" : "translate-x-full invisible"
          }`}
        >
          <div className="flex items-center justify-between border-b border-white/20 px-6 py-5 shrink-0">
            <h2 className="text-xl font-semibold text-white uppercase tracking-wide">
              Menu
            </h2>

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
              }}
              className="text-2xl text-white hover:text-gray-300 cursor-pointer"
            >
              ✕
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto py-3 scrollbar-thin scrollbar-thumb-white/20">
            {isCategoriesLoading ? (
              <div className="space-y-2 px-6 py-3">
                {[1, 2, 3, 4].map((n) => (
                  <div key={`mob-skel-${n}`} className="h-8 bg-white/10 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : (
              <>
                <MobileCategoryAccordion
                  nodes={headerMenu.filter((item) => item.categories.length > 0).map(buildNavNode)}
                  onNavigate={() => {
                    setIsOpen(false);
                  }}
                />
                {headerMenu
                  .filter((item) => item.categories.length === 0)
                  .map((item) => (
                    <Link
                      key={item.id}
                      href={item.link ?? "#"}
                      onClick={() => setIsOpen(false)}
                      className="block px-6 py-4 text-sm font-semibold text-red-400 hover:bg-white/10 transition-colors"
                    >
                      {item.label}
                    </Link>
                  ))}
              </>
            )}
          </nav>
        </div>
      </>

      {/* Mobile Bottom Navigation Bar */}
      <div
        className="
          fixed
          bottom-0
          left-0
          w-full
          bg-white/90
          backdrop-blur-xl
          border-t
          border-stone-200
          shadow-[0_-8px_30px_rgba(0,0,0,0.08)]
          flex
          justify-around
          items-center
          py-2.5
          pb-[calc(env(safe-area-inset-bottom)+10px)]
          lg:hidden
          z-50
        "
      >
        {mobileBottomIcons.map((item) => {
          if (isStaffUser && (item.text === "Wishlist" || item.text === "Cart")) return null;
          const isUser =
            item.text === "Account" || item.path === "/profile";
          const targetPath = resolvePath(item);
          const badge =
            item.text === "Cart"
              ? cartCount
              : item.text === "Wishlist"
              ? wishlistCount
              : undefined;

          if (isUser) {
            // "Login" and "Account" are different widths, and this bar is
            // justify-around, so the swap would nudge all four items. Same fix
            // as the desktop row: pin the cell width, let it repaint inside.
            return (
              <div key={item.id} className="flex w-16 justify-center">
                {isAuthLoading ? (
                  <div
                    className="flex flex-col-reverse items-center gap-1"
                    aria-hidden="true"
                  >
                    <span className="h-4 w-10 rounded bg-theme-surface-alt animate-pulse" />
                    <span className="h-5 w-5 rounded-full bg-theme-surface-alt animate-pulse" />
                  </div>
                ) : !isAuthenticated ? (
                  <NavButton
                    variant="bottom"
                    customIcon={
                      <LogIn
                        className="w-[18px] h-[18px] text-theme-text-primary"
                        strokeWidth={1.75}
                      />
                    }
                    text="Login"
                    href="/login"
                    isActive={pathname === "/login"}
                  />
                ) : (
                  <NavButton
                    variant="bottom"
                    customIcon={
                      <div className="w-5 h-5 rounded-full bg-theme-primary text-theme-primary-fg text-[10px] font-bold flex items-center justify-center select-none leading-none">
                        {userInitials}
                      </div>
                    }
                    text="Account"
                    href={accountHref}
                    isActive={pathname === accountHref}
                  />
                )}
              </div>
            );
          }

          return (
            <NavButton
              key={item.id}
              variant="bottom"
              icon={item.icon}
              text={item.text}
              href={targetPath}
              badge={badge}
              isActive={pathname === targetPath}
            />
          );
        })}
      </div>
      </header>
    </>
  );
}

export default Header;

