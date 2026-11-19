import type { VariantMeasurement } from "@/features/variants/utils/measurement.util";
import type { OfferBreakdown } from "@/features/offers/types";

export interface CustomerBrandDto {
  id: string; // Brand UUID
  name: string;
  slug?: string;
  image: string | null;
}

export interface CustomerCategoryDto {
  id: string; // Category UUID
  name: string;
  slug: string;
  parentId: string | null;
  image: string | null;
}

export interface CustomerProductListItemDto {
  id: string; // Product UUID
  name: string;
  description: string | null;
  brand: {
    id: string;
    name: string;
  } | null;
  category: {
    id: string;
    name: string;
  } | null;
  image: string | null;
  minPrice: number;
  maxPrice: number;
  /** Distinct Color count on the Style - shown on the storefront card. */
  colorCount?: number;
  inStock?: boolean;
  outOfStock?: boolean;
  unitPrices?: Array<{
    id: string;
    label: string;
    basePrice: number;
    sellingPrice: number;
    /** The offer that produced `sellingPrice`, or null when none applied. */
    offer?: OfferBreakdown | null;
    discountAmount?: number;
    discountPercent?: number;
  }>;
}

/**
 * A single sellable pack size ("250g", "500g", "1kg", ...) for a variant.
 * Selling price is NOT stored - the repository returns it equal to basePrice,
 * and `catalogOffers` in the customer service layer replaces it with the price
 * the shared offer engine produces before the DTO leaves the server.
 */
export interface CustomerVariantUnitPriceDto {
  id: string; // VariantUnitPrice UUID - this is what cart/wishlist APIs key off
  sku: string;
  measurement: VariantMeasurement;
  /**
   * The Size this row sells, when the Color was split by a Size attribute
   * (VariantUnitPrice.attribute_value_id). Null for catalogs that use this
   * table for pack sizes (250g/500g) instead of clothing sizes.
   */
  sizeId: string | null;
  sizeLabel: string | null;
  /** What the size/pack chip shows: `sizeLabel`, else the measurement label. */
  label: string;
  /**
   * Every variation value this row sells (Size=M, Neck=V, Sleeve=Half), so a
   * selection across several attributes resolves to exactly one row. Empty for a
   * pack-size row, which is distinguished by its measurement instead.
   */
  attributes: {
    attributeId: string;
    attributeName: string;
    valueId: string;
    value: string;
  }[];
  basePrice: number;
  sellingPrice: number;
  isDefault: boolean;
  /** The offer that produced `sellingPrice`, or null when none applied. */
  offer?: OfferBreakdown | null;
  discountAmount?: number;
  discountPercent?: number;
  /** Current available quantity for this exact color+unit combination. */
  stock: number;
  inStock: boolean;
}

export interface CustomerVariantImageDto {
  id: string;
  imageUrl: string;
  sortOrder: number;
  isPrimary: boolean;
}

export interface CustomerVariantListItemDto {
  id: string; // Variant UUID (Color level)
  styleId: string; // Style UUID
  styleName: string;
  /** @deprecated use styleId - kept for callers not yet migrated */
  productId: string;
  /** @deprecated use styleName */
  productName: string;
  variantName: string;
  measurement: VariantMeasurement;
  sku: string;
  basePrice: number;
  /** Default pack size's price after offers; mirrors `unitPrices`. */
  salePrice: number;
  primaryImage: string | null;
  /** This variant's color, when the Style distinguishes variants by color. */
  colorName: string | null;
  colorHex: string | null;
  /** Full set of images for this color - the gallery to show when this variant/color is selected. */
  images: CustomerVariantImageDto[];
  inStock?: boolean;
  outOfStock?: boolean;
  // Full list of sellable Sizes/pack sizes for this color - each independently
  // priced. `sku`/`basePrice`/`salePrice`/`measurement` above mirror the
  // default (or first) entry here for callers that expect a single price/sku.
  unitPrices: CustomerVariantUnitPriceDto[];
  /** This variant's non-color, non-size attribute values (e.g. Fabric=Cotton). */
  attributeValues: Array<{ attributeName: string; valueId: string; value: string }>;
}

export interface CustomerVariantDetailDto extends CustomerVariantListItemDto {
  images: CustomerVariantImageDto[];
}

