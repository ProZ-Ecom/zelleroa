import { DELIVERY_ESTIMATE, OTHER_STATE_DELIVERY_CHARGE } from "./shipping";
import type {
  DeliveryMethod,
  PaymentMethod,
} from "./types";

export const DELIVERY_OPTIONS: Record<
  DeliveryMethod,
  { label: string; cost: number; description: string }
> = {
  standard: { label: "Standard Delivery", cost: OTHER_STATE_DELIVERY_CHARGE, description: DELIVERY_ESTIMATE },
  express: { label: "Express Delivery", cost: OTHER_STATE_DELIVERY_CHARGE, description: DELIVERY_ESTIMATE },
};

export const PAYMENT_METHOD_OPTIONS: {
  value: PaymentMethod;
  label: string;
  description: string;
}[] = [
  { value: "CASH_ON_DELIVERY", label: "Cash on Delivery", description: "Pay in cash when your order arrives" },
  { value: "UPI", label: "UPI", description: "GPay, PhonePe, Paytm and more" },
  { value: "CREDIT_CARD", label: "Credit Card", description: "Visa, Mastercard, Amex" },
  { value: "DEBIT_CARD", label: "Debit Card", description: "Visa, Mastercard, RuPay" },
  { value: "NET_BANKING", label: "Net Banking", description: "All major banks supported" },
  { value: "WALLET", label: "Wallet", description: "Paytm wallet and more" },
];
