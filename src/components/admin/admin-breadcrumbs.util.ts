import type { BreadcrumbItem } from "./AdminBreadcrumb";

interface RouteConfig {
  prefix: string;
  section: string;
  sectionHref?: string;
  module: string;
  moduleHref: string;
}

const ROUTE_CONFIGS: RouteConfig[] = [
  // Catalog
  { prefix: "/admin/dashboard/categories", section: "Catalog", module: "Categories", moduleHref: "/admin/dashboard/categories" },
  { prefix: "/admin/dashboard/header-menu", section: "Catalog", module: "Header Menu", moduleHref: "/admin/dashboard/header-menu" },
  { prefix: "/admin/dashboard/tags", section: "Catalog", module: "Tags", moduleHref: "/admin/dashboard/tags" },
  { prefix: "/admin/dashboard/products", section: "Catalog", module: "Products", moduleHref: "/admin/dashboard/products" },
  { prefix: "/admin/dashboard/styles", section: "Catalog", module: "Models (Styles)", moduleHref: "/admin/dashboard/styles" },
  { prefix: "/admin/dashboard/variants", section: "Catalog", module: "Variants", moduleHref: "/admin/dashboard/variants" },
  { prefix: "/admin/dashboard/brands", section: "Catalog", module: "Brands", moduleHref: "/admin/dashboard/brands" },
  { prefix: "/admin/dashboard/attributes", section: "Catalog", module: "Attributes", moduleHref: "/admin/dashboard/attributes" },
  { prefix: "/admin/dashboard/units", section: "Catalog", module: "Units", moduleHref: "/admin/dashboard/units" },
  { prefix: "/admin/dashboard/reviews", section: "Catalog", module: "Reviews", moduleHref: "/admin/dashboard/reviews" },

  // Sales
  { prefix: "/admin/dashboard/orders/pos", section: "Sales", module: "POS Sales", moduleHref: "/admin/dashboard/orders/pos" },
  { prefix: "/admin/dashboard/orders/returns", section: "Sales", module: "Return Requests", moduleHref: "/admin/dashboard/orders/returns" },
  { prefix: "/admin/dashboard/orders", section: "Sales", module: "Orders", moduleHref: "/admin/dashboard/orders" },
  { prefix: "/admin/dashboard/customers", section: "Sales", module: "Customers", moduleHref: "/admin/dashboard/customers" },
  { prefix: "/admin/dashboard/delivery", section: "Sales", module: "Deliveries", moduleHref: "/admin/dashboard/delivery" },

  // Counter (POS)
  { prefix: "/admin/dashboard/pos/shifts", section: "Counter (POS)", module: "Shifts", moduleHref: "/admin/dashboard/pos/shifts" },
  { prefix: "/admin/dashboard/pos", section: "Counter (POS)", module: "Billing", moduleHref: "/admin/dashboard/pos" },

  // Inventory
  { prefix: "/admin/dashboard/inventory/stock", section: "Inventory", sectionHref: "/admin/dashboard/inventory", module: "Current Stock", moduleHref: "/admin/dashboard/inventory/stock" },
  { prefix: "/admin/dashboard/inventory/pricing", section: "Inventory", sectionHref: "/admin/dashboard/inventory", module: "Pricing", moduleHref: "/admin/dashboard/inventory/pricing" },
  { prefix: "/admin/dashboard/inventory/valuation", section: "Inventory", sectionHref: "/admin/dashboard/inventory", module: "Valuation & Margin", moduleHref: "/admin/dashboard/inventory/valuation" },
  { prefix: "/admin/dashboard/inventory/movements", section: "Inventory", sectionHref: "/admin/dashboard/inventory", module: "Stock Movements", moduleHref: "/admin/dashboard/inventory/movements" },
  { prefix: "/admin/dashboard/inventory/adjustment", section: "Inventory", sectionHref: "/admin/dashboard/inventory", module: "Stock Adjustment", moduleHref: "/admin/dashboard/inventory/adjustment" },
  { prefix: "/admin/dashboard/inventory/history", section: "Inventory", sectionHref: "/admin/dashboard/inventory", module: "History", moduleHref: "/admin/dashboard/inventory/history" },
  { prefix: "/admin/dashboard/inventory", section: "Inventory", module: "Dashboard", moduleHref: "/admin/dashboard/inventory" },
  { prefix: "/admin/dashboard/vendors", section: "Inventory", sectionHref: "/admin/dashboard/inventory", module: "Vendors", moduleHref: "/admin/dashboard/vendors" },
  { prefix: "/admin/dashboard/purchase-orders", section: "Inventory", sectionHref: "/admin/dashboard/inventory", module: "Purchases", moduleHref: "/admin/dashboard/purchase-orders" },
  { prefix: "/admin/dashboard/purchase-returns", section: "Inventory", sectionHref: "/admin/dashboard/inventory", module: "Purchase Returns", moduleHref: "/admin/dashboard/purchase-returns" },

  // Tax & Compliance
  { prefix: "/admin/dashboard/gst-rates", section: "Tax & Compliance", module: "GST Rates", moduleHref: "/admin/dashboard/gst-rates" },
  { prefix: "/admin/dashboard/hsn-codes", section: "Tax & Compliance", module: "HSN Codes", moduleHref: "/admin/dashboard/hsn-codes" },

  // Marketing
  { prefix: "/admin/dashboard/coupons", section: "Marketing", module: "Coupons", moduleHref: "/admin/dashboard/coupons" },
  { prefix: "/admin/dashboard/offers", section: "Marketing", module: "Offers", moduleHref: "/admin/dashboard/offers" },
  { prefix: "/admin/dashboard/banners", section: "Marketing", module: "Banners", moduleHref: "/admin/dashboard/banners" },

  // CMS
  { prefix: "/admin/dashboard/blogs", section: "CMS", module: "Blogs", moduleHref: "/admin/dashboard/blogs" },
  { prefix: "/admin/dashboard/faqs", section: "CMS", module: "FAQs", moduleHref: "/admin/dashboard/faqs" },
  { prefix: "/admin/dashboard/contacts", section: "CMS", module: "Contact List", moduleHref: "/admin/dashboard/contacts" },
  { prefix: "/admin/dashboard/cms/contacts", section: "CMS", module: "Contact List", moduleHref: "/admin/dashboard/contacts" },

  // Sales Partners
  { prefix: "/admin/dashboard/agents", section: "Sales Partners", module: "Sales Partners", moduleHref: "/admin/dashboard/agents" },
  { prefix: "/admin/dashboard/commission-rates", section: "Sales Partners", module: "Commission Rates", moduleHref: "/admin/dashboard/commission-rates" },
  { prefix: "/admin/dashboard/commissions", section: "Sales Partners", module: "Commissions", moduleHref: "/admin/dashboard/commissions" },
  { prefix: "/admin/dashboard/agent-payouts", section: "Sales Partners", module: "Payouts", moduleHref: "/admin/dashboard/agent-payouts" },
  { prefix: "/admin/dashboard/commission-reports", section: "Sales Partners", module: "Commission Reports", moduleHref: "/admin/dashboard/commission-reports" },

  // Team & Access
  { prefix: "/admin/dashboard/staff", section: "Team & Access", module: "Staff", moduleHref: "/admin/dashboard/staff" },
  { prefix: "/admin/dashboard/users", section: "Team & Access", module: "Users", moduleHref: "/admin/dashboard/users" },
  { prefix: "/admin/dashboard/roles", section: "Team & Access", module: "Roles", moduleHref: "/admin/dashboard/roles" },
  { prefix: "/admin/dashboard/permissions", section: "Team & Access", module: "Permissions", moduleHref: "/admin/dashboard/permissions" },

  // Reports
  { prefix: "/admin/dashboard/reports", section: "Reports", module: "Reports", moduleHref: "/admin/dashboard/reports" },

  // WhatsApp
  { prefix: "/admin/dashboard/whatsapp/campaigns", section: "WhatsApp", sectionHref: "/admin/dashboard/whatsapp", module: "Campaigns", moduleHref: "/admin/dashboard/whatsapp/campaigns" },
  { prefix: "/admin/dashboard/whatsapp/templates", section: "WhatsApp", sectionHref: "/admin/dashboard/whatsapp", module: "Templates", moduleHref: "/admin/dashboard/whatsapp/templates" },
  { prefix: "/admin/dashboard/whatsapp/reports", section: "WhatsApp", sectionHref: "/admin/dashboard/whatsapp", module: "Reports", moduleHref: "/admin/dashboard/whatsapp/reports" },
  { prefix: "/admin/dashboard/whatsapp", section: "WhatsApp", module: "Overview", moduleHref: "/admin/dashboard/whatsapp" },

  // Settings
  { prefix: "/admin/dashboard/settings", section: "Settings", module: "Settings", moduleHref: "/admin/dashboard/settings" },
];

