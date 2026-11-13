/**
 * WhatsApp Utility Functions & Message Templates
 */

/**
 * Normalizes an Indian or international phone number to international E.164 digits and display formats.
 * For standard 10-digit Indian mobile numbers or numbers starting with 0, prepends country code +91.
 */
export function normalizePhoneNumber(rawPhone: string): {
  digits: string;
  e164: string;
  formatted: string;
  isValid: boolean;
} {
  if (!rawPhone || typeof rawPhone !== "string") {
    return { digits: "", e164: "", formatted: "", isValid: false };
  }

  // 1. Remove domain (@s.whatsapp.net, @lid, etc.) and multi-device index suffix (:22, :0, etc.)
  const withoutDomain = rawPhone.split("@")[0].split(":")[0];
  // 2. Extract digits only
  let digits = withoutDomain.replace(/\D/g, "");

  // 3. Strip international trunk prefix 00 or local trunk 0
  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  } else if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  // 4. If 10 digits, assume standard Indian mobile number (+91)
  if (digits.length === 10) {
    digits = "91" + digits;
  }

  const isValid = digits.length >= 10 && digits.length <= 15;
  const e164 = digits ? `+${digits}` : "";

  // 5. Clean readable display format
  let formatted = e164;
  if (digits.length === 12 && digits.startsWith("91")) {
    formatted = `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  } else if (digits.length === 10) {
    formatted = `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }

  return { digits, e164, formatted, isValid };
}

export function formatToWhatsAppJid(phone: string): string {
  const norm = normalizePhoneNumber(phone);
  return `${norm.digits}@s.whatsapp.net`;
}

export function cleanPhoneDisplay(rawJidOrPhone: string): string {
  const norm = normalizePhoneNumber(rawJidOrPhone);
  return norm.formatted || norm.e164;
}

export const WHATSAPP_TEMPLATES = [
  {
    id: "order_confirmed",
    name: "Order Confirmed",
    template: (orderId = "1001", customerName = "Customer", amount = "450") =>
      `Hello ${customerName}! 🙏\n\nYour Zellora order *#${orderId}* for *₹${amount}* has been confirmed and is being carefully prepared! ✨\n\nWe will notify you as soon as your parcel is dispatched.\n\nThank you for shopping with Zellora! ❤️`,
  },
  {
    id: "out_for_delivery",
    name: "Out for Delivery",
    template: (orderId = "1001", customerName = "Customer") =>
      `Hello ${customerName}! 🚚\n\nGreat news! Your Zellora order *#${orderId}* is out for delivery. Our courier partner will reach you shortly.\n\nGet ready to elevate your style! ✨`,
  },
  {
    id: "order_delivered",
    name: "Order Delivered",
    template: (orderId = "1001", customerName = "Customer") =>
      `Dear ${customerName}, your Zellora order *#${orderId}* has been delivered successfully! 🎉\n\nWe hope you love your new pieces! If you have any feedback or sizing inquiries, please reply directly to this message.\n\nHave a stylish day! ❤️`,
  },
  {
    id: "payment_reminder",
    name: "Payment Reminder",
    template: (orderId = "1001", customerName = "Customer", amount = "450") =>
      `Hello ${customerName},\n\nThis is a friendly reminder regarding your pending payment of *₹${amount}* for Zellora order *#${orderId}*.\n\nPlease complete your payment using UPI/card or contact us for assistance. Thank you! 🙏`,
  },
];
