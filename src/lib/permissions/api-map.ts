/**
 * Which permission an admin API request needs.
 *
 * `createApiHandler` looks the request up here (path + method) instead of every route file
 * repeating a database check, so one table covers all ~175 admin routes and a new module is
 * one line. It applies ONLY to routes that already declare `requiredRole` with ADMIN/STAFF,
 * so storefront, customer and agent endpoints are never affected.
 *
 * Resolution order for a request:
 *   1. the longest matching `prefix` in MODULE_ROUTES decides the module;
 *   2. a path suffix in ACTION_SUFFIXES (e.g. `/approve`) decides the action, if the module
 *      defines it;
 *   3. a read-shaped path (`/list`, `/count`, …) is a VIEW even when it is a POST, because
 *      this app posts its list filters;
 *   4. otherwise the HTTP method decides: GET → VIEW, POST → CREATE, PUT/PATCH → UPDATE,
 *      DELETE → DELETE.
 * An action the module does not define falls back to UPDATE, then VIEW, so a sub-route can
 * never demand a permission that does not exist (which no role could ever be given).
 */
import { PERMISSION_MODULES } from "./catalog";

/** Routes only the built-in owner role (`admin`) may call, whatever permissions a role has. */
export const OWNER_ONLY = "OWNER_ONLY" as const;

/** Paths that need no permission beyond being in the admin area. */
const UNGUARDED_PREFIXES = [
  "/api/admin/upload",
  "/api/admin/uploads",
  "/api/auth",
];

/** Destructive maintenance endpoints: owner only, never grantable through a role. */
const OWNER_ONLY_PREFIXES = ["/api/admin/reset-database", "/api/dev"];

/** Longest prefix wins, so `/api/admin/inventory/pricing` beats `/api/admin/inventory`. */
const MODULE_ROUTES: Array<{ prefix: string; module: string }> = [
  // Operations
  { prefix: "/api/admin/orders", module: "ORDER" },
  { prefix: "/api/admin/returns", module: "RETURN" },
  { prefix: "/api/returns", module: "RETURN" },
  { prefix: "/api/admin/replacements", module: "REPLACEMENT" },
  { prefix: "/api/admin/bulk-orders", module: "BULK_ORDER" },
  { prefix: "/api/bulk-order", module: "BULK_ORDER" },
  { prefix: "/api/admin/customers", module: "CUSTOMER" },
  { prefix: "/api/admin/customer-transfers", module: "CUSTOMER" },
  { prefix: "/api/admin/delivery", module: "DELIVERY" },
  { prefix: "/api/staff/deliveries", module: "DELIVERY" },
  { prefix: "/api/admin/payments", module: "PAYMENT" },
  { prefix: "/api/dashboard", module: "DASHBOARD" },

  // Catalog
  { prefix: "/api/admin/categories", module: "CATEGORY" },
  { prefix: "/api/categories", module: "CATEGORY" },
  { prefix: "/api/admin/header-menu", module: "HEADER_MENU" },
  { prefix: "/api/admin/tags", module: "TAG" },
  { prefix: "/api/admin/products", module: "PRODUCT" },
  { prefix: "/api/products", module: "PRODUCT" },
  { prefix: "/api/admin/styles", module: "STYLE" },
  { prefix: "/api/admin/variants", module: "VARIANT" },
  { prefix: "/api/product-variants", module: "VARIANT" },
  { prefix: "/api/admin/brands", module: "BRAND" },
  { prefix: "/api/brands", module: "BRAND" },
  { prefix: "/api/admin/attributes", module: "ATTRIBUTE" },
  { prefix: "/api/admin/units", module: "UNIT" },
  { prefix: "/api/size-charts", module: "SIZE_CHART" },

  // Inventory & purchases
  { prefix: "/api/admin/inventory", module: "INVENTORY_STOCK" },
  { prefix: "/api/admin/inventory/stock", module: "INVENTORY_STOCK" },
  { prefix: "/api/admin/inventory/pricing", module: "INVENTORY_PRICING" },
  { prefix: "/api/admin/inventory/valuation", module: "INVENTORY_VALUATION" },
  { prefix: "/api/admin/inventory/movements", module: "STOCK_MOVEMENT" },
  { prefix: "/api/admin/inventory/history", module: "STOCK_MOVEMENT" },
  { prefix: "/api/admin/inventory/adjustment", module: "STOCK_ADJUSTMENT" },
  { prefix: "/api/admin/inventory/adjustments", module: "STOCK_ADJUSTMENT" },
  { prefix: "/api/inventory", module: "INVENTORY_STOCK" },
  { prefix: "/api/admin/vendors", module: "VENDOR" },
  { prefix: "/api/admin/purchase-orders", module: "PURCHASE_ORDER" },
  { prefix: "/api/admin/purchase-returns", module: "PURCHASE_RETURN" },

  // Tax
  { prefix: "/api/admin/gst-rates", module: "GST_RATE" },
  { prefix: "/api/admin/hsn-codes", module: "HSN_CODE" },

  // Marketing
  { prefix: "/api/coupons", module: "COUPON" },
  { prefix: "/api/offers", module: "OFFER" },
  { prefix: "/api/admin/banners", module: "BANNER" },
  { prefix: "/api/admin/banner-positions", module: "BANNER" },

  // CMS
  { prefix: "/api/blogs", module: "BLOG" },
  { prefix: "/api/admin/faqs", module: "FAQ" },
  { prefix: "/api/faqs", module: "FAQ" },
  { prefix: "/api/admin/contact-messages", module: "CONTACT_MESSAGE" },
  { prefix: "/api/contact", module: "CONTACT_MESSAGE" },
  { prefix: "/api/admin/reviews", module: "REVIEW" },

  // Sales partners
  { prefix: "/api/admin/agents", module: "AGENT" },
  { prefix: "/api/admin/agent-orders", module: "AGENT" },
  { prefix: "/api/admin/agent-payouts", module: "AGENT_PAYOUT" },
  { prefix: "/api/admin/commission-rates", module: "COMMISSION_RATE" },
  { prefix: "/api/admin/commission-settings", module: "COMMISSION_RATE" },
  { prefix: "/api/admin/commissions", module: "COMMISSION" },
  { prefix: "/api/admin/commission-reports", module: "COMMISSION_REPORT" },

  // Reports
  { prefix: "/api/admin/reports", module: "REPORT" },

  // WhatsApp
  { prefix: "/api/admin/whatsapp", module: "WHATSAPP" },

  // Administration
  { prefix: "/api/admin/staff", module: "STAFF" },
  { prefix: "/api/staff", module: "STAFF" },
  { prefix: "/api/users", module: "USER" },
  { prefix: "/api/roles", module: "ROLE" },
  { prefix: "/api/permissions", module: "PERMISSION" },
  { prefix: "/api/admin/company", module: "SETTINGS" },
];

