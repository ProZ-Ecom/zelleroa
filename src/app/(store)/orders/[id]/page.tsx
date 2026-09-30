"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, RefreshCw, AlertCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/Toast";
import { CancelOrderDialog } from "@/features/orders/components/CancelOrderDialog";
import { RequestWizard } from "@/features/returns/components/RequestWizard";
import { isOrderCancellable } from "@/features/returns/lib/policy";
import {
  useCustomerOrderDetail,
  useCancelCustomerOrder,
} from "@/features/customers/hooks/use-customer-orders";
import { OrderDetailView } from "@/features/orders/components/OrderDetailView";

function OrderDetailSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8 sm:py-10 max-w-5xl space-y-6 animate-pulse">
      <div className="h-6 w-36 rounded-lg skeleton-shimmer" />
      <div className="flex justify-between items-center pb-4 border-b border-theme-border-subtle">
        <div className="space-y-2">
          <div className="h-8 w-60 rounded-xl skeleton-shimmer" />
          <div className="h-4 w-40 rounded-lg skeleton-shimmer" />
        </div>
        <div className="h-8 w-24 rounded-full skeleton-shimmer" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="h-60 rounded-2xl border border-theme-border bg-theme-surface overflow-hidden skeleton-shimmer" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="h-32 rounded-2xl border border-theme-border bg-theme-surface overflow-hidden skeleton-shimmer" />
            <div className="h-32 rounded-2xl border border-theme-border bg-theme-surface overflow-hidden skeleton-shimmer" />
            <div className="h-32 rounded-2xl border border-theme-border bg-theme-surface overflow-hidden skeleton-shimmer" />
          </div>
        </div>
        <div>
          <div className="h-64 rounded-2xl border border-theme-border bg-theme-surface overflow-hidden skeleton-shimmer" />
        </div>
      </div>
    </div>
  );
}

export default function OrderDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { data: session, status } = useSession();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [requestMode, setRequestMode] = useState<"return" | "replacement" | null>(null);

  const { data: order, isLoading, error, refetch } = useCustomerOrderDetail(id);
  const cancelOrderMutation = useCancelCustomerOrder();

  if (status === "loading" || (isLoading && !order)) {
    return <OrderDetailSkeleton />;
  }

  if (status === "unauthenticated" || !session) {
    router.push(`/login?callbackUrl=/orders/${id}`);
    return null;
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-lg text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600 border border-red-200">
          <AlertCircle className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-bold text-theme-text-primary">Order Not Found</h2>
        <p className="text-xs text-theme-text-subtle">
          {error.message || "We could not find the requested order in your account."}
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            variant="outline"
            onClick={() => router.push("/orders")}
            className="rounded-xl border-theme-border text-xs font-semibold"
          >
            Back to Orders
          </Button>
          <Button
            onClick={() => refetch()}
            className="rounded-xl bg-theme-primary hover:bg-theme-primary-hover text-white text-xs font-bold"
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-lg text-center space-y-4">
        <h2 className="text-xl font-bold text-theme-text-primary">Order Not Found</h2>
        <p className="text-xs text-theme-text-subtle">
          This order does not exist or has been removed.
        </p>
        <Button
          onClick={() => router.push("/orders")}
          className="rounded-xl bg-theme-primary text-white text-xs font-bold"
        >
          View All Orders
        </Button>
      </div>
    );
  }

  const canCancel = isOrderCancellable(order.status);
  const isPaid = order.paymentStatus === "paid";

  return (
    <div className="container mx-auto px-4 py-8 sm:py-10 max-w-5xl">
      {/* Back Navigation Bar */}
      <div className="mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.push("/orders")}
          className="inline-flex items-center gap-2 text-xs font-bold text-theme-text-subtle hover:text-theme-primary transition-colors cursor-pointer py-1.5 px-3 rounded-xl hover:bg-theme-surface-alt"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to All Orders</span>
        </button>

        <div className="flex items-center gap-2 text-xs text-theme-text-muted">
          <Link href="/" className="hover:text-theme-primary">Home</Link>
          <span>/</span>
          <Link href="/orders" className="hover:text-theme-primary">Orders</Link>
          <span>/</span>
          <span className="font-mono text-theme-primary font-bold">
            {order.orderNumber}
          </span>
        </div>
      </div>

      <OrderDetailView
        order={order}
        canCancel={canCancel}
        isCancelling={cancelOrderMutation.isPending}
        onCancel={() => {
          setCancelError(null);
          setCancelOpen(true);
        }}
        onRequest={(mode) => setRequestMode(mode)}
      />

      <CancelOrderDialog
        open={cancelOpen}
        orderNumber={order.orderNumber}
        isPaid={isPaid}
        isSubmitting={cancelOrderMutation.isPending}
        serverError={cancelError}
        onClose={() => setCancelOpen(false)}
        onConfirm={(payload) => {
          cancelOrderMutation.mutate(
            { uuid: order.id, payload },
            {
              onSuccess: () => {
                setCancelOpen(false);
                toast.success(
                  "Order cancelled successfully.",
                  isPaid ? "Your refund status is shown below." : undefined
                );
              },
              onError: (err) => {
                const msg = err instanceof Error ? err.message : "Could not cancel the order.";
                setCancelError(msg);
                toast.error("Could not cancel order", msg);
              },
            }
          );
        }}
      />

      {requestMode && (
        // Mounted per open so the wizard always starts from a clean state.
        <RequestWizard
          open
          orderUuid={order.id}
          initialMode={requestMode}
          onClose={() => setRequestMode(null)}
        />
      )}
    </div>
  );
}
