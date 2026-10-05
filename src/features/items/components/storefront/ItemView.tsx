"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Heart,
  Loader2,
  Minus,
  PackageCheck,
  Plus,
  RotateCcw,
  ShieldCheck,
  Share2,
  ShoppingBag,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/Toast";
import { ProductGallery } from "@/features/products/components/ProductGallery";
import { ReviewRatingStars } from "@/features/reviews/components/ReviewRatingStars";
import { ProductReviewsSection } from "@/features/reviews/components/ProductReviewsSection";
import { usePublicVariantReviews } from "@/features/reviews/hooks/use-public-reviews";
import { useAddToCart } from "@/features/cart/hooks/use-cart";
import {
  useWishlist,
  useAddToWishlist,
  useRemoveFromWishlist,
} from "@/features/wishlist/hooks/use-wishlist";
import { cn, getImageUrl } from "@/lib/utils";
import { sanitizeRichText } from "@/lib/sanitize-html";
import type { CustomerStyleItemDto } from "@/features/customers/types/catalog.types";
import { useItemSelection } from "../../hooks/use-item-selection";
import { ItemColorSelector } from "./ItemColorSelector";
import { ItemSizeSelector } from "./ItemSizeSelector";
import { ItemAttributeFacts } from "./ItemAttributeFacts";
import { ItemPriceBlock } from "./ItemPriceBlock";

interface ItemViewProps {
  item: CustomerStyleItemDto;
  /** Where to send an anonymous shopper back to after signing in. */
  returnUrl: string;
  /** Rendered above the title, e.g. the Style or Product name. */
  eyebrow?: string | null;
  /** The Item's brand; omitted when it has none. */
  brandName?: string | null;
  className?: string;
}

/**
 * One Item, as the shopper sees it.
 *
 * The whole view is driven by the selected Colour:
 *
 *   Colour -> images -> available Sizes -> stock -> price
 *
 * so switching Colour swaps the gallery, the Size chips, the stock state and
 * the price together. What goes in the cart is never the Item itself but the
 * exact Colour+Size row selected here.
 *
 * Everything shown belongs to this one Item - there is no way to switch to a
 * sibling Item from here; the shopper goes back to the listing for that.
 */
