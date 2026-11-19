/**
 * Role-agnostic profile completion helpers.
 * Callers list only the fields their role actually requires; each is counted once.
 */

export interface RequiredField {
  /** Stable id — duplicates are ignored so a field is never double-counted. */
  key: string;
  label: string;
  filled: boolean;
}

export interface FieldCompletion {
  /** Rounded 0–100. */
  percent: number;
  /** Always 100 - percent. */
  incompletePercent: number;
  filled: number;
  total: number;
  missing: string[];
}

/** A filled value is non-null/undefined and, for strings, not blank. */
export const isFilled = (v: string | number | boolean | null | undefined): boolean =>
  typeof v === "string" ? v.trim().length > 0 : v !== null && v !== undefined;

export function calculateFieldCompletion(fields: RequiredField[]): FieldCompletion {
  const unique = [...new Map(fields.map((f) => [f.key, f])).values()];
  const filled = unique.filter((f) => f.filled).length;
  const percent = unique.length === 0 ? 0 : Math.round((filled / unique.length) * 100);
  return {
    percent,
    incompletePercent: 100 - percent,
    filled,
    total: unique.length,
    missing: unique.filter((f) => !f.filled).map((f) => f.label),
  };
}
