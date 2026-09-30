"use client";

import { ItemCard } from "../ItemCard";
import type { ListingItemCardDto } from "../../../types/catalog-listing.types";

/** One Item. Opens that Item's own page - never a page to choose between Items. */
export function ListingItemCard({ item }: { item: ListingItemCardDto }) {
  return <ItemCard item={item} variant="grid" />;
}

export default ListingItemCard;
