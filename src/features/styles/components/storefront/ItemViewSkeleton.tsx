/**
 * Loading placeholder shaped like {@link ItemView} - gallery on the left,
 * title/price/selectors/cart on the right - so the page does not jump when the
 * Item arrives.
 */
export function ItemViewSkeleton() {
  return (
    <div className="grid animate-pulse grid-cols-1 items-start gap-8 lg:grid-cols-12 lg:gap-12">
      <div className="space-y-4 lg:col-span-6">
        <div className="skeleton-shimmer aspect-square w-full overflow-hidden rounded-2xl border border-theme-border" />
        <div className="flex gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="skeleton-shimmer h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-theme-border"
            />
          ))}
        </div>
      </div>

      <div className="space-y-6 lg:col-span-6">
        <div className="space-y-2.5">
          <div className="skeleton-shimmer h-4 w-28 rounded-md" />
          <div className="skeleton-shimmer h-8 w-3/4 rounded-xl" />
          <div className="skeleton-shimmer h-4 w-2/3 rounded-md" />
        </div>

        <div className="space-y-2 border-y border-theme-border-subtle py-4">
          <div className="skeleton-shimmer h-8 w-40 rounded-lg" />
          <div className="skeleton-shimmer h-3 w-32 rounded-md" />
        </div>

        <div className="space-y-3">
          <div className="skeleton-shimmer h-4 w-20 rounded-md" />
          <div className="flex gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton-shimmer h-14 w-14 rounded-xl" />
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="skeleton-shimmer h-4 w-16 rounded-md" />
          <div className="flex gap-2.5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton-shimmer h-10 w-14 rounded-xl" />
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <div className="skeleton-shimmer h-12 w-28 rounded-xl" />
          <div className="skeleton-shimmer h-12 flex-1 rounded-xl" />
          <div className="skeleton-shimmer h-12 w-12 shrink-0 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export default ItemViewSkeleton;
