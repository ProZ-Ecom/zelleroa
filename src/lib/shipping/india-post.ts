/**
 * India Post (Speed Post) helpers.
 *
 * India Post has no public booking/tracking API, so admins book at the post
 * office and enter the consignment number; customers track via India Post's site.
 */

export const INDIA_POST_PARTNER_CODE = "INDIA_POST";
export const INDIA_POST_PARTNER_NAME = "India Post";

// Speed Post / registered article numbers: 2 letters, 9 digits, 2 letters (e.g. EE123456789IN).
export const INDIA_POST_CONSIGNMENT_REGEX = /^[A-Z]{2}\d{9}[A-Z]{2}$/;

export function getIndiaPostTrackingUrl(consignmentNumber: string): string {
  return `https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx?consignmentnumber=${encodeURIComponent(consignmentNumber)}`;
}
