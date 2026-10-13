import type { ListingGender } from "../utils/catalog-listing-query";

/**
 * Category listing (`GET /api/customer/catalog/listing`) - the category page's
 * cards, and the filters that apply to *that* category, in one response. The
 * filters are derived from the Items actually sellable in the category, so a
 * Dresses page offers Size/Colour/Fabric while a Watches page offers Strap/Dial
 * without either being configured in the frontend.
 */

export interface ListingCategoryRefDto {
  id: string; // Category UUID
  name: string;
  slug: string;
}

/** A category tile in the browse strip, with the image shown in its circle. */
export interface ListingSubcategoryDto extends ListingCategoryRefDto {
  image: string | null;
}

export interface ListingCategoryDto extends ListingCategoryRefDto {
  description: string | null;
  image: string | null;
  /** Root-first chain of ancestors, for the breadcrumb. */
  ancestors: ListingCategoryRefDto[];
}

export type ListingStockStatus = "in_stock" | "low_stock" | "out_of_stock";

/**
 * One card per Item - Items of the same Style are listed separately. Prices
 * already include any live offer.
 */
export interface ListingItemCardDto {
  id: string; // Item UUID - the card links to /items/:id
  name: string;
  /** The Style the Item belongs to, shown as the card's eyebrow. */
  styleName: string;
  description: string | null;
  image: string | null;
  brand: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
  /**
   * Price of the cheapest unit that satisfies the active filters: what the
   * shopper pays (`price`) and, when an offer applies, the pre-offer price.
   */
  price: number;
  originalPrice: number | null;
  discountPercent: number;
  /** True when the matching units span more than one price ("From ₹x"). */
  hasPriceRange: boolean;
  /**
   * The Colour the card is showing: the one matching the Colour filter when
   * one is applied, otherwise the Item's default Colour.
   */
  selectedColor: { name: string; hex: string | null } | null;
  /** Every Colour available for the Item (swatches), default first. */
  colors: Array<{ name: string; hex: string | null }>;
  rating: { average: number; count: number } | null;
  stockStatus: ListingStockStatus;
  isNew: boolean;
}

export interface ListingFilterValueDto {
  /** What goes in the URL (`?size=M`) - the value's own label. */
  key: string;
  label: string;
  colorHex: string | null;
  /** Items this value would show, given every *other* active filter. */
  count: number;
  selected: boolean;
}

export interface ListingAttributeFilterDto {
  /** URL key - the attribute slug, lower-cased (`?size=`, `?colour=`). */
  key: string;
  name: string;
  type: "text" | "color";
  /** From ProductAttribute.multiple_selection. Single-select filters act as radios. */
  multiple: boolean;
  values: ListingFilterValueDto[];
}

export interface ListingFiltersDto {
  /** Bounds of the category's selling prices, independent of the active filters. */
  priceRange: { min: number; max: number } | null;
  attributes: ListingAttributeFilterDto[];
  brands: ListingFilterValueDto[];
  genders: Array<Omit<ListingFilterValueDto, "key"> & { key: ListingGender }>;
  /** Null when every Item has the same availability - nothing to filter on. */
  availability: { inStockCount: number; outOfStockCount: number } | null;
}

export interface CategoryListingDto {
  /** Null on the "all" listing. */
  category: ListingCategoryDto | null;
  /**
   * Categories to browse into: the category's active direct children (whose
   * products are already included here), or the root categories on "all".
   * A leaf category lists its siblings instead, so the shopper can hop
   * between them; `activeSubcategoryId` marks the current one.
   */
  subcategories: ListingSubcategoryDto[];
  activeSubcategoryId: string | null;
  /** Image per category UUID, for strips built from a header nav item's categories. */
  categoryImages: Record<string, string | null>;
  items: ListingItemCardDto[];
  filters: ListingFiltersDto;
}

/** One Item link in the header category menu. */
export interface CategoryMenuItemDto {
  id: string; // Item UUID
  name: string;
  image: string | null;
}

/** One Product in the header category menu, with the Items sold under it. */
export interface CategoryMenuProductDto {
  id: string; // Product UUID
  name: string;
  items: CategoryMenuItemDto[];
}

/** What the header shows when a category is hovered. */
export interface CategoryMenuDto {
  products: CategoryMenuProductDto[];
}
