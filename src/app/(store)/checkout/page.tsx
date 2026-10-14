"use client";

import { useState, useMemo, useEffect } from "react";
import { EMAIL_MAX_LENGTH, emailField } from "@/lib/validations/email";
import { getMobileError } from "@/lib/validations/mobile";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { ProductImage } from "@/components/common/ProductImage";
import {
  MapPin,
  Truck,
  CreditCard,
  CheckCircle2,
  Plus,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  ShoppingBag,
  Lock,
  AlertCircle,
  Loader2,
  X,
  Phone,
  Clock,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { formatPrice, cn } from "@/lib/utils";
import {
  MOBILE_VERIFICATION_PATH,
  MOBILE_VERIFICATION_REQUIRED_CODE,
  MOBILE_VERIFICATION_REQUIRED_MESSAGE,
} from "@/lib/constants/mobile-verification";
import { formatMeasurementLabel } from "@/features/variants/utils/measurement.util";
import { useCustomerCart } from "@/features/customers/hooks/use-customer-cart";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCustomerAddresses,
  useCreateCustomerAddress,
} from "@/features/customers/hooks/use-customer-address";
import {
  useCreateCustomerOrder,
  useCreateGuestOrder,
  CUSTOMER_ORDERS_QUERY_KEY,
} from "@/features/customers/hooks/use-customer-orders";
import { customerPaymentApi } from "@/features/customers/api/customer-payment.api";
import { useCheckout } from "@/features/checkout/checkout-context";
import { useIsAgent, useSignedIn } from "@/features/auth/hooks/use-signed-in";
import { AgentCartCustomerOrder } from "@/features/agents/components/AgentCartCustomerOrder";
import {
  DELIVERY_ESTIMATE,
  FREE_DELIVERY_STATE,
  OTHER_STATE_DELIVERY_CHARGE,
  STANDARD_DELIVERY_CHARGE,
  EXPRESS_DELIVERY_CHARGE,
  STANDARD_DELIVERY_ESTIMATE,
  EXPRESS_DELIVERY_ESTIMATE,
  getShippingCharge,
  isFreeDeliveryState,
} from "@/features/orders/shipping";
import { usePincodeLookup } from "@/features/addresses/hooks/use-pincode-lookup";
import type { CustomerAddressResponse } from "@/features/customers/types/customer-address.types";
import { loadRazorpayScript } from "@/features/customers/utils/razorpay-loader";


function CheckoutSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8 sm:py-10 max-w-7xl animate-pulse">
      <div className="mb-8 space-y-2">
        <div className="h-8 w-64 rounded-xl skeleton-shimmer" />
        <div className="h-4 w-96 rounded-lg skeleton-shimmer" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-6">
          <div className="rounded-2xl border border-theme-border bg-theme-surface p-6 space-y-4">
            <div className="h-6 w-48 rounded-md skeleton-shimmer" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="h-36 rounded-xl skeleton-shimmer" />
              <div className="h-36 rounded-xl skeleton-shimmer" />
            </div>
          </div>

          <div className="rounded-2xl border border-theme-border bg-theme-surface p-6 space-y-4">
            <div className="h-6 w-48 rounded-md skeleton-shimmer" />
            <div className="h-24 rounded-xl skeleton-shimmer" />
          </div>

          <div className="rounded-2xl border border-theme-border bg-theme-surface p-6 space-y-4">
            <div className="h-6 w-48 rounded-md skeleton-shimmer" />
            <div className="h-40 rounded-xl skeleton-shimmer" />
          </div>
        </div>

        <div className="lg:col-span-4">
          <div className="rounded-2xl border border-theme-border bg-theme-surface p-6 space-y-4">
            <div className="h-6 w-36 rounded-md skeleton-shimmer" />
            <div className="h-32 rounded-xl skeleton-shimmer" />
            <div className="h-12 rounded-xl skeleton-shimmer" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session, status: authStatus } = useSession();
  const { isOrderPlaced, setIsOrderPlaced } = useCheckout();

  // Customer Module TanStack Query hooks
  const { data: cart, isLoading: cartLoading } = useCustomerCart();
  const { data: addresses = [], isLoading: addressesLoading } =
    useCustomerAddresses();
  const createAddressMutation = useCreateCustomerAddress();
  const createOrderMutation = useCreateCustomerOrder();
  const createGuestOrderMutation = useCreateGuestOrder();

  // Agents sign in through the cookie flow, so useSession() alone would call them guests.
  const signedIn = useSignedIn();
  const isAgent = useIsAgent();
  // Agent flow: is this cart for the agent themselves (own order) or one of their customers?
  const [orderFor, setOrderFor] = useState<"self" | "customer">("self");
  const isGuest = authStatus !== "loading" && !signedIn;
  const [guestEmail, setGuestEmail] = useState<string>("");

  // Selected state
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");
  const [deliveryMethod, setDeliveryMethod] = useState<"standard" | "express">("standard");
  const [paymentMethod, setPaymentMethod] = useState<"CARD" | "UPI" | "COD">(
    "CARD"
  );
  const [orderNotes, setOrderNotes] = useState<string>("");
  const [checkoutError, setCheckoutErrorState] = useState<string | null>(null);
  const [mobileVerificationRequired, setMobileVerificationRequired] = useState(false);

  // Clearing/setting a plain message resets the verification prompt; the
  // backend's MOBILE_VERIFICATION_REQUIRED code turns it on (see reportOrderError).
  const setCheckoutError = (message: string | null) => {
    setMobileVerificationRequired(false);
    setCheckoutErrorState(message);
  };
  const reportOrderError = (err: any, fallback: string) => {
    if (err?.code === MOBILE_VERIFICATION_REQUIRED_CODE) {
      setCheckoutErrorState(err.message || MOBILE_VERIFICATION_REQUIRED_MESSAGE);
      setMobileVerificationRequired(true);
      return;
    }
    setCheckoutError(err?.message || fallback);
  };

  // Payment in-flight guards
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);
  const [pendingOrder] = useState<null>(null);


  // Add Address Modal state
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [newAddressForm, setNewAddressForm] = useState({
    fullName: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    landmark: "",
    city: "",
    state: "Tamil Nadu",
    pincode: "",
    country: "India",
    addressType: "shipping" as const,
    isDefault: true,
  });
  const [addressFormError, setAddressFormError] = useState<string | null>(null);
  const {
    isLoading: isPincodeLoading,
    lookupError: pincodeLookupError,
    postOffices,
    triggerLookup: triggerPincodeLookup,
  } = usePincodeLookup();
  const [area, setArea] = useState("");

  const validateField = (field: string, value: string): string | null => {
    const val = (value || "").trim();
    if (field === "guestEmail") {
      if (!val) return "Email address is required";
      const res = emailField.safeParse(val);
      if (!res.success) return res.error.issues[0].message;
      return null;
    }
    if (field === "fullName") {
      if (!val) return "Recipient name is required";
      if (val.length < 2) return "Recipient name must be at least 2 characters";
      if (val.length > 150) return "Recipient name cannot exceed 150 characters";
      return null;
    }
    if (field === "phone") {
      if (!val) return "Phone number is required";
      const err = getMobileError(val);
      if (err) return err;
      return null;
    }
    if (field === "pincode") {
      const clean = val.replace(/\D/g, "");
      if (!val) return "PIN code is required";
      if (clean.length !== 6 || !/^\d{6}$/.test(clean)) {
        return "PIN code must be exactly 6 digits";
      }
      return null;
    }
    if (field === "addressLine1") {
      if (!val) return "Flat / House No., Building, Street is required";
      if (val.length < 3) return "Please enter a complete street address";
      if (val.length > 255) return "Address line cannot exceed 255 characters";
      return null;
    }
    if (field === "city") {
      if (!val) return "City is required";
      if (val.length > 100) return "City cannot exceed 100 characters";
      return null;
    }
    if (field === "state") {
      if (!val) return "State is required";
      if (val.length > 100) return "State cannot exceed 100 characters";
      return null;
    }
    return null;
  };

  const validateAddressForm = () => {
    const errors: Record<string, string> = {};
    if (isGuest) {
      const emailErr = validateField("guestEmail", guestEmail);
      if (emailErr) errors.guestEmail = emailErr;
    }
    const nameErr = validateField("fullName", newAddressForm.fullName);
    if (nameErr) errors.fullName = nameErr;

    const phoneErr = validateField("phone", newAddressForm.phone);
    if (phoneErr) errors.phone = phoneErr;

    const pinErr = validateField("pincode", newAddressForm.pincode);
    if (pinErr) errors.pincode = pinErr;

    const addrErr = validateField("addressLine1", newAddressForm.addressLine1);
    if (addrErr) errors.addressLine1 = addrErr;

    const cityErr = validateField("city", newAddressForm.city);
    if (cityErr) errors.city = cityErr;

    const stateErr = validateField("state", newAddressForm.state);
    if (stateErr) errors.state = stateErr;

    return errors;
  };

  const handleFieldChange = (field: string, value: string) => {
    if (field === "guestEmail") {
      setGuestEmail(value);
    } else {
      setNewAddressForm((prev) => ({ ...prev, [field]: value }));
    }
    if (fieldErrors[field]) {
      const err = validateField(field, value);
      setFieldErrors((prev) => {
        const next = { ...prev };
        if (err) next[field] = err;
        else delete next[field];
        return next;
      });
    }
  };

  const handleFieldBlur = (field: string) => {
    const value = field === "guestEmail" ? guestEmail : (newAddressForm as any)[field] || "";
    const err = validateField(field, value);
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (err) next[field] = err;
      else delete next[field];
      return next;
    });
  };

  // Auto-fill city and state from the PIN code. City and state are disabled/readOnly.
  const handlePincodeChange = (value: string) => {
    const pincode = value.replace(/\D/g, "").slice(0, 6);
    setArea("");
    setNewAddressForm((prev) => ({
      ...prev,
      pincode,
      ...(pincode.length < 6 ? { city: "", state: "" } : {}),
    }));

    if (fieldErrors.pincode) {
      if (pincode.length === 6) {
        setFieldErrors((prev) => {
          const next = { ...prev };
          delete next.pincode;
          return next;
        });
      }
    }

    void triggerPincodeLookup(pincode, {
      onSuccess: ({ city, state }) => {
        setNewAddressForm((prev) => ({ ...prev, city, state }));
        setFieldErrors((prev) => {
          const next = { ...prev };
          if (city) delete next.city;
          if (state) delete next.state;
          return next;
        });
      },
    });
  };

  // Online payment stays a logged-in-only convenience for now; guests are COD only.
  useEffect(() => {
    if (isGuest) setPaymentMethod("COD");
  }, [isGuest]);

  // Effective selected address (fall back to default or first available)
  const effectiveAddressId = useMemo(() => {
    if (selectedAddressId && addresses.some((a) => a.id === selectedAddressId)) {
      return selectedAddressId;
    }
    const defaultAddr = addresses.find((a) => a.isDefault);
    if (defaultAddr) return defaultAddr.id;
    if (addresses.length > 0) return addresses[0].id;
    return "";
  }, [selectedAddressId, addresses]);

  // Pricing calculations
  const items = cart?.items || [];
  const subtotal = Number(cart?.subtotal || 0);
  // Delivery is priced by chosen delivery method (Standard = ₹49, Express = ₹99)
  const deliveryState = isGuest
    ? newAddressForm.state
    : addresses.find((a) => a.id === effectiveAddressId)?.state;
  const hasDeliveryState = !!deliveryState?.trim();
  const isFreeDelivery = false;
  const shippingCharge = getShippingCharge(deliveryState, deliveryMethod);
  const grandTotal = subtotal + shippingCharge;

  // Authentication gate
  if (authStatus === "loading" || (cartLoading && !cart) || addressesLoading) {
    return <CheckoutSkeleton />;
  }

  // Guests can check out too - no login redirect here.

  // Order placed confirmation guard (prevents flashing empty cart screen)
  if (isOrderPlaced) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-lg text-center space-y-4 animate-in fade-in duration-300">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 border border-emerald-300 text-emerald-600 shadow-sm animate-in zoom-in-75 duration-300">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-theme-text-primary">
          Order Placed Successfully!
        </h2>
        <p className="text-xs sm:text-sm text-theme-text-subtle">
          Finalizing your order confirmation... Please wait.
        </p>
        <div className="flex items-center justify-center gap-2 text-xs text-theme-text-muted pt-2">
          <Loader2 className="h-4 w-4 animate-spin text-theme-primary" />
          <span>Preparing your order receipt...</span>
        </div>
      </div>
    );
  }

  // With redirect flow, pendingOrder is always null — this guard is kept for safety.
  if (pendingOrder && !isOrderPlaced) {
    return null;
  }

  // Empty cart guard
  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-4xl text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-theme-surface-alt border border-theme-border text-theme-primary">
          <ShoppingBag className="h-8 w-8" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-theme-text-primary mb-2">
          Your Cart is Empty
        </h1>
        <p className="text-theme-text-subtle mb-6 text-sm max-w-md mx-auto">
          Explore our handcrafted clothing, stylish dresses, and timeless collections to
          proceed with your order.
        </p>
        <Link href="/products">
          <Button className="min-h-[44px] px-6 rounded-xl bg-theme-primary hover:bg-theme-primary-hover text-white font-semibold shadow-sm">
            Browse Collections
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>
    );
  }


  // Handle address form creation
  const handleCreateAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddressFormError(null);

    const errors = validateAddressForm();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    try {
      const cleanPhone = newAddressForm.phone.startsWith("+91")
        ? newAddressForm.phone
        : `+91${newAddressForm.phone.replace(/\D/g, "").slice(-10)}`;

      const created = await createAddressMutation.mutateAsync({
        fullName: newAddressForm.fullName.trim(),
        phone: cleanPhone,
        addressLine1: newAddressForm.addressLine1.trim(),
        addressLine2: newAddressForm.addressLine2.trim() || undefined,
        landmark: newAddressForm.landmark.trim() || undefined,
        city: newAddressForm.city.trim(),
        state: newAddressForm.state.trim(),
        pincode: newAddressForm.pincode.trim(),
        country: "India",
        addressType: "shipping",
        isDefault: newAddressForm.isDefault,
      });

      setSelectedAddressId(created.id);
      setIsAddingAddress(false);
      setFieldErrors({});
      setNewAddressForm({
        fullName: "",
        phone: "",
        addressLine1: "",
        addressLine2: "",
        landmark: "",
        city: "",
        state: "Tamil Nadu",
        pincode: "",
        country: "India",
        addressType: "shipping",
        isDefault: true,
      });
    } catch (err: any) {
      setAddressFormError(err.message || "Failed to save address");
    }
  };

  // In-built Razorpay payment flow via embedded modal (matches Rithu Snacks flow)
  const launchInbuiltRazorpayPayment = async (targetAddressId?: string) => {
    setIsProcessingPayment(true);
    setCheckoutError(null);

    const shippingId = targetAddressId || effectiveAddressId;
    if (!shippingId) {
      setIsProcessingPayment(false);
      setCheckoutError("Please select or add a delivery address first.");
      return;
    }

    try {
      // 1. Asynchronously load Razorpay Checkout SDK
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) {
        setIsProcessingPayment(false);
        setCheckoutError(
          "Could not load Razorpay SDK. Please check your internet connection and try again."
        );
        return;
      }

      // 2. Create Razorpay Order from active cart
      const razorpayOrder = await customerPaymentApi.createRazorpayOrder({
        orderId: "cart",
        shippingAddressId: shippingId,
        deliveryMethod: deliveryMethod,
      });

      // 3. Find address details for prefill
      const chosenAddress = addresses.find((a) => a.id === shippingId);
      const user = session?.user;

      // 4. Configure Razorpay In-built Modal Options
      const options = {
        key: razorpayOrder.keyId,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency || "INR",
        name: "Zellora",
        description: `Order Checkout - ₹${(razorpayOrder.amount / 100).toFixed(2)}`,
        order_id: razorpayOrder.razorpayOrderId,
        prefill: {
          name: chosenAddress ? chosenAddress.fullName : user?.name || "",
          email: user?.email || "",
          contact: chosenAddress?.phone || (user as any)?.phone || "",
        },
        theme: {
          color: "#2563EB", // Zellora Royal Cobalt brand color
        },
        modal: {
          ondismiss: () => {
            setIsProcessingPayment(false);
            setIsVerifyingPayment(false);
            setCheckoutError(
              "Payment window was closed. You can retry whenever you are ready."
            );
          },
        },
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          setIsVerifyingPayment(true);
          try {
            // 5. Verify Cryptographic Payment Signature & Confirm Order
            const verifyResult = await customerPaymentApi.verifyPayment({
              orderId: "cart",
              shippingAddressId: shippingId,
              billingAddressId: shippingId,
              deliveryMethod: deliveryMethod,
              notes: orderNotes.trim() || undefined,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            setIsOrderPlaced(true);
            queryClient.invalidateQueries({
              queryKey: CUSTOMER_ORDERS_QUERY_KEY,
              refetchType: "all",
            });
            queryClient.invalidateQueries({
              queryKey: ["customer", "cart"],
              refetchType: "all",
            });
            queryClient.invalidateQueries({
              queryKey: ["cart"],
              refetchType: "all",
            });

            router.push(
              `/checkout/success?orderNumber=${encodeURIComponent(
                verifyResult.orderNumber
              )}&orderId=${encodeURIComponent(verifyResult.orderId)}`
            );
          } catch (err: any) {
            setCheckoutError(
              err.message ||
                "Payment verification failed. Please contact customer support."
            );
          } finally {
            setIsProcessingPayment(false);
            setIsVerifyingPayment(false);
          }
        },
      };

      const razorpayInstance = new (window as any).Razorpay(options);
      razorpayInstance.on("payment.failed", function (response: any) {
        setIsProcessingPayment(false);
        setIsVerifyingPayment(false);
        setCheckoutError(
          response?.error?.description ||
            "Transaction was declined or failed. Please try again."
        );
      });
      razorpayInstance.open();
    } catch (err: any) {
      setIsProcessingPayment(false);
      setIsVerifyingPayment(false);
      setCheckoutError(
        err.message ||
          "Failed to initialize payment gateway. Please check item stock and retry."
      );
    }
  };

  // Place Order Handler (guest)
  const handlePlaceGuestOrder = async () => {
    setAddressFormError(null);
    setCheckoutError(null);

    const errors = validateAddressForm();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setCheckoutError("Please fill in all required delivery and contact details correctly.");
      return;
    }
    setFieldErrors({});

    try {
      const cleanPhone = newAddressForm.phone.startsWith("+91")
        ? newAddressForm.phone
        : `+91${newAddressForm.phone.replace(/\D/g, "").slice(-10)}`;

      const order = await createGuestOrderMutation.mutateAsync({
        email: guestEmail.trim(),
        fullName: newAddressForm.fullName.trim(),
        phone: cleanPhone,
        addressLine1: newAddressForm.addressLine1.trim(),
        addressLine2: newAddressForm.addressLine2.trim() || undefined,
        landmark: newAddressForm.landmark.trim() || undefined,
        city: newAddressForm.city.trim(),
        state: newAddressForm.state.trim(),
        pincode: newAddressForm.pincode.trim(),
        notes: orderNotes.trim() || undefined,
        paymentMethod: "COD",
        deliveryMethod,
      });

      const orderId = (order as any)?.id;
      const orderNumber = (order as any)?.orderNumber;

      setIsOrderPlaced(true);
      queryClient.invalidateQueries({ queryKey: CUSTOMER_ORDERS_QUERY_KEY, refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["customer", "cart"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["cart"], refetchType: "all" });

      const params = new URLSearchParams();
      if (orderId) params.set("orderId", String(orderId));
      if (orderNumber) params.set("orderNumber", String(orderNumber));
      router.push(`/checkout/success${params.toString() ? `?${params.toString()}` : ""}`);
    } catch (err: any) {
      setIsOrderPlaced(false);
      reportOrderError(
        err,
        "Failed to place your order. Please check your details and try again."
      );
    }
  };

  // Place Order Handler
  const handlePlaceOrder = async () => {
    setCheckoutError(null);

    if (isProcessingPayment || isVerifyingPayment || createOrderMutation.isPending || createGuestOrderMutation.isPending) {
      return;
    }

    if (isGuest) {
      await handlePlaceGuestOrder();
      return;
    }

    if (!effectiveAddressId) {
      setCheckoutError("Please select or add a delivery address to proceed.");
      return;
    }

    // 1. Cash on Delivery (COD) flow
    if (paymentMethod === "COD") {
      try {
        const orderRes = await createOrderMutation.mutateAsync({
          shippingAddressId: effectiveAddressId,
          paymentMethod: "COD",
          notes: orderNotes.trim() || undefined,
          deliveryMethod,
          paymentDetails: {
            method: "COD",
            status: "pending",
          },
        });

        const order =
          (orderRes as any)?.data?.data ||
          (orderRes as any)?.data ||
          orderRes;
        const orderId = order?.id;
        const orderNumber = order?.orderNumber;

        setIsOrderPlaced(true);
        queryClient.invalidateQueries({ queryKey: CUSTOMER_ORDERS_QUERY_KEY, refetchType: "all" });
        queryClient.invalidateQueries({ queryKey: ["customer", "cart"], refetchType: "all" });
        queryClient.invalidateQueries({ queryKey: ["cart"], refetchType: "all" });

        const params = new URLSearchParams();
        if (orderId && String(orderId) !== "undefined" && String(orderId) !== "null") {
          params.set("orderId", String(orderId));
        }
        if (orderNumber && String(orderNumber) !== "undefined" && String(orderNumber) !== "null") {
          params.set("orderNumber", String(orderNumber));
        }
        router.push(`/checkout/success${params.toString() ? `?${params.toString()}` : ""}`);
      } catch (err: any) {
        setIsOrderPlaced(false);
        reportOrderError(
          err,
          "Failed to place COD order. Please check details and try again."
        );
      }
      return;
    }

    // 2. Online Payment (In-built Razorpay standard modal)
    await launchInbuiltRazorpayPayment(effectiveAddressId);
  };


  return (
    <div className="container mx-auto px-4 py-8 sm:py-10 max-w-7xl">
      {/* Header & Steps */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs font-semibold text-theme-text-subtle mb-2">
          <Link
            href="/cart"
            className="hover:text-theme-primary transition-colors flex items-center gap-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Return to Cart
          </Link>
          <span>/</span>
          <span className="text-theme-primary font-bold">Checkout</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-theme-text-primary">
              Checkout & Payment
            </h1>
            <p className="text-xs sm:text-sm text-theme-text-subtle mt-0.5">
              Review your delivery address, choose a shipping option, and complete
              your simulated payment.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold bg-theme-surface-alt border border-theme-border px-3.5 py-1.5 rounded-full text-theme-text-subtle self-start sm:self-auto">
            <ShieldCheck className="h-4 w-4 text-theme-secondary" />
            <span>256-Bit SSL Encrypted</span>
          </div>
        </div>
      </div>

      {checkoutError && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Unable to complete checkout</p>
            <p className="text-xs mt-0.5">{checkoutError}</p>
            {mobileVerificationRequired && (
              <Link
                href={
                  isGuest
                    ? "/login?callbackUrl=/checkout"
                    : `${MOBILE_VERIFICATION_PATH}?callbackUrl=/checkout`
                }
                className="mt-2 inline-block text-xs font-bold underline"
              >
                {isGuest ? "Log in to continue" : "Verify mobile number"}
              </Link>
            )}
          </div>
        </div>
      )}

      {isAgent && (
        <div className="mb-6 rounded-2xl border border-theme-border bg-theme-surface shadow-xs p-5 sm:p-6">
          <h2 className="text-base font-bold text-theme-text-primary mb-3">Who is this order for?</h2>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" checked={orderFor === "self"} onChange={() => setOrderFor("self")} /> Self (for myself)
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" checked={orderFor === "customer"} onChange={() => setOrderFor("customer")} /> Customer
            </label>
          </div>
        </div>
      )}

      {isAgent && orderFor === "customer" ? (
        <AgentCartCustomerOrder items={items} subtotal={subtotal} />
      ) : (
      /* Main Grid Layout */
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Form & Steps (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* 1. Delivery Address Card */}
          <div className="rounded-2xl border border-theme-border bg-theme-surface shadow-xs p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4 mb-4 pb-3 border-b border-theme-border-subtle">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-theme-surface-alt border border-theme-border text-theme-primary font-bold text-xs">
                  1
                </span>
                <h2 className="text-base sm:text-lg font-bold text-theme-text-primary flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-theme-secondary" />
                  Delivery Address
                </h2>
              </div>

              {!isAddingAddress && !isGuest && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddingAddress(true)}
                  className="rounded-xl border-theme-border text-xs font-bold text-theme-primary hover:bg-theme-surface-alt min-h-[36px]"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add New
                </Button>
              )}
            </div>

            {/* Address Selection List */}
            {!isAddingAddress && !isGuest && (
              <div className="space-y-3">
                {addresses.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-theme-border p-6 text-center">
                    <p className="text-sm font-semibold text-theme-text-primary mb-1">
                      No saved addresses found
                    </p>
                    <p className="text-xs text-theme-text-subtle mb-4">
                      Please add your delivery address to receive your order at your doorstep.
                    </p>
                    <Button
                      type="button"
                      onClick={() => setIsAddingAddress(true)}
                      className="min-h-[44px] rounded-xl bg-theme-primary hover:bg-theme-primary-hover text-white text-xs font-semibold px-4"
                    >
                      <Plus className="mr-1.5 h-4 w-4" />
                      Add Delivery Address
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {addresses.map((addr) => {
                      const isSelected = effectiveAddressId === addr.id;
                      return (
                        <div
                          key={addr.id}
                          onClick={() => setSelectedAddressId(addr.id)}
                          className={`relative rounded-xl border p-4 cursor-pointer transition-all ${
                            isSelected
                              ? "border-theme-primary bg-theme-surface-alt/70 shadow-xs ring-1 ring-theme-primary"
                              : "border-theme-border bg-theme-surface hover:border-theme-border-accent hover:bg-theme-surface-warm"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <span
                                className={`flex h-4 w-4 items-center justify-center rounded-full border transition-colors ${
                                  isSelected
                                    ? "border-theme-primary bg-theme-primary text-white"
                                    : "border-theme-border-input bg-white"
                                }`}
                              >
                                {isSelected && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                              </span>
                              <span className="font-bold text-sm text-theme-text-primary line-clamp-1">
                                {addr.fullName}
                              </span>
                            </div>

                            {addr.isDefault && (
                              <span className="shrink-0 rounded-md bg-theme-status-del-bg px-2 py-0.5 text-[10px] font-extrabold text-theme-status-del-fg">
                                Default
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-theme-text-subtle space-y-1 pl-6">
                            <p className="line-clamp-2">
                              {addr.addressLine1}
                              {addr.addressLine2 ? `, ${addr.addressLine2}` : ""}
                            </p>
                            <p>
                              {addr.city}, {addr.state} - {addr.pincode}
                            </p>
                            <p className="flex items-center gap-1 text-theme-text-muted pt-0.5">
                              <Phone className="h-3 w-3" />
                              {addr.phone}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Inline Add Address Form */}
            {(isAddingAddress || isGuest) && (
              <form
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!isGuest) {
                    void handleCreateAddress(e);
                  } else {
                    void handlePlaceGuestOrder();
                  }
                }}
                className="rounded-xl border border-theme-border bg-theme-surface-warm p-4 sm:p-5 space-y-4"
              >
                <div className="flex items-center justify-between border-b border-theme-border pb-2.5">
                  <h3 className="text-sm font-bold text-theme-text-primary">
                    {isGuest ? "Your Contact & Delivery Details" : "New Delivery Address"}
                  </h3>
                  {!isGuest && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingAddress(false);
                        setFieldErrors({});
                        setAddressFormError(null);
                      }}
                      className="text-theme-text-subtle hover:text-theme-text-primary"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {addressFormError && (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-2.5 text-xs text-red-600">
                    {addressFormError}
                  </div>
                )}

                {isGuest && (
                  <div>
                    <label className="block text-xs font-semibold text-theme-text-secondary mb-1">
                      Email Address <span className="text-red-500 font-bold">*</span>
                    </label>
                    <input
                      type="email"
                      maxLength={EMAIL_MAX_LENGTH}
                      placeholder="e.g. you@example.com"
                      value={guestEmail}
                      onChange={(e) => handleFieldChange("guestEmail", e.target.value)}
                      onBlur={() => handleFieldBlur("guestEmail")}
                      className={cn(
                        "w-full min-h-[44px] rounded-xl border bg-white px-3 text-xs text-theme-text-primary placeholder:text-theme-text-muted focus:outline-none transition-colors",
                        fieldErrors.guestEmail
                          ? "border-red-500 bg-red-50/10 focus:border-red-500 focus:ring-1 focus:ring-red-500/50 ring-1 ring-red-500/40"
                          : "border-theme-border-input focus:border-theme-primary"
                      )}
                    />
                    {fieldErrors.guestEmail ? (
                      <p className="mt-1 text-xs text-red-500 font-medium animate-in fade-in duration-150">
                        {fieldErrors.guestEmail}
                      </p>
                    ) : (
                      <p className="mt-1 text-[11px] text-theme-text-muted">
                        We&apos;ll send your order confirmation here.
                      </p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-theme-text-secondary mb-1">
                      Recipient Name <span className="text-red-500 font-bold">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Ramesh Kumar"
                      value={newAddressForm.fullName}
                      onChange={(e) => handleFieldChange("fullName", e.target.value)}
                      onBlur={() => handleFieldBlur("fullName")}
                      className={cn(
                        "w-full min-h-[44px] rounded-xl border bg-white px-3 text-xs text-theme-text-primary placeholder:text-theme-text-muted focus:outline-none transition-colors",
                        fieldErrors.fullName
                          ? "border-red-500 bg-red-50/10 focus:border-red-500 focus:ring-1 focus:ring-red-500/50 ring-1 ring-red-500/40"
                          : "border-theme-border-input focus:border-theme-primary"
                      )}
                    />
                    {fieldErrors.fullName && (
                      <p className="mt-1 text-xs text-red-500 font-medium animate-in fade-in duration-150">
                        {fieldErrors.fullName}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-theme-text-secondary mb-1">
                      Phone Number (10 digits) <span className="text-red-500 font-bold">*</span>
                    </label>
                    <input
                      type="tel"
                      maxLength={10}
                      placeholder="e.g. 9876543210"
                      value={newAddressForm.phone}
                      onChange={(e) => handleFieldChange("phone", e.target.value.replace(/\D/g, "").slice(0, 10))}
                      onBlur={() => handleFieldBlur("phone")}
                      className={cn(
                        "w-full min-h-[44px] rounded-xl border bg-white px-3 text-xs text-theme-text-primary placeholder:text-theme-text-muted focus:outline-none transition-colors",
                        fieldErrors.phone
                          ? "border-red-500 bg-red-50/10 focus:border-red-500 focus:ring-1 focus:ring-red-500/50 ring-1 ring-red-500/40"
                          : "border-theme-border-input focus:border-theme-primary"
                      )}
                    />
                    {fieldErrors.phone && (
                      <p className="mt-1 text-xs text-red-500 font-medium animate-in fade-in duration-150">
                        {fieldErrors.phone}
                      </p>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-theme-text-secondary mb-1">
                      PIN Code (6 digits) <span className="text-red-500 font-bold">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="e.g. 636001"
                        value={newAddressForm.pincode}
                        onChange={(e) => handlePincodeChange(e.target.value)}
                        onBlur={() => handleFieldBlur("pincode")}
                        className={cn(
                          "w-full min-h-[44px] rounded-xl border bg-white px-3 text-xs text-theme-text-primary placeholder:text-theme-text-muted focus:outline-none transition-colors",
                          fieldErrors.pincode || pincodeLookupError
                            ? "border-red-500 bg-red-50/10 focus:border-red-500 focus:ring-1 focus:ring-red-500/50 ring-1 ring-red-500/40"
                            : "border-theme-border-input focus:border-theme-primary"
                        )}
                      />
                      {isPincodeLoading && (
                        <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-theme-text-muted" />
                      )}
                    </div>
                    {fieldErrors.pincode ? (
                      <p className="mt-1 text-xs text-red-500 font-medium animate-in fade-in duration-150">
                        {fieldErrors.pincode}
                      </p>
                    ) : pincodeLookupError ? (
                      <p className="mt-1 text-xs text-red-500 font-medium animate-in fade-in duration-150">
                        {pincodeLookupError}
                      </p>
                    ) : null}
                  </div>

                  {postOffices.length > 0 && (
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-theme-text-secondary mb-1">
                        Select your area / post office ({postOffices.length} found)
                      </label>
                      <Select
                        options={postOffices.map((po) => ({
                          value: po.value,
                          label: `${po.label}${po.description ? ` (${po.description})` : ""}`,
                        }))}
                        value={area}
                        onValueChange={(val) => {
                          setArea(val);
                          setNewAddressForm((prev) =>
                            val && (!prev.addressLine2.trim() || prev.addressLine2 === area)
                              ? { ...prev, addressLine2: val }
                              : prev
                          );
                        }}
                        placeholder="Select area / locality…"
                      />
                    </div>
                  )}

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-theme-text-secondary mb-1">
                      Flat / House No., Building, Street <span className="text-red-500 font-bold">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 42, Sri Krishna Nagar, Main Road"
                      value={newAddressForm.addressLine1}
                      onChange={(e) => handleFieldChange("addressLine1", e.target.value)}
                      onBlur={() => handleFieldBlur("addressLine1")}
                      className={cn(
                        "w-full min-h-[44px] rounded-xl border bg-white px-3 text-xs text-theme-text-primary placeholder:text-theme-text-muted focus:outline-none transition-colors",
                        fieldErrors.addressLine1
                          ? "border-red-500 bg-red-50/10 focus:border-red-500 focus:ring-1 focus:ring-red-500/50 ring-1 ring-red-500/40"
                          : "border-theme-border-input focus:border-theme-primary"
                      )}
                    />
                    {fieldErrors.addressLine1 && (
                      <p className="mt-1 text-xs text-red-500 font-medium animate-in fade-in duration-150">
                        {fieldErrors.addressLine1}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-theme-text-secondary mb-1 flex items-center justify-between">
                      <span>
                        City <span className="text-red-500 font-bold">*</span>
                      </span>
                      <span className="text-[10px] text-theme-text-muted font-normal">Auto-filled</span>
                    </label>
                    <input
                      type="text"
                      readOnly
                      tabIndex={-1}
                      placeholder={isPincodeLoading ? "Fetching city..." : "Auto-filled from pincode"}
                      value={newAddressForm.city}
                      className={cn(
                        "w-full min-h-[44px] rounded-xl border bg-theme-surface-alt/70 px-3 text-xs text-theme-text-primary cursor-not-allowed select-none shadow-none focus:outline-none transition-colors",
                        fieldErrors.city
                          ? "border-red-500 bg-red-50/10 ring-1 ring-red-500/40"
                          : "border-theme-border-input"
                      )}
                    />
                    {fieldErrors.city && (
                      <p className="mt-1 text-xs text-red-500 font-medium animate-in fade-in duration-150">
                        {fieldErrors.city}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-theme-text-secondary mb-1 flex items-center justify-between">
                      <span>
                        State <span className="text-red-500 font-bold">*</span>
                      </span>
                      <span className="text-[10px] text-theme-text-muted font-normal">Auto-filled</span>
                    </label>
                    <input
                      type="text"
                      readOnly
                      tabIndex={-1}
                      placeholder={isPincodeLoading ? "Fetching state..." : "Auto-filled from pincode"}
                      value={newAddressForm.state}
                      className={cn(
                        "w-full min-h-[44px] rounded-xl border bg-theme-surface-alt/70 px-3 text-xs text-theme-text-primary cursor-not-allowed select-none shadow-none focus:outline-none transition-colors",
                        fieldErrors.state
                          ? "border-red-500 bg-red-50/10 ring-1 ring-red-500/40"
                          : "border-theme-border-input"
                      )}
                    />
                    {fieldErrors.state && (
                      <p className="mt-1 text-xs text-red-500 font-medium animate-in fade-in duration-150">
                        {fieldErrors.state}
                      </p>
                    )}
                  </div>
                </div>

                {!isGuest && (
                  <div className="flex items-center justify-end gap-2.5 pt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsAddingAddress(false);
                        setFieldErrors({});
                        setAddressFormError(null);
                      }}
                      className="min-h-[40px] text-xs font-semibold rounded-xl text-theme-text-subtle"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={createAddressMutation.isPending}
                      className="min-h-[40px] px-4 text-xs font-bold rounded-xl bg-theme-primary hover:bg-theme-primary-hover text-white"
                    >
                      {createAddressMutation.isPending ? (
                        <>
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          Saving Address...
                        </>
                      ) : (
                        "Save Address"
                      )}
                    </Button>
                  </div>
                )}
              </form>
            )}
          </div>

          {/* 2. Delivery Method Card */}
          <div className="rounded-2xl border border-theme-border bg-theme-surface shadow-xs p-5 sm:p-6">
            <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-theme-border-subtle">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-theme-surface-alt border border-theme-border text-theme-primary font-bold text-xs">
                2
              </span>
              <h2 className="text-base sm:text-lg font-bold text-theme-text-primary flex items-center gap-2">
                <Truck className="h-4 w-4 text-theme-secondary" />
                Shipping & Delivery Method
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Standard Delivery Option */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => setDeliveryMethod("standard")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setDeliveryMethod("standard");
                  }
                }}
                className={`relative rounded-xl border p-4 text-left cursor-pointer transition-all duration-200 focus:outline-none select-none ${
                  deliveryMethod === "standard"
                    ? "border-theme-primary bg-theme-surface-alt/70 shadow-xs ring-2 ring-theme-primary/30"
                    : "border-theme-border bg-theme-surface hover:border-theme-border-strong hover:bg-theme-surface-alt/40"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-4 w-4 rounded-full border flex items-center justify-center transition-colors ${
                        deliveryMethod === "standard"
                          ? "border-theme-primary bg-theme-primary"
                          : "border-theme-border-strong bg-white"
                      }`}
                    >
                      {deliveryMethod === "standard" && (
                        <div className="h-1.5 w-1.5 rounded-full bg-white" />
                      )}
                    </div>
                    <span className="text-xs font-bold text-theme-text-primary">
                      Standard Delivery
                    </span>
                  </div>
                  <span className="text-xs font-extrabold text-theme-primary">
                    {formatPrice(STANDARD_DELIVERY_CHARGE)}
                  </span>
                </div>
                <p className="text-[11px] text-theme-text-subtle flex items-center gap-1 mb-1">
                  <Clock className="h-3 w-3 text-theme-secondary shrink-0" />
                  <span>Estimated: {STANDARD_DELIVERY_ESTIMATE}</span>
                </p>
                <p className="text-[11px] text-theme-text-muted">
                  Standard doorstep delivery across India.
                </p>
              </div>

              {/* Express Delivery Option */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => setDeliveryMethod("express")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setDeliveryMethod("express");
                  }
                }}
                className={`relative rounded-xl border p-4 text-left cursor-pointer transition-all duration-200 focus:outline-none select-none ${
                  deliveryMethod === "express"
                    ? "border-theme-primary bg-theme-surface-alt/70 shadow-xs ring-2 ring-theme-primary/30"
                    : "border-theme-border bg-theme-surface hover:border-theme-border-strong hover:bg-theme-surface-alt/40"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-4 w-4 rounded-full border flex items-center justify-center transition-colors ${
                        deliveryMethod === "express"
                          ? "border-theme-primary bg-theme-primary"
                          : "border-theme-border-strong bg-white"
                      }`}
                    >
                      {deliveryMethod === "express" && (
                        <div className="h-1.5 w-1.5 rounded-full bg-white" />
                      )}
                    </div>
                    <span className="text-xs font-bold text-theme-text-primary">
                      Express Delivery
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                      Fastest
                    </span>
                    <span className="text-xs font-extrabold text-theme-primary">
                      {formatPrice(EXPRESS_DELIVERY_CHARGE)}
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-theme-text-subtle flex items-center gap-1 mb-1">
                  <Clock className="h-3 w-3 text-amber-600 shrink-0" />
                  <span>Estimated: {EXPRESS_DELIVERY_ESTIMATE}</span>
                </p>
                <p className="text-[11px] text-theme-text-muted">
                  Priority express delivery directly to your doorstep.
                </p>
              </div>
            </div>
          </div>

          {/* 3. Payment Method Card */}
          <div className="rounded-2xl border border-theme-border bg-theme-surface shadow-xs p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4 mb-4 pb-3 border-b border-theme-border-subtle">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-theme-surface-alt border border-theme-border text-theme-primary font-bold text-xs">
                  3
                </span>
                <h2 className="text-base sm:text-lg font-bold text-theme-text-primary flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-theme-secondary" />
                  Payment Method
                </h2>
              </div>

              {!isGuest && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-0.5 text-[11px] font-bold text-emerald-700">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  Razorpay Secured
                </span>
              )}
            </div>

            {isGuest && (
              <p className="mb-4 text-[11px] text-theme-text-muted bg-theme-surface-alt/60 border border-theme-border-subtle rounded-lg px-3 py-2">
                Guest checkout supports Cash on Delivery only.{" "}
                <Link href="/login?callbackUrl=/checkout" className="font-semibold text-theme-primary hover:underline">
                  Log in
                </Link>{" "}
                to pay online instead.
              </p>
            )}

            {/* Payment Method Selector Tabs */}
            <div className={`grid gap-3 mb-5 ${isGuest ? "grid-cols-1" : "grid-cols-2"}`}>
              {!isGuest && (
                <button
                  type="button"
                  onClick={() => setPaymentMethod("CARD")}
                  className={`flex flex-col items-center justify-center p-3.5 rounded-xl border text-center transition-all min-h-[64px] ${
                    paymentMethod === "CARD" || paymentMethod === "UPI"
                      ? "border-theme-primary bg-theme-surface-alt font-bold text-theme-primary shadow-xs ring-1 ring-theme-primary"
                      : "border-theme-border bg-theme-surface text-theme-text-subtle hover:bg-theme-surface-warm"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <CreditCard className="h-4 w-4 text-theme-primary" />
                    <span className="text-xs font-black">UPI / Cards / NetBanking</span>
                  </div>
                  <span className="text-[11px] font-medium text-theme-text-muted">Online via Razorpay</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setPaymentMethod("COD")}
                className={`flex flex-col items-center justify-center p-3.5 rounded-xl border text-center transition-all min-h-[64px] ${
                  paymentMethod === "COD"
                    ? "border-theme-primary bg-theme-surface-alt font-bold text-theme-primary shadow-xs ring-1 ring-theme-primary"
                    : "border-theme-border bg-theme-surface text-theme-text-subtle hover:bg-theme-surface-warm"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Truck className="h-4 w-4 text-theme-secondary" />
                  <span className="text-xs font-black">Cash on Delivery</span>
                </div>
                <span className="text-[11px] font-medium text-theme-text-muted">Pay upon delivery</span>
              </button>
            </div>

            {/* Payment Details Container */}
            {(paymentMethod === "CARD" || paymentMethod === "UPI") && (
              <div className="rounded-xl border border-theme-border-subtle bg-theme-surface-alt/60 p-4 sm:p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-bold text-theme-text-primary">
                      Official Razorpay Payment Gateway
                    </h3>
                    <p className="text-[11px] text-theme-text-subtle mt-0.5">
                      Fast, safe, and encrypted payment with instant order confirmation.
                    </p>
                  </div>
                  <span className="rounded bg-white border border-theme-border px-2 py-0.5 text-[10px] font-bold text-theme-text-secondary shadow-2xs">
                    256-bit SSL
                  </span>
                </div>

                {/* Badges of accepted methods */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <div className="rounded-lg bg-white border border-theme-border/80 px-2.5 py-2 text-center shadow-2xs">
                    <span className="text-[11px] font-bold text-theme-text-primary block">UPI</span>
                    <span className="text-[10px] text-theme-text-muted">GPay, PhonePe, Paytm</span>
                  </div>
                  <div className="rounded-lg bg-white border border-theme-border/80 px-2.5 py-2 text-center shadow-2xs">
                    <span className="text-[11px] font-bold text-theme-text-primary block">Cards</span>
                    <span className="text-[10px] text-theme-text-muted">Visa, Master, RuPay</span>
                  </div>
                  <div className="rounded-lg bg-white border border-theme-border/80 px-2.5 py-2 text-center shadow-2xs">
                    <span className="text-[11px] font-bold text-theme-text-primary block">Net Banking</span>
                    <span className="text-[10px] text-theme-text-muted">All major Indian banks</span>
                  </div>
                  <div className="rounded-lg bg-white border border-theme-border/80 px-2.5 py-2 text-center shadow-2xs">
                    <span className="text-[11px] font-bold text-theme-text-primary block">Wallets</span>
                    <span className="text-[10px] text-theme-text-muted">Amazon Pay & more</span>
                  </div>
                </div>

                <div className="text-[11px] text-theme-text-subtle bg-white/90 border border-theme-border rounded-xl p-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>
                    Clicking <strong>&ldquo;Pay {formatPrice(grandTotal)} via Razorpay&rdquo;</strong> will open the secure checkout dialog where you can complete payment seamlessly.
                  </span>
                </div>
              </div>
            )}

            {paymentMethod === "COD" && (
              <div className="rounded-xl border border-theme-border-subtle bg-theme-surface-alt/60 p-4 sm:p-5 space-y-2">
                <p className="text-xs font-bold text-theme-text-primary">
                  Pay with Cash upon Doorstep Delivery
                </p>
                <p className="text-[11px] text-theme-text-subtle leading-relaxed">
                  Please keep exact change ready upon delivery. Our delivery partner will verify and hand over your fresh package with a receipt.
                </p>
              </div>
            )}
          </div>


          {/* 4. Delivery Instructions */}
          <div className="rounded-2xl border border-theme-border bg-theme-surface shadow-xs p-5 sm:p-6">
            <label className="block text-xs font-bold text-theme-text-primary mb-1.5">
              Special Delivery Instructions (Optional)
            </label>
            <textarea
              rows={2}
              maxLength={300}
              placeholder="e.g. Ring bell twice, leave with security, call before arrival..."
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              className="w-full rounded-xl border border-theme-border-input bg-white p-3 text-xs text-theme-text-primary placeholder:text-theme-text-muted focus:border-theme-primary focus:outline-none"
            />
          </div>
        </div>

        {/* Right Column: Order Summary Sidebar (4 cols - Sticky) */}
        <div className="lg:col-span-4 sticky top-24 space-y-4">
          <div className="rounded-2xl border border-theme-border bg-theme-surface shadow-xs overflow-hidden">
            <div className="border-b border-theme-border-subtle bg-theme-surface-alt px-5 py-4">
              <h2 className="text-base font-bold text-theme-text-primary flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-theme-secondary" />
                Order Summary ({items.length} {items.length === 1 ? "item" : "items"})
              </h2>
            </div>

            <div className="p-5 space-y-4">
              {/* Items Mini List */}
              <div className="max-h-60 overflow-y-auto space-y-3 divide-y divide-theme-border-subtle pr-1">
                {items.map((item) => (
                  <div key={item.id} className="pt-3 first:pt-0 flex items-center gap-3">
                    <div className="relative h-14 w-14 rounded-xl border border-theme-border bg-theme-surface-alt shrink-0 overflow-hidden">
                      <ProductImage
                        src={item.primaryImage}
                        alt={item.productName}
                        fallbackText={item.productName}
                        containerClassName="w-full h-full"
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-theme-text-primary truncate">
                        {item.productName}
                      </p>
                      <p className="text-[11px] text-theme-text-subtle">
                        {item.variantName}{" "}
                        {item.measurement
                          ? `(${formatMeasurementLabel(item.measurement)})`
                          : ""}
                      </p>
                      <p className="text-[11px] text-theme-text-muted">
                        Qty: {item.quantity} × {formatPrice(item.currentPrice)}
                      </p>
                    </div>

                    <div className="text-xs font-bold text-theme-text-primary shrink-0">
                      {formatPrice(item.itemTotal)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Price Calculation Breakdown */}
              <div className="border-t border-theme-border-subtle pt-4 space-y-2.5 text-xs">
                <div className="flex justify-between text-theme-text-subtle">
                  <span>Items Subtotal</span>
                  <span className="font-semibold text-theme-text-primary">
                    {formatPrice(subtotal)}
                  </span>
                </div>

                <div className="flex justify-between text-theme-text-subtle items-center">
                  <div className="flex items-center gap-1.5">
                    <span>Shipping & Handling</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-theme-surface-alt border border-theme-border text-theme-text-muted">
                      {deliveryMethod === "express" ? "Express" : "Standard"}
                    </span>
                  </div>
                  <span className="font-semibold text-theme-text-primary">
                    {formatPrice(shippingCharge)}
                  </span>
                </div>

                <div className="border-t border-theme-border pt-3 flex justify-between items-baseline">
                  <span className="text-sm font-bold text-theme-text-primary">
                    Total Amount
                  </span>
                  <span className="text-xl font-extrabold text-theme-primary">
                    {formatPrice(grandTotal)}
                  </span>
                </div>
              </div>

              {/* Place Order CTA Button */}
              <Button
                type="button"
                onClick={handlePlaceOrder}
                disabled={
                  createOrderMutation.isPending ||
                  createGuestOrderMutation.isPending ||
                  isProcessingPayment ||
                  isVerifyingPayment ||
                  (!isGuest && (addressesLoading || !effectiveAddressId))
                }
                className="w-full min-h-[48px] rounded-xl bg-theme-primary hover:bg-theme-primary-hover text-white font-bold text-sm shadow-md transition-all disabled:opacity-50"
              >
                {isVerifyingPayment ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying Payment...
                  </>
                ) : isProcessingPayment ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Opening Razorpay Gateway...
                  </>
                ) : createOrderMutation.isPending || createGuestOrderMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Placing Your Order...
                  </>
                ) : paymentMethod === "COD" ? (
                  <>
                    <Truck className="mr-2 h-4 w-4" />
                    Confirm COD Order ({formatPrice(grandTotal)})
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-4 w-4" />
                    Pay {formatPrice(grandTotal)} via Razorpay
                  </>
                )}
              </Button>

              <div className="text-[11px] text-center text-theme-text-muted space-y-1 pt-1">
                <p className="flex items-center justify-center gap-1.5 font-medium text-emerald-700">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  256-bit Bank-Grade Encryption by Razorpay
                </p>
                <p>Premium collection delivered securely to your door.</p>
              </div>

            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
