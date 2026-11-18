import { ApiError } from "@/lib/api/api-error";
import { catalogRepository } from "../repositories/catalog.repository";
import { catalogOffers } from "./catalog-offers";
import type {
  CustomerBrandListInput,
  CustomerCategoryListInput,
  CustomerProductListInput,
  CustomerVariantListInput,
  CustomerGlobalVariantListInput,
  CustomerRelatedVariantsQueryInput,
} from "../validations/catalog.schema";

export const catalogService = {
  // Brand Methods
  async getBrands(params: CustomerBrandListInput) {
    return catalogRepository.findCustomerBrands(params);
  },

  async getBrandByUuid(uuid: string) {
    const brand = await catalogRepository.findCustomerBrandByUuid(uuid);
    if (!brand) {
      throw ApiError.notFound("Brand not found");
    }
    return brand;
  },

  // Category Methods
  async getCategories(params: CustomerCategoryListInput) {
    return catalogRepository.findCustomerCategories(params);
  },

  async getCategoryByUuid(uuid: string) {
    const category = await catalogRepository.findCustomerCategoryByUuid(uuid);
    if (!category) {
      throw ApiError.notFound("Category not found");
    }
    return category;
  },

  // Product Methods
  //
  // Every read below goes through `catalogOffers`, which is what turns the
  // repository's catalog prices into the prices the shopper is quoted. Adding
  // a new catalog read without it would show undiscounted prices.
  async getProducts(params: CustomerProductListInput) {
    const result = await catalogRepository.findCustomerProducts(params);
    await catalogOffers.decorateProducts(result.data);
    return result;
  },

  // Storefront listing is Style-based: one card per Style, never per Item or
  // per Color, no matter how many Items/Colors that Style has.
  async getStyles(params: CustomerProductListInput) {
    const result = await catalogRepository.findCustomerStyleListItems(params);
    await catalogOffers.decorateProducts(result.data);
    return result;
  },

  /**
   * The Style detail page: the Style plus every Item under it, each Item with
   * its Colors, and each Color with its own images, Sizes, prices and stock.
   */
  async getStyleByUuid(uuid: string) {
    const style = await catalogRepository.findCustomerStyleDetailByUuid(uuid);
    if (!style) {
      throw ApiError.notFound("Style not found");
    }
    return catalogOffers.decorateStyleDetail(style);
  },

  /**
   * One Item on its own page - the same Color/Size tree the Style detail page
   * shows for a selected Item, fetched directly by Item UUID.
   */
  async getItemByUuid(uuid: string) {
    const item = await catalogRepository.findCustomerItemDetailByUuid(uuid);
    if (!item) {
      throw ApiError.notFound("Item not found");
    }
    return catalogOffers.decorateItemDetail(item);
  },

  async getProductByUuid(uuid: string) {
    const product = await catalogRepository.findCustomerProductByUuid(uuid);
    if (!product) {
      throw ApiError.notFound("Product not found");
    }
    return catalogOffers.decorateProductDetail(product);
  },

  async getRelatedProducts(uuid: string, limit: number) {
    const related = await catalogRepository.findRelatedProducts(uuid, limit);
    if (related === null) {
      throw ApiError.notFound("Product not found");
    }
    await catalogOffers.decorateProducts(related);
    return related;
  },

  // Variant Methods
  async getVariants(productUuid: string, params: CustomerVariantListInput) {
    const result = await catalogRepository.findCustomerVariantsByProductUuid(
      productUuid,
      params
    );
    if (!result) {
      throw ApiError.notFound("Product not found");
    }
    await catalogOffers.decorateVariants(result.data);
    return result;
  },

  async getVariantByUuids(productUuid: string, variantUuid: string) {
    const variant = await catalogRepository.findCustomerVariantByUuids(
      productUuid,
      variantUuid
    );
    if (!variant) {
      throw ApiError.notFound("Variant not found");
    }
    return catalogOffers.decorateVariant(variant);
  },

  /**
   * Related items for a variant, resolved through the product's
   * category/subcategory and brand relationships. Returns an empty page rather
   * than a 404 when the variant exists but nothing relates to it.
   */
  async getRelatedVariants(variantId: string, params: CustomerRelatedVariantsQueryInput) {
    const result = await catalogRepository.findRelatedVariantsByVariantId(variantId, params);
    if (result === null) {
      throw ApiError.notFound("Variant not found");
    }
    await catalogOffers.decorateRelatedVariants(result.data);
    return result;
  },

  async getGlobalVariants(params: CustomerGlobalVariantListInput) {
    const result = await catalogRepository.findCustomerGlobalVariants(params);
    await catalogOffers.decorateVariants(result.data);
    return result;
  },

  /**
   * Unified global search across styles/products, categories, and brands.
   * Products are decorated with active promotional offers.
   */
  async globalSearch(params: {
    query: string;
    productLimit?: number;
    categoryLimit?: number;
    brandLimit?: number;
  }) {
    const result = await catalogRepository.globalSearch(params);
    if (result.products.length > 0) {
      await catalogOffers.decorateProducts(result.products);
    }
    return result;
  },
};