/**
 * Automatically derives the proper breadcrumbs for any admin dashboard page or sub-page.
 */
export function getAdminBreadcrumbs(pathname: string, pageTitle?: string): BreadcrumbItem[] {
  // If exactly on dashboard root, no extra crumbs needed
  if (!pathname || pathname === "/admin/dashboard" || pathname === "/admin/dashboard/") {
    return [];
  }

  // Find longest matching route configuration
  const matched = ROUTE_CONFIGS.filter(
    (cfg) => pathname === cfg.prefix || pathname.startsWith(cfg.prefix + "/") || pathname.startsWith(cfg.prefix + "?")
  ).sort((a, b) => b.prefix.length - a.prefix.length)[0];

  if (!matched) {
    // Fallback: split pathname into segments
    const parts = pathname.replace(/^\/admin\/dashboard\/?/, "").split("/").filter(Boolean);
    if (parts.length === 0) return [];

    const items: BreadcrumbItem[] = [];
    let accumulatedPath = "/admin/dashboard";

    for (let i = 0; i < parts.length; i++) {
      accumulatedPath += `/${parts[i]}`;
      const isLast = i === parts.length - 1;
      const formatted = parts[i]
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());

      items.push({
        label: isLast && pageTitle ? pageTitle : formatted,
        href: isLast ? undefined : accumulatedPath,
      });
    }
    return items;
  }

  const isExactModule = pathname === matched.moduleHref;
  const items: BreadcrumbItem[] = [];

  // 1. Add section (if distinct from module and not a root module like Settings or Reports)
  if (matched.section && matched.section !== matched.module) {
    items.push({
      label: matched.section,
      href: matched.sectionHref,
    });
  }

  // 2. Add module
  if (isExactModule) {
    // On the main module list page itself (e.g. /admin/dashboard/products)
    items.push({
      label: matched.module,
    });
    return items;
  }

  // On a sub-page or detail page (e.g. /admin/dashboard/products/uuid-123)
  items.push({
    label: matched.module,
    href: matched.moduleHref,
  });

  // 3. Add sub-page crumb
  const remaining = pathname.slice(matched.prefix.length).replace(/^\//, "");
  const subSegments = remaining.split("/").filter(Boolean);

  if (subSegments.length > 1) {
    // Nested sub-page (e.g. /purchase-orders/uuid-123/edit)
    const midSegment = subSegments[0];
    const lastSegment = subSegments[subSegments.length - 1];
    const isMidId = /^[0-9a-f-]{10,}$/i.test(midSegment) || /^\d+$/.test(midSegment);
    const formattedMid = isMidId
      ? "Details"
      : midSegment.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    items.push({
      label: formattedMid,
      href: `${matched.prefix}/${midSegment}`,
    });

    const formattedLast = lastSegment
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

    const hasDistinctTitle =
      Boolean(pageTitle) &&
      pageTitle!.trim() !== "" &&
      pageTitle!.toLowerCase() !== matched.module.toLowerCase() &&
      pageTitle!.toLowerCase() !== matched.section.toLowerCase() &&
      !pageTitle!.toLowerCase().includes("loading");

    items.push({
      label:
        formattedLast === "Edit"
          ? "Edit"
          : formattedLast === "Return"
          ? "Return"
          : hasDistinctTitle
          ? pageTitle!
          : formattedLast,
    });
  } else if (subSegments.length === 1) {
    // Standard detail page (e.g. /products/uuid-123 or /orders/processing)
    const segment = subSegments[0];
    const isId = /^[0-9a-f-]{10,}$/i.test(segment) || /^\d+$/.test(segment);
    const formattedSegment = segment
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

    const hasDistinctTitle =
      Boolean(pageTitle) &&
      pageTitle!.trim() !== "" &&
      pageTitle!.toLowerCase() !== matched.module.toLowerCase() &&
      pageTitle!.toLowerCase() !== matched.section.toLowerCase() &&
      !pageTitle!.toLowerCase().includes("loading");

    const label = hasDistinctTitle
      ? pageTitle!
      : isId
      ? "Details"
      : formattedSegment;

    items.push({ label });
  }

  return items;
}
