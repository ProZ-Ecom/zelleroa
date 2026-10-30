export const PERMISSIONS = {
  // Product
  PRODUCT_VIEW: "PRODUCT_VIEW",
  PRODUCT_CREATE: "PRODUCT_CREATE",
  PRODUCT_UPDATE: "PRODUCT_UPDATE",
  PRODUCT_DELETE: "PRODUCT_DELETE",

  // Model
  MODELS_VIEW: "MODELS_VIEW",
  MODEL_VIEW: "MODELS_VIEW",

  // Colors / Variants
  COLORS_LIST: "COLORS_LIST",
  COLORS_CREATE: "COLORS_CREATE",

  // Brand
  BRAND_LIST: "BRAND_LIST",
  BRAND_CREATE: "BRAND_CREATE",
  BRAND_UPDATE: "BRAND_UPDATE",
  BRAND_DELETE: "BRAND_DELETE",

  // Category
  CATEGORY_VIEW: "CATEGORY_VIEW",
  CATEGORY_CREATE: "CATEGORY_CREATE",
  CATEGORY_UPDATE: "CATEGORY_UPDATE",
  CATEGORY_DELETE: "CATEGORY_DELETE",

  // Order
  ORDER_VIEW: "ORDER_VIEW",
  ORDER_UPDATE: "ORDER_UPDATE",
  ORDER_DELETE: "ORDER_DELETE",

  // User
  USER_VIEW: "USER_VIEW",
  USER_CREATE: "USER_CREATE",
  USER_UPDATE: "USER_UPDATE",
  USER_DELETE: "USER_DELETE",

  // Review
  REVIEW_VIEW: "REVIEW_VIEW",
  REVIEW_APPROVE: "REVIEW_APPROVE",
  REVIEW_DELETE: "REVIEW_DELETE",

  // Coupon
  COUPON_VIEW: "COUPON_VIEW",
  COUPON_CREATE: "COUPON_CREATE",
  COUPON_UPDATE: "COUPON_UPDATE",
  COUPON_DELETE: "COUPON_DELETE",

  // Banner
  BANNER_VIEW: "BANNER_VIEW",
  BANNER_CREATE: "BANNER_CREATE",
  BANNER_UPDATE: "BANNER_UPDATE",
  BANNER_DELETE: "BANNER_DELETE",

  // Blog
  BLOG_VIEW: "BLOG_VIEW",
  BLOG_CREATE: "BLOG_CREATE",
  BLOG_UPDATE: "BLOG_UPDATE",
  BLOG_DELETE: "BLOG_DELETE",

  // Report
  REPORT_VIEW: "REPORT_VIEW",

  // Settings
  SETTINGS_VIEW: "SETTINGS_VIEW",
  SETTINGS_UPDATE: "SETTINGS_UPDATE",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export function hasPermission(
  userPermissions: string[],
  permission: Permission
): boolean {
  return userPermissions.includes(permission);
}

export function hasAnyPermission(
  userPermissions: string[],
  permissions: Permission[]
): boolean {
  return permissions.some((p) => userPermissions.includes(p));
}

export function hasAllPermissions(
  userPermissions: string[],
  permissions: Permission[]
): boolean {
  return permissions.every((p) => userPermissions.includes(p));
}
