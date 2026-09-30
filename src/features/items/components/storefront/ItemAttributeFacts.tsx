"use client";

import { useMemo } from "react";
import {
  Info,
  Layers,
  Ruler,
  Sparkles,
  Shirt,
  Droplet,
  Globe,
  Calendar,
  Scale,
  Tag,
  type LucideIcon,
} from "lucide-react";
import type {
  CustomerStyleItemDto,
  CustomerVariantListItemDto,
  CustomerVariantUnitPriceDto,
} from "@/features/customers/types/catalog.types";

interface ItemAttributeFactsProps {
  item: CustomerStyleItemDto;
  selectedColor: CustomerVariantListItemDto | null;
  /** The exact Colour+Size row on screen, shown here as the SKU fact. */
  selectedSize?: CustomerVariantUnitPriceDto | null;
}

/** Best-effort icon for a fact by its label - purely decorative, falls back to `Info`. */
function iconFor(attributeName: string): LucideIcon {
  const name = attributeName.toLowerCase();
  if (name.includes("material") || name.includes("fabric")) return Layers;
  if (name.includes("fit")) return Ruler;
  if (name.includes("pattern") || name.includes("print")) return Sparkles;
  if (name.includes("sleeve") || name.includes("neck") || name.includes("collar"))
    return Shirt;
  if (name.includes("wash") || name.includes("care")) return Droplet;
  if (name.includes("origin") || name.includes("country") || name.includes("made"))
    return Globe;
  if (name.includes("season") || name.includes("occasion")) return Calendar;
  if (name.includes("weight") || name.includes("gsm")) return Scale;
  return Info;
}

/**
 * The Item's extra attributes - Material, Fit, Pattern and whatever else the
 * catalog carries. They come from two places and are merged here: the Item's
 * own attributes (true of every Colour) and the selected Colour's, which can
 * differ between Colours. Colour and Size are excluded; they have their own
 * selectors. The SKU of the exact Colour+Size on screen is appended as a
 * fact of its own. Renders nothing when there is nothing to show at all.
 */
export function ItemAttributeFacts({
  item,
  selectedColor,
  selectedSize,
}: ItemAttributeFactsProps) {
  const facts = useMemo(() => {
    const byName = new Map<string, Set<string>>();

    const add = (attributeName: string, value: string) => {
      const name = attributeName.trim();
      const key = name.toLowerCase();
      // Some catalogs name the Size/Colour attribute "Slipper Size(s)",
      // "Shoe Size", "Colour Name" etc rather than the bare word - matching by
      // "includes" keeps those out of the facts list too, since both already
      // have their own selector above.
      if (!name || !value || key.includes("color") || key.includes("colour") || key.includes("size")) {
        return;
      }
      if (!byName.has(name)) byName.set(name, new Set());
      byName.get(name)!.add(value);
    };

    for (const attribute of item.attributes ?? []) {
      add(attribute.attributeName, attribute.value);
    }
    for (const attribute of selectedColor?.attributeValues ?? []) {
      add(attribute.attributeName, attribute.value);
    }

    return [...byName.entries()].map(([name, values]) => ({
      name,
      value: [...values].join(", "),
      icon: iconFor(name),
    }));
  }, [item.attributes, selectedColor]);

  const sku = selectedSize?.sku || selectedColor?.sku;

  if (facts.length === 0 && !sku) return null;

  const tiles = sku ? [...facts, { name: "SKU", value: sku, icon: Tag }] : facts;

  return (
    <div className="space-y-3 rounded-2xl border border-theme-border bg-theme-surface-alt p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-theme-primary text-theme-primary-fg">
            <Info className="h-3.5 w-3.5" />
          </span>
          <h3 className="text-sm font-bold tracking-wide text-theme-text-primary">
            Product Details
          </h3>
        </div>
        <span className="hidden h-px flex-1 bg-gradient-to-r from-theme-border to-transparent sm:block" />
      </div>

      <dl className="grid grid-cols-2 gap-2 lg:grid-cols-3">
        {tiles.map((fact) => (
          <div
            key={fact.name}
            className="group flex min-w-0 flex-col gap-1 rounded-lg border border-theme-border-subtle bg-theme-surface p-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-theme-primary/40 hover:shadow-md"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-theme-primary-light text-theme-primary transition-colors group-hover:bg-theme-primary group-hover:text-theme-primary-fg">
              <fact.icon className="h-3.5 w-3.5" />
            </span>
            <dt className="text-[10px] font-bold uppercase tracking-wide text-theme-text-subtle">
              {fact.name}
            </dt>
            <dd className="min-w-0 break-words text-xs font-semibold leading-snug text-theme-text-primary [overflow-wrap:anywhere]">
              {fact.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default ItemAttributeFacts;
