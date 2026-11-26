"use client";

import Link from "next/link";
import { SquarePen, Check } from "lucide-react";
import { Tooltip } from "@/features/agents/components/Tooltip";
import { getImageUrl, formatPrice } from "@/lib/utils";
import { ProductImage } from "@/components/common/ProductImage";
import type { OrderItemResponse, OrderItemDisplay } from "../types";

interface OrderItemsListProps {
  items: (OrderItemResponse | OrderItemDisplay)[];
  compact?: boolean;
  isDelivered?: boolean;
  onReviewItem?: (item: OrderItemResponse | OrderItemDisplay) => void;
}

export function OrderItemsList({
  items,
  compact = false,
  isDelivered = false,
  onReviewItem,
}: OrderItemsListProps) {
  if (!items || items.length === 0) {
    return (
      <div className="py-4 text-center text-sm text-muted-foreground">
        No items in this order.
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {items.map((item) => {
        const full = "primaryImage" in item ? item : null;
        const image = (full ? full.primaryImage : (item as OrderItemDisplay).image) || null;
        const unitPrice =
          "unitPrice" in item ? item.unitPrice : item.price || 0;
        const totalPrice =
          "totalPrice" in item ? item.totalPrice : item.total || 0;
        const discount = full?.discountAmount ?? 0;
        const sku = "sku" in item ? item.sku : "";
        const attributes = full?.attributes ?? [];
        const colorName = full?.colorName ?? null;
        const colorHex = full?.colorHex ?? null;
        const itemName =
          full?.itemName && full.itemName !== item.productName ? full.itemName : "";
        const colorAttr = attributes.find((a) => /^colou?r$/i.test(a.name));
        const otherAttrs = attributes.filter((a) => !/^colou?r$/i.test(a.name));
        const shownColor = colorAttr?.value || colorName;
        const fallbackVariant =
          !attributes.length ? item.variantName || sku || "" : "";

        return (
          <div key={item.id} className="flex items-start gap-3 sm:gap-4 py-3">
            <div className="h-20 w-20 sm:h-24 sm:w-24 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
              <ProductImage
                src={image ? getImageUrl(image) : null}
                alt={item.productName}
                fallbackText={item.productName}
                fallbackSize="compact"
                containerClassName="w-full h-full"
                className="w-full h-full object-cover"
              />
            </div>

            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="font-medium text-sm text-foreground break-words">
                {item.productName}
              </p>
              {itemName && (
                <p className="text-xs text-muted-foreground">{itemName}</p>
              )}
              {shownColor && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {colorHex && (
                    <span
                      className="inline-block h-3 w-3 rounded-full border border-gray-300"
                      style={{ backgroundColor: colorHex }}
                    />
                  )}
                  Color: {shownColor}
                  {colorHex && (
                    <span className="font-mono text-[10px] uppercase">({colorHex})</span>
                  )}
                </p>
              )}
              {otherAttrs.map((a) => (
                <p key={`${a.name}-${a.value}`} className="text-xs text-muted-foreground">
                  {a.name}: {a.value}
                </p>
              ))}
              {fallbackVariant && (
                <p className="text-xs text-muted-foreground">{fallbackVariant}</p>
              )}
              {sku && (
                <p className="font-mono text-[10px] text-muted-foreground">SKU: {sku}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Qty: {item.quantity}
                {compact && (
                  <span className="ml-2 font-medium text-foreground">
                    {formatPrice(unitPrice)}
                  </span>
                )}
              </p>
            </div>

            {!compact && (
              <div className="text-right shrink-0 flex flex-col items-end">
                <p className="text-sm font-semibold">{formatPrice(totalPrice)}</p>
                {discount > 0 && (
                  <p className="text-xs text-muted-foreground line-through">
                    {formatPrice(unitPrice * item.quantity)}
                  </p>
                )}
                {discount > 0 && (
                  <p className="text-xs font-medium text-emerald-700">
                    Offer: -{formatPrice(discount)}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {formatPrice(unitPrice)} x {item.quantity}
                </p>

                {isDelivered && onReviewItem && (
                  <div className="mt-2.5">
                    {"isReviewed" in item && item.isReviewed ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span>Reviewed</span>
                      </span>
                    ) : (
                      <Tooltip content="Write Review">
                        <button
                          type="button"
                          aria-label="Write Review"
                          onClick={() => onReviewItem(item)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer shadow-2xs"
                        >
                          <SquarePen className="h-4 w-4" />
                        </button>
                      </Tooltip>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
