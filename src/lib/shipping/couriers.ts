/**
 * Third-party couriers an admin can hand a packed order to (India Post, ST Courier, ...).
 *
 * None of these are integrated by API: the admin books the parcel, enters the tracking
 * number, and customers follow it on the courier's own tracking page.
 */

export interface CourierDefinition {
  code: string;
  name: string;
  /** Hint shown in the tracking number input. */
  placeholder: string;
  /** Format check for the tracking number; omitted when the courier's format varies. */
  pattern?: RegExp;
  patternMessage?: string;
  /** Deep link to the courier's tracking page for a given number. */
  trackingUrl: (trackingNumber: string) => string;
}

export const COURIERS: readonly CourierDefinition[] = [
  {
    code: "INDIA_POST",
    name: "India Post",
    placeholder: "EE123456789IN",
    // Speed Post / registered article numbers: 2 letters, 9 digits, 2 letters.
    pattern: /^[A-Z]{2}\d{9}[A-Z]{2}$/,
    patternMessage: "Enter a valid Speed Post consignment number (e.g. EE123456789IN)",
    trackingUrl: (n) =>
      `https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx?consignmentnumber=${encodeURIComponent(n)}`,
  },
  {
    code: "ST_COURIER",
    name: "ST Courier",
    placeholder: "Docket / consignment number",
    trackingUrl: () => "https://www.stcourier.com/track/shipment",
  },
  {
    code: "DTDC",
    name: "DTDC",
    placeholder: "Consignment number",
    trackingUrl: () => "https://www.dtdc.in/tracking.asp",
  },
  {
    code: "PROFESSIONAL_COURIERS",
    name: "Professional Couriers",
    placeholder: "Consignment number",
    trackingUrl: () => "https://www.tpcindia.com/",
  },
  {
    code: "DELHIVERY",
    name: "Delhivery",
    placeholder: "Waybill number",
    trackingUrl: (n) => `https://www.delhivery.com/track-v2/package/${encodeURIComponent(n)}`,
  },
  {
    code: "OTHER_COURIER",
    name: "Other courier",
    placeholder: "Tracking number",
    trackingUrl: () => "",
  },
];

export const COURIER_CODES = COURIERS.map((c) => c.code) as [string, ...string[]];

export const DEFAULT_COURIER_CODE = "INDIA_POST";

export function getCourier(code?: string | null): CourierDefinition | undefined {
  return COURIERS.find((c) => c.code === code);
}

export function getCourierTrackingUrl(code: string, trackingNumber: string): string {
  return getCourier(code)?.trackingUrl(trackingNumber) ?? "";
}
