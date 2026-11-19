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
import { pickColor, pickSize } from "@/features/styles/hooks/use-style-selection";
import { customerCatalogApi } from "../../api/customer-catalog.api";
import { CUSTOMER_CATALOG_QUERY_KEYS } from "../../hooks/use-customer-catalog";

const STALE_TIME = 1000 * 60 * 5;

/**
 * The Style/Item card's heart. The wishlist stores Colour+Size rows, so the heart is
 * filled when any row of this Style is saved; clicking saves the Style's default
 * row, or clears every saved row of it when it is already filled.
 */
export function StyleWishlistButton({
  itemId,
  styleId,
  className,
}: {
  itemId?: string;
  styleId?: string;
  className?: string;
}) {
  const targetId = styleId ?? itemId ?? "";
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const { data: wishlist } = useWishlist({ enabled: !!session });
  const addToWishlist = useAddToWishlist();
  const removeFromWishlist = useRemoveFromWishlist();
  const [busy, setBusy] = useState(false);

  const hasSavedRows = (wishlist?.items.length ?? 0) > 0;
  const { data: style } = useQuery({
    queryKey: CUSTOMER_CATALOG_QUERY_KEYS.style(targetId),
    queryFn: () => customerCatalogApi.getStyle(targetId),
    staleTime: STALE_TIME,
    enabled: !!session && hasSavedRows && !!targetId,
  });

  const savedRowIds = new Set(wishlist?.items.map((entry) => entry.variantUnitPriceId));
  const itemRowIds = (style?.colors ?? []).flatMap((color: any) => color.unitPrices.map((up: any) => up.id));
  const savedItemRowIds = itemRowIds.filter((id: string) => savedRowIds.has(id));
  const isSaved = savedItemRowIds.length > 0;

  const handleClick = async () => {
    if (!session) {
      router.push(`/login?callbackUrl=${encodeURIComponent(pathname || "/")}`);
      return;
    }
    if (busy || !targetId) return;
    setBusy(true);
    try {
      const current = await queryClient.fetchQuery({
        queryKey: CUSTOMER_CATALOG_QUERY_KEYS.style(targetId),
        queryFn: () => customerCatalogApi.getStyle(targetId),
        staleTime: STALE_TIME,
      });
      const rowIds = (current.colors ?? []).flatMap((color: any) => color.unitPrices.map((up: any) => up.id));
      const saved = rowIds.filter((id: string) => savedRowIds.has(id));

      if (saved.length > 0) {
        await Promise.all(saved.map((id: string) => removeFromWishlist.mutateAsync(id)));
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

  const ariaAttributes = {
    "aria-label": isSaved ? "Remove from wishlist" : "Add to wishlist",
    "aria-pressed": isSaved,
  };

  return (
    <button
      type = "button"
      onClick = { handleClick }
      disabled = { busy }
      title = { isSaved? "Remove from wishlist": "Add to wishlist" }
      { ...ariaAttributes }
      className = {
        cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-full bg-theme-surface/90 text-theme-text-secondary shadow-sm backdrop-blur transition-colors hover:text-rose-500 disabled:opacity-60",
          className
    )
  }
    >
{
  busy?(
        <Loader2 className = "h-4 w-4 animate-spin" />
      ): (
      <Heart className = { cn("h-4 w-4", isSaved && "fill-rose-500 text-rose-500")} />
      )}
    </button >
  );
}
