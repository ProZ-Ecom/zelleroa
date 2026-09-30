const DAY_MS = 24 * 60 * 60 * 1000;

export interface OfferValidity {
  label: string;
  /** True when the offer ends within a week, so the UI can flag it. */
  urgent: boolean;
}

/** "Valid till 30 Sep 2026", or an urgency hint when close; null when open-ended. */
export function getOfferValidity(endsAt: string | null | undefined): OfferValidity | null {
  if (!endsAt) return null;
  const end = new Date(endsAt);
  if (Number.isNaN(end.getTime())) return null;

  const daysLeft = Math.ceil((end.getTime() - Date.now()) / DAY_MS);
  const date = end.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  if (daysLeft <= 0) return { label: "Ends today", urgent: true };
  if (daysLeft === 1) return { label: "Ends tomorrow", urgent: true };
  if (daysLeft <= 7) return { label: `Only ${daysLeft} days left · ends ${date}`, urgent: true };
  return { label: `Valid till ${date}`, urgent: false };
}
