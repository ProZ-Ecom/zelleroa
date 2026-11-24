"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { Star, X, CheckCircle2, AlertCircle, Loader2, LogIn, Check } from "lucide-react";
import { toast } from "@/components/ui/Toast";
import { useSubmitCustomerReview, useReviewEligibility } from "../hooks/use-customer-reviews";
import type { CustomerVariantUnitPriceDto } from "@/features/customers/types/catalog.types";
import { formatMeasurementLabel } from "@/features/variants/utils/measurement.util";
import { ProductImage } from "@/components/common/ProductImage";
import { getImageUrl } from "@/lib/utils";

export interface ReviewTargetItem {
  orderItemId?: string | null;
  productId?: string | null;
  productName?: string;
  variantId?: string | null;
  variantName?: string;
  variantUnitPriceId?: string | null;
  sku?: string | null;
  attributesSummary?: string | null;
  primaryImage?: string | null;
  isReviewed?: boolean;
  review?: {
    id?: string;
    rating?: number;
    title?: string | null;
    comment?: string | null;
    isApproved?: boolean;
    createdAt?: Date | string;
  } | null;
}

export interface WriteReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** When reviewing a specific order item */
  item?: ReviewTargetItem | null;
  /** When reviewing an order with multiple items */
  orderItems?: ReviewTargetItem[];
  orderNumber?: string | null;
  /** Storefront product page backward compatibility */
  variantId?: string | null;
  variantName?: string;
  productName?: string;
  productId?: string | null;
  selectedUnitPriceId?: string | null;
  packSizes?: CustomerVariantUnitPriceDto[];
  onSuccess?: () => void;
}

function getPackSizeLabel(pack: CustomerVariantUnitPriceDto): string {
  if (pack.measurement) {
    const formatted = formatMeasurementLabel(pack.measurement);
    if (formatted && formatted.trim() !== "" && formatted.trim() !== "0") {
      return formatted;
    }
  }
  if ((pack as any).label) return (pack as any).label;
  if ((pack as any).unit_value && (pack as any).unit_type) {
    return `${(pack as any).unit_value} ${(pack as any).unit_type}`;
  }
  if (pack.sku) return pack.sku;
  return "Standard Pack";
}

const RATING_DESCRIPTIONS: Record<number, { label: string; text: string }> = {
  1: { label: "Disappointed", text: "Poor quality or not as expected" },
  2: { label: "Not Satisfied", text: "Could have been much better" },
  3: { label: "Average", text: "Decent quality, met basic expectations" },
  4: { label: "Very Good", text: "Really good quality, comfortable, and well made" },
  5: { label: "Loved it!", text: "Outstanding quality, perfect fit, and excellent finish!" },
};

const EMPTY_ORDER_ITEMS: ReviewTargetItem[] = [];
const EMPTY_PACK_SIZES: CustomerVariantUnitPriceDto[] = [];

