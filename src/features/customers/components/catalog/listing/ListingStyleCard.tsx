"use client";

import { StyleCard } from "../StyleCard";
import type { ListingStyleCardDto } from "../../../types/catalog-listing.types";

/** One Item. Opens that Item's own page - never a page to choose between Items. */
export function ListingStyleCard({ item }: { item: ListingStyleCardDto }) {
  return <StyleCard item={item} variant="grid" />;
}

export default ListingStyleCard;
