/**
 * The permission each admin screen needs to be opened.
 *
 * One table drives three things: which sidebar links a role sees, the guard the dashboard
 * layout puts in front of a page someone reaches by typing the URL, and the "no access"
 * message. It is UI gating only — the API guard in `./api-map.ts` is the real boundary.
 *
 * The longest matching prefix wins, so `/admin/dashboard/inventory/pricing` is checked
 * against INVENTORY_PRICING_VIEW rather than the inventory dashboard's permission.
 */
import { ALL_PERMISSIONS } from "./catalog";

const ADMIN_ROUTE_PERMISSIONS: Array<{ prefix: string; permission: string }> = [
  { prefix: "/admin/dashboard", permission: "DASHBOARD_VIEW" },

  // Operations
  { prefix: "/admin/dashboard/orders", permission: "ORDER_VIEW" },
  { prefix: "/admin/dashboard/orders/returns", permission: "RETURN_VIEW" },
  { prefix: "/admin/dashboard/orders/returned", permission: "RETURN_VIEW" },
  { prefix: "/admin/dashboard/orders/replacements", permission: "REPLACEMENT_VIEW" },
  { prefix: "/admin/dashboard/bulk-orders", permission: "BULK_ORDER_VIEW" },
  { prefix: "/admin/dashboard/customers", permission: "CUSTOMER_VIEW" },
  { prefix: "/admin/dashboard/delivery", permission: "DELIVERY_VIEW" },

  // Catalog
  { prefix: "/admin/dashboard/categories", permission: "CATEGORY_VIEW" },
  { prefix: "/admin/dashboard/header-menu", permission: "HEADER_MENU_VIEW" },
  { prefix: "/admin/dashboard/tags", permission: "TAG_VIEW" },
  { prefix: "/admin/dashboard/products", permission: "PRODUCT_VIEW" },
  { prefix: "/admin/dashboard/styles", permission: "STYLE_VIEW" },
  { prefix: "/admin/dashboard/variants", permission: "VARIANT_VIEW" },
  { prefix: "/admin/dashboard/brands", permission: "BRAND_VIEW" },
  { prefix: "/admin/dashboard/attributes", permission: "ATTRIBUTE_VIEW" },
  { prefix: "/admin/dashboard/units", permission: "UNIT_VIEW" },

  // Inventory & purchases
  { prefix: "/admin/dashboard/inventory", permission: "INVENTORY_STOCK_VIEW" },
  { prefix: "/admin/dashboard/inventory/stock", permission: "INVENTORY_STOCK_VIEW" },
  { prefix: "/admin/dashboard/inventory/pricing", permission: "INVENTORY_PRICING_VIEW" },
  { prefix: "/admin/dashboard/inventory/valuation", permission: "INVENTORY_VALUATION_VIEW" },
  { prefix: "/admin/dashboard/inventory/movements", permission: "STOCK_MOVEMENT_VIEW" },
  { prefix: "/admin/dashboard/inventory/history", permission: "STOCK_MOVEMENT_VIEW" },
  { prefix: "/admin/dashboard/inventory/adjustment", permission: "STOCK_ADJUSTMENT_VIEW" },
  { prefix: "/admin/dashboard/vendors", permission: "VENDOR_VIEW" },
  { prefix: "/admin/dashboard/purchase-orders", permission: "PURCHASE_ORDER_VIEW" },
  { prefix: "/admin/dashboard/purchase-returns", permission: "PURCHASE_RETURN_VIEW" },

  // Tax
  { prefix: "/admin/dashboard/gst-rates", permission: "GST_RATE_VIEW" },
  { prefix: "/admin/dashboard/hsn-codes", permission: "HSN_CODE_VIEW" },

  // Marketing
  { prefix: "/admin/dashboard/coupons", permission: "COUPON_VIEW" },
  { prefix: "/admin/dashboard/offers", permission: "OFFER_VIEW" },
  { prefix: "/admin/dashboard/banners", permission: "BANNER_VIEW" },

  // CMS
  { prefix: "/admin/dashboard/blogs", permission: "BLOG_VIEW" },
  { prefix: "/admin/dashboard/faqs", permission: "FAQ_VIEW" },
  { prefix: "/admin/dashboard/contacts", permission: "CONTACT_MESSAGE_VIEW" },
  { prefix: "/admin/dashboard/cms/contacts", permission: "CONTACT_MESSAGE_VIEW" },
  { prefix: "/admin/dashboard/reviews", permission: "REVIEW_VIEW" },

  // Sales partners
  { prefix: "/admin/dashboard/agents", permission: "AGENT_VIEW" },
  { prefix: "/admin/dashboard/commission-rates", permission: "COMMISSION_RATE_VIEW" },
  { prefix: "/admin/dashboard/commissions", permission: "COMMISSION_VIEW" },
  { prefix: "/admin/dashboard/agent-payouts", permission: "AGENT_PAYOUT_VIEW" },
  { prefix: "/admin/dashboard/commission-reports", permission: "COMMISSION_REPORT_VIEW" },

  // Reports
  { prefix: "/admin/dashboard/reports", permission: "REPORT_VIEW" },

  // WhatsApp
  { prefix: "/admin/dashboard/whatsapp", permission: "WHATSAPP_VIEW" },
  { prefix: "/admin/dashboard/whatsapp/campaigns", permission: "WHATSAPP_CAMPAIGN_VIEW" },
  { prefix: "/admin/dashboard/whatsapp/templates", permission: "WHATSAPP_TEMPLATE_MANAGE" },
  { prefix: "/admin/dashboard/whatsapp/reports", permission: "WHATSAPP_REPORT_VIEW" },

  // Administration
  { prefix: "/admin/dashboard/staff", permission: "STAFF_VIEW" },
  { prefix: "/admin/dashboard/users", permission: "USER_VIEW" },
  { prefix: "/admin/dashboard/users/staff", permission: "STAFF_VIEW" },
  { prefix: "/admin/dashboard/users/customers", permission: "CUSTOMER_VIEW" },
  { prefix: "/admin/dashboard/roles", permission: "ROLE_VIEW" },
  { prefix: "/admin/dashboard/permissions", permission: "PERMISSION_VIEW" },
  { prefix: "/admin/dashboard/settings", permission: "SETTINGS_VIEW" },
];

