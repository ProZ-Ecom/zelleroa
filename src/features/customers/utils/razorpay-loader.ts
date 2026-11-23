/**
 * Asynchronously load the Razorpay checkout script into the browser.
 */
let scriptLoadingPromise: Promise<boolean> | null = null;

/**
 * Resolves the Razorpay Checkout script URL from the environment.
 * Supports full script URLs, base paths, or default checkout CDN.
 */
export function getRazorpayScriptUrl(): string {
  const configured =
    process.env.NEXT_PUBLIC_RAZORPAY_BASE_URL ||
    process.env.NEXT_PUBLIC_RAZORPAY_SCRIPT_URL;

  if (!configured) {
    throw new Error(
      "Razorpay base URL is not configured. Please set NEXT_PUBLIC_RAZORPAY_BASE_URL in your .env file."
    );
  }

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
  if ((window as any).Razorpay) {
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
      existingScript.addEventListener("load", () => resolve(true));
      existingScript.addEventListener("error", () => resolve(false));
      return;
    }

    const script = document.createElement("script");
    script.src = scriptUrl;
    script.async = true;
    script.crossOrigin = "anonymous";

    script.onload = () => {
      resolve(true);
    };

    script.onerror = () => {
      scriptLoadingPromise = null;
      resolve(false);
    };

    document.body.appendChild(script);
  });

  return scriptLoadingPromise;
}
