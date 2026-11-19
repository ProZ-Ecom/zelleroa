"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MissingImageBannerProps {
  /** How many records still have no image. Nothing renders when this is 0. */
  count: number;
  /** Plural noun for the records, e.g. "categories". */
  noun: string;
  /** Wire this to filter the list down to the records without an image. */
  onShowOnly?: () => void;
  showingOnly?: boolean;
  onClearFilter?: () => void;
}

/**
 * Standing reminder above an admin list that some records have no image yet.
 *
 * A bulk import cannot carry images, so the records it creates arrive without one. The
 * notice in the import dialog is gone as soon as the dialog closes; this stays on the
 * list until every record has an image.
 */
export function MissingImageBanner({
  count,
  noun,
  onShowOnly,
  showingOnly,
  onClearFilter,
}: MissingImageBannerProps) {
  if (count <= 0) return null;

  return (
    <div className="mt-4 flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          <span className="font-semibold">
            {count} {count === 1 ? noun.replace(/ies$/, "y").replace(/s$/, "") : noun}
          </span>{" "}
          {count === 1 ? "has" : "have"} no image. Open each one and upload its image —
          imported records never come with one.
        </span>
      </p>
      {onShowOnly &&
        (showingOnly ? (
          <Button variant="outline" size="sm" onClick={onClearFilter} className="shrink-0">
            Show all
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={onShowOnly} className="shrink-0">
            Show these
          </Button>
        ))}
    </div>
  );
}
