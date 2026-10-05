import { ApiError } from "@/lib/api/api-error";
import type { PaginationMeta } from "@/lib/api/api-response";
import { offerService } from "@/features/offers/services/offer.service";
import {
  catalogListingRepository,
  type ListingAttributeValueRow,
  type ListingCategoryRow,
  type ListingStyleRow,
} from "../repositories/catalog-listing.repository";
import type { ListingGender, ListingQuery } from "../utils/catalog-listing-query";
import type {
  CategoryListingDto,
  CategoryMenuDto,
  ListingAttributeFilterDto,
  ListingCategoryDto,
  ListingCategoryRefDto,
  ListingFilterValueDto,
  ListingFiltersDto,
  ListingStockStatus,
  ListingItemCardDto,
} from "../types/catalog-listing.types";

/**
 * Category listing: cards + the filters that apply to the category.
 *
 * One card per Item - Items under the same Style are separate products to
 * the shopper, each opening its own Item page (`/items/:id`), so they are
 * never merged into one card.
 *
 * Every Item is flattened into its sellable units - one per Size row
 * (VariantUnitPrice) - and each unit carries the attribute values that
 * describe it. Filters are then checked against units, not Items, so
 * "Colour: Black + Size: M + ₹500-₹1500" only matches an Item that sells a
 * black M within that price, not one with a black S and a red M.
 *
 * A unit's values come from three places, most specific first:
 *   1. its Size row's `attribute_value_id` (Size = M),
 *   2. its Colour's `variant_attribute_values` pins (Colour = Black),
 *   3. its Item's `item_attribute_values` pool, for attributes 1-2 don't
 *      cover (Fabric = Cotton). A colour-type pool is narrowed to the value
 *      matching the Colour's own `color_name` where there is one.
 */

const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 60;
const LOW_STOCK_THRESHOLD = 5;
const NEW_ARRIVAL_DAYS = 30;

// ---------------------------------------------------------------------------
// Sellable units
// ---------------------------------------------------------------------------

interface Colour {
  name: string;
  hex: string | null;
}

interface SellableUnit {
  id: string; // VariantUnitPrice UUID - what the offer engine prices
  basePrice: number;
  sellingPrice: number;
  stock: number;
  inStock: boolean;
  /** Facet keys (`${attributeId}:${label lower-cased}`) describing this unit. */
  values: Set<string>;
  colour: Colour | null;
  image: string | null;
  /** Lower sorts first - default Colour/Size before the rest. */
  defaultRank: number;
}

type ListingItemRow = ListingStyleRow["items"][number];

interface Candidate {
  row: ListingStyleRow;
  item: ListingItemRow;
  units: SellableUnit[];
  brand: { id: string; key: string; name: string } | null;
  gender: ListingGender | null;
  colours: Colour[];
}

interface FacetValueMeta {
  attributeId: string;
  label: string;
  colorHex: string | null;
  /** Smallest AttributeValue id sharing this label - the admin's creation order. */
  order: bigint;
}

interface FacetAttributeMeta {
  id: string;
  key: string;
  name: string;
  type: "text" | "color";
  multiple: boolean;
}

const facetKey = (attributeId: bigint | string, label: string) =>
  `${attributeId}:${label.trim().toLowerCase()}`;

