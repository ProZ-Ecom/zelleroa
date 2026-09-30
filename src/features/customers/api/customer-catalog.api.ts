import { apiClient } from "@/lib/api/api-client";
import type {
  CustomerBrandDto,
  CustomerCategoryDto,
  CustomerProductListItemDto,
  CustomerProductDetailDto,
  CustomerVariantListItemDto,
  CustomerVariantDetailDto,
  CustomerStyleDetailDto,
  CustomerItemDetailDto,
} from "../types/catalog.types";
import type { CategoryListingDto, CategoryMenuDto } from "../types/catalog-listing.types";
import type {
  CustomerBrandListInput,
  CustomerCategoryListInput,
  CustomerProductListInput,
  CustomerVariantListInput,
  CustomerGlobalVariantListInput,
} from "../validations/catalog.schema";
import type { ApiResponse } from "@/lib/api/api-response";

export interface CatalogFacets {
  inStockCount: number;
  outOfStockCount: number;
  vegCount: number;
  nonVegCount: number;
  veganCount?: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  pageSize?: number;
  total: number;
  totalPages: number;
  facets?: CatalogFacets;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta?: PaginationMeta;
}

export const customerCatalogApi = {
  /**
   * Fetch customer brand list
   * Postman: POST /api/customer/brands
   */
  async getBrands(
    params?: CustomerBrandListInput
  ): Promise<PaginatedResponse<CustomerBrandDto>> {
    const response = await apiClient.post<CustomerBrandDto[]>(
      "/api/customer/brands",
      params || {}
    );
    return {
      data: response.data ?? [],
      meta: response.meta as PaginationMeta | undefined,
    };
  },

  /**
   * Fetch single brand by UUID
   * Postman: GET /api/customer/brands/:uuid
   */
  async getBrand(uuid: string): Promise<CustomerBrandDto> {
    const response = await apiClient.get<CustomerBrandDto>(
      `/api/customer/brands/${uuid}`
    );
    return response.data!;
  },

  /**
   * Fetch customer categories list
   * Postman: POST /api/customer/categories
   */
  async getCategories(
    params?: CustomerCategoryListInput
  ): Promise<PaginatedResponse<CustomerCategoryDto>> {
    const response = await apiClient.post<CustomerCategoryDto[]>(
      "/api/customer/categories",
      params || {}
    );
    return {
      data: response.data ?? [],
      meta: response.meta as PaginationMeta | undefined,
    };
  },

  /**
   * Fetch single category by UUID
   * Postman: GET /api/customer/categories/:uuid
   */
  async getCategory(uuid: string): Promise<CustomerCategoryDto> {
    const response = await apiClient.get<CustomerCategoryDto>(
      `/api/customer/categories/${uuid}`
    );
    return response.data!;
  },

  /**
   * Fetch customer products list with filters (brands, categories, min/max price, search, sorting)
   * Postman: POST /api/customer/products
   */
  async getProducts(
    params?: CustomerProductListInput
  ): Promise<PaginatedResponse<CustomerProductListItemDto>> {
    const response = await apiClient.post<CustomerProductListItemDto[]>(
      "/api/customer/products",
      params || {}
    );
    return {
      data: response.data ?? [],
      meta: response.meta as PaginationMeta | undefined,
    };
  },

  /**
   * Category page listing: a page of Style cards plus the category's own
   * filters. `queryString` is the storefront page's filter query string
   * (see `serializeListingQuery`), forwarded unchanged.
   * GET /api/customer/catalog/listing
   */
  async getCategoryListing(params: {
    category: string;
    queryString: string;
    page: number;
    pageSize: number;
  }): Promise<{ data: CategoryListingDto; meta: PaginationMeta }> {
    const qs = new URLSearchParams(params.queryString);
    qs.set("category", params.category);
    qs.set("page", String(params.page));
    qs.set("pageSize", String(params.pageSize));
    const response = await apiClient.get<CategoryListingDto>(
      `/api/customer/catalog/listing?${qs.toString()}`
    );
    return {
      data: response.data!,
      meta: response.meta as PaginationMeta,
    };
  },

  /**
   * Header menu preview: Products (with their Items) under a category.
   * GET /api/customer/catalog/menu?category=
   */
  async getCategoryMenu(category: string, gender?: string | null): Promise<CategoryMenuDto> {
    const genderQuery = gender ? `&gender=${encodeURIComponent(gender)}` : "";
    const response = await apiClient.get<CategoryMenuDto>(
      `/api/customer/catalog/menu?category=${encodeURIComponent(category)}${genderQuery}`
    );
    return response.data ?? { products: [] };
  },

  /**
   * Fetch the storefront listing as Styles: one card per Style, never per
   * Item or per Color.
   * Postman: POST /api/customer/styles
   */
  async getStyles(
    params?: CustomerProductListInput
  ): Promise<PaginatedResponse<CustomerProductListItemDto>> {
    const response = await apiClient.post<CustomerProductListItemDto[]>(
      "/api/customer/styles",
      params || {}
    );
    return {
      data: response.data ?? [],
      meta: response.meta as PaginationMeta | undefined,
    };
  },

  /**
   * Fetch one Style with every Item under it - each Item carrying its Colors,
   * and each Color its own images, Sizes, prices and stock.
   * Postman: GET /api/customer/styles/:styleUuid
   */
  async getStyle(styleUuid: string): Promise<CustomerStyleDetailDto> {
    const response = await apiClient.get<CustomerStyleDetailDto>(
      `/api/customer/styles/${styleUuid}`
    );
    return response.data!;
  },

  /**
   * Fetch one Item with its Colors, and each Color's images, Sizes, prices
   * and stock - the standalone Item detail page.
   * Postman: GET /api/customer/items/:itemUuid
   */
  async getItem(itemUuid: string): Promise<CustomerItemDetailDto> {
    const response = await apiClient.get<CustomerItemDetailDto>(
      `/api/customer/items/${itemUuid}`
    );
    return response.data!;
  },

  /**
   * Fetch customer product detail by product UUID
   * Postman: GET /api/customer/products/:productUuid
   */
  async getProduct(productUuid: string): Promise<CustomerProductDetailDto> {
    const response = await apiClient.get<CustomerProductDetailDto>(
      `/api/customer/products/${productUuid}`
    );
    return response.data!;
  },

  /**
   * Fetch related products for a given product (same category/brand)
   * Postman: GET /api/customer/products/:productUuid/related
   */
  async getRelatedProducts(
    productUuid: string,
    limit?: number
  ): Promise<CustomerProductListItemDto[]> {
    const response = await apiClient.get<CustomerProductListItemDto[]>(
      `/api/customer/products/${productUuid}/related${limit ? `?limit=${limit}` : ""}`
    );
    return response.data ?? [];
  },

  /**
   * Fetch the current customer's recently viewed products, most recent first.
   * Postman: GET /api/customer/recently-viewed
   */
  async getRecentlyViewed(
    excludeProductUuid?: string,
    limit?: number
  ): Promise<CustomerProductListItemDto[]> {
    const params = new URLSearchParams();
    if (excludeProductUuid) params.set("exclude", excludeProductUuid);
    if (limit) params.set("limit", String(limit));
    const query = params.toString();
    const response = await apiClient.get<CustomerProductListItemDto[]>(
      `/api/customer/recently-viewed${query ? `?${query}` : ""}`
    );
    return response.data ?? [];
  },

  /**
   * Records a product view for the current customer.
   * Postman: POST /api/customer/recently-viewed
   */
  async recordProductView(productUuid: string): Promise<void> {
    await apiClient.post("/api/customer/recently-viewed", { productId: productUuid });
  },

  /**
   * Fetch variants of a specific product with min/max price filter
   * Postman: POST /api/customer/products/:productUuid/variants
   */
  async getProductVariants(
    productUuid: string,
    params?: CustomerVariantListInput
  ): Promise<PaginatedResponse<CustomerVariantListItemDto>> {
    const response = await apiClient.post<CustomerVariantListItemDto[]>(
      `/api/customer/products/${productUuid}/variants`,
      params || {}
    );
    return {
      data: response.data ?? [],
      meta: response.meta as PaginationMeta | undefined,
    };
  },

  /**
   * Fetch single variant details
   * Postman: GET /api/customer/products/:productUuid/variants/:variantUuid
   */
  async getVariant(
    productUuid: string,
    variantUuid: string
  ): Promise<CustomerVariantDetailDto> {
    const response = await apiClient.get<CustomerVariantDetailDto>(
      `/api/customer/products/${productUuid}/variants/${variantUuid}`
    );
    return response.data!;
  },

  /**
   * Fetch all variants global catalog filter
   * Postman: POST /api/customer/variants
   */
  async getAllVariants(
    params?: CustomerGlobalVariantListInput
  ): Promise<PaginatedResponse<CustomerVariantListItemDto>> {
    const response = await apiClient.post<CustomerVariantListItemDto[]>(
      "/api/customer/variants",
      params || {}
    );
    return {
      data: response.data ?? [],
      meta: response.meta as PaginationMeta | undefined,
    };
  },

  /**
   * Fetch promotional banners
   * Postman: GET /api/customer/banners
   */
  async getBanners(position?: string) {
    const response = await apiClient.get<any[]>(
      `/api/customer/banners${position ? `?position=${position}` : ""}`
    );
    return response.data ?? [];
  },
};
