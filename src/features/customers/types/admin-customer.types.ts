import type { VariantMeasurement } from "@/features/variants/utils/measurement.util";

export interface AdminCustomerListItemDto {
  id: string; // customer_profiles.uuid
  userId: string; // users.uuid
  customerId: string | null; // users.cust_id
  name: string;
  email: string;
  phone: string;
  profileImage: string | null;
  isWhatsapp: boolean;
  whatsappNo: string | null;
  dob: string | null; // YYYY-MM-DD
  gender: "male" | "female" | "other" | "not_applicable" | null;
  referralCode: string | null;
  status: "active" | "inactive" | "banned";
  isActive: boolean;
  isBlocked: boolean;
  blockReason: string | null;
  blockedAt: Date | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminCustomerDetailDto {
  id: string; // users.uuid
  customerId: string | null; // users.cust_id
  name: string;
  email: string | null;
  phone: string | null;
  profileImage: string | null;
  dob: string | null; // YYYY-MM-DD
  gender: string | null;
  isWhatsapp: boolean;
  whatsappNo: string | null;
  referralCode: string | null;
  status: string;
  isActive: boolean;
  isBlocked: boolean;
  blockReason: string | null;
  blockedAt: Date | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminCustomerAddressDto {
  id: string; // customer_addresses.uuid
  type: string; // home / work / other
  addressType: "shipping" | "billing";
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminCustomerOrderItemDto {
  id: string; // orders.uuid
  orderNumber: string;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  totalItems: number;
  placedAt: Date | null;
  createdAt: Date;
}

export interface AdminCustomerCartItemDto {
  id: string; // cartItem.uuid
  productId: string; // product.uuid
  productName: string;
  variantId: string; // variant.uuid
  variantName: string;
  sku: string;
  measurement: VariantMeasurement;
  primaryImage: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface AdminCustomerCartDto {
  id: string; // cart.uuid
  status: string;
  totalItems: number;
  subtotal: number;
  createdAt: Date;
  updatedAt: Date;
  items: AdminCustomerCartItemDto[];
}

export interface AdminCustomerListPaginationMeta {
  page: number;
  limit: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AdminCustomerListResponse {
  data: AdminCustomerListItemDto[];
  meta: AdminCustomerListPaginationMeta;
}

export interface AdminCustomerOrdersResponse {
  data: AdminCustomerOrderItemDto[];
  meta: AdminCustomerListPaginationMeta;
}

export interface AdminCustomersCountResponse {
  active: number;
  inactive: number;
  blocked: number;
  unblocked: number;
  verified: number;
  unverified: number;
  male: number;
  female: number;
  other: number;
  all: number;
}