function buildCandidates(
  rows: ListingStyleRow[],
  valuesById: Map<string, ListingAttributeValueRow>,
  search: string
): Candidate[] {
  const needle = search.trim().toLowerCase();

  return rows
    .flatMap((row) => {
      // When the search hit the Style or Product, every Item under it is a
      // match; when it only hit Item names, only those Items are.
      const parentMatches =
        !needle ||
        row.name.toLowerCase().includes(needle) ||
        row.product.name.toLowerCase().includes(needle);
      const items = parentMatches
        ? row.items
        : row.items.filter((item) => item.name.toLowerCase().includes(needle));

      const brand = row.brand ?? row.product.brand;
      const brandRef =
        brand && brand.isActive && !brand.deleted_at
          ? { id: brand.uuid || String(brand.id), key: brand.slug.toLowerCase(), name: brand.name }
          : null;

      return items.map((item): Candidate => {
        const units: SellableUnit[] = [];
        const colours = new Map<string, Colour>();

        // Item pool grouped by attribute, active values only.
        const pool = new Map<string, ListingAttributeValueRow[]>();
        for (const iav of item.item_attribute_values) {
          const value = valuesById.get(iav.attribute_value_id.toString());
          if (!value) continue;
          const attrId = value.attribute.id.toString();
          pool.set(attrId, [...(pool.get(attrId) ?? []), value]);
        }

        item.variants.forEach((variant, variantIdx) => {
          const pinned = variant.variant_attribute_values
            .map((vav) => valuesById.get(vav.attribute_value_id.toString()))
            .filter((v): v is ListingAttributeValueRow => Boolean(v));

          const colourAttr = pinned.find((v) => v.attribute.type === "color");
          const colourName = variant.color_name?.trim() || colourAttr?.value || null;
          const colour: Colour | null = colourName
            ? { name: colourName, hex: variant.color_hex || colourAttr?.colorHex || null }
            : null;
          if (colour && !colours.has(colour.name.toLowerCase())) {
            colours.set(colour.name.toLowerCase(), colour);
          }

          variant.variant_unit_prices.forEach((up, upIdx) => {
            const values = new Set<string>();
            const covered = new Set<string>();
            const add = (v: ListingAttributeValueRow) => {
              values.add(facetKey(v.attribute.id, v.value));
              covered.add(v.attribute.id.toString());
            };

            const size = up.attribute_value_id
              ? valuesById.get(up.attribute_value_id.toString())
              : undefined;
            if (size) add(size);
            pinned.forEach(add);

            for (const [attrId, poolValues] of pool) {
              if (covered.has(attrId)) continue;
              const isColour = poolValues[0].attribute.type === "color";
              const narrowed =
                isColour && colourName
                  ? poolValues.filter((v) => v.value.trim().toLowerCase() === colourName.toLowerCase())
                  : poolValues;
              narrowed.forEach((v) => values.add(facetKey(v.attribute.id, v.value)));
            }

            const basePrice = Number(up.base_price);
            const stock = up.inventories?.quantity_available ?? 0;
            units.push({
              id: up.uuid,
              basePrice,
              sellingPrice: basePrice,
              stock,
              inStock: stock > 0 && !variant.out_of_stock && !item.out_of_stock,
              values,
              colour,
              image: variant.product_variant_images[0]?.image_url ?? null,
              defaultRank:
                (variant.is_default ? 0 : 1 + variantIdx) * 1_000 +
                (up.is_default ? 0 : 1 + upIdx),
            });
          });
        });

        return {
          row,
          item,
          units,
          brand: brandRef,
          gender: ((row.product.gender as string) === "na" ? null : (row.product.gender as ListingGender | null)) ?? null,
          colours: [...colours.values()],
        };
      });
    })
    .filter((c) => c.units.length > 0);
}

