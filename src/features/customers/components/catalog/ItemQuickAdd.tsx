"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Minus, Plus, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/Toast";
import { useAddToCart } from "@/features/cart/hooks/use-cart";
import { formatPrice } from "@/lib/utils";
import { useItemSelection } from "@/features/items/hooks/use-item-selection";
import { ItemColorSelector } from "@/features/items/components/storefront/ItemColorSelector";
import { ItemSizeSelector } from "@/features/items/components/storefront/ItemSizeSelector";
import { customerCatalogApi } from "../../api/customer-catalog.api";
import { CUSTOMER_CATALOG_QUERY_KEYS } from "../../hooks/use-customer-catalog";
import type { CustomerStyleItemDto } from "../../types/catalog.types";

/** Every Colour+Size row of the Item that can actually be bought. */
function sellableRows(item: CustomerStyleItemDto) {
  return item.colors
    .filter((color) => !color.outOfStock)
    .flatMap((color) => color.unitPrices.filter((up) => up.inStock).map((up) => ({ color, up })));
}

function SelectionDialog({
  items,
  title,
  onClose,
}: {
  items: CustomerStyleItemDto[];
  title: string;
  onClose: () => void;
}) {
  const [itemId, setItemId] = useState(
    (items.find((i) => sellableRows(i).length > 0) ?? items[0]).id
  );
  const item = items.find((i) => i.id === itemId) ?? items[0];
  return (
    <Modal open onClose={onClose} title={title} className="max-w-lg">
      {items.length > 1 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {items.map((i) => (
            <button
              key={i.id}
              type="button"
              onClick={() => setItemId(i.id)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                i.id === item.id
                  ? "border-theme-primary bg-theme-primary text-theme-primary-fg"
                  : "border-theme-border"
              }`}
            >
              {i.name}
            </button>
          ))}
        </div>
      )}
      <SelectionBody key={item.id} item={item} onClose={onClose} />
    </Modal>
  );
}

function SelectionBody({
  item,
  onClose,
}: {
  item: CustomerStyleItemDto;
  onClose: () => void;
}) {
  const sel = useItemSelection(item);
  const addToCart = useAddToCart();
  const max = sel.purchasable?.stock ?? 0;

  const submit = () => {
    if (sel.missingSelection === "color") return toast.error("Please select a colour");
    if (sel.missingSelection === "size") return toast.error("Please select a size");
    if (!sel.purchasable) return toast.error("This option is out of stock");
    addToCart.mutate(
      {
        variantUnitPriceId: sel.purchasable.id,
        variantId: sel.selectedColor?.id,
        quantity: sel.quantity,
      },
      {
        onSuccess: () => {
          toast.success(`${item.name} added to cart`);
          onClose();
        },
        onError: () => toast.error("Could not add this item to your cart"),
      }
    );
  };

  return (
    <>
      <div className="mt-4 space-y-5">
        {sel.hasColors && (
          <ItemColorSelector
            colors={sel.colors}
            selectedColorId={sel.selectedColor?.id ?? null}
            onSelect={sel.selectColor}
          />
        )}
        {sel.sizes.length > 0 && (
          <ItemSizeSelector
            sizes={sel.sizes}
            selectedSizeId={sel.selectedSize?.id ?? null}
            onSelect={sel.selectSize}
          />
        )}

        <div className="flex items-center justify-between gap-3">
          <span className="text-lg font-extrabold text-theme-text-primary">
            {sel.purchasable ? formatPrice(sel.purchasable.sellingPrice) : "Unavailable"}
          </span>
          <div className="inline-flex items-center gap-2">
            <button
              type="button"
              aria-label="Decrease quantity"
              disabled={sel.quantity <= 1}
              onClick={() => sel.setQuantity(sel.quantity - 1)}
              className="rounded-lg border border-theme-border p-1.5 disabled:opacity-40"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-6 text-center text-sm font-bold">{sel.quantity}</span>
            <button
              type="button"
              aria-label="Increase quantity"
              disabled={sel.quantity >= max}
              onClick={() => sel.setQuantity(Math.min(max, sel.quantity + 1))}
              className="rounded-lg border border-theme-border p-1.5 disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        <Button
          type="button"
          className="w-full"
          onClick={submit}
          disabled={addToCart.isPending || !sel.purchasable}
        >
          {addToCart.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ShoppingBag className="h-4 w-4" />
          )}
          Add to Cart
        </Button>
      </div>
    </>
  );
}

/**
 * The Item card's "Add to Cart". Fetches the Item on click: a single buyable
 * Colour+Size goes straight to the cart, anything else opens the picker.
 */
export function ItemQuickAdd({
  itemId,
  styleId,
  name,
}: {
  itemId?: string;
  styleId?: string;
  name?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const addToCart = useAddToCart();
  const [loading, setLoading] = useState(false);
  const [dialog, setDialog] = useState<{ items: CustomerStyleItemDto[]; title: string } | null>(null);

  const handleClick = async () => {
    if (!session) {
      router.push(`/login?callbackUrl=${encodeURIComponent(pathname || "/")}`);
      return;
    }
    setLoading(true);
    try {
      const items = styleId
        ? (
            await queryClient.fetchQuery({
              queryKey: CUSTOMER_CATALOG_QUERY_KEYS.style(styleId),
              queryFn: () => customerCatalogApi.getStyle(styleId),
              staleTime: 1000 * 60 * 5,
            })
          ).items
        : [
            await queryClient.fetchQuery({
              queryKey: CUSTOMER_CATALOG_QUERY_KEYS.item(itemId!),
              queryFn: () => customerCatalogApi.getItem(itemId!),
              staleTime: 1000 * 60 * 5,
            }),
          ];
      const rows = items.flatMap(sellableRows);
      const title = name ?? items[0]?.name ?? "";
      if (rows.length === 0) {
        toast.error("This item is out of stock");
      } else if (rows.length === 1) {
        const [{ color, up }] = rows;
        await addToCart.mutateAsync({
          variantUnitPriceId: up.id,
          variantId: color.id,
          quantity: 1,
        });
        toast.success(`${title} added to cart`);
      } else {
        setDialog({ items, title });
      }
    } catch {
      toast.error("Could not add this item to your cart");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-theme-primary px-4 py-2 text-xs font-bold text-theme-primary-fg transition-colors hover:bg-theme-primary-hover disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShoppingBag className="h-3.5 w-3.5" />}
        Add to Cart
      </button>
      {dialog && <SelectionDialog {...dialog} onClose={() => setDialog(null)} />}
    </>
  );
}
