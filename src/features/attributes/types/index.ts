export type AttributeType = "text" | "color";

export interface AttributeValueItem {
  id: string; // Public UUID
  value: string;
  colorHex?: string | null;
  imageUrl?: string | null;
  isActive: boolean;
  createdAt: Date;
  priceAdjustment: number;
}

export interface AttributeListItem {
  id: string; // Public UUID
  name: string;
  slug: string;
  type: AttributeType;
  multipleSelection: boolean;
  isActive: boolean;
  createdAt: Date;
  values: AttributeValueItem[];
  _count?: { values?: number };
}

export interface GetAdminAttributesParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

/**
 * How far down the catalog an attribute splits stock, chosen per product.
 *
 * VARIANT becomes a ProductVariant and carries its own images (normally Colour);
 * SKU joins the VariantUnitPrice identity, so it splits stock (Size, Neck, Storage);
 * INFO is descriptive only and never multiplies the SKU set (Fabric, Fit, Care).
 */
export type VariationLevel = "VARIANT" | "SKU" | "INFO";

/** One attribute configured on a Product, with its selectable values (e.g.
 * Color: Black/White with hex codes) - powers the single-variant Add/Edit
 * Item form and the bulk Generate Variants form. */
export interface ConfiguredProductAttribute {
  id: string; // Attribute UUID
  name: string;
  slug: string;
  type: AttributeType;
  isRequired: boolean;
  multipleSelection: boolean;
  variationLevel: VariationLevel;
  sortOrder: number;
  values: AttributeValueItem[];
}

/** One attribute configured on a Product, with whether it's currently enabled. */
export interface ProductAttributeConfigOption {
  id: string; // Attribute UUID
  name: string;
  slug: string;
  type: AttributeType;
  configured: boolean;
  isRequired: boolean;
  multipleSelection: boolean;
  sortOrder: number;
  /** Defaults to SKU for an attribute that is not configured on this product yet. */
  variationLevel: VariationLevel;
}

/** One attribute value under an Item, with whether it's currently selected. */
export interface ItemAttributeValueOption {
  id: string; // AttributeValue UUID
  value: string;
  colorHex?: string | null;
  imageUrl?: string | null;
  selected: boolean;
}

/** One Product-configured attribute rendered on the Item form, with its
 * values flagged for whether this specific Item currently has them selected. */
export interface ItemAttributeGroup {
  id: string; // Attribute UUID
  name: string;
  slug: string;
  type: AttributeType;
  isRequired: boolean;
  /** Whether an Item can pick several of this attribute's values (OFF means
   * exactly one value may be selected, driven by the Attribute Master's
   * "Multiple Selection" setting). */
  multipleSelection: boolean;
  values: ItemAttributeValueOption[];
}

export interface ProductAttributeUsage {
  attributeId: string;
  attributeName: string;
  itemCount: number;
  variantCount: number;
  /** Stock rows whose identity includes this attribute. */
  skuCount: number;
  /** Whether the attribute is being unconfigured outright or just moved off the SKU axis. */
  change: "removed" | "demoted";
}