/** The offer engine prices every unit of the page's candidate set in one call. */
async function applyOffers(candidates: Candidate[]): Promise<void> {
  const units = candidates.flatMap((c) => c.units);
  if (units.length === 0) return;

  const pricing = await offerService.getBestUnitPrices(
    units.map((u) => ({ itemId: u.id, unitPrice: u.basePrice }))
  );
  for (const unit of units) {
    const result = pricing.get(unit.id);
    if (result?.offerApplied) unit.sellingPrice = result.finalPrice;
  }
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

interface ResolvedFilters {
  /** attributeId -> selected facet keys */
  attributes: Map<string, Set<string>>;
  brands: Set<string>;
  genders: Set<ListingGender>;
  minPrice: number | null;
  maxPrice: number | null;
  inStockOnly: boolean;
}

type FilterDimension = { attribute: string } | "brand" | "gender" | "availability" | null;

/**
 * URL keys/labels -> facet keys. Unknown attributes and values (a stale link,
 * or a filter that doesn't exist in this category) are dropped rather than
 * producing an empty page.
 */
function resolveFilters(
  query: ListingQuery,
  attributesByKey: Map<string, FacetAttributeMeta>,
  facetValues: Map<string, FacetValueMeta>,
  candidates: Candidate[]
): ResolvedFilters {
  const attributes = new Map<string, Set<string>>();
  for (const [urlKey, labels] of Object.entries(query.attributes)) {
    const attribute = attributesByKey.get(urlKey);
    if (!attribute) continue;
    let keys = labels.map((label) => facetKey(attribute.id, label)).filter((k) => facetValues.has(k));
    if (!attribute.multiple) keys = keys.slice(0, 1);
    if (keys.length > 0) attributes.set(attribute.id, new Set(keys));
  }

  const knownBrands = new Set(candidates.map((c) => c.brand?.key).filter(Boolean));

  return {
    attributes,
    brands: new Set(query.brands.filter((b) => knownBrands.has(b))),
    // Kept even when no product has this gender: dropping it would show every
    // audience (e.g. men's items under Women) instead of an empty list.
    genders: new Set(query.genders),
    minPrice: query.minPrice,
    maxPrice: query.maxPrice,
    inStockOnly: query.inStockOnly,
  };
}

/**
 * A men's/women's/kids' filter also includes unisex products (matches /api/customer/styles).
 */
function genderMatches(gender: ListingGender | null, selected: Set<ListingGender>): boolean {
  if (selected.size === 0) return true;
  if (!gender) return false;
  return selected.has(gender) || (gender === "unisex" && [...selected].some((g) => g !== "unisex"));
}

function styleMatches(c: Candidate, f: ResolvedFilters, skip: FilterDimension): boolean {
  if (skip !== "brand" && f.brands.size > 0 && !(c.brand && f.brands.has(c.brand.key))) return false;
  if (skip !== "gender" && !genderMatches(c.gender, f.genders)) return false;
  return true;
}

function unitMatches(u: SellableUnit, f: ResolvedFilters, skip: FilterDimension): boolean {
  if (f.minPrice !== null && u.sellingPrice < f.minPrice) return false;
  if (f.maxPrice !== null && u.sellingPrice > f.maxPrice) return false;
  if (skip !== "availability" && f.inStockOnly && !u.inStock) return false;
  const skipAttr = typeof skip === "object" && skip !== null ? skip.attribute : null;
  for (const [attrId, selected] of f.attributes) {
    if (attrId === skipAttr) continue;
    let hit = false;
    for (const key of selected) {
      if (u.values.has(key)) {
        hit = true;
        break;
      }
    }
    if (!hit) return false;
  }
  return true;
}

function matchingUnits(c: Candidate, f: ResolvedFilters, skip: FilterDimension): SellableUnit[] {
  if (!styleMatches(c, f, skip)) return [];
  return c.units.filter((u) => unitMatches(u, f, skip));
}

function compareLabels(a: FacetValueMeta, b: FacetValueMeta): number {
  const na = Number(a.label);
  const nb = Number(b.label);
  if (Number.isFinite(na) && Number.isFinite(nb) && a.label.trim() !== "" && b.label.trim() !== "") {
    return na - nb;
  }
  return a.order < b.order ? -1 : a.order > b.order ? 1 : 0;
}

function buildFilters(
  candidates: Candidate[],
  f: ResolvedFilters,
  attributes: FacetAttributeMeta[],
  facetValues: Map<string, FacetValueMeta>
): ListingFiltersDto {
  // --- Attributes -------------------------------------------------------
  const attributeFilters: Array<ListingAttributeFilterDto & { coverage: number }> = [];
  for (const attribute of attributes) {
    const valueKeys = [...facetValues.entries()]
      .filter(([, meta]) => meta.attributeId === attribute.id)
      .sort(([, a], [, b]) => compareLabels(a, b));

    // How many Items carry each value at all, and with the other filters applied.
    const coverage = new Map<string, number>();
    const counts = new Map<string, number>();
    let stylesWithAttribute = 0;
    for (const c of candidates) {
      const all = new Set<string>();
      c.units.forEach((u) => valueKeys.forEach(([k]) => u.values.has(k) && all.add(k)));
      if (all.size > 0) stylesWithAttribute++;
      all.forEach((k) => coverage.set(k, (coverage.get(k) ?? 0) + 1));

      const reachable = new Set<string>();
      matchingUnits(c, f, { attribute: attribute.id }).forEach((u) =>
        valueKeys.forEach(([k]) => u.values.has(k) && reachable.add(k))
      );
      reachable.forEach((k) => counts.set(k, (counts.get(k) ?? 0) + 1));
    }

    const selected = f.attributes.get(attribute.id) ?? new Set<string>();
    const values = valueKeys
      .filter(([k]) => (coverage.get(k) ?? 0) > 0)
      .map(([k, meta]) => ({
        key: meta.label,
        label: meta.label,
        colorHex: meta.colorHex,
        count: counts.get(k) ?? 0,
        selected: selected.has(k),
      }));

    // A single value every Item shares can't narrow anything down.
    const narrowsNothing =
      values.length === 1 && (coverage.get(facetKey(attribute.id, values[0].label)) ?? 0) === candidates.length;
    if (values.length === 0 || (narrowsNothing && selected.size === 0)) continue;

    attributeFilters.push({ ...attribute, values, coverage: stylesWithAttribute });
  }
  attributeFilters.sort((a, b) => b.coverage - a.coverage || a.name.localeCompare(b.name));

  // --- Brands -----------------------------------------------------------
  const brandMeta = new Map<string, { name: string; coverage: number; count: number }>();
  for (const c of candidates) {
    if (!c.brand) continue;
    const entry = brandMeta.get(c.brand.key) ?? { name: c.brand.name, coverage: 0, count: 0 };
    entry.coverage++;
    if (matchingUnits(c, f, "brand").length > 0) entry.count++;
    brandMeta.set(c.brand.key, entry);
  }
  const brandSingleAndUniversal =
    brandMeta.size === 1 && [...brandMeta.values()][0].coverage === candidates.length;
  const brands: ListingFilterValueDto[] =
    brandMeta.size === 0 || (brandSingleAndUniversal && f.brands.size === 0)
      ? []
      : [...brandMeta.entries()]
          .sort(([, a], [, b]) => a.name.localeCompare(b.name))
          .map(([key, meta]) => ({
            key,
            label: meta.name,
            colorHex: null,
            count: meta.count,
            selected: f.brands.has(key),
          }));

  // --- Gender -----------------------------------------------------------
  const presentGenders = (["men", "women", "kids", "unisex"] as const).filter((g) =>
    candidates.some((c) => c.gender === g)
  );
  const genders: ListingFiltersDto["genders"] =
    presentGenders.length < 2 && f.genders.size === 0
      ? []
      : presentGenders.map((g) => ({
          key: g,
          label: g.charAt(0).toUpperCase() + g.slice(1),
          colorHex: null,
          count: candidates.filter(
            (c) => genderMatches(c.gender, new Set([g])) && matchingUnits(c, f, "gender").length > 0
          ).length,
          selected: f.genders.has(g),
        }));

  // --- Availability -----------------------------------------------------
  let inStockCount = 0;
  let outOfStockCount = 0;
  for (const c of candidates) {
    const units = matchingUnits(c, f, "availability");
    if (units.length === 0) continue;
    if (units.some((u) => u.inStock)) inStockCount++;
    else outOfStockCount++;
  }
  const availability =
    (inStockCount > 0 && outOfStockCount > 0) || f.inStockOnly ? { inStockCount, outOfStockCount } : null;

  // --- Price ------------------------------------------------------------
  // Bounds come from the whole category, not the filtered set, so the slider
  // doesn't shrink under the shopper as they narrow other filters.
  let lowest = Infinity;
  let highest = -Infinity;
  for (const c of candidates) {
    for (const u of c.units) {
      if (u.sellingPrice < lowest) lowest = u.sellingPrice;
      if (u.sellingPrice > highest) highest = u.sellingPrice;
    }
  }
  const min = Math.floor(lowest);
  const max = Math.ceil(highest);
  const priceRange = Number.isFinite(lowest) && max > min ? { min, max } : null;

  return {
    priceRange,
    // `id` is the internal attribute id - the URL key identifies the filter publicly.
    attributes: attributeFilters.map(({ key, name, type, multiple, values }) => ({
      key,
      name,
      type,
      multiple,
      values,
    })),
    brands,
    genders,
    availability,
  };
}

// ---------------------------------------------------------------------------
// Cards & sorting
// ---------------------------------------------------------------------------

interface ListedItem {
  candidate: Candidate;
  card: ListingItemCardDto;
  rating: { average: number; count: number } | null;
  unitsSold: number;
  createdAt: number;
  inStock: boolean;
  maxPrice: number;
}

function toCard(
  c: Candidate,
  units: SellableUnit[],
  colourFilterActive: boolean,
  categoryNames: Map<string, ListingCategoryRow>,
  rating: { average: number; count: number } | null
): ListingItemCardDto {
  const cheapest = units.reduce((best, u) => (u.sellingPrice < best.sellingPrice ? u : best), units[0]);
  const representative = [...units].sort(
    (a, b) => Number(b.inStock) - Number(a.inStock) || a.defaultRank - b.defaultRank
  )[0];
  const styleImage = c.row.images[0]?.image_url ?? null;
  const anyVariantImage = c.units.find((u) => u.image)?.image ?? null;

  // Items of one Style share the Style's cover, so the card leads with the
  // Item's own Colour photo (the filtered Colour's, when a Colour filter is
  // on) and only falls back to the Style cover when the Item has none.
  const image = colourFilterActive
    ? representative.image ?? anyVariantImage ?? styleImage
    : representative.image ?? anyVariantImage ?? styleImage;

  const totalStock = units.filter((u) => u.inStock).reduce((sum, u) => sum + u.stock, 0);
  const stockStatus: ListingStockStatus = !units.some((u) => u.inStock)
    ? "out_of_stock"
    : totalStock <= LOW_STOCK_THRESHOLD
      ? "low_stock"
      : "in_stock";

  const prices = units.map((u) => u.sellingPrice);
  const originalPrice = cheapest.basePrice > cheapest.sellingPrice ? cheapest.basePrice : null;
  const category = c.row.product.categoryId
    ? categoryNames.get(c.row.product.categoryId.toString())
    : undefined;

  return {
    id: c.item.uuid || String(c.item.id),
    name: c.item.name,
    styleName: c.row.name,
    description: c.item.short_description || c.row.short_description || null,
    image,
    brand: c.brand ? { id: c.brand.id, name: c.brand.name } : null,
    category: category ? { id: category.uuid || String(category.id), name: category.name } : null,
    price: cheapest.sellingPrice,
    originalPrice,
    discountPercent: originalPrice
      ? Math.round(((originalPrice - cheapest.sellingPrice) / originalPrice) * 100)
      : 0,
    hasPriceRange: Math.max(...prices) > Math.min(...prices),
    selectedColor: representative.colour,
    colors: c.colours,
    rating,
    stockStatus,
    isNew: Date.now() - c.item.createdAt.getTime() < NEW_ARRIVAL_DAYS * 86_400_000,
  };
}

function searchScore(name: string, search: string): number {
  if (!search) return 0;
  const n = name.toLowerCase();
  const s = search.toLowerCase();
  if (n === s) return 4;
  if (n.startsWith(s)) return 3;
  if (n.split(/\s+/).some((word) => word.startsWith(s))) return 2;
  return n.includes(s) ? 1 : 0;
}

function sortListed(listed: ListedItem[], query: ListingQuery): void {
  const byNewest = (a: ListedItem, b: ListedItem) => b.createdAt - a.createdAt;
  const byId = (a: ListedItem, b: ListedItem) => a.card.id.localeCompare(b.card.id);
  const byRating = (a: ListedItem, b: ListedItem) =>
    (b.rating?.average ?? 0) - (a.rating?.average ?? 0) || (b.rating?.count ?? 0) - (a.rating?.count ?? 0);

  const comparators: Record<ListingQuery["sort"], (a: ListedItem, b: ListedItem) => number> = {
    relevance: (a, b) =>
      Math.max(searchScore(b.card.name, query.search), searchScore(b.card.styleName, query.search)) -
        Math.max(searchScore(a.card.name, query.search), searchScore(a.card.styleName, query.search)) ||
      Number(b.inStock) - Number(a.inStock) ||
      Number(b.candidate.item.is_featured || b.candidate.row.is_featured) -
        Number(a.candidate.item.is_featured || a.candidate.row.is_featured) ||
      b.unitsSold - a.unitsSold ||
      byRating(a, b) ||
      byNewest(a, b),
    popularity: (a, b) => b.unitsSold - a.unitsSold || byRating(a, b) || byNewest(a, b),
    newest: byNewest,
    price_asc: (a, b) => a.card.price - b.card.price || byNewest(a, b),
    price_desc: (a, b) => b.maxPrice - a.maxPrice || b.card.price - a.card.price || byNewest(a, b),
    rating: (a, b) => byRating(a, b) || b.unitsSold - a.unitsSold || byNewest(a, b),
  };

  const compare = comparators[query.sort];
  listed.sort((a, b) => compare(a, b) || byId(a, b));
}

// ---------------------------------------------------------------------------
// Category context
// ---------------------------------------------------------------------------

const toRef = (c: ListingCategoryRow): ListingCategoryRefDto => ({
  id: c.uuid || String(c.id),
  name: c.name,
  slug: c.slug,
});

function describeCategory(category: ListingCategoryRow, all: ListingCategoryRow[]): {
  dto: ListingCategoryDto;
  subtreeIds: bigint[];
} {
  const byId = new Map(all.map((c) => [c.id.toString(), c]));

  const ancestors: ListingCategoryRefDto[] = [];
  const seen = new Set<string>([category.id.toString()]);
  let parentId = category.parentId;
  while (parentId !== null && !seen.has(parentId.toString())) {
    const parent = byId.get(parentId.toString());
    if (!parent) break;
    seen.add(parent.id.toString());
    ancestors.unshift(toRef(parent));
    parentId = parent.parentId;
  }

  const subtreeIds: bigint[] = [category.id];
  const visited = new Set<string>([category.id.toString()]);
  for (let i = 0; i < subtreeIds.length; i++) {
    for (const child of all) {
      if (child.parentId === subtreeIds[i] && !visited.has(child.id.toString())) {
        visited.add(child.id.toString());
        subtreeIds.push(child.id);
      }
    }
  }

  return {
    dto: {
      ...toRef(category),
      description: category.description,
      image: category.image,
      ancestors,
    },
    subtreeIds,
  };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export const catalogListingService = {
  async getListing(params: {
    categoryKey: string | null;
    query: ListingQuery;
    page: number;
    pageSize: number;
  }): Promise<{ data: CategoryListingDto; meta: PaginationMeta }> {
    const { query } = params;
    const page = Math.max(1, params.page);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, params.pageSize || DEFAULT_PAGE_SIZE));

    const allCategories = await catalogListingRepository.findActiveCategories();
    let category: ListingCategoryDto | null = null;
    let categoryIds: bigint[] | null = null;
    let subcategories = allCategories.filter((c) => c.parentId === null).map(toRef);

    if (params.categoryKey && params.categoryKey.toLowerCase() !== "all") {
      const row = catalogListingRepository.resolveCategoryKey(allCategories, params.categoryKey);
      if (!row) throw ApiError.notFound("Category not found");
      const described = describeCategory(row, allCategories);
      category = described.dto;
      categoryIds = described.subtreeIds;
      subcategories = allCategories.filter((c) => c.parentId === row.id).map(toRef);
    }

    const rows = await catalogListingRepository.findListingStyles({
      categoryIds,
      search: query.search,
    });

    // Every attribute value referenced anywhere in the candidate set.
    const valueIds = new Set<bigint>();
    for (const row of rows) {
      for (const item of row.items) {
        item.item_attribute_values.forEach((v) => valueIds.add(v.attribute_value_id));
        for (const variant of item.variants) {
          variant.variant_attribute_values.forEach((v) => valueIds.add(v.attribute_value_id));
          variant.variant_unit_prices.forEach(
            (up) => up.attribute_value_id !== null && valueIds.add(up.attribute_value_id)
          );
        }
      }
    }

    const [attributeValues, ratings, unitsSold] = await Promise.all([
      catalogListingRepository.findAttributeValues([...valueIds]),
      catalogListingRepository.findRatings([...new Set(rows.map((r) => r.product.id))]),
      catalogListingRepository.findUnitsSold(rows.flatMap((r) => r.items.map((i) => i.id))),
    ]);

    const valuesById = new Map(attributeValues.map((v) => [v.id.toString(), v]));
    const candidates = buildCandidates(rows, valuesById, query.search);
    await applyOffers(candidates);

    // Facet vocabulary: only values some unit in this category actually carries.
    const usedKeys = new Set(candidates.flatMap((c) => c.units.flatMap((u) => [...u.values])));
    const attributesById = new Map<string, FacetAttributeMeta>();
    const facetValues = new Map<string, FacetValueMeta>();
    for (const value of attributeValues) {
      const key = facetKey(value.attribute.id, value.value);
      if (!usedKeys.has(key)) continue;
      const attrId = value.attribute.id.toString();
      if (!attributesById.has(attrId)) {
        attributesById.set(attrId, {
          id: attrId,
          key: value.attribute.slug.toLowerCase(),
          name: value.attribute.name,
          type: value.attribute.type,
          multiple: value.attribute.multiple,
        });
      }
      const existing = facetValues.get(key);
      if (!existing || value.id < existing.order) {
        facetValues.set(key, {
          attributeId: attrId,
          label: value.value.trim(),
          colorHex: value.colorHex ?? existing?.colorHex ?? null,
          order: value.id,
        });
      }
    }
    const attributesByKey = new Map([...attributesById.values()].map((a) => [a.key, a]));

    const filters = resolveFilters(query, attributesByKey, facetValues, candidates);
    const colourFilterActive = [...filters.attributes.keys()].some(
      (id) => attributesById.get(id)?.type === "color"
    );
    const categoryById = new Map(allCategories.map((c) => [c.id.toString(), c]));

    const listed: ListedItem[] = [];
    for (const candidate of candidates) {
      const units = matchingUnits(candidate, filters, null);
      if (units.length === 0) continue;
      const rating = ratings.get(candidate.row.product.id.toString()) ?? null;
      listed.push({
        candidate,
        card: toCard(candidate, units, colourFilterActive, categoryById, rating),
        rating,
        unitsSold: unitsSold.get(candidate.item.id.toString()) ?? 0,
        createdAt: candidate.item.createdAt.getTime(),
        inStock: units.some((u) => u.inStock),
        maxPrice: Math.max(...units.map((u) => u.sellingPrice)),
      });
    }
    sortListed(listed, query);

    const total = listed.length;
    return {
      data: {
        category,
        subcategories,
        items: listed.slice((page - 1) * pageSize, page * pageSize).map((l) => l.card),
        filters: buildFilters(candidates, filters, [...attributesById.values()], facetValues),
      },
      meta: {
        page,
        limit: pageSize,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  },

  /**
   * Header menu preview for a category (and its subcategories): a handful of
   * Products, each with the Items sold under it.
   */
  async getCategoryMenu(params: {
    categoryKey: string;
    productLimit: number;
    itemLimit: number;
    gender?: "men" | "women" | "kids" | "unisex";
  }): Promise<CategoryMenuDto> {
    const allCategories = await catalogListingRepository.findActiveCategories();
    const row = catalogListingRepository.resolveCategoryKey(allCategories, params.categoryKey);
    if (!row) throw ApiError.notFound("Category not found");
    const { subtreeIds } = describeCategory(row, allCategories);

    const products = await catalogListingRepository.findMenuProducts({
      categoryIds: subtreeIds,
      take: params.productLimit,
      gender: params.gender,
    });

    return {
      products: products.map((product) => ({
        id: product.uuid || String(product.id),
        name: product.name,
        items: product.styles
          .flatMap((style) =>
            style.items.map((item) => ({
              id: item.uuid,
              name: item.name,
              image:
                item.variants[0]?.product_variant_images[0]?.image_url ||
                style.images[0]?.image_url ||
                null,
            }))
          )
          .slice(0, params.itemLimit),
      })),
    };
  },
};
