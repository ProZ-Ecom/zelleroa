"use client";

import { useState } from "react";
import {
  X,
  Phone,
  MessageSquare,
  MapPin,
  Calendar,
  Clock,
  CheckCircle2,
  Truck,
  ArrowRight,
  Package,
  Copy,
  Check,
  Loader2,
  Navigation,
  FileText,
  User,
  ShieldAlert,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatPrice } from "@/lib/utils";
import { formatPhone } from "@/lib/utils/format-phone";
import {
  useStaffDelivery,
  useAcceptDelivery,
  useMarkOutForDelivery,
} from "../hooks";
import { DeliveryStatusBadge, AssignmentStatusBadge } from "./DeliveryStatusBadge";
import { MarkDeliveredModal } from "./MarkDeliveredModal";
import { isManualDeliveryStatusEnabled } from "../lib/delivery-config";

interface StaffDeliveryDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  shipmentId: string | null;
  onRefresh?: () => void;
}

export function StaffDeliveryDetailModal({
  isOpen,
  onClose,
  shipmentId,
  onRefresh,
}: StaffDeliveryDetailModalProps) {
  const { data: delivery, isLoading, error, refetch } = useStaffDelivery(
    isOpen ? shipmentId : null
  );

  const [copiedPhone, setCopiedPhone] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [isDeliverModalOpen, setIsDeliverModalOpen] = useState(false);

  const acceptDeliveryMutation = useAcceptDelivery();
  const outForDeliveryMutation = useMarkOutForDelivery();

  const handleCopyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  const handleCopyAddress = (addrText: string) => {
    navigator.clipboard.writeText(addrText);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  const handleAccept = () => {
    if (!shipmentId) return;
    acceptDeliveryMutation.mutate(shipmentId, {
      onSuccess: () => {
        refetch();
        onRefresh?.();
      },
    });
  };

  const handleOutForDelivery = () => {
    if (!shipmentId) return;
    outForDeliveryMutation.mutate(shipmentId, {
      onSuccess: () => {
        refetch();
        onRefresh?.();
      },
    });
  };

  if (!isOpen) return null;

  const order = delivery?.order;
  const customer = delivery?.customer;
  const address = delivery?.shippingAddress;
  const slot = delivery?.deliverySlot;
  const trackingHistory = delivery?.trackingHistory ?? [];

  const fullAddressString = address
    ? `${address.addressLine1}${address.addressLine2 ? `, ${address.addressLine2}` : ""}${
        address.landmark ? `, Landmark: ${address.landmark}` : ""
      }, ${address.city}, ${address.state} - ${address.pincode}`
    : "";

  const isPendingAcceptance =
    delivery?.assignmentStatus === "pending" ||
    (!delivery?.acceptedAt && delivery?.status === "pending");

  const isTestingDeliveryEnabled = isManualDeliveryStatusEnabled();

  const canMarkOutForDelivery =
    isTestingDeliveryEnabled &&
    delivery?.assignmentStatus === "accepted" &&
    delivery?.status !== "out_for_delivery" &&
    delivery?.status !== "delivered";

  const canMarkDelivered =
    isTestingDeliveryEnabled &&
    delivery?.status === "out_for_delivery";

  return (
    <>
      <Modal
        open={isOpen}
        onClose={onClose}
        title="Delivery Shipment Details"
        className="max-w-2xl p-0 bg-cream-50 rounded-2xl overflow-hidden border border-cream-border-subtle"
      >
        {/* Header summary bar */}
        <div className="bg-neutral-900 text-white p-5 border-b border-neutral-800">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-medium text-neutral-300 uppercase tracking-wider">
                  Order Number
                </span>
                <span className="text-sm font-bold text-white tracking-wide">
                  #{order?.orderNumber || "..."}
                </span>
              </div>
              <h2 className="mt-1 text-xl font-bold text-cream-white">
                {formatPrice(order?.totalAmount ?? 0)}
              </h2>
              <div className="mt-1 text-xs text-neutral-300">
                Placed: {(order?.placedAt || order?.createdAt) ? formatDateTime(order?.placedAt || order?.createdAt) : "—"}
              </div>
            </div>

            <div className="flex flex-col items-end gap-1.5">
              <div className="flex items-center gap-1.5">
                <DeliveryStatusBadge status={delivery?.status} />
              </div>
              <div className="text-[11px] text-neutral-300">
                Assignment:{" "}
                <AssignmentStatusBadge
                  status={delivery?.assignmentStatus}
                  className="ml-1"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Content body */}
        <div className="p-5 max-h-[70vh] overflow-y-auto space-y-4">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-neutral-500">
              <Loader2 className="h-6 w-6 animate-spin text-secondary-600" />
              <p className="text-xs font-medium">Loading delivery details...</p>
            </div>
          ) : error ? (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-rose-600">
              <ShieldAlert className="h-8 w-8" />
              <p className="text-sm font-semibold">Failed to load delivery details</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="mt-2 text-xs"
              >
                Try Again
              </Button>
            </div>
          ) : delivery ? (
            <>
              {/* Customer & Contact Card */}
              <div className="rounded-xl border border-cream-border bg-white p-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-cream-border pb-2 mb-3">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-secondary-600">
                    <User className="h-4 w-4" />
                    <span>Customer Information</span>
                  </div>
                  {customer?.phone && (
                    <div className="flex items-center gap-1.5">
                      <a
                        href={`tel:${customer.phone}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                        title="Call Customer"
                      >
                        <Phone className="h-3 w-3" />
                        Call
                      </a>
                      <a
                        href={`https://wa.me/${customer.phone.replace(/[^0-9]/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-xs"
                        title="WhatsApp Chat"
                      >
                        <MessageSquare className="h-3 w-3" />
                        WhatsApp
                      </a>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-xs text-neutral-400">Full Name</span>
                    <p className="font-semibold text-neutral-900">{customer?.name || "Customer"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-neutral-400">Phone Number</span>
                    <div className="flex items-center gap-2">
                      <p className="font-mono font-medium text-neutral-900">
                        {formatPhone(customer?.phone)}
                      </p>
                      {customer?.phone && (
                        <button
                          type="button"
                          onClick={() => handleCopyPhone(customer.phone!)}
                          className="text-neutral-400 hover:text-neutral-700 transition-colors cursor-pointer"
                          title="Copy phone"
                        >
                          {copiedPhone ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  {customer?.email && (
                    <div className="sm:col-span-2">
                      <span className="text-xs text-neutral-400">Email</span>
                      <p className="text-neutral-700 text-xs font-mono">{customer.email}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Delivery Address & Slot */}
              <div className="rounded-xl border border-cream-border bg-white p-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-cream-border pb-2 mb-3">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-secondary-600">
                    <MapPin className="h-4 w-4" />
                    <span>Delivery Address & Slot</span>
                  </div>
                  {fullAddressString && (
                    <button
                      type="button"
                      onClick={() => handleCopyAddress(fullAddressString)}
                      className="inline-flex items-center gap-1 text-xs text-secondary-600 hover:underline cursor-pointer"
                    >
                      {copiedAddress ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-600" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>Copy Address</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                <div className="space-y-3 text-sm">
                  {address ? (
                    <div>
                      <p className="font-semibold text-neutral-900">{address.fullName}</p>
                      <p className="text-neutral-700 leading-relaxed text-xs sm:text-sm mt-0.5">
                        {address.addressLine1}
                        {address.addressLine2 && `, ${address.addressLine2}`}
                      </p>
                      {address.landmark && (
                        <p className="text-xs text-amber-800 bg-amber-50 rounded px-2 py-1 inline-block mt-1 font-medium">
                          📍 Landmark: {address.landmark}
                        </p>
                      )}
                      <p className="text-xs font-mono text-neutral-600 mt-1">
                        {address.city}, {address.state} - {address.pincode}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-neutral-500 italic">No delivery address specified.</p>
                  )}

                  {slot && (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-cream-100 border border-cream-border text-xs text-neutral-700">
                      <Calendar className="h-4 w-4 text-secondary-600" />
                      <span className="font-semibold">Scheduled Slot:</span>
                      <span>
                        {slot.slotDate || "Anytime"} ({slot.startTime || "09:00"} -{" "}
                        {slot.endTime || "21:00"})
                      </span>
                    </div>
                  )}

                  {order?.notes && (
                    <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-100 text-xs text-blue-900">
                      <span className="font-bold">Customer Note:</span> {order.notes}
                    </div>
                  )}

                  {delivery.deliveryNotes && (
                    <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-100 text-xs text-amber-900">
                      <span className="font-bold">Staff / Dispatch Note:</span>{" "}
                      {delivery.deliveryNotes}
                    </div>
                  )}
                </div>
              </div>

              {/* Interactive Tracking Timeline */}
              <div className="rounded-xl border border-cream-border bg-white p-4 shadow-xs">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-secondary-600 border-b border-cream-border pb-2 mb-3">
                  <Clock className="h-4 w-4" />
                  <span>Tracking Milestones</span>
                </div>

                <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-cream-border-subtle">
                  {trackingHistory.length > 0 ? (
                    trackingHistory.map((item, idx) => (
                      <div key={idx} className="relative group">
                        <div className="absolute -left-6 top-1 grid h-4 w-4 place-items-center rounded-full bg-secondary-600 text-white ring-4 ring-white">
                          <Check className="h-2.5 w-2.5" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-neutral-900 uppercase tracking-wide">
                            {item.status.replace(/_/g, " ")}
                          </p>
                          {item.note && (
                            <p className="text-xs text-neutral-700 mt-0.5">{item.note}</p>
                          )}
                          <p className="text-[10px] text-neutral-400 font-mono mt-0.5">
                            {formatDateTime(item.trackedAt)}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-neutral-500 italic">No tracking records yet.</p>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer Actions */}
        <div className="bg-cream-100 p-4 border-t border-cream-border-subtle flex flex-wrap items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="rounded-xl cursor-pointer"
          >
            Close
          </Button>

          <div className="flex items-center gap-2">
            {isPendingAcceptance && (
              <Button
                type="button"
                onClick={handleAccept}
                disabled={acceptDeliveryMutation.isPending}
                className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                {acceptDeliveryMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Accepting...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Accept Delivery
                  </>
                )}
              </Button>
            )}

            {canMarkOutForDelivery && (
              <Button
                type="button"
                onClick={handleOutForDelivery}
                disabled={outForDeliveryMutation.isPending}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                {outForDeliveryMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Truck className="h-4 w-4" />
                    Start Out for Delivery
                  </>
                )}
              </Button>
            )}

            {canMarkDelivered && (
              <Button
                type="button"
                onClick={() => setIsDeliverModalOpen(true)}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <CheckCircle2 className="h-4 w-4" />
                Mark as Delivered
              </Button>
            )}
          </div>
        </div>
      </Modal>

      {/* Complete Handover Dialog */}
      <MarkDeliveredModal
        isOpen={isDeliverModalOpen}
        onClose={() => setIsDeliverModalOpen(false)}
        shipmentId={shipmentId}
        orderNumber={order?.orderNumber}
        customerName={customer?.name}
        onSuccess={() => {
          refetch();
          onRefresh?.();
        }}
      />
    </>
  );
}
