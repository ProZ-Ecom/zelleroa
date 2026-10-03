"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import {
  useAddToWishlist,
  useRemoveFromWishlist,
  useWishlist,
} from "@/features/wishlist/hooks/use-wishlist";
import { pickColor, pickSize } from "@/features/items/hooks/use-item-selection";
import { customerCatalogApi } from "../../api/customer-catalog.api";
import { CUSTOMER_CATALOG_QUERY_KEYS } from "../../hooks/use-customer-catalog";

const STALE_TIME = 1000 * 60 * 5;

/**
 * The Item card's heart. The wishlist stores Colour+Size rows, so the heart is
 * filled when any row of this Item is saved; clicking saves the Item's default
 * row, or clears every saved row of it when it is already filled.
 */
export function ItemWishlistButton({ itemId, className }: { itemId: string; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const { data: wishlist } = useWishlist({ enabled: !!session });
  const addToWishlist = useAddToWishlist();
  const removeFromWishlist = useRemoveFromWishlist();
  const [busy, setBusy] = useState(false);

  const hasSavedRows = (wishlist?.items.length ?? 0) > 0;
  // Only needed to know which saved rows belong to this Item, so skip the
  // fetch entirely for shoppers with an empty wishlist.
  const { data: item } = useQuery({
    queryKey: CUSTOMER_CATALOG_QUERY_KEYS.item(itemId),
    queryFn: () => customerCatalogApi.getItem(itemId),
    staleTime: STALE_TIME,
    enabled: !!session && hasSavedRows,
  });

  const savedRowIds = new Set(wishlist?.items.map((entry) => entry.variantUnitPriceId));
  const itemRowIds = item?.colors.flatMap((color) => color.unitPrices.map((up) => up.id)) ?? [];
  const savedItemRowIds = itemRowIds.filter((id) => savedRowIds.has(id));
  const isSaved = savedItemRowIds.length > 0;

  const handleClick = async () => {
    if (!session) {
      router.push(`/login?callbackUrl=${encodeURIComponent(pathname || "/")}`);
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const current = await queryClient.fetchQuery({
        queryKey: CUSTOMER_CATALOG_QUERY_KEYS.item(itemId),
        queryFn: () => customerCatalogApi.getItem(itemId),
        staleTime: STALE_TIME,
      });
      const rowIds = current.colors.flatMap((color) => color.unitPrices.map((up) => up.id));
      const saved = rowIds.filter((id) => savedRowIds.has(id));

      if (saved.length > 0) {
        await Promise.all(saved.map((id) => removeFromWishlist.mutateAsync(id)));
        toast.success("Removed from wishlist");
        return;
      }
      const row = pickSize(pickColor(current.colors));
      if (!row) {
        toast.error("Nothing to save yet");
        return;
      }
      await addToWishlist.mutateAsync(row.id);
      toast.success("Added to wishlist");
    } catch {
      toast.error("Could not update your wishlist");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      aria-label={isSaved ? "Remove from wishlist" : "Add to wishlist"}
      aria-pressed={isSaved}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-full bg-theme-surface/90 text-theme-text-secondary shadow-sm backdrop-blur transition-colors hover:text-rose-500 disabled:opacity-60",
        className
      )}
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Heart className={cn("h-4 w-4", isSaved && "fill-rose-500 text-rose-500")} />
      )}
    </button>
  );
}
