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
        style: {
          select: {
            name: true,
            product: { select: { name: true } },
          },
        },
      },
    },
  } as const;

export function productName(row: any) {
  return (
    row.variant?.style?.product?.name ??
    row.variant?.item?.style?.product?.name ??
    row.variant?.style?.name ??
    row.variant?.item?.name ??
    "Unknown product"
  );
}
