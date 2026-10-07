export type SizeChartGender = "men" | "women" | "kids" | "unisex" | "not_applicable";

export interface SizeChartEntry {
  id: string; // AttributeValue public UUID
  value: string; // e.g. "M", "2-3Y"
  sortOrder: number;
}
