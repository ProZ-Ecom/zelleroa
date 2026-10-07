"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Clock, Loader2, X } from "lucide-react";
import { useCustomerProducts } from "@/features/customers/hooks/use-customer-catalog";
import { formatCurrency } from "@/lib/utils/format-currency";

const SUGGESTIONS_LIMIT = 6;
const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

interface SearchDropdownProps {
  query: string;
  recent: string[];
  /** Run a search for this term (recent chip or "view all"). */
  onSearch: (term: string) => void;
  /** A product suggestion was opened; the term that found it is worth remembering. */
  onProductOpen: (term: string) => void;
  onRemoveRecent: (term: string) => void;
  onClearRecent: () => void;
  className?: string;
}

/**
 * Panel under a search input: recent searches while the box is empty,
 * matching products (plus recent terms that match) while the user types.
 */
export function SearchDropdown({
  query,
  recent,
  onSearch,
  onProductOpen,
  onRemoveRecent,
  onClearRecent,
  className = "",
}: SearchDropdownProps) {
  const trimmed = query.trim();
  const debounced = useDebouncedValue(trimmed, DEBOUNCE_MS);
  const isTyping = trimmed.length >= MIN_QUERY_LENGTH;

  const { data, isFetching } = useCustomerProducts(
    { search: debounced, pageSize: SUGGESTIONS_LIMIT },
    { enabled: debounced.length >= MIN_QUERY_LENGTH }
  );
  const products = data?.data ?? [];

  const matchingRecent = isTyping
    ? recent.filter((t) => t.toLowerCase().includes(trimmed.toLowerCase()))
    : recent;

  if (!isTyping && recent.length === 0) return null;

  const showResults = debounced.length >= MIN_QUERY_LENGTH;

  return (
    <div
      className={`rounded-xl border border-theme-border bg-theme-surface shadow-lg overflow-hidden ${className}`}
    >
      {matchingRecent.length > 0 && (
        <div className="py-1">
          <div className="flex items-center justify-between px-3 pt-2 pb-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-theme-text-subtle">
              Recent searches
            </span>
            {!isTyping && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={onClearRecent}
                className="text-xs font-medium text-theme-primary hover:underline cursor-pointer"
              >
                Clear all
              </button>
            )}
          </div>
          {matchingRecent.map((term) => (
            <div
              key={term}
              className="group flex items-center hover:bg-theme-surface-alt transition-colors"
            >
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onSearch(term)}
                className="flex flex-1 min-w-0 items-center gap-2.5 px-3 py-2 text-left text-sm text-theme-text-primary cursor-pointer"
              >
                <Clock className="h-4 w-4 shrink-0 text-theme-text-subtle" />
                <span className="truncate">{term}</span>
              </button>
              <button
                type="button"
                aria-label={`Remove ${term} from recent searches`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onRemoveRecent(term)}
                className="px-3 py-2 text-theme-text-subtle hover:text-theme-text-primary cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {isTyping && (
        <div className={matchingRecent.length > 0 ? "border-t border-theme-border-subtle" : ""}>
          {isFetching && products.length === 0 ? (
            <div className="flex items-center justify-center gap-2 p-4 text-sm text-theme-text-subtle">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching…
            </div>
          ) : showResults && products.length === 0 ? (
            <p className="p-4 text-sm text-theme-text-subtle text-center">
              No products found for &ldquo;{debounced}&rdquo;
            </p>
          ) : (
            <>
              <div className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-theme-text-subtle">
                Related products
              </div>
              {products.map((product) => (
                <Link
                  key={product.id}
                  href={`/products/${product.id}`}
                  onClick={() => onProductOpen(trimmed)}
                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-theme-surface-alt transition-colors"
                >
                  <div className="relative h-11 w-11 shrink-0 rounded-lg overflow-hidden bg-theme-surface-alt">
                    {product.image && (
                      <Image
                        src={product.image}
                        alt={product.name}
                        fill
                        sizes="44px"
                        className="object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-theme-text-primary truncate">
                      {product.name}
                    </p>
                    {product.category && (
                      <p className="text-xs text-theme-text-subtle truncate">
                        {product.category.name}
                      </p>
                    )}
                  </div>
                  {product.minPrice > 0 && (
                    <p className="text-sm font-bold text-theme-text-primary shrink-0">
                      {formatCurrency(product.minPrice)}
                    </p>
                  )}
                </Link>
              ))}
              {products.length > 0 && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onSearch(trimmed)}
                  className="w-full p-3 text-sm font-semibold text-theme-primary hover:bg-theme-surface-alt transition-colors text-center border-t border-theme-border-subtle cursor-pointer"
                >
                  View all results for &ldquo;{trimmed}&rdquo;
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