/** Path endings that name their own action, used when the module defines that action. */
const ACTION_SUFFIXES: Array<{ match: RegExp; action: string }> = [
  { match: /\/approve$/, action: "APPROVE" },
  { match: /\/review$/, action: "APPROVE" },
  { match: /\/reject$/, action: "REJECT" },
  { match: /\/confirm$/, action: "CONFIRM" },
  { match: /\/import$/, action: "IMPORT" },
  { match: /\/cancel$/, action: "CANCEL" },
  { match: /\/invoice(-number)?$/, action: "INVOICE" },
  { match: /\/refund$/, action: "REFUND" },
  { match: /\/assign$/, action: "ASSIGN" },
  { match: /\/reassign$/, action: "TRANSFER" },
  { match: /\/agent$/, action: "TRANSFER" },
  { match: /\/debit-note$/, action: "DEBIT_NOTE" },
  { match: /\/mark-paid$/, action: "APPROVE" },
  { match: /\/send$/, action: "CAMPAIGN_SEND" },
  { match: /\/campaigns$/, action: "CAMPAIGN_VIEW" },
  { match: /\/templates/, action: "TEMPLATE_MANAGE" },
  { match: /\/export$/, action: "EXPORT" },
];

/** Read-shaped endings. This app posts list filters, so a POST here is still a read. */
const READ_SUFFIXES = /\/(list|count|stats|summary|search|options|export|preview)$/;

/** Reads whose path does not look like one (a picker feeding a form, for example). */
const READ_PATHS = ["/api/admin/staff/roles"];

const MODULE_ACTIONS = new Map(PERMISSION_MODULES.map((mod) => [mod.module, new Set(mod.actions)]));

function permissionFor(module: string, preferred: string[]): string | null {
  const actions = MODULE_ACTIONS.get(module);
  if (!actions) return null;
  for (const action of preferred) {
    if (actions.has(action)) return `${module}_${action}`;
  }
  return null;
}

function actionForMethod(method: string): string {
  switch (method.toUpperCase()) {
    case "GET":
      return "VIEW";
    case "POST":
      return "CREATE";
    case "PUT":
    case "PATCH":
      return "UPDATE";
    case "DELETE":
      return "DELETE";
    default:
      return "VIEW";
  }
}

/**
 * The permission this request needs, `OWNER_ONLY` for owner-only maintenance routes, or
 * null when the admin area itself is the only gate (uploads, auth, anything unmapped).
 */
export function resolveRequiredPermission(
  pathname: string,
  method: string
): string | typeof OWNER_ONLY | null {
  const path = pathname.replace(/\/+$/, "") || "/";

  if (OWNER_ONLY_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    return OWNER_ONLY;
  }
  if (UNGUARDED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    return null;
  }

  const match = MODULE_ROUTES.filter(
    (route) => path === route.prefix || path.startsWith(`${route.prefix}/`)
  ).sort((a, b) => b.prefix.length - a.prefix.length)[0];

  if (!match) return null;

  const named = ACTION_SUFFIXES.find((entry) => entry.match.test(path))?.action;
  const isRead = READ_SUFFIXES.test(path) || READ_PATHS.includes(path);
  const methodAction = actionForMethod(method);

  // Reads ask for VIEW (or the module's own read action, e.g. WHATSAPP_CAMPAIGN_VIEW).
  // Writes prefer the action the path names, then the one the method implies; UPDATE and
  // VIEW close the list so a sub-route can never demand a permission that does not exist.
  const preferred =
    isRead || methodAction === "VIEW"
      ? named?.endsWith("_VIEW")
        ? [named, "VIEW"]
        : ["VIEW"]
      : named
        ? [named, methodAction, "UPDATE", "VIEW"]
        : [methodAction, "UPDATE", "VIEW"];

  return permissionFor(match.module, preferred);
}
