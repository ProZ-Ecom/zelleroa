"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { Star, X, CheckCircle2, AlertCircle, Loader2, LogIn } from "lucide-react";
import { toast } from "@/components/ui/Toast";
import { useSubmitCustomerReview } from "../hooks/use-customer-reviews";
import type { CustomerVariantUnitPriceDto } from "@/features/customers/types/catalog.types";
import { formatMeasurementLabel } from "@/features/variants/utils/measurement.util";

interface WriteReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  variantId?: string | null;
  variantName?: string;
  productName?: string;
  productId?: string | null;
  selectedUnitPriceId?: string | null;
  packSizes?: CustomerVariantUnitPriceDto[];
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
  5: { label: "Loved it!", text: "Outstanding quality, authentic styling, exceptional craftsmanship!" },
};

export function WriteReviewModal({
  isOpen,
  onClose,
  variantId,
  variantName,
  productName,
  productId,
  selectedUnitPriceId,
  packSizes = [],
}: WriteReviewModalProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status: authStatus } = useSession();

  const [rating, setRating] = React.useState<number>(5);
  const [hoverRating, setHoverRating] = React.useState<number | null>(null);
  const [title, setTitle] = React.useState("");
  const [comment, setComment] = React.useState("");
  const [activeUnitPriceId, setActiveUnitPriceId] = React.useState<string | null>(
    selectedUnitPriceId || (packSizes[0]?.id ?? null)
  );
  const [errorBanner, setErrorBanner] = React.useState<string | null>(null);
  const [isSuccess, setIsSuccess] = React.useState(false);

  // Initialize and reset states when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setActiveUnitPriceId(selectedUnitPriceId || (packSizes[0]?.id ?? null));
      setRating(5);
      setHoverRating(null);
      setTitle("");
      setComment("");
      setErrorBanner(null);
      setIsSuccess(false);
    }
  }, [isOpen]);

  const { mutate: submitReview, isPending } = useSubmitCustomerReview({
    variantId,
    productId,
    onSuccess: () => {
      setIsSuccess(true);
      toast.success(
        "Review Submitted",
        "Thank you! Your review is pending admin approval and will appear once approved."
      );
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

  const targetName = variantName || productName || "Authentic Snack";
  const activeRating = hoverRating !== null ? hoverRating : rating;
  const ratingInfo = RATING_DESCRIPTIONS[activeRating] || RATING_DESCRIPTIONS[5];

  const handleRatingClick = (starValue: number) => {
    setRating(starValue);
    setErrorBanner(null);
  };

  const handleLoginRedirect = () => {
    const currentUrl = typeof window !== "undefined" ? window.location.href : pathname;
    router.push(`/login?redirect=${encodeURIComponent(currentUrl)}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
      variantId: variantId ?? undefined,
      variantUnitPriceId: activeUnitPriceId ?? undefined,
      productId: productId ?? undefined,
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
        className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-lg bg-white rounded-3xl border border-[#E8D9CD] shadow-2xl overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Top Decorative Header Accent */}
        <div className="h-2 bg-gradient-to-r from-[#7A2224] via-[#8B1D1D] to-[#A83232]" />

        {/* Modal Header */}
        <div className="p-6 sm:p-7 pb-4 flex items-start justify-between gap-4 border-b border-[#F0E4D8] bg-[#FFFDF9]">
          <div className="min-w-0">
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8B1D1D] block mb-1">
              Customer Feedback
            </span>
            <h3 className="font-serif text-2xl font-bold text-[#2B1B17] tracking-tight">
              Review This Product
            </h3>
            <p className="text-xs sm:text-sm text-stone-600 mt-1 truncate">
              {targetName}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-full p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Close review modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-7 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Guest / Unauthenticated Notice */}
          {!session && authStatus !== "loading" ? (
            <div className="rounded-2xl border border-[#E8D9CD] bg-[#FAF4ED] p-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-[#F5EDE3] text-[#8B1D1D] flex items-center justify-center mx-auto shadow-2xs">
                <LogIn className="w-6 h-6 text-[#8B1D1D]" />
              </div>
              <div className="space-y-1">
                <h4 className="font-serif text-lg font-bold text-[#2B1B17]">
                  Sign In to Share Your Review
                </h4>
                <p className="text-xs sm:text-sm text-stone-600 max-w-sm mx-auto leading-relaxed">
                  Join our community to share your thoughts. It only takes a few seconds to sign in!
                </p>
              </div>
              <button
                type="button"
                onClick={handleLoginRedirect}
                className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 rounded-xl bg-[#7A2224] hover:bg-[#5A1911] text-white text-xs sm:text-sm font-bold shadow-xs hover:shadow-sm transition-all cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In to Continue</span>
              </button>
            </div>
          ) : isSuccess ? (
            /* Success View */
            <div className="py-8 text-center space-y-3.5 animate-in fade-in zoom-in-95 duration-200">
              <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-2xs">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <h4 className="font-serif text-xl font-bold text-[#2B1B17]">
                Review Submitted for Approval!
              </h4>
              <p className="text-xs sm:text-sm text-stone-600 max-w-sm mx-auto leading-relaxed">
                Thank you for sharing your authentic feedback. Your review has been submitted and is currently pending admin moderation. Once approved, it will be published on the store.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 rounded-xl bg-[#7A2224] hover:bg-[#5A1911] text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                >
                  Got It
                </button>
              </div>
            </div>
          ) : (
            /* Review Form */
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Reviewer Identity Badge */}
              {session?.user?.name && (
                <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-[#FBF8F4] border border-[#F0E4D8] text-xs text-stone-600">
                  <div className="w-6 h-6 rounded-full bg-[#8B1D1D] text-white font-bold flex items-center justify-center text-[10px]">
                    {session.user.name.charAt(0).toUpperCase()}
                  </div>
                  <span>
                    Posting as <strong className="text-[#2B1B17] font-semibold">{session.user.name}</strong>
                  </span>
                </div>
              )}

              {/* Error Banner */}
              {errorBanner && (
                <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p className="leading-snug">{errorBanner}</p>
                </div>
              )}

              {/* Pack Size Selector (if multiple pack sizes exist) */}
              {packSizes.length > 1 && (
                <div>
                  <label className="block text-xs font-bold text-[#2B1B17] uppercase tracking-wider mb-2">
                    Pack Size Purchased / Tasted
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {packSizes.map((pack) => {
                      const isSelected = activeUnitPriceId === pack.id;
                      return (
                        <button
                          key={pack.id}
                          type="button"
                          onClick={() => setActiveUnitPriceId(pack.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                            isSelected
                              ? "bg-[#7A2224] text-white border-[#7A2224] shadow-2xs"
                              : "bg-white text-stone-700 border-stone-200 hover:border-stone-400"
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
                <label className="block text-xs font-bold text-[#2B1B17] uppercase tracking-wider mb-1.5">
                  Overall Rating <span className="text-[#8B1D1D]">*</span>
                </label>
                <div className="flex items-center gap-1.5 py-1">
                  {[1, 2, 3, 4, 5].map((starValue) => {
                    const isFilled = starValue <= activeRating;
                    return (
                      <button
                        key={starValue}
                        type="button"
                        onClick={() => handleRatingClick(starValue)}
                        onMouseEnter={() => setHoverRating(starValue)}
                        onMouseLeave={() => setHoverRating(null)}
                        className="p-1 rounded-lg hover:scale-110 active:scale-95 transition-transform cursor-pointer focus:outline-hidden"
                        aria-label={`${starValue} Stars`}
                      >
                        <Star
                          className={`w-7 h-7 sm:w-8 sm:h-8 transition-colors ${
                            isFilled
                              ? "fill-amber-400 text-amber-400 drop-shadow-xs"
                              : "fill-stone-100 text-stone-300"
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-xs font-bold text-[#8B1D1D]">
                    {ratingInfo.label} ({activeRating}/5)
                  </span>
                  <span className="text-xs text-stone-500 hidden sm:inline">
                    — {ratingInfo.text}
                  </span>
                </div>
              </div>

              {/* Review Title / Headline */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="review-title" className="text-xs font-bold text-[#2B1B17] uppercase tracking-wider">
                    Headline
                  </label>
                  <span className="text-[11px] text-stone-400">
                    {title.length}/150
                  </span>
                </div>
                <input
                  id="review-title"
                  type="text"
                  maxLength={150}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Perfectly crunchy with pure ghee aroma!"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-sm text-[#2B1B17] placeholder:text-stone-400 focus:outline-hidden focus:border-[#7A2224] focus:ring-2 focus:ring-[#7A2224]/15 transition-all"
                />
              </div>

              {/* Detailed Review / Comment */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="review-comment" className="text-xs font-bold text-[#2B1B17] uppercase tracking-wider">
                    Your Review <span className="text-[#8B1D1D]">*</span>
                  </label>
                  <span className="text-[11px] text-stone-400">
                    {comment.length}/2000
                  </span>
                </div>
                <textarea
                  id="review-comment"
                  rows={4}
                  maxLength={2000}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="What made this snack special? Tell us about the crunch, freshness, spices, or how your family enjoyed it..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-sm text-[#2B1B17] placeholder:text-stone-400 focus:outline-hidden focus:border-[#7A2224] focus:ring-2 focus:ring-[#7A2224]/15 transition-all resize-none leading-relaxed"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-[#F0E4D8] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isPending}
                  className="px-5 py-2.5 rounded-xl border border-stone-200 text-stone-700 hover:bg-stone-50 text-xs font-bold cursor-pointer transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || (!comment.trim() && !title.trim())}
                  className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#7A2224] hover:bg-[#5A1911] text-white text-xs font-bold shadow-xs hover:shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Submitting...</span>
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