export function WriteReviewModal({
  isOpen,
  onClose,
  item: initialItem,
  orderItems = EMPTY_ORDER_ITEMS,
  orderNumber,
  variantId,
  variantName,
  productName,
  productId,
  selectedUnitPriceId,
  packSizes = EMPTY_PACK_SIZES,
  onSuccess,
}: WriteReviewModalProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status: authStatus } = useSession();

  // Active item selection when multiple items exist in an order
  const selectableItems = React.useMemo(() => {
    if (orderItems && orderItems.length > 0) return orderItems;
    if (initialItem) return [initialItem];
    return EMPTY_ORDER_ITEMS;
  }, [orderItems, initialItem]);

  const [selectedItemIndex, setSelectedItemIndex] = React.useState<number>(0);

  const activeItem: ReviewTargetItem | null =
    selectableItems[selectedItemIndex] || initialItem || null;

  const targetVariantId = activeItem?.variantId || variantId;
  const targetProductId = activeItem?.productId || productId;

  // Query eligibility as fallback if previous review isn't passed in props
  const { data: eligibility } = useReviewEligibility({
    orderItemId: activeItem?.orderItemId ?? undefined,
    variantId: targetVariantId ?? undefined,
    productId: targetProductId ?? undefined,
    variantUnitPriceId: activeItem?.variantUnitPriceId || selectedUnitPriceId || undefined,
    enabled: isOpen && !activeItem?.review,
  });

  const effectiveReview = activeItem?.review || eligibility?.existingReview || null;
  const isAlreadyReviewed = Boolean(
    activeItem?.isReviewed ||
    Boolean(activeItem?.review) ||
    eligibility?.reason === "already_reviewed" ||
    Boolean(eligibility?.existingReview)
  );

  const [rating, setRating] = React.useState<number>(1);
  const [hoverRating, setHoverRating] = React.useState<number | null>(null);
  const [title, setTitle] = React.useState("");
  const [comment, setComment] = React.useState("");
  const [activeUnitPriceId, setActiveUnitPriceId] = React.useState<string | null>(
    selectedUnitPriceId || (packSizes[0]?.id ?? null)
  );
  const [errorBanner, setErrorBanner] = React.useState<string | null>(null);
  const [isSuccess, setIsSuccess] = React.useState(false);

  // Track previous open state & selected item index
  const prevOpenRef = React.useRef(false);
  const prevIndexRef = React.useRef(selectedItemIndex);

  React.useEffect(() => {
    if (!isOpen) {
      prevOpenRef.current = false;
      return;
    }

    const justOpened = !prevOpenRef.current;
    const indexChanged = prevIndexRef.current !== selectedItemIndex;

    if (justOpened) {
      setActiveUnitPriceId(selectedUnitPriceId || (packSizes?.[0]?.id ?? null));
      setIsSuccess(false);
    }

    if (justOpened || indexChanged) {
      if (isAlreadyReviewed) {
        setRating(effectiveReview?.rating ?? 5);
        setHoverRating(null);
        setTitle(effectiveReview?.title ?? "");
        setComment(effectiveReview?.comment ?? "");
        setErrorBanner(null);
      } else {
        setRating(1);
        setHoverRating(null);
        setTitle("");
        setComment("");
        setErrorBanner(null);
      }
    } else if (isAlreadyReviewed && effectiveReview) {
      // If review loaded asynchronously after modal opened
      if (effectiveReview.rating) setRating(effectiveReview.rating);
      if (effectiveReview.title !== undefined) setTitle(effectiveReview.title ?? "");
      if (effectiveReview.comment !== undefined) setComment(effectiveReview.comment ?? "");
    }

    prevOpenRef.current = isOpen;
    prevIndexRef.current = selectedItemIndex;
  }, [isOpen, selectedItemIndex, isAlreadyReviewed, effectiveReview]);

  const { mutate: submitReview, isPending } = useSubmitCustomerReview({
    variantId: targetVariantId,
    productId: targetProductId,
    onSuccess: () => {
      setIsSuccess(true);
      toast.success(
        "Review Submitted",
        "Thank you! Your review is pending admin approval and will appear once approved."
      );
      onSuccess?.();
      setTimeout(() => {
        onClose();
      }, 2500);
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to submit your review. Please try again.";
      setErrorBanner(msg);
      toast.error("Submission Failed", msg);
    },
  });

  if (!isOpen) return null;

  const activeRating = hoverRating !== null ? hoverRating : rating;
  const ratingInfo = RATING_DESCRIPTIONS[activeRating] || RATING_DESCRIPTIONS[1];

  const displayName =
    activeItem?.productName ||
    productName ||
    variantName ||
    "Product";

  const displayImage = activeItem?.primaryImage || null;

  const handleRatingClick = (starValue: number) => {
    if (isAlreadyReviewed) return;
    setRating(starValue);
    setHoverRating(null);
    setErrorBanner(null);
  };

  const handleLoginRedirect = () => {
    const currentUrl = typeof window !== "undefined" ? window.location.href : pathname;
    router.push(`/login?redirect=${encodeURIComponent(currentUrl)}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isAlreadyReviewed) return;
    setErrorBanner(null);

    if (rating < 1 || rating > 5) {
      setErrorBanner("Please select a star rating between 1 and 5.");
      return;
    }

    if (!comment.trim() && !title.trim()) {
      setErrorBanner("Please enter a short headline or comment sharing your feedback.");
      return;
    }

    submitReview({
      orderItemId: activeItem?.orderItemId ?? undefined,
      variantId: (activeItem?.variantId || variantId) ?? undefined,
      variantUnitPriceId: (activeItem?.variantUnitPriceId || activeUnitPriceId) ?? undefined,
      productId: (activeItem?.productId || productId) ?? undefined,
      rating,
      title: title.trim() || undefined,
      comment: comment.trim() || undefined,
      images: [],
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
    >
      {/* Dimmed Backdrop */}
      <div
        onClick={() => !isPending && onClose()}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-lg bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Top Header Accent */}
        <div className="h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500" />

        {/* Modal Header */}
        <div className="p-5 sm:p-6 pb-4 flex items-start justify-between gap-4 border-b border-slate-100 bg-slate-50/70">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
                {orderNumber ? `Order #${orderNumber}` : "Customer Feedback"}
              </span>
              {isAlreadyReviewed && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/90 px-2.5 py-0.5 rounded-full border border-emerald-300">
                  <Check className="w-3 h-3" />
                  Already Reviewed
                </span>
              )}
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {isAlreadyReviewed ? "Your Product Review" : "Write a Review"}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {isAlreadyReviewed
                ? "You have already submitted a review for this purchase."
                : "Verified buyers help others make informed shopping decisions"}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-full p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Close review modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Guest / Unauthenticated Notice */}
          {!session && authStatus !== "loading" ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-2xs">
                <LogIn className="w-6 h-6 text-blue-600" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-slate-900">
                  Sign In to Share Your Review
                </h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                  Sign in to your account to review products you have purchased and received.
                </p>
              </div>
              <button
                type="button"
                onClick={handleLoginRedirect}
                className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs hover:shadow-sm transition-all cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In to Continue</span>
              </button>
            </div>
          ) : isSuccess ? (
            /* Success View */
            <div className="py-6 text-center space-y-3.5 animate-in fade-in zoom-in-95 duration-200">
              <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-2xs">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <h4 className="text-xl font-bold text-slate-900">
                Review Submitted for Approval!
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 max-w-sm mx-auto leading-relaxed">
                Thank you for your review! It has been submitted and is pending admin moderation. Once approved by our team, it will appear on the product page.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            /* Review Form */
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Already Reviewed Top Banner */}
              {/* {isAlreadyReviewed && (
                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 animate-in fade-in">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 text-emerald-600 mt-0.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  </div>
                  { <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs font-bold text-emerald-900 uppercase tracking-wide">
                        Already Reviewed
                      </span>
                      {effectiveReview?.isApproved ? (
                        <span className="text-[10px] font-bold text-emerald-700 bg-white px-2 py-0.5 rounded-md border border-emerald-200 shadow-2xs">
                          Approved & Published
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                          Pending Admin Approval
                        </span>
                      )}
                    </div>
                   
                  </div> }
                </div>
              )} */}

              {/* Product Card Preview */}
              <div className="flex items-center gap-3.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="w-14 h-14 rounded-lg overflow-hidden border border-slate-200 flex-shrink-0 bg-white">
                  <ProductImage
                    src={displayImage ? getImageUrl(displayImage) : null}
                    alt={displayName}
                    fallbackText={displayName}
                    containerClassName="w-full h-full"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-slate-900 truncate">
                    {displayName}
                  </h4>
                  {activeItem?.attributesSummary ? (
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      {activeItem.attributesSummary}
                    </p>
                  ) : activeItem?.variantName ? (
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      Variant: {activeItem.variantName}
                    </p>
                  ) : activeItem?.sku ? (
                    <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                      SKU: {activeItem.sku}
                    </p>
                  ) : null}
                </div>
              </div>

              {/* Item Chooser when an order has multiple items */}
              {selectableItems.length > 1 && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Select Item to Review ({selectableItems.length} items)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto p-1">
                    {selectableItems.map((it, idx) => {
                      const isSelected = selectedItemIndex === idx;
                      return (
                        <button
                          key={it.orderItemId || idx}
                          type="button"
                          onClick={() => {
                            setSelectedItemIndex(idx);
                            setErrorBanner(null);
                          }}
                          className={`flex items-center gap-2.5 p-2 rounded-xl text-left border transition-all cursor-pointer ${
                            isSelected
                              ? "bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/15"
                              : "bg-white border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          <div className="w-9 h-9 rounded-md overflow-hidden border border-slate-200 flex-shrink-0">
                            <ProductImage
                              src={it.primaryImage ? getImageUrl(it.primaryImage) : null}
                              alt={it.productName || "Item"}
                              fallbackText={it.productName || "Item"}
                              containerClassName="w-full h-full"
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-slate-800 truncate">
                              {it.productName}
                            </p>
                            <p className="text-[11px] text-slate-500 truncate">
                              {it.attributesSummary || it.variantName || "Delivered Item"}
                            </p>
                          </div>
                          {it.isReviewed && (
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                              Reviewed
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Error Banner */}
              {errorBanner && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p className="leading-snug">{errorBanner}</p>
                </div>
              )}

              {/* Pack Size Selector (if on storefront product view with multiple sizes) */}
              {!activeItem?.orderItemId && packSizes.length > 1 && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Pack Size Purchased / Tasted
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {packSizes.map((pack) => {
                      const isSelected = activeUnitPriceId === pack.id;
                      return (
                        <button
                          key={pack.id}
                          type="button"
                          disabled={isAlreadyReviewed}
                          onClick={() => setActiveUnitPriceId(pack.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                            isSelected
                              ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                              : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          {getPackSizeLabel(pack)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Star Rating Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Your Rating {isAlreadyReviewed ? "(Submitted)" : <span className="text-red-500">*</span>}
                </label>
                <div
                  className="flex items-center gap-1.5 py-1"
                  onMouseLeave={() => !isAlreadyReviewed && setHoverRating(null)}
                >
                  {[1, 2, 3, 4, 5].map((starValue) => {
                    const isFilled = starValue <= activeRating;
                    return (
                      <button
                        key={starValue}
                        type="button"
                        disabled={isAlreadyReviewed}
                        onClick={() => handleRatingClick(starValue)}
                        onMouseEnter={() => !isAlreadyReviewed && setHoverRating(starValue)}
                        className={`p-1 rounded-lg transition-transform focus:outline-hidden ${
                          isAlreadyReviewed
                            ? "cursor-default"
                            : "hover:scale-110 active:scale-95 cursor-pointer"
                        }`}
                        aria-label={`${starValue} Stars`}
                      >
                        <Star
                          className={`w-7 h-7 sm:w-8 sm:h-8 transition-colors pointer-events-none ${
                            isFilled
                              ? "fill-amber-400 text-amber-400 drop-shadow-xs"
                              : "fill-slate-100 text-slate-300 hover:text-amber-300"
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-xs font-bold text-blue-600">
                    {ratingInfo.label} ({activeRating}/5)
                  </span>
                  <span className="text-xs text-slate-500 hidden sm:inline">
                    — {ratingInfo.text}
                  </span>
                </div>
              </div>

              {/* Review Title / Headline */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="review-title" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Headline
                  </label>
                  {!isAlreadyReviewed && (
                    <span className="text-[11px] text-slate-400">
                      {title.length}/150
                    </span>
                  )}
                </div>
                <input
                  id="review-title"
                  type="text"
                  maxLength={150}
                  value={title}
                  disabled={isAlreadyReviewed || isPending}
                  readOnly={isAlreadyReviewed}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={isAlreadyReviewed ? "No headline was provided" : "e.g. Great quality, comfortable fit and stylish look!"}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition-all ${
                    isAlreadyReviewed
                      ? "bg-slate-50 border-slate-200 text-slate-800 cursor-not-allowed select-text"
                      : "bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
                  }`}
                />
              </div>

              {/* Detailed Review / Comment */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="review-comment" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Your Review {isAlreadyReviewed ? "" : <span className="text-red-500">*</span>}
                  </label>
                  {!isAlreadyReviewed && (
                    <span className="text-[11px] text-slate-400">
                      {comment.length}/2000
                    </span>
                  )}
                </div>
                <textarea
                  id="review-comment"
                  rows={4}
                  maxLength={2000}
                  value={comment}
                  disabled={isAlreadyReviewed || isPending}
                  readOnly={isAlreadyReviewed}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={isAlreadyReviewed ? "No written review was provided" : "Tell us what you liked about the material, comfort, size accuracy, styling, or overall experience..."}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition-all resize-none leading-relaxed ${
                    isAlreadyReviewed
                      ? "bg-slate-50 border-slate-200 text-slate-800 cursor-not-allowed select-text"
                      : "bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
                  }`}
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAlreadyReviewed || isPending || (!comment.trim() && !title.trim())}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs hover:shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  title={isAlreadyReviewed ? "You have already reviewed this product" : undefined}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : isAlreadyReviewed ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Already Reviewed</span>
                    </>
                  ) : (
                    <span>Submit Review</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default WriteReviewModal;
