import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface NoImagePlaceholderProps {
  /** Square size in pixels, matching the thumbnail it stands in for. */
  size?: number;
  className?: string;
}

/**
 * Empty slot shown in admin lists where a record has no image yet.
 *
 * Deliberately not a picture: a stock photo in the thumbnail reads as "an image was
 * uploaded", which hides the records a bulk import left without one. The dashed border
 * and label say the slot is still empty.
 */
export function NoImagePlaceholder({ size = 48, className }: NoImagePlaceholderProps) {
  const compact = size < 56;

  return (
    <div
      style={{ width: size, height: size }}
      title="No image uploaded"
      className={cn(
        "flex flex-col items-center justify-center gap-0.5 rounded-xl border border-dashed",
        "border-[var(--color-neutral-300)] bg-[var(--color-neutral-50)] text-[var(--color-neutral-400)]",
        className
      )}
    >
      <ImageOff className={compact ? "h-4 w-4" : "h-5 w-5"} aria-hidden />
      {!compact && <span className="text-[10px] leading-none font-medium">No image</span>}
      <span className="sr-only">No image uploaded</span>
    </div>
  );
}
