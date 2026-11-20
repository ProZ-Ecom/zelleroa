/**
 * WhatsApp Module environment configuration.
 *
 * Controls whether the WhatsApp marketing and integration module is enabled
 * in the Admin Panel navigation and routes.
 */

export function isWhatsAppModuleEnabled(): boolean {
  const explicit = (
    process.env.NEXT_PUBLIC_ENABLE_WHATSAPP_MODULE ??
    process.env.NEXT_PUBLIC_ENABLE_WHATSAPP ??
    process.env.ENABLE_WHATSAPP_MODULE
  )?.trim().toLowerCase();

  if (explicit !== undefined && explicit !== "") {
    return explicit === "true" || explicit === "1" || explicit === "yes";
  }

  return false;
}