export function ItemView({ item, returnUrl, eyebrow, brandName, className }: ItemViewProps) {
  const router = useRouter();
  const { data: session } = useSession();

  const {
    colors,
    selectedColor,
    selectColor,
    sizes,
    selectedSize,
    selectSize,
    hasColors,
    hasSizes,
    purchasable,
    images,
    inStock,
    quantity,
    setQuantity,
    missingSelection,
  } = useItemSelection(item);

  const addToCart = useAddToCart();
  const { data: wishlist } = useWishlist({ enabled: !!session });
  const addToWishlist = useAddToWishlist();
  const removeFromWishlist = useRemoveFromWishlist();

  // Reviews are held at the Colour (variant) level, so they follow the Colour
  // the shopper is looking at rather than the Item as a whole.
  const { data: reviewsData } = usePublicVariantReviews(selectedColor?.id);
  const averageRating = reviewsData?.ratingSummary?.averageRating ?? 0;
  const reviewCount =
    reviewsData?.ratingSummary?.totalReviews ?? reviewsData?.reviews?.length ?? 0;

  const galleryImages = images.map((image) => ({
    id: image.id,
    url: getImageUrl(image.imageUrl),
    altText: selectedColor?.colorName
      ? `${item.name} - ${selectedColor.colorName}`
      : item.name,
  }));

  const isInWishlist =
    !!selectedSize &&
    !!wishlist?.items.some((entry) => entry.variantUnitPriceId === selectedSize.id);

  const requireSignIn = () => {
    if (session) return false;
    router.push(`/login?callbackUrl=${encodeURIComponent(returnUrl)}`);
    return true;
  };

  const handleAddToCart = () => {
    if (requireSignIn()) return;

    // The cart line is a Colour+Size combination, so neither can be left
    // unresolved - validate before adding rather than adding the wrong row.
    if (missingSelection === "color") {
      toast.error("Please select a colour");
      return;
    }
    if (missingSelection === "size") {
      toast.error("Please select a size");
      return;
    }
    if (!purchasable) {
      toast.error(hasSizes ? "This size is out of stock" : "This item is out of stock");
      return;
    }

    addToCart.mutate(
      {
        variantUnitPriceId: purchasable.id,
        variantId: selectedColor?.id,
        quantity,
      },
      {
        onSuccess: () => toast.success(`${item.name} added to cart`),
      }
    );
  };

  const handleWishlistToggle = () => {
    if (requireSignIn()) return;
    if (!selectedSize) {
      toast.error(hasSizes ? "Please select a size" : "Nothing to save yet");
      return;
    }
    if (addToWishlist.isPending || removeFromWishlist.isPending) return;

    if (isInWishlist) {
      removeFromWishlist.mutate(selectedSize.id);
    } else {
      addToWishlist.mutate(selectedSize.id);
    }
  };

  // What the shopper is mid-typing in the quantity box; null when not editing.
  const [quantityDraft, setQuantityDraft] = useState<string | null>(null);

  const handleShare = async () => {
    const url = `${window.location.origin}${returnUrl}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: item.name, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
    } catch (error) {
      // Dismissing the native share sheet rejects with AbortError - not a failure.
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("Could not share this item");
    }
  };

  const description = item.description?.trim();
  const wishlistPending = addToWishlist.isPending || removeFromWishlist.isPending;
  const maxQuantity = purchasable?.stock ?? 0;

  return (
    <div className={cn("space-y-12", className)}>
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12 lg:gap-12">
        {/* 1. Gallery - keyed on the Colour so it resets to the first image of
            whichever Colour is selected. */}
        <div className="lg:sticky lg:top-24 lg:col-span-6">
          <div className="overflow-hidden rounded-3xl border border-theme-border bg-theme-surface shadow-md">
            <ProductGallery
              key={selectedColor?.id ?? item.id}
              images={galleryImages}
              productName={item.name}
              isInStock={inStock}
              isVeg={false}
              showQualitySeal={false}
            />
          </div>
        </div>

        <div className="space-y-5 rounded-3xl border border-theme-border bg-theme-surface p-4 shadow-sm sm:p-6 lg:col-span-6">
          {/* 2. Name, with the 10. rating summary beside it */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              {eyebrow && (
                <span className="inline-flex rounded-full bg-theme-primary-light px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-theme-primary">
                  {eyebrow}
                </span>
              )}
              {brandName && (
                <span className="text-xs font-semibold uppercase tracking-wide text-theme-text-subtle">
                  {brandName}
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold leading-tight tracking-tight text-theme-text-primary sm:text-2xl">
              {item.name}
            </h1>

            {reviewCount > 0 && (
              <a
                href="#item-reviews"
                className="inline-flex items-center gap-2 rounded-full text-sm text-theme-text-subtle transition-colors hover:text-theme-primary"
              >
                <ReviewRatingStars rating={averageRating} size="sm" showScore />
                <span>
                  {reviewCount} review{reviewCount === 1 ? "" : "s"}
                </span>
              </a>
            )}

            {/* 3. Short description */}
            {item.shortDescription && (
              <p className="pt-1 text-sm leading-relaxed text-theme-text-subtle">
                {item.shortDescription}
              </p>
            )}
          </div>

          {/* 7. Amount - this exact Colour+Size, with any offer applied */}
          <ItemPriceBlock
            size={selectedSize}
            minPrice={item.minPrice}
            maxPrice={item.maxPrice}
            className="py-3"
          />

          {/* 4. Colour */}
          {hasColors && (
            <ItemColorSelector
              colors={colors}
              selectedColorId={selectedColor?.id ?? null}
              onSelect={selectColor}
            />
          )}

          {/* 5. Size - only when the selected Colour actually carries sizes */}
          {hasSizes && (
            <ItemSizeSelector
              sizes={sizes}
              selectedSizeId={selectedSize?.id ?? null}
              onSelect={selectSize}
            />
          )}

          {/* 6. Extra attributes */}
          <ItemAttributeFacts
            item={item}
            selectedColor={selectedColor}
            selectedSize={selectedSize}
          />

          {/* 9. Quantity and add to cart */}
          <div className="space-y-3">
            {purchasable && purchasable.stock <= 5 && (
              <p className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-700">
                Only {purchasable.stock} left in stock
              </p>
            )}

            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-bold uppercase tracking-wide text-theme-text-primary">
                Quantity
              </span>
              <div className="flex items-center gap-1 rounded-full border border-theme-border bg-theme-surface-alt p-1">
                <button
                  type="button"
                  onClick={() => setQuantity(quantity - 1)}
                  disabled={quantity <= 1}
                  aria-label="Decrease quantity"
                  className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-theme-surface text-theme-text-primary shadow-sm transition-colors hover:bg-theme-primary hover:text-theme-primary-fg active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-theme-surface disabled:hover:text-theme-text-primary"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  aria-label="Quantity"
                  value={quantityDraft ?? String(quantity)}
                  onFocus={(event) => event.target.select()}
                  onChange={(event) => {
                    const digits = event.target.value.replace(/\D/g, "").slice(0, 3);
                    setQuantityDraft(digits);
                    if (digits && maxQuantity > 0) {
                      setQuantity(Math.min(Number(digits) || 1, maxQuantity));
                    }
                  }}
                  onBlur={() => setQuantityDraft(null)}
                  className="h-10 w-14 rounded-full bg-transparent text-center text-base font-bold tabular-nums text-theme-text-primary outline-none focus:bg-theme-surface focus:ring-2 focus:ring-theme-primary/40"
                />
                <button
                  type="button"
                  onClick={() => setQuantity(quantity + 1)}
                  disabled={!purchasable || quantity >= maxQuantity}
                  aria-label="Increase quantity"
                  className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-theme-surface text-theme-text-primary shadow-sm transition-colors hover:bg-theme-primary hover:text-theme-primary-fg active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-theme-surface disabled:hover:text-theme-text-primary"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Button
                type="button"
                onClick={handleAddToCart}
                disabled={addToCart.isPending || !inStock}
                className="h-12 flex-1 rounded-xl text-sm font-semibold shadow-md shadow-theme-primary/20 transition-all hover:shadow-lg hover:shadow-theme-primary/30"
              >
                {addToCart.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding to cart...
                  </>
                ) : (
                  <>
                    <ShoppingBag className="mr-2 h-4 w-4" />
                    {inStock ? "Add to cart" : "Out of stock"}
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={handleWishlistToggle}
                disabled={wishlistPending}
                aria-label={isInWishlist ? "Remove from wishlist" : "Add to wishlist"}
                className={cn(
                  "h-12 w-12 shrink-0 rounded-xl shadow-sm transition-colors",
                  isInWishlist
                    ? "border-rose-200 bg-rose-50 hover:bg-rose-100"
                    : "hover:border-rose-200 hover:bg-rose-50"
                )}
              >
                {wishlistPending ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <Heart
                    className={cn("h-6 w-6", isInWishlist && "fill-rose-500 text-rose-500")}
                  />
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={handleShare}
                aria-label="Share this item"
                className="h-12 w-12 shrink-0 rounded-xl shadow-sm"
              >
                <Share2 className="h-6 w-6" />
              </Button>
            </div>

            {/* Reassurance under the buy button */}
            <ul className="grid grid-cols-1 gap-2 border-t border-theme-border pt-4 sm:grid-cols-3">
              {[
                { icon: ShieldCheck, label: "Secure checkout" },
                { icon: RotateCcw, label: "3-day easy returns" },
                { icon: PackageCheck, label: "Quality checked" },
              ].map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  className="flex items-center gap-2 rounded-xl bg-theme-surface-alt px-3 py-2 text-xs font-semibold text-theme-text-secondary"
                >
                  <Icon className="h-4 w-4 shrink-0 text-theme-primary" />
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* 8. Detailed description */}
      {description && (
        <section className="space-y-4 rounded-2xl border border-theme-border bg-theme-surface p-5 shadow-sm sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold text-theme-text-primary">
            <span className="h-5 w-1 rounded-full bg-theme-primary" />
            Description
          </h2>
          <div
            className="prose prose-sm max-w-none text-theme-text-secondary"
            dangerouslySetInnerHTML={{ __html: sanitizeRichText(description) }}
          />
        </section>
      )}

      {/* Return details, shown on every Item */}
      <section className="space-y-4 rounded-2xl border border-theme-border bg-theme-surface p-5 shadow-sm sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-theme-text-primary">
          <span className="h-5 w-1 rounded-full bg-theme-primary" />
          Returns &amp; Refunds
        </h2>
        <ul className="grid grid-cols-1 gap-3 text-sm text-theme-text-secondary md:grid-cols-3">
          {[
            { icon: RotateCcw, text: "Raise a return request within 3 days of delivery." },
            { icon: Video, text: "A complete unboxing video is required with your request." },
            { icon: PackageCheck, text: "Eligible for wrong, damaged, size or quality issues." },
          ].map(({ icon: Icon, text }) => (
            <li
              key={text}
              className="flex flex-col gap-3 rounded-xl border border-theme-border-subtle bg-theme-surface-alt p-4"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-theme-primary-light text-theme-primary">
                <Icon className="h-4 w-4" />
              </span>
              {text}
            </li>
          ))}
        </ul>
        <Link
          href="/return-refund-policy"
          className="inline-block text-sm font-semibold text-theme-primary hover:underline"
        >
          View full return &amp; refund policy
        </Link>
      </section>

      {/* 10. Reviews and ratings, for the Colour on screen */}
      <section id="item-reviews" className="scroll-mt-24">
        <ProductReviewsSection
          variantId={selectedColor?.id}
          variantName={selectedColor?.colorName ?? selectedColor?.variantName}
          productName={item.name}
          selectedUnitPriceId={selectedSize?.id ?? null}
          packSizes={sizes}
        />
      </section>
    </div>
  );
}

export default ItemView;
