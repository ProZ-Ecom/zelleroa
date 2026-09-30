type QueryKeyFactory = {
  all: readonly string[];
  lists: () => readonly string[];
  list: (filters?: Record<string, unknown>) => readonly unknown[];
  details: () => readonly string[];
  detail: (id: string | number) => readonly unknown[];
};

function createQueryKeyFactory(base: string): QueryKeyFactory {
  return {
    all: [base] as const,
    lists: () => [base, "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      filters
        ? ([base, "list", filters] as const)
        : ([base, "list"] as const),
    details: () => [base, "detail"] as const,
    detail: (id: string | number) => [base, "detail", id] as const,
  };
}

export const productKeys = createQueryKeyFactory("products");
export const gstRateKeys = createQueryKeyFactory("gst-rates");
export const hsnCodeKeys = createQueryKeyFactory("hsn-codes");
export const categoryKeys = createQueryKeyFactory("categories");
export const brandKeys = createQueryKeyFactory("brands");
export const attributeKeys = createQueryKeyFactory("attributes");
export const unitKeys = createQueryKeyFactory("units");
export const vendorKeys = createQueryKeyFactory("vendors");
export const purchaseKeys = createQueryKeyFactory("purchase-orders");
export const cartKeys = createQueryKeyFactory("cart");
export const wishlistKeys = createQueryKeyFactory("wishlist");
export const orderKeys = createQueryKeyFactory("orders");
export const reviewKeys = createQueryKeyFactory("reviews");
export const blogKeys = createQueryKeyFactory("blogs");
export const couponKeys = createQueryKeyFactory("coupons");
export const offerKeys = createQueryKeyFactory("offers");
export const userKeys = createQueryKeyFactory("users");
export const addressKeys = createQueryKeyFactory("addresses");
export const adminOrderKeys = createQueryKeyFactory("admin-orders");
export const checkoutKeys = createQueryKeyFactory("checkout");
export const roleKeys = createQueryKeyFactory("roles");
export const permissionKeys = createQueryKeyFactory("permissions");
export const variantKeys = createQueryKeyFactory("variants");
export const styleKeys = createQueryKeyFactory("styles");
export const itemKeys = createQueryKeyFactory("items");
export const adminCustomerKeys = createQueryKeyFactory("admin-customers");
export const bannerPositionKeys = createQueryKeyFactory("banner-positions");
export const bannerKeys = createQueryKeyFactory("banners");
export const staffKeys = createQueryKeyFactory("staff");
export const deliveryKeys = createQueryKeyFactory("delivery");
export const returnKeys = createQueryKeyFactory("returns");
export const adminReviewKeys = createQueryKeyFactory("admin-reviews");
export const adminContactKeys = createQueryKeyFactory("admin-contacts");
export const adminBulkOrderKeys = createQueryKeyFactory("admin-bulk-orders");
export const companyKeys = createQueryKeyFactory("company");
export const headerMenuKeys = createQueryKeyFactory("header-menu");
