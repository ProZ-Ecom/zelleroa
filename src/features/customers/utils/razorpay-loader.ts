/**
 * Asynchronously load the Razorpay checkout script into the browser.
 */
let scriptLoadingPromise: Promise<boolean> | null = null;

const DEFAULT_RAZORPAY_BASE_URL = "https://checkout.razorpay.com";

type RazorpayWindow = Window & { Razorpay?: unknown };

function hasRazorpaySdk(): boolean {
  return typeof window !== "undefined" && Boolean((window as RazorpayWindow).Razorpay);
}

/**
 * Resolves the Razorpay Checkout script URL from the environment.
 * Supports full script URLs, base paths, or the official Razorpay checkout CDN.
 */
export function getRazorpayScriptUrl(): string {
  const configured =
    process.env.NEXT_PUBLIC_RAZORPAY_BASE_URL ||
    process.env.NEXT_PUBLIC_RAZORPAY_SCRIPT_URL ||
    DEFAULT_RAZORPAY_BASE_URL;

  const trimmed = configured.trim().replace(/\/+$/, "");
  if (trimmed.endsWith(".js")) {
    return trimmed;
  }
  if (trimmed.endsWith("/v1")) {
    return `${trimmed}/checkout.js`;
  }
  return `${trimmed}/v1/checkout.js`;
}

export function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === "undefined") {
    return Promise.resolve(false);
  }

  // Already loaded and available on window
  if (hasRazorpaySdk()) {
    return Promise.resolve(true);
  }

  // If already in-flight, return the existing promise
  if (scriptLoadingPromise) {
    return scriptLoadingPromise;
  }

  const scriptUrl = getRazorpayScriptUrl();

  scriptLoadingPromise = new Promise<boolean>((resolve) => {
    // Check if script tag already exists
    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${scriptUrl}"]`
    );

    if (existingScript) {
      if (hasRazorpaySdk()) {
        resolve(true);
        return;
      }
      existingScript.addEventListener("load", () => resolve(hasRazorpaySdk()), { once: true });
      existingScript.addEventListener(
        "error",
        () => {
          existingScript.remove();
          scriptLoadingPromise = null;
          resolve(false);
        },
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.src = scriptUrl;
    script.async = true;
    script.crossOrigin = "anonymous";

    script.onload = () => {
      resolve(hasRazorpaySdk());
    };

    script.onerror = () => {
      script.remove();
      scriptLoadingPromise = null;
      resolve(false);
    };

    document.body.appendChild(script);
  });

  return scriptLoadingPromise;
}
