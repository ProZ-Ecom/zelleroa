"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";
import { useCategories } from "@/features/categories/hooks";
import { useBrands } from "@/features/brands/hooks";
import { useHsnCodes } from "@/features/hsn-codes/hooks";
import { useUnits } from "@/features/units/hooks";
import { useAdminAttributes } from "@/features/attributes/hooks";

const STORAGE_KEY = "zellora_catalog_checklist_open";

export function CatalogChecklistBanner() {
  const [userToggled, setUserToggled] = useState<boolean | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "open") return true;
      if (saved === "closed") return false;
      return null;
    } catch {
      return null;
    }
  });

  const { data: categoriesData } = useCategories({ pageSize: 1 });
  const { data: brandsData } = useBrands({ limit: 1 });
  const { data: hsnData } = useHsnCodes({ pageSize: 1 });
  const { data: unitsData } = useUnits({ pageSize: 1 });
  const { data: attributesData } = useAdminAttributes({ pageSize: 1 });

  const isInitialLoading =
    !categoriesData ||
    !brandsData ||
    !hsnData ||
    !unitsData ||
    !attributesData;

  const hasCategories = (categoriesData?.data?.length ?? 0) > 0;
  const hasBrands = (brandsData?.data?.length ?? 0) > 0;
  const hasHsn = (hsnData?.data?.length ?? 0) > 0;
  const hasUnits = (unitsData?.data?.length ?? 0) > 0;
  const hasAttributes = (attributesData?.data?.length ?? 0) > 0;

  const items = [
    {
      label: "Tax / HSN Codes",
      ready: hasHsn,
      href: "/admin/dashboard/hsn-codes",
      actionText: "Add HSN & GST",
    },
    {
      label: "Categories",
      ready: hasCategories,
      href: "/admin/dashboard/categories",
      actionText: "Add Category",
    },
    {
      label: "Brands",
      ready: hasBrands,
      href: "/admin/dashboard/brands",
      actionText: "Add Brand",
    },
    {
      label: "Units (Piece, Sizes)",
      ready: hasUnits,
      href: "/admin/dashboard/units",
      actionText: "Add Units",
    },
    {
      label: "Attributes (Color, Size)",
      ready: hasAttributes,
      href: "/admin/dashboard/attributes",
      actionText: "Add Attributes",
    },
  ];

  const readyCount = items.filter((i) => i.ready).length;
  const allReady = readyCount === items.length;

  // Once the checklist is 5 out of 5, hide it completely.
  // Also keep it hidden during initial loading so it never flashes on screen.
  if (isInitialLoading || allReady) {
    return null;
  }

  // When less than 5 are ready, default to open unless user manually collapsed it
  const isOpen = userToggled !== null ? userToggled : true;

  const toggleOpen = () => {
    const next = !isOpen;
    setUserToggled(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "open" : "closed");
    } catch {
      // ignore
    }
  };

  return (
    <div className="mb-5 rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50/80 via-white to-amber-50/40 transition-all duration-200 shadow-xs">
      <div
        onClick={toggleOpen}
        className="flex flex-wrap items-center justify-between gap-3 p-4 cursor-pointer select-none"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-700">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-neutral-900">
                Catalog Setup Checklist
              </h3>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                {readyCount} of {items.length} Ready
              </span>
            </div>
            <p className="mt-0.5 text-xs text-neutral-600">
              Set up master prerequisites before adding products so forms and variant generators work seamlessly.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleOpen();
            }}
            className="flex items-center gap-1 text-xs font-semibold rounded-lg px-2.5 py-1.5 text-neutral-600 hover:bg-neutral-100 transition cursor-pointer"
            aria-expanded={isOpen}
            title={isOpen ? "Collapse checklist" : "Expand checklist"}
          >
            <span>{isOpen ? "Hide Checklist" : "Show Checklist"}</span>
            {isOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="border-t border-neutral-100 px-4 pb-4 pt-3">
          <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {items.map((item) => (
              <div
                key={item.label}
                className={`flex items-center justify-between rounded-xl border p-2.5 text-xs transition ${
                  item.ready
                    ? "border-emerald-200/80 bg-emerald-50/50 text-emerald-900"
                    : "border-neutral-200 bg-white text-neutral-800 hover:border-amber-300"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {item.ready ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
                  )}
                  <span className="truncate font-medium">{item.label}</span>
                </div>

                {item.ready ? (
                  <span className="ml-1 shrink-0 text-[11px] font-semibold text-emerald-700">
                    Ready
                  </span>
                ) : (
                  <Link
                    href={item.href}
                    onClick={(e) => e.stopPropagation()}
                    className="ml-1 shrink-0 inline-flex items-center gap-0.5 text-[11px] font-bold text-secondary-600 hover:text-secondary-700 hover:underline"
                  >
                    {item.actionText}
                    <ChevronRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