/**
 * A single sellable style/design under a Product (e.g. Product "T-Shirt" ->
 * Style "V Neck T-Shirt"). Holds the style-level description/ingredients/etc,
 * and the Color variants the customer picks between.
 */
export interface CustomerProductStyleDto {
  id: string; // Style UUID
  productId: string;
  productName: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  ingredients: string | null;
  isReadyToMix: boolean;
  cookingRecipe: string | null;
  shelfLife: string | null;
  vegType: "veg" | "nonveg" | "vegan" | "na";
  isDefault: boolean;
  /** Style-level fallback images, used when this Style has no Color split. */
  images: CustomerVariantImageDto[];
  variants: CustomerVariantListItemDto[];
}

export interface CustomerProductDetailDto {
  id: string; // Product UUID
  name: string;
  description: string | null;
  brand: {
    id: string;
    name: string;
  } | null;
  category: {
    id: string;
    name: string;
  } | null;
  image: string | null;
  gender: "men" | "women" | "kids" | "unisex" | null;
  styles: CustomerProductStyleDto[];
}

/**
 * One related product returned by the related-products API. It is variant-level
 * (a single representative variant per related product) so the storefront can
 * link/add straight to a sellable row, while still carrying the product,
 * category and brand context the card needs.
 */
export interface CustomerRelatedVariantDto {
  productId: string; // Product UUID
  productName: string;
  variantId: string; // Variant UUID
  variantName: string;
  measurement: VariantMeasurement;
  sku: string;
  /** The pack size `price`/`offerPrice` refer to - what cart APIs key off. */
  unitPriceId: string | null;
  // `price` is the catalog base price; `offerPrice` is what the shared offer
  // engine charges, and is null when no offer applies.
  price: number;
  offerPrice: number | null;
  image: string | null;
  category: {
    id: string;
    name: string;
  } | null;
  subcategory: {
    id: string;
    name: string;
  } | null;
  brand: {
    id: string;
    name: string;
  } | null;
  inStock: boolean;
  stockQuantity: number;
}

// ---------------------------------------------------------------------------
// Style -> Color -> Size storefront flow
//
// The listing shows one card per Style; the Style's own page reveals its
// Colors, and each Color its own Sizes, each with its own price and stock.
// These DTOs carry that whole tree in one response so the client never has to
// re-fetch while the shopper switches Color/Size.
// ---------------------------------------------------------------------------

/** A Style as the storefront renders it, with the Colors the shopper picks
 *  between and each Color's own Sizes. */
export interface CustomerStyleViewDto {
  id: string; // Style UUID
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  isDefault: boolean;
  outOfStock: boolean;
  /** Default image: the default Color's primary image, else the Style's. */
  image: string | null;
  /** Shown before a Color is picked, and for Styles with no Color split. */
  images: CustomerVariantImageDto[];
  minPrice: number;
  maxPrice: number;
  /** True when at least one Color carries Sizes (a Size attribute value). */
  hasSizes: boolean;
  inStock: boolean;
  /** One entry per Color (ProductVariant), each with its own images/sizes. */
  colors: CustomerVariantListItemDto[];
  /**
   * The Style's own extra attributes - Material, Fit, Pattern and so on. These
   * describe the Style as a whole, so they are shown as plain facts rather than
   * as something to pick; Color and Size are excluded, having their own
   * selectors. Empty when the Style carries none.
   */
  attributes: Array<{ attributeName: string; valueId: string; value: string }>;
}

/** A Style on its own page: everything the storefront needs to render it,
 *  plus the Product/brand/category context for breadcrumbs and fallbacks. */
export interface CustomerStyleDetailDto extends CustomerStyleViewDto {
  ingredients: string | null;
  isReadyToMix: boolean;
  cookingRecipe: string | null;
  shelfLife: string | null;
  vegType: "veg" | "nonveg" | "vegan" | "na";
  product: {
    id: string;
    name: string;
    gender: "men" | "women" | "kids" | "unisex" | null;
  };
  brand: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
}

export interface GlobalSearchResultDto {
  query: string;
  products: CustomerProductListItemDto[];
  categories: CustomerCategoryDto[];
  brands: CustomerBrandDto[];
  totalMatches: number;
}
