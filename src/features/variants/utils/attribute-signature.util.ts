/**
 * The canonical identity of a stock row's variation.
 *
 * A VariantUnitPrice can carry any number of SKU-axis attribute values (Size=M,
 * Neck=V, Sleeve=Half). `variant_unit_prices.attribute_signature` holds them as one
 * string so the database can enforce "one row per combination" with a plain unique
 * index, which it cannot do across a child table.
 *
 * Attribute value ids are globally unique, so the sorted id list is a stable key: the
 * same combination always produces the same signature no matter what order the admin
 * picked the values in, or which order a query returns them.
 *
 * Numeric sort, not lexicographic - "9" must not sort after "10".
 */
export function buildAttributeSignature(valueIds: readonly bigint[]): string {
  return [...valueIds]
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .join("-");
}

/**
 * A row with no SKU-axis attributes - a variant sold as a single option, or the
 * pack-size flow where the unit and unit_value carry the distinction instead.
 * Empty string rather than null because MySQL treats nulls as distinct in a unique
 * index, which would let duplicate no-attribute rows through.
 */
export const EMPTY_ATTRIBUTE_SIGNATURE = "";

/**
 * attribute_signature is VarChar(255) and an id plus its separator runs to about 12
 * characters, so the column stops being able to hold the combination well before an
 * admin would want this many axes. Guarded at generation time with a clear message
 * rather than left to fail as a truncation.
 */
export const MAX_SKU_AXIS_ATTRIBUTES = 12;

/**
 * How many stock rows one generate call may create. Attributes multiply, so four
 * modest axes already run to several hundred combinations - past this the admin almost
 * certainly meant some of them to be INFO rather than part of the SKU.
 */
export const MAX_GENERATED_SKUS = 500;
