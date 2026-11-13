/**
 * The one list of permissions the app knows about.
 *
 * Nothing is hard-coded anywhere else: `prisma/seed.ts` creates a `permissions` row per
 * entry here, the Roles screen groups its checkboxes by `module`, and the API guard
 * (`src/lib/permissions/api-map.ts`) names these permissions. Add an action here, run the
 * seed, and it appears for every role on the Roles screen with no further code change.
 *
 * `name` is what the database stores (and what route guards use); `slug` is its kebab-case
 * twin. Renaming a label is safe; renaming a name needs a data migration.
 */
export interface PermissionModuleDefinition {
  /** Stored in `permissions.module`; groups the checkboxes on the Roles screen. */
  module: string;
  /** Wording shown to the admin. */
  label: string;
  /** Section the module belongs to, mirroring the admin sidebar. */
  group: string;
  /** Action suffixes; each permission is named `${module}_${action}`. */
  actions: string[];
}

const CRUD = ["VIEW", "CREATE", "UPDATE", "DELETE"];

export const PERMISSION_MODULES: PermissionModuleDefinition[] = [
  // ---------------------------------------------------------------- Operations
  { module: "DASHBOARD", label: "Dashboard", group: "Operations", actions: ["VIEW"] },
  {
    module: "ORDER",
    label: "Orders",
    group: "Operations",
    actions: ["VIEW", "UPDATE", "INVOICE", "CANCEL", "EXPORT", "DELETE"],
  },
  {
    module: "RETURN",
    label: "Return requests",
    group: "Operations",
    actions: ["VIEW", "APPROVE", "REJECT", "REFUND"],
  },
  { module: "REPLACEMENT", label: "Replacements", group: "Operations", actions: ["VIEW", "APPROVE", "REJECT"] },
  { module: "BULK_ORDER", label: "Bulk orders", group: "Operations", actions: ["VIEW", "UPDATE"] },
  { module: "CUSTOMER", label: "Customers", group: "Operations", actions: [...CRUD, "TRANSFER"] },
  { module: "DELIVERY", label: "Deliveries", group: "Operations", actions: ["VIEW", "UPDATE", "ASSIGN"] },
  { module: "PAYMENT", label: "Payments", group: "Operations", actions: ["VIEW", "REFUND"] },

  // ------------------------------------------------------------------ Counter
  // Split finely on purpose: a cashier gets VIEW + BILL + SHIFT, and the three
  // actions that move money the other way (discount, void, return) stay with a
  // manager. REPORT_VIEW is separate again so a cashier cannot read the day's
  // takings or another cashier's shift.
  {
    module: "POS",
    label: "Counter sales (POS)",
    group: "Counter",
    actions: ["VIEW", "BILL", "DISCOUNT", "VOID", "RETURN", "SHIFT", "REPORT_VIEW"],
  },
  { module: "POS_STORE", label: "Counters / stores", group: "Counter", actions: CRUD },

  // ------------------------------------------------------------------- Catalog
  { module: "CATEGORY", label: "Categories", group: "Catalog", actions: CRUD },
  { module: "HEADER_MENU", label: "Header menu", group: "Catalog", actions: CRUD },
  { module: "TAG", label: "Tags", group: "Catalog", actions: CRUD },
  { module: "PRODUCT", label: "Products", group: "Catalog", actions: CRUD },
  { module: "STYLE", label: "Models", group: "Catalog", actions: CRUD },
  { module: "VARIANT", label: "Colors", group: "Catalog", actions: CRUD },
  { module: "BRAND", label: "Brands", group: "Catalog", actions: CRUD },
  { module: "ATTRIBUTE", label: "Attributes", group: "Catalog", actions: CRUD },
  { module: "UNIT", label: "Units", group: "Catalog", actions: CRUD },
  { module: "SIZE_CHART", label: "Size charts", group: "Catalog", actions: CRUD },

  // ----------------------------------------------------- Inventory & purchases
  { module: "INVENTORY_STOCK", label: "Current stock", group: "Inventory", actions: ["VIEW"] },
  { module: "INVENTORY_PRICING", label: "Pricing", group: "Inventory", actions: ["VIEW", "UPDATE"] },
  { module: "INVENTORY_VALUATION", label: "Valuation & margin", group: "Inventory", actions: ["VIEW"] },
  { module: "STOCK_MOVEMENT", label: "Stock movements", group: "Inventory", actions: ["VIEW"] },
  { module: "STOCK_ADJUSTMENT", label: "Stock adjustment", group: "Inventory", actions: ["VIEW", "CREATE"] },
  { module: "VENDOR", label: "Vendors", group: "Inventory", actions: CRUD },
  {
    module: "PURCHASE_ORDER",
    label: "Purchase orders",
    group: "Inventory",
    actions: ["VIEW", "CREATE", "UPDATE", "CONFIRM", "IMPORT", "DELETE"],
  },
  {
    module: "PURCHASE_RETURN",
    label: "Purchase returns",
    group: "Inventory",
    actions: ["VIEW", "CREATE", "DEBIT_NOTE"],
  },

  // ------------------------------------------------------------ Tax compliance
  { module: "GST_RATE", label: "GST rates", group: "Tax & Compliance", actions: CRUD },
  { module: "HSN_CODE", label: "HSN codes", group: "Tax & Compliance", actions: CRUD },

  // ----------------------------------------------------------------- Marketing
  { module: "COUPON", label: "Coupons", group: "Marketing", actions: CRUD },
  { module: "OFFER", label: "Offers", group: "Marketing", actions: CRUD },
  { module: "BANNER", label: "Banners", group: "Marketing", actions: CRUD },

  // ----------------------------------------------------------------------- CMS
  { module: "BLOG", label: "Blogs", group: "CMS", actions: CRUD },
  { module: "FAQ", label: "FAQs", group: "CMS", actions: CRUD },
  {
    module: "CONTACT_MESSAGE",
    label: "Contact messages",
    group: "CMS",
    actions: ["VIEW", "UPDATE", "DELETE"],
  },
  { module: "REVIEW", label: "Reviews", group: "CMS", actions: ["VIEW", "APPROVE", "DELETE"] },

  // ------------------------------------------------------------ Sales partners
  {
    module: "AGENT",
    label: "Sales partners",
    group: "Sales Partners",
    actions: ["VIEW", "CREATE", "UPDATE", "APPROVE"],
  },
  {
    module: "COMMISSION_RATE",
    label: "Commission rates",
    group: "Sales Partners",
    actions: ["VIEW", "CREATE", "UPDATE"],
  },
  { module: "COMMISSION", label: "Commissions", group: "Sales Partners", actions: ["VIEW", "ADJUST"] },
  { module: "AGENT_PAYOUT", label: "Payouts", group: "Sales Partners", actions: ["VIEW", "CREATE", "APPROVE"] },
  { module: "COMMISSION_REPORT", label: "Commission reports", group: "Sales Partners", actions: ["VIEW", "EXPORT"] },

  // ------------------------------------------------------------------- Reports
  {
    module: "REPORT",
    label: "Reports",
    group: "Reports",
    actions: ["VIEW", "EXPORT", "SALES", "REVENUE", "ORDERS", "PRODUCTS", "CUSTOMERS", "INVENTORY"],
  },

  // ------------------------------------------------------------------ WhatsApp
  {
    module: "WHATSAPP",
    label: "WhatsApp",
    group: "WhatsApp",
    actions: ["VIEW", "CAMPAIGN_VIEW", "CAMPAIGN_CREATE", "CAMPAIGN_SEND", "TEMPLATE_MANAGE", "REPORT_VIEW"],
  },

  // ------------------------------------------------------------ Administration
  { module: "STAFF", label: "Staff", group: "Administration", actions: CRUD },
  { module: "USER", label: "Users", group: "Administration", actions: CRUD },
  { module: "ROLE", label: "Roles", group: "Administration", actions: CRUD },
  { module: "PERMISSION", label: "Permissions", group: "Administration", actions: ["VIEW", "MANAGE"] },
  { module: "SETTINGS", label: "Settings", group: "Administration", actions: ["VIEW", "UPDATE"] },
];

export interface PermissionDefinition {
  name: string;
  slug: string;
  module: string;
  /** Module label plus action, e.g. "Orders — Update". */
  label: string;
  group: string;
}

function toSlug(name: string): string {
  return name.toLowerCase().replace(/_/g, "-");
}

function toActionLabel(action: string): string {
  return action
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Every permission the app defines, flattened from the modules above. */
export const ALL_PERMISSIONS: PermissionDefinition[] = PERMISSION_MODULES.flatMap((mod) =>
  mod.actions.map((action) => {
    const name = `${mod.module}_${action}`;
    return {
      name,
      slug: toSlug(name),
      module: mod.module,
      label: `${mod.label} — ${toActionLabel(action)}`,
      group: mod.group,
    };
  })
);

/** `PERMISSIONS.ORDER_VIEW === "ORDER_VIEW"`, for guards that want a checked constant. */
export const PERMISSIONS: Record<string, string> = Object.fromEntries(
  ALL_PERMISSIONS.map((permission) => [permission.name, permission.name])
);

export type PermissionName = string;