/** The permission needed to open this admin path, or null when the path has no entry. */
export function permissionForAdminPath(pathname?: string | null): string | null {
  if (!pathname) return null;
  const path = pathname.split("?")[0].replace(/\/+$/, "") || "/";

  const match = ADMIN_ROUTE_PERMISSIONS.filter(
    (route) => path === route.prefix || path.startsWith(`${route.prefix}/`)
  ).sort((a, b) => b.prefix.length - a.prefix.length)[0];

  return match?.permission ?? null;
}

const PERMISSION_NAMES = new Set(ALL_PERMISSIONS.map((permission) => permission.name));

/**
 * The permission needed to perform `action` on the screen at `pathname` — e.g. "CREATE" on
 * /admin/dashboard/brands is BRAND_CREATE. Returns null when the module has no such action,
 * which callers read as "nothing to gate here".
 *
 * This is what lets a page hide its Add/Edit/Delete buttons without naming a permission:
 * the screen's own route entry already says which module it belongs to.
 */
export function actionPermissionForAdminPath(
  pathname: string | null | undefined,
  action: string
): string | null {
  const view = permissionForAdminPath(pathname);
  if (!view || !view.endsWith("_VIEW")) return null;

  const candidate = `${view.slice(0, -"_VIEW".length)}_${action}`;
  return PERMISSION_NAMES.has(candidate) ? candidate : null;
}

/**
 * The first admin screen these permissions can open, so a role without DASHBOARD_VIEW still
 * has somewhere to land after signing in. Order follows the table above, which mirrors the
 * sidebar; null means the role can open nothing at all.
 */
export function firstAllowedAdminPath(permissions: string[]): string | null {
  const held = new Set(permissions);
  for (const route of ADMIN_ROUTE_PERMISSIONS) {
    if (held.has(route.permission)) return route.prefix;
  }
  return null;
}
