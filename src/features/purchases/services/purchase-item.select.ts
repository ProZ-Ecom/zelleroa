/**
 * How a stock row is described wherever purchases show one: the product it
 * belongs to plus the colour, size and unit that tell two SKUs apart. Shared so
 * purchase orders, receipts and returns all label the same line the same way.
 */
export const productSelect = {
  attribute_value: { select: { value: true } },
  variant: {
    select: {
      variant_name: true,
      color_name: true,
      item: {
        select: {
          name: true,
          style: { select: { product: { select: { name: true } } } },
        },
      },
    },
  },
} as const;

export function productName(row: {
  variant: {
    item: { name: string; style: { product: { name: string } | null } | null } | null;
  } | null;
}) {
  return row.variant?.item?.style?.product?.name ?? row.variant?.item?.name ?? "Unknown product";
}
