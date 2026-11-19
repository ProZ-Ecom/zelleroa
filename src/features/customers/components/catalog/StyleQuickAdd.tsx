"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSignedIn } from "@/features/auth/hooks/use-signed-in";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Minus, Plus, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/Toast";
import { useAddToCart } from "@/features/cart/hooks/use-cart";
import { formatPrice } from "@/lib/utils";
import { useStyleSelection } from "@/features/styles/hooks/use-style-selection";
import { StyleColorSelector } from "@/features/styles/components/storefront/StyleColorSelector";
import { StyleSizeSelector } from "@/features/styles/components/storefront/StyleSizeSelector";
import { StyleVariationSelectors } from "@/features/styles/components/storefront/StyleVariationSelectors";
import { customerCatalogApi } from "../../api/customer-catalog.api";
import { CUSTOMER_CATALOG_QUERY_KEYS } from "../../hooks/use-customer-catalog";
import type { CustomerStyleViewDto } from "../../types/catalog.types";

/** Every Colour+Size row of the Style that can actually be bought. */
function sellableRows(style: CustomerStyleViewDto) {
  return (style.colors ?? [])
    .filter((color) => !color.outOfStock)
    .flatMap((color) => (color.unitPrices ?? []).filter((up) => up.inStock).map((up) => ({ color, up })));
}

function SelectionDialog({
  style,
  title,
  onClose,
}: {
  style: CustomerStyleViewDto;
  title: string;
  onClose: () => void;
}) {
  return (
    <Modal open onClose={onClose} title={title} className="max-w-lg">
      <SelectionBody key={style.id} style={style} onClose={onClose} />
    </Modal >
  );
}

function SelectionBody({
  style,
  onClose,
}: {
  style: CustomerStyleViewDto;
  onClose: () => void;
}) {
  const sel = useStyleSelection(style);
  const addToCart = useAddToCart();
  const max = sel.purchasable?.stock ?? 0;

  const submit = () => {
    if (sel.missingSelection)
      return toast.error(`Please select a ${sel.missingSelection.toLowerCase()}`);
    if (!sel.purchasable) return toast.error("This option is out of stock");
    addToCart.mutate(
      {
        variantUnitPriceId: sel.purchasable.id,
        variantId: sel.selectedColor?.id,
        quantity: sel.quantity,
      },
      {
        onSuccess: () => {
          toast.success(`${style.name} added to cart`);
          onClose();
        },
        onError: (error) =>
          toast.error(error instanceof Error && error.message ? error.message : "Could not add this item to your cart"),
      }
    );
  };

  return (
    <div className="mt-4 space-y-5">
      {sel.hasColors && (
        <StyleColorSelector
          colors={sel.colors}
          selectedColorId={sel.selectedColor?.id ?? null}
          onSelect={sel.selectColor}
        />
      )}
      {sel.hasVariations ? (
        <StyleVariationSelectors
          attributes={sel.variationAttributes}
          selectedValues={sel.selectedValues}
          onSelect={sel.selectValue}
        />
      ) : (
        // Pack-size rows carry no variation values, so they are picked directly.
        sel.sizes.length > 1 && (
          <StyleSizeSelector
            sizes={sel.sizes}
            selectedSizeId={sel.selectedUnitPrice?.id ?? null}
            onSelect={sel.selectUnitPrice}
          />
        )
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
        className={`w-full gap-2 ${!sel.purchasable ? "cursor-not-allowed opacity-80" : ""}`}
        onClick={submit}
        disabled={addToCart.isPending || !sel.purchasable}
      >
        {addToCart.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <ShoppingBag className="h-4 w-4 mr-2" />
        )}
        <span>{sel.purchasable ? "Add to Cart" : "Out of Stock"}</span>
      </Button>
    </div>
      );
}

      export interface StyleQuickAddProps {
      styleId?: string;
      itemId?: string;
      name?: string;
      inStock?: boolean;
      outOfStock?: boolean;
}

      /**
       * The Style card's "Add to Cart". Fetches the Style on click: a single buyable
       * Colour+Size goes straight to the cart, anything else opens the picker.
       * When out of stock, displays a disabled "Out of Stock" button.
       */
      export function StyleQuickAdd({
        styleId,
        itemId,
        name,
        inStock,
        outOfStock,
}: StyleQuickAddProps) {
  const targetId = styleId ?? itemId ?? "";
      const router = useRouter();
      const pathname = usePathname();
      const session = useSignedIn();
      const queryClient = useQueryClient();
      const addToCart = useAddToCart();
      const [loading, setLoading] = useState(false);
      const [dialog, setDialog] = useState<{ style: CustomerStyleViewDto; title: string } | null>(null);

      const propOutOfStock =
      outOfStock !== undefined ? outOfStock : inStock !== undefined ? !inStock : false;
      const [runtimeOutOfStock, setRuntimeOutOfStock] = useState(false);
      const isOutOfStock = propOutOfStock || runtimeOutOfStock;

  const handleClick = async () => {
      if (isOutOfStock || !targetId) return;
      if (!session) {
        router.push(`/login?callbackUrl=${encodeURIComponent(pathname || "/")}`);
      return;
    }
      setLoading(true);
      try {
    const style = await queryClient.fetchQuery({
      queryKey: CUSTOMER_CATALOG_QUERY_KEYS.style(targetId),
      queryFn: () => customerCatalogApi.getStyle(targetId),
      staleTime: 1000 * 60 * 5,
    });
      const rows = sellableRows(style);
      const title = name ?? style.name;
    if(rows.length === 0) {
      setRuntimeOutOfStock(true);
  toast.error("This product is out of stock");
} else if (rows.length === 1) {
  const [{ color, up }] = rows;
  await addToCart.mutateAsync({
    variantUnitPriceId: up.id,
    variantId: color.id,
    quantity: 1,
  });
  toast.success(`${title} added to cart`);
} else {
  setDialog({ style, title });
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
      disabled={loading || isOutOfStock}
      aria-disabled={loading || isOutOfStock}
      className={`inline-flex w-full items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${isOutOfStock
          ? "cursor-not-allowed bg-stone-200 text-stone-500 border border-stone-300 opacity-90 select-none shadow-none"
          : "cursor-pointer bg-theme-primary text-theme-primary-fg hover:bg-theme-primary-hover disabled:opacity-60"
        }`}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
      ) : (
        <ShoppingBag className="h-3.5 w-3.5 mr-1.5" />
      )}
      <span>{isOutOfStock ? "Out of Stock" : "Add to Cart"}</span>
    </button>
    {dialog && <SelectionDialog {...dialog} onClose={() => setDialog(null)} />}
  </>
);
}
