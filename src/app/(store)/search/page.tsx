"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search as SearchIcon } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { SearchDropdown } from "@/components/storefront/search/SearchDropdown";
import { useRecentSearches } from "@/hooks/use-recent-searches";

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const { recent, add, remove, clear } = useRecentSearches();

  const goToResults = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    add(trimmed);
    router.push(`/products?search=${encodeURIComponent(trimmed)}`);
  };

  return (
    <PageContainer>
      <div className="max-w-2xl mx-auto mt-6">
        <h1 className="text-2xl font-bold text-theme-text-primary mb-4">Search Products</h1>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            goToResults(query);
          }}
          className="relative"
        >
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-theme-text-subtle" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by product name, brand, or category..."
            autoFocus
            className="w-full h-12 pl-12 pr-4 rounded-xl border border-theme-border bg-theme-surface text-theme-text-primary placeholder:text-theme-text-subtle outline-none focus:border-theme-primary transition-colors"
          />
        </form>

        <SearchDropdown
          query={query}
          recent={recent}
          onSearch={goToResults}
          onProductOpen={add}
          onRemoveRecent={remove}
          onClearRecent={clear}
          className="mt-3"
        />
      </div>
    </PageContainer>
  );
}
