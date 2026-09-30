/**
 * The category listing's URL is its API contract: the page's query string
 * (`/category/dresses?colour=Black&size=M,L&minPrice=500`) is forwarded as-is
 * to `GET /api/customer/catalog/listing`, and both sides read it through this
 * one module. That keeps "refresh preserves the filters" true by construction
 * - there is no second copy of the filter state to drift out of sync.
 *
 * Attribute filters are not a fixed list. Any query key that isn't one of the
 * reserved keys below is treated as an attribute slug (lower-cased), and its
 * comma-separated values as that attribute's value labels. Which attributes
 * exist is decided by the catalog data, never by the frontend.
 */

export const LISTING_SORT_OPTIONS = [
  { value: "relevance", label: "Relevance" },
  { value: "popularity", label: "Popularity" },
  { value: "newest", label: "Newest First" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "rating", label: "Customer Rating" },
] as const;

export type ListingSort = (typeof LISTING_SORT_OPTIONS)[number]["value"];

export const DEFAULT_LISTING_SORT: ListingSort = "relevance";

export const LISTING_GENDERS = ["men", "women", "kids", "unisex"] as const;
export type ListingGender = (typeof LISTING_GENDERS)[number];

/** Query keys with a fixed meaning - never read as attribute slugs. */
export const RESERVED_LISTING_KEYS = new Set([
  "category",
  "page",
  "pageSize",
  "q",
  "sort",
  "minPrice",
  "maxPrice",
  "inStock",
  "brand",
  "gender",
]);

export interface ListingQuery {
  search: string;
  sort: ListingSort;
  minPrice: number | null;
  maxPrice: number | null;
  inStockOnly: boolean;
  /** Brand slugs, lower-cased. */
  brands: string[];
  genders: ListingGender[];
  /** Attribute slug (lower-cased) -> selected value labels. */
  attributes: Record<string, string[]>;
}

export const EMPTY_LISTING_QUERY: ListingQuery = {
  search: "",
  sort: DEFAULT_LISTING_SORT,
  minPrice: null,
  maxPrice: null,
  inStockOnly: false,
  brands: [],
  genders: [],
  attributes: {},
};

const MAX_VALUES_PER_KEY = 50;
const MAX_ATTRIBUTE_KEYS = 30;

function splitList(raw: string | null): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const value = part.trim().slice(0, 150);
    const dedupeKey = value.toLowerCase();
    if (!value || seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push(value);
    if (out.length >= MAX_VALUES_PER_KEY) break;
  }
  return out;
}

function parsePrice(raw: string | null): number | null {
  if (raw === null || raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
}

type SearchParamsLike = Pick<URLSearchParams, "get" | "forEach">;

export function parseListingQuery(params: SearchParamsLike): ListingQuery {
  const rawSort = params.get("sort");
  const sort = LISTING_SORT_OPTIONS.some((o) => o.value === rawSort)
    ? (rawSort as ListingSort)
    : DEFAULT_LISTING_SORT;

  let minPrice = parsePrice(params.get("minPrice"));
  let maxPrice = parsePrice(params.get("maxPrice"));
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    [minPrice, maxPrice] = [maxPrice, minPrice];
  }

  const genders = splitList(params.get("gender"))
    .map((g) => g.toLowerCase())
    .filter((g): g is ListingGender => (LISTING_GENDERS as readonly string[]).includes(g));

  const attributes: Record<string, string[]> = {};
  params.forEach((value, rawKey) => {
    if (RESERVED_LISTING_KEYS.has(rawKey)) return;
    if (Object.keys(attributes).length >= MAX_ATTRIBUTE_KEYS) return;
    const key = rawKey.trim().toLowerCase().slice(0, 120);
    if (!key || RESERVED_LISTING_KEYS.has(key)) return;
    const values = splitList(value);
    if (values.length > 0) attributes[key] = values;
  });

  return {
    search: (params.get("q") ?? "").trim().slice(0, 100),
    sort,
    minPrice,
    maxPrice,
    inStockOnly: params.get("inStock") === "1" || params.get("inStock") === "true",
    brands: splitList(params.get("brand")).map((b) => b.toLowerCase()),
    genders,
    attributes,
  };
}

/**
 * Inverse of `parseListingQuery`. Defaults are omitted so an unfiltered page
 * keeps a clean URL (`/category/dresses`), and keys are written in a stable
 * order so the same filters always produce the same URL / query-cache key.
 */
export function serializeListingQuery(query: ListingQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.search) params.set("q", query.search);

  for (const key of Object.keys(query.attributes).sort()) {
    const values = query.attributes[key];
    if (values && values.length > 0) params.set(key, values.join(","));
  }

  if (query.brands.length > 0) params.set("brand", query.brands.join(","));
  if (query.genders.length > 0) params.set("gender", query.genders.join(","));
  if (query.minPrice !== null) params.set("minPrice", String(query.minPrice));
  if (query.maxPrice !== null) params.set("maxPrice", String(query.maxPrice));
  if (query.inStockOnly) params.set("inStock", "1");
  if (query.sort !== DEFAULT_LISTING_SORT) params.set("sort", query.sort);
  return params;
}

/** Number of distinct filter conditions applied (sort is not a filter). */
export function countActiveListingFilters(query: ListingQuery): number {
  return (
    Object.values(query.attributes).reduce((n, values) => n + values.length, 0) +
    query.brands.length +
    query.genders.length +
    (query.minPrice !== null || query.maxPrice !== null ? 1 : 0) +
    (query.inStockOnly ? 1 : 0) +
    (query.search ? 1 : 0)
  );
}

/**
 * Canonical storefront URL for a category. Slugs are stored upper-case with
 * underscores (`MENS_CLOTHING`); the URL uses the lower-cased form, and the
 * lookup is case-insensitive, so both resolve to the same category.
 */
export function categoryHref(category: { slug?: string | null; id: string }): string {
  const slug = category.slug?.trim();
  return `/category/${encodeURIComponent(slug ? slug.toLowerCase() : category.id)}`;
}

/**
 * Appends `?gender=` to a storefront href so a nav item's audience survives
 * onto the page it links to, even when the destination category is also
 * linked from a different nav item with a different (or no) audience.
 */
export function withGenderParam(href: string, gender?: string | null): string {
  if (!gender) return href;
  const [path, query] = href.split("?");
  const params = new URLSearchParams(query);
  params.set("gender", gender);
  return `${path}?${params.toString()}`;
}
