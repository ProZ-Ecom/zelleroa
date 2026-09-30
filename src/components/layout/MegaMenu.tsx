"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { CategoryTreeNode } from "@/features/categories/types";
import { categoryHref, withGenderParam } from "@/features/customers/utils/catalog-listing-query";
import { itemHref } from "@/features/customers/utils/style-default-item";
import { useCategoryMenu, useCategoryMenus } from "@/features/customers/hooks/use-customer-catalog";
import { ItemCard } from "@/features/customers/components/catalog/ItemCard";

/** A CategoryTreeNode, or a synthetic grouping of several categories under one label. */
export interface NavNode extends CategoryTreeNode {
  href?: string;
  /** Audience this nav item targets - appended as ?gender= to every link resolved under it. */
  gender?: string | null;
}

interface MegaMenuTriggerProps {
  root: NavNode;
  isActive?: boolean;
  isOpen?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onFocus?: () => void;
}

/**
 * One top-level nav item's link (e.g. "Women"). Hovering/focusing it is
 * reported to the parent, which renders the shared <MegaMenuPanel> below the
 * whole nav row so the dropdown pushes page content down instead of
 * floating over it.
 */
export function MegaMenuTrigger({
  root,
  isActive,
  isOpen,
  onMouseEnter,
  onMouseLeave,
  onFocus,
}: MegaMenuTriggerProps) {
  const href = withGenderParam(root.href ?? categoryHref(root), root.gender);

  return (
    <div onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      <Link
        href={href}
        onFocus={onFocus}
        className={`flex items-center gap-1 rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
          isActive || isOpen
            ? "bg-theme-primary text-theme-primary-fg font-semibold"
            : "text-hover-primary hover:text-theme-primary"
        }`}
      >
        {root.name}
      </Link>
    </div>
  );
}

interface MegaMenuPanelProps {
  root: NavNode;
  /** false for a synthetic multi-category grouping - there's no single category to preview products for. */
  enableProductPreview?: boolean;
  onNavigate?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

/**
 * The dropdown content for whichever nav item is currently open: the
 * subcategories (one column per level-2 child with its level-3 links, or a
 * single list when there is no level-3), and the Products under the
 * category with their Items. Rendered in normal document flow (a full-width
 * bar directly below the header's nav row) so opening it pushes the rest of
 * the page down rather than overlaying it.
 */
export function MegaMenuPanel({
  root,
  enableProductPreview = true,
  onNavigate,
  onMouseEnter,
  onMouseLeave,
}: MegaMenuPanelProps) {
  const href = withGenderParam(root.href ?? categoryHref(root), root.gender);
  const hasChildren = root.children.length > 0;
  const hasGrandchildren = root.children.some((c) => c.children.length > 0);
  /** One column per leaf child category (a subcategory list, or a grouped nav item's categories). */
  const showColumnProducts = hasChildren && !hasGrandchildren;

  const { data: menu, isLoading } = useCategoryMenu(root.slug || root.id, {
    enabled: enableProductPreview && !hasChildren,
    gender: root.gender,
  });
  const products = menu?.products ?? [];
  const showProducts = enableProductPreview && !hasChildren && (isLoading || products.length > 0);

  const columnMenus = useCategoryMenus(
    showColumnProducts ? root.children.map((c) => c.slug || c.id) : [],
    { enabled: showColumnProducts, gender: root.gender }
  );

  if (!hasChildren && !showProducts) return null;

  return (
    <div
      className="w-full border-t border-neutral-100 bg-white shadow-md"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="w-full max-w-[1100px] mx-auto px-4 sm:px-6 md:px-8 py-6 flex flex-col gap-6">
        {hasChildren && (
          <div className="shrink-0">
            {hasGrandchildren ? (
              <div className="flex flex-wrap gap-8">
                {root.children.map((level2) => (
                  <div key={level2.id} className="min-w-[160px]">
                    <Link
                      href={withGenderParam(categoryHref(level2), root.gender)}
                      onClick={onNavigate}
                      className="mb-3 block text-xs font-bold uppercase tracking-wide text-neutral-900 hover:text-theme-primary"
                    >
                      {level2.name}
                    </Link>
                    <ul className="space-y-2">
                      {level2.children.map((level3) => (
                        <li key={level3.id}>
                          <Link
                            href={withGenderParam(categoryHref(level3), root.gender)}
                            onClick={onNavigate}
                            className="text-sm text-neutral-600 hover:text-theme-primary"
                          >
                            {level3.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-8">
                {root.children.map((level2, i) => {
                  const columnMenu = columnMenus[i];
                  const columnProducts = columnMenu?.data?.products ?? [];
                  return (
                    <div key={level2.id} className="min-w-[160px]">
                      <Link
                        href={withGenderParam(categoryHref(level2), root.gender)}
                        onClick={onNavigate}
                        className="mb-3 block text-xs font-bold uppercase tracking-wide text-neutral-900 hover:text-theme-primary"
                      >
                        {level2.name}
                      </Link>
                      {columnMenu?.isLoading ? (
                        <ul className="space-y-2">
                          {[1, 2, 3].map((n) => (
                            <li key={n} className="h-3.5 w-28 rounded bg-neutral-100 animate-pulse" />
                          ))}
                        </ul>
                      ) : (
                        <ul className="space-y-2">
                          {columnProducts.slice(0, 5).map((product) => (
                            <li key={product.id}>
                              <Link
                                href={product.items[0] ? itemHref(product.items[0].id) : categoryHref(level2)}
                                onClick={onNavigate}
                                className="text-sm text-neutral-600 hover:text-theme-primary whitespace-nowrap"
                              >
                                {product.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                      <Link
                        href={withGenderParam(categoryHref(level2), root.gender)}
                        onClick={onNavigate}
                        className="mt-2 flex items-center gap-0.5 text-xs font-semibold text-theme-primary hover:underline"
                      >
                        View all
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {showProducts && (
          <div className={`min-w-0 ${hasChildren ? "border-t border-neutral-100 pt-6" : ""}`}>
            <div className="mb-3 flex items-center justify-between gap-6">
              <p className="text-xs font-bold uppercase tracking-wide text-neutral-900">
                Products
              </p>
              <Link
                href={href}
                onClick={onNavigate}
                className="flex items-center gap-0.5 text-xs font-semibold text-theme-primary hover:underline"
              >
                View all
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-3 gap-6">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="w-44 space-y-2 animate-pulse">
                    <div className="h-3 w-24 rounded bg-neutral-200" />
                    {[1, 2, 3].map((m) => (
                      <div key={m} className="flex items-center gap-2">
                        <div className="h-10 w-10 rounded-md bg-neutral-100" />
                        <div className="h-3 w-24 rounded bg-neutral-100" />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-x-6 gap-y-5">
                {products.map((product) => (
                  <div key={product.id} className="w-44">
                    {product.items[0] ? (
                      <Link
                        href={itemHref(product.items[0].id)}
                        onClick={onNavigate}
                        className="mb-2 block truncate text-sm font-semibold text-neutral-900 hover:text-theme-primary"
                        title={product.name}
                      >
                        {product.name}
                      </Link>
                    ) : (
                      <p className="mb-2 truncate text-sm font-semibold text-neutral-900">
                        {product.name}
                      </p>
                    )}
                    <ul className="space-y-1.5">
                      {product.items.map((item) => (
                        <li key={item.id}>
                          <ItemCard item={item} variant="compact" onClick={onNavigate} />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default MegaMenuTrigger;
