import { ProductCardSkeleton } from "../cards/ProductCardSkeleton";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Matches the header + grid layout shared by ProductSection and TrendingNow so
 * swapping the fallback for the real section causes no layout shift.
 */
export function ProductGridSectionSkeleton({
  withFilters = false,
  bgClassName = "bg-white",
}: {
  withFilters?: boolean;
  bgClassName?: string;
}) {
  return (
    <section className={`relative w-full ${bgClassName}`}>
      <div className="w-full max-w-[1400px] 2xl:max-w-[1600px] 3xl:max-w-[1800px] mx-auto px-4 sm:px-6 md:px-8 py-10 sm:py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="mt-2 h-9 w-48" />
            <Skeleton className="mt-3 h-4 w-72 max-w-full" />
          </div>

          {withFilters && (
            <div className="flex flex-wrap items-center gap-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-8 w-16 rounded-md" />
              ))}
            </div>
          )}
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <ProductCardSkeleton key={index} />
          ))}
        </div>
      </div>
    </section>
  );
}

/** Matches DealsSection: centered heading + 3-card grid. */
export function DealsSectionSkeleton() {
  return (
    <section className="w-full bg-theme-primary-light/40">
      <div className="w-full max-w-[1400px] 2xl:max-w-[1600px] 3xl:max-w-[1800px] mx-auto px-4 sm:px-6 md:px-8 py-10 sm:py-14">
        <div className="flex flex-col items-center text-center">
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="mt-2 h-9 w-80 max-w-full" />
          <Skeleton className="mt-3 h-4 w-96 max-w-full" />
        </div>

        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="flex flex-col rounded-xl border border-theme-border bg-white p-6"
            >
              <Skeleton className="h-5 w-32 rounded-full" />
              <Skeleton className="mt-4 h-8 w-40" />
              <Skeleton className="mt-2 h-4 w-full" />
              <Skeleton className="mt-2 h-4 w-2/3" />
              <div className="mt-5 pt-4 border-t border-theme-border flex items-center justify-between gap-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-24 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Matches Newsletter: centered rounded panel with a form row. */
export function NewsletterSkeleton() {
  return (
    <section className="w-full bg-white">
      <div className="w-full max-w-[1400px] 2xl:max-w-[1600px] 3xl:max-w-[1800px] mx-auto px-4 sm:px-6 md:px-8 py-8 sm:py-10">
        <div className="rounded-2xl bg-theme-primary-light/60 px-6 py-10 sm:py-14 flex flex-col items-center">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <Skeleton className="mt-5 h-8 w-72 max-w-full" />
          <Skeleton className="mt-2 h-4 w-96 max-w-full" />
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-md">
            <Skeleton className="h-12 w-full rounded-md" />
            <Skeleton className="h-12 w-full sm:w-32 shrink-0 rounded-md" />
          </div>
        </div>
      </div>
    </section>
  );
}
