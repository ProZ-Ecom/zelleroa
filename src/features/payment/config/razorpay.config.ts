import Razorpay from "razorpay";

export function getRazorpayClient(): Razorpay {
  const key_id = process.env.RAZORPAY_KEY_ID?.trim();
  const key_secret = process.env.RAZORPAY_KEY_SECRET?.trim();

  if (!key_id || !key_secret) {
    throw new Error(
      "Razorpay API credentials are not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in the environment."
    );
  }

  return new Razorpay({
    key_id,
    key_secret,
  });
}

export function getRazorpayPublicKey(): string {
  // Prefer the server key used to create Razorpay orders so Checkout never opens with a mismatched key.
  const key_id = (process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID)?.trim();
  if (!key_id) {
    throw new Error("Razorpay Public Key ID is not configured.");
  }
  return key_id;
}
