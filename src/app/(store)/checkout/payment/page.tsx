"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  CreditCard,
  Loader2,
  MapPin,
  ShoppingBag,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup } from "@/components/ui/Radio";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { useCart } from "@/features/cart/hooks/use-cart";
import { useAddresses } from "@/features/addresses/hooks";
import { useCheckout } from "@/features/checkout/checkout-context";
import { useCheckoutSummary, usePlaceOrder } from "@/features/orders/hooks";
import { OrderItemsList } from "@/features/orders/components/OrderItemsList";
import { OrderTotals } from "@/features/orders/components/OrderTotals";
import { AppliedReferral } from "@/features/agents/components/AppliedReferral";
import { PAYMENT_METHOD_OPTIONS } from "@/features/orders/constants";

export default function CheckoutPaymentPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const { data: cart, isLoading: cartLoading } = useCart();
  const { data: addresses, isLoading: addressesLoading } = useAddresses();
  const checkout = useCheckout();
  const placeOrder = usePlaceOrder();

  const {
    data: summary,
    isLoading: summaryLoading,
    error: summaryError,
    refetch: refetchSummary,
  } = useCheckoutSummary(checkout.deliveryMethod, checkout.couponCode, checkout.addressId);

  if (status === "loading" || cartLoading || addressesLoading) {
    return <LoadingState text="Loading payment..." />;
  }

  if (status === "unauthenticated" || !session) {
    router.push("/login?callbackUrl=/checkout/payment");
    return null;
  }

  const items = cart?.items ?? [];
  const selectedAddress = addresses?.find((a) => a.id === checkout.addressId);

  if (items.length === 0) {
    return (
      <EmptyState
        title="Your cart is empty"
        description="Nothing to pay for right now."
      >
        <Link href="/products">
          <Button>Browse Products</Button>
        </Link>
      </EmptyState>
    );
  }

  const handlePlaceOrder = () => {
    if (!checkout.addressId) return;
    placeOrder.mutate(
      {
        addressId: checkout.addressId,
        deliveryMethod: checkout.deliveryMethod,
        couponCode: checkout.couponCode ?? undefined,
        paymentMethod: checkout.paymentMethod,
        notes: checkout.notes || undefined,
      },
      {
        onSuccess: (order) => {
          checkout.resetCheckout();
          router.push(`/checkout/success?orderNumber=${order.orderNumber}`);
        },
      }
    );
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Payment</h1>
        <Button variant="outline" onClick={() => router.push("/checkout")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                Delivering To
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedAddress ? (
                <div className="text-sm text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">
                    {selectedAddress.firstName} {selectedAddress.lastName}
                  </p>
                  <p>
                    {selectedAddress.addressLine1}
                    {selectedAddress.addressLine2
                      ? `, ${selectedAddress.addressLine2}`
                      : ""}
                  </p>
                  <p>
                    {selectedAddress.city}, {selectedAddress.state} -{" "}
                    {selectedAddress.postalCode}
                  </p>
                  <p>Phone: {selectedAddress.phone}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No address selected.{" "}
                  <Link
                    href="/checkout/address"
                    className="text-primary hover:underline"
                  >
                    Select an address
                  </Link>
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                Choose Payment Method
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup
                name="paymentMethod"
                value={checkout.paymentMethod}
                onValueChange={(value) =>
                  checkout.setPaymentMethod(
                    value as typeof checkout.paymentMethod
                  )
                }
                options={PAYMENT_METHOD_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.label,
                  description: option.description,
                }))}
              />
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                Order Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-72 overflow-y-auto">
                <OrderItemsList items={summary?.items ?? []} compact />
              </div>

              <div className="my-4 border-t" />

              {summaryLoading ? (
                <LoadingState size="sm" text="Calculating totals..." />
              ) : summary ? (
                <OrderTotals
                  totals={{
                    subtotal: summary.subtotal,
                    taxAmount: summary.taxAmount ?? 0,
                    shippingAmount:
                      summary.shippingCharge ??
                      summary.deliveryCharge ??
                      summary.totals?.shipping ??
                      0,
                    discountAmount:
                      summary.discountAmount ??
                      summary.discount ??
                      summary.totals?.discount ??
                      0,
                    totalAmount:
                      summary.totalAmount ??
                      summary.total ??
                      summary.totals?.total ??
                      summary.subtotal,
                  }}
                  couponLabel={summary.coupon?.code ?? null}
                />
              ) : (
                <ErrorState
                  title="Could not calculate totals"
                  message={summaryError?.message}
                  onRetry={refetchSummary}
                />
              )}

              <AppliedReferral />

              <Button
                className="mt-5 w-full"
                size="lg"
                onClick={handlePlaceOrder}
                disabled={
                  !checkout.addressId || summaryLoading || placeOrder.isPending
                }
              >
                {placeOrder.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {checkout.paymentMethod === "CASH_ON_DELIVERY"
                  ? "Place Order (Cash on Delivery)"
                  : `Pay ${checkout.paymentMethod.replace(/_/g, " ")}`}
              </Button>

              {placeOrder.error && (
                <p className="mt-2 text-sm text-error-600">
                  {placeOrder.error.message}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
