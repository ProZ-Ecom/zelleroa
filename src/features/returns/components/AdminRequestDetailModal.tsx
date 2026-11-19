"use client";
 
import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { Loader2, Copy, Check, Building2, Smartphone, MapPin, Upload, X, Truck, AlertCircle, CheckCircle2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/Toast";
import { formatDateTime, formatPrice } from "@/lib/utils";
import {
  availableActions,
  formatStoreDate,
  REPLACEMENT_TRANSITIONS,
  RETURN_DEADLINES,
  RETURN_DISPOSITION_HINTS,
  RETURN_DISPOSITION_LABELS,
  RETURN_DISPOSITIONS,
  RETURN_SHIP_WINDOW_DAYS,
  RETURN_TRANSITIONS,
  returnStatusLabel,
  type ReturnDisposition,
} from "../lib/policy";
import {
  useAdminRequest,
  useAdminRequestAction,
  type RequestKind,
} from "../hooks/use-returns";
import { RequestStatusBadge } from "./RequestStatusBadge";
import { usePurchaseProducts } from "@/features/purchases/hooks";

/** Local debounce, matching the one the stock adjustment screen uses. */
function useDebounced(value: string, ms = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/** The SKU picked at QC as the one that actually turned up in the parcel. */
interface ArrivedItem {
  variantUnitPriceId: number;
  label: string;
  sku: string;
}

interface Props {
  kind: RequestKind;
  uuid: string | null;
  onClose: () => void;
}

type Pending = { action: string; label: string } | null;

/** Actions that end the request badly; rendered as red outline buttons. */
const DESTRUCTIVE_ACTIONS = ["reject", "qc-fail", "expire", "cancel"];

/** Actions whose confirmation panel asks for a free-text reason. */
const REASON_LABELS: Record<string, string> = {
  reject: "Rejection Reason *",
  "qc-fail": "QC Failure Reason *",
  cancel: "Cancellation Reason (Optional)",
  approve: "Return Address & Instructions for the Customer",
};

export function AdminRequestDetailModal({ kind, uuid, onClose }: Props) {
  const { data: req, isLoading, error } = useAdminRequest(kind, uuid);
  const mutation = useAdminRequestAction(kind);
  const [pending, setPending] = useState<Pending>(null);
  const [comment, setComment] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [transactionRef, setTransactionRef] = useState("");
  const [courierName, setCourierName] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [pickupImageUrl, setPickupImageUrl] = useState<string | null>(null);
  const [slipUrl, setSlipUrl] = useState<string | null>(null);
  /** `refund` only: resellable item vs damaged write-off. */
  const [disposition, setDisposition] = useState<ReturnDisposition>("restock");
  /** `send-back` only: how the item is couriered back after a failed check. */
  const [sendbackCourier, setSendbackCourier] = useState("");
  const [sendbackTracking, setSendbackTracking] = useState("");
  const [sendbackProofUrl, setSendbackProofUrl] = useState<string | null>(null);
  /** `refund` only: order item uuid -> the SKU that actually arrived. */
  const [arrivedItems, setArrivedItems] = useState<Record<string, ArrivedItem>>({});
  const [arrivedSearchFor, setArrivedSearchFor] = useState<string | null>(null);
  const [arrivedSearch, setArrivedSearch] = useState("");
  const debouncedArrivedSearch = useDebounced(arrivedSearch);
  const { data: arrivedOptions = [], isFetching: isSearchingArrived } = usePurchaseProducts(
    debouncedArrivedSearch
  );
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** Which field the shared hidden file input is currently filling. */
  const uploadTargetRef = useRef<"pickup" | "slip" | "sendback">("pickup");

  // Where the admin can tell us what physically came back: at the returns
  // quality check, and when a replacement parcel is opened or processed.
  const showArrivedPicker =
    (kind === "returns" && pending?.action === "refund") ||
    (kind === "replacements" &&
      (pending?.action === "picked-up" || pending?.action === "process"));

  const originalTracking = req?.originalCourier?.trackingNumber?.trim();
  const isPickupAction = pending?.action === "pickup" || pending?.action === "picked-up";
  const isMissingMandatoryPhoto = isPickupAction && !pickupImageUrl;
  const hasCourierMismatch =
    Boolean(originalTracking) &&
    isPickupAction &&
    trackingNumber.trim().toUpperCase() !== originalTracking?.toUpperCase();
  const isCourierMatched =
    Boolean(originalTracking) &&
    isPickupAction &&
    Boolean(trackingNumber.trim()) &&
    trackingNumber.trim().toUpperCase() === originalTracking?.toUpperCase();

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleUploadImage = async (file: File) => {
    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "returns");
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      const uploadedUrl = data?.data?.url || data?.data?.path;
      if (res.ok && uploadedUrl) {
        if (uploadTargetRef.current === "slip") setSlipUrl(uploadedUrl);
        else if (uploadTargetRef.current === "sendback") setSendbackProofUrl(uploadedUrl);
        else setPickupImageUrl(uploadedUrl);
        setFieldError(null);
        toast.success("Image uploaded successfully");
      } else {
        toast.error(data?.message || "Failed to upload image");
      }
    } catch {
      toast.error("Failed to upload image");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const transitions = kind === "returns" ? RETURN_TRANSITIONS : REPLACEMENT_TRANSITIONS;
  const actions = req ? availableActions(transitions as Record<string, { from: readonly string[]; label: string }>, req.status) : [];

  const confirm = () => {
    if (!pending || !req) return;
    const isReject = pending.action === "reject";
    const isQcFail = pending.action === "qc-fail";
    if (isReject && comment.trim().length < 3) {
      setFieldError("A rejection reason is required.");
      return;
    }
    if (isQcFail && comment.trim().length < 3) {
      setFieldError("A quality check failure reason is required.");
      return;
    }
    if (pending.action === "shipped") {
      if (courierName.trim().length < 2) {
        setFieldError("Enter the courier the customer shipped with.");
        return;
      }
      if (trackingNumber.trim().length < 3) {
        setFieldError("Enter the tracking / AWB number.");
        return;
      }
      if (!slipUrl) {
        setFieldError("A photo of the courier / delivery slip is mandatory.");
        return;
      }
    }
    if (pending.action === "send-back") {
      if (sendbackCourier.trim().length < 2) {
        setFieldError("Enter the courier the item is being sent back with.");
        return;
      }
      if (sendbackTracking.trim().length < 3) {
        setFieldError("Enter the tracking / AWB number for the item sent back.");
        return;
      }
    }
    if (hasCourierMismatch && originalTracking) {
      setFieldError(`Courier number mismatch! Must match original delivered courier no: ${originalTracking}. Pickup is not allowed on mismatch.`);
      return;
    }
    if (isMissingMandatoryPhoto) {
      setFieldError("Package / courier receipt photo is mandatory. Please upload a photo to proceed.");
      return;
    }
    setFieldError(null);
    mutation.mutate(
      {
        uuid: req.id,
        action: pending.action,
        payload: {
          ...(isReject
            ? { rejectionReason: comment.trim() }
            : isQcFail
              ? { qcFailureReason: comment.trim() }
              : pending.action === "cancel"
                ? comment.trim()
                  ? { cancellationReason: comment.trim() }
                  : {}
                : comment.trim()
                  ? { comment: comment.trim() }
                  : {}),
          ...(pending.action === "pickup" && pickupDate ? { pickupDate: new Date(pickupDate).toISOString() } : {}),
          ...(pending.action === "shipped" && pickupDate
            ? { shippedDate: new Date(pickupDate).toISOString() }
            : {}),
          ...(pending.action === "pickup" ||
          pending.action === "picked-up" ||
          pending.action === "shipped"
            ? {
                ...(courierName.trim() ? { courierName: courierName.trim() } : {}),
                ...(trackingNumber.trim() ? { trackingNumber: trackingNumber.trim() } : {}),
                ...(pickupImageUrl ? { pickupImageUrl } : {}),
                ...(pending.action === "shipped" && slipUrl
                  ? { shippingSlipUrl: slipUrl }
                  : {}),
              }
            : {}),
          ...(pending.action === "refund" && kind === "returns" ? { disposition } : {}),
          ...(showArrivedPicker && Object.keys(arrivedItems).length > 0
            ? {
                receivedVariants: Object.entries(arrivedItems).map(([orderItemId, picked]) => ({
                  orderItemId,
                  variantUnitPriceId: picked.variantUnitPriceId,
                })),
              }
            : {}),
          ...(pending.action === "send-back"
            ? {
                sendbackCourierName: sendbackCourier.trim(),
                sendbackTrackingNumber: sendbackTracking.trim(),
                ...(pickupDate ? { sendbackShippedDate: new Date(pickupDate).toISOString() } : {}),
                ...(sendbackProofUrl ? { sendbackProofUrl } : {}),
              }
            : {}),
          ...(pending.action === "complete" && transactionRef.trim() ? { transactionRef: transactionRef.trim() } : {}),
        },
      },
      {
        onSuccess: (result) => {
          // A prepaid refund is settled at the gateway, and that can fail on its
          // own even though the status change went through.
          const gateway = result?.gatewayRefund;
          if (gateway?.attempted && !gateway.ok) {
            toast.error(gateway.message);
          } else if (gateway?.ok) {
            toast.success(gateway.message);
          } else {
            toast.success(
              gateway && !gateway.attempted ? `${pending.label} completed - ${gateway.message}` : `${pending.label} completed`
            );
          }
          setPending(null);
          setComment("");
          setPickupDate("");
          setTransactionRef("");
          setCourierName("");
          setTrackingNumber("");
          setPickupImageUrl(null);
          setSlipUrl(null);
          setDisposition("restock");
          setSendbackCourier("");
          setSendbackTracking("");
          setSendbackProofUrl(null);
          setArrivedItems({});
          setArrivedSearchFor(null);
          setArrivedSearch("");
        },
        onError: (err) => setFieldError(err instanceof Error ? err.message : "Action failed"),
      }
    );
  };

  return (
    <Modal
      open={Boolean(uuid)}
      onClose={onClose}
      title={kind === "returns" ? "Return request" : "Replacement request"}
      className="max-w-3xl"
    >
      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-20 rounded-xl skeleton-shimmer" />
          <div className="h-40 rounded-xl skeleton-shimmer" />
        </div>
      ) : error || !req ? (
        <p className="py-6 text-center text-sm text-red-600">
          {(error as Error)?.message || "Request not found."}
        </p>
      ) : (
        <div className="space-y-4 pr-1 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-400">Request:</span>
              <p className="font-mono text-xs font-semibold text-neutral-700">{req.id.slice(0, 8).toUpperCase()}</p>
            </div>
            <RequestStatusBadge status={req.status} kind={kind === "returns" ? "return" : "replacement"} />
          </div>

          {kind === "returns" && ["return_requested", "under_review"].includes(req.status) && req.adminDeadline && (
            <div
              className={`flex items-start gap-2 rounded-xl border px-4 py-2.5 text-xs ${
                req.adminDeadlineExpired
                  ? "border-red-200 bg-red-50 text-red-800"
                  : (req.adminDaysLeft ?? 0) <= 2
                  ? "border-amber-200 bg-amber-50 text-amber-900"
                  : "border-blue-200 bg-blue-50 text-blue-900"
              }`}
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {req.adminDeadlineExpired ? (
                  <>
                    <strong>Admin decision deadline expired</strong> ({formatStoreDate(new Date(req.adminDeadline))}).
                    This request was not reviewed within {RETURN_DEADLINES.ADMIN_APPROVAL_DAYS} days and is subject to automatic rejection.
                  </>
                ) : (
                  <>
                    <strong>Admin Review Window:</strong> You have {RETURN_DEADLINES.ADMIN_APPROVAL_DAYS} days from request submission to approve or reject this request.
                    Deadline: <strong>{formatStoreDate(new Date(req.adminDeadline))}</strong>
                    {typeof req.adminDaysLeft === "number"
                      ? ` (${req.adminDaysLeft} ${req.adminDaysLeft === 1 ? "day" : "days"} left)`
                      : ""}
                    . If no action is taken, it will automatically expire.
                  </>
                )}
              </span>
            </div>
          )}

          {kind === "returns" && req.status === "approved" && req.shipDeadline && (
            <div
              className={`flex items-start gap-2 rounded-xl border px-4 py-2.5 text-xs ${
                req.shipWindowExpired
                  ? "border-red-200 bg-red-50 text-red-800"
                  : "border-amber-200 bg-amber-50 text-amber-900"
              }`}
            >
              <Truck className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {req.shipWindowExpired ? (
                  <>
                    <strong>Shipping deadline passed</strong> ({formatStoreDate(new Date(req.shipDeadline))}).
                    The customer never shipped the item - close the request as expired.
                  </>
                ) : (
                  <>
                    <strong>Awaiting shipment from the customer.</strong> They must courier the
                    item by {formatStoreDate(new Date(req.shipDeadline))}
                    {typeof req.shipDaysLeft === "number" && req.shipDaysLeft > 0
                      ? ` (${req.shipDaysLeft} ${req.shipDaysLeft === 1 ? "day" : "days"} left)`
                      : ""}
                    .
                  </>
                )}
              </span>
            </div>
          )}

          {req.returnNumber && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  {kind === "returns" ? "Official Return ID:" : "Official Replacement ID:"}
                </span>
                <span className="font-mono text-xs font-black text-emerald-950 bg-white px-2.5 py-1 rounded-md border border-emerald-200">
                  {req.returnNumber}
                </span>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(req.returnNumber!, "ret-num")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors cursor-pointer"
              >
                {copiedKey === "ret-num" ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy ID</span>
                  </>
                )}
              </button>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Block title="Customer">
              <p className="font-semibold">{req.customer.name}</p>
              <p className="text-neutral-600">{req.customer.email}</p>
              <p className="text-neutral-600">{req.customer.phone || "—"}</p>
            </Block>
            <Block title="Order">
              <p className="font-mono font-semibold">{req.orderNumber}</p>
              <p>Status: {req.orderStatus}</p>
              <p>Delivered: {req.deliveredAt ? formatDateTime(req.deliveredAt) : "—"}</p>
              {kind === "returns" && ["return_requested", "under_review"].includes(req.status) && req.adminDeadline ? (
                <p>
                  Admin Decision Deadline:{" "}
                  <strong className={req.adminDeadlineExpired ? "text-red-600" : "text-neutral-900"}>
                    {formatStoreDate(new Date(req.adminDeadline))}
                    {typeof req.adminDaysLeft === "number" ? ` (${req.adminDaysLeft}d left)` : ""}
                  </strong>
                </p>
              ) : kind === "returns" && req.status === "approved" && req.shipDeadline ? (
                <p>
                  Customer Courier Deadline:{" "}
                  <strong className={req.shipWindowExpired ? "text-red-600" : "text-neutral-900"}>
                    {formatStoreDate(new Date(req.shipDeadline))}
                    {typeof req.shipDaysLeft === "number" ? ` (${req.shipDaysLeft}d left)` : ""}
                  </strong>
                </p>
              ) : (
                <p>
                  {kind === "returns" ? "Return" : "Replacement"} deadline:{" "}
                  {req.returnDeadline ? formatDateTime(req.returnDeadline) : "—"}
                </p>
              )}
              {req.orderTotal !== undefined && <p>Order total: {formatPrice(req.orderTotal)}</p>}
            </Block>
            <Block title="Customer Pickup Address">
              {req.shippingAddress ? (
                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-neutral-900">{req.shippingAddress.fullName}</p>
                    <button
                      type="button"
                      onClick={() => {
                        const addrText = [
                          req.shippingAddress?.fullName,
                          req.shippingAddress?.phone,
                          req.shippingAddress?.addressLine1,
                          req.shippingAddress?.addressLine2,
                          req.shippingAddress?.landmark ? `Landmark: ${req.shippingAddress.landmark}` : null,
                          `${req.shippingAddress?.city}, ${req.shippingAddress?.state} - ${req.shippingAddress?.pincode}`,
                        ].filter(Boolean).join(", ");
                        copyToClipboard(addrText, "pickup-addr");
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 hover:text-emerald-800 transition-colors cursor-pointer"
                    >
                      {copiedKey === "pickup-addr" ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-600" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>Copy Address</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-neutral-600 font-medium">Phone: {req.shippingAddress.phone}</p>
                  <p className="text-neutral-700">
                    {req.shippingAddress.addressLine1}
                    {req.shippingAddress.addressLine2 ? `, ${req.shippingAddress.addressLine2}` : ""}
                  </p>
                  {req.shippingAddress.landmark && (
                    <p className="text-neutral-500 text-[11px]">Landmark: {req.shippingAddress.landmark}</p>
                  )}
                  <p className="text-neutral-800 font-medium">
                    {req.shippingAddress.city}, {req.shippingAddress.state} - {req.shippingAddress.pincode}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-neutral-500">Same as customer registered address</p>
              )}
            </Block>
          </div>

          {(req.originalCourier ||
            req.courierName ||
            req.trackingNumber ||
            req.shippingSlipUrl ||
            req.pickupImageUrl) && (
            <Block title="Courier & Tracking Details">
              <div className="grid gap-3 sm:grid-cols-3 text-xs">
                {req.originalCourier && (
                  <div className="rounded-lg border border-neutral-200 bg-neutral-50/80 p-2.5">
                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                      Original Delivery Shipment
                    </span>
                    <p className="font-semibold text-neutral-900 mt-0.5">{req.originalCourier.carrier || "Courier"}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="font-mono font-bold text-neutral-800 bg-white px-2 py-0.5 rounded border border-neutral-200">
                        {req.originalCourier.trackingNumber}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(req.originalCourier!.trackingNumber, "orig-trk")}
                        className="text-neutral-500 hover:text-neutral-800 p-0.5 cursor-pointer"
                        title="Copy Original Tracker ID"
                      >
                        {copiedKey === "orig-trk" ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                )}
                {(req.courierName || req.trackingNumber) && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-emerald-900 uppercase tracking-wider block">
                        Return Pickup Courier
                      </span>
                      {req.originalCourier?.trackingNumber && req.trackingNumber && (
                        req.trackingNumber.toUpperCase() === req.originalCourier.trackingNumber.toUpperCase() ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-800 bg-emerald-100/90 px-1.5 py-0.5 rounded">
                            <Check className="h-2.5 w-2.5" /> Matched
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-red-800 bg-red-100/90 px-1.5 py-0.5 rounded">
                            Mismatch
                          </span>
                        )
                      )}
                    </div>
                    <p className="font-semibold text-neutral-900 mt-0.5">{req.courierName || "Assigned Courier"}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="font-mono font-bold text-emerald-950 bg-white px-2 py-0.5 rounded border border-emerald-200">
                        {req.trackingNumber || "—"}
                      </span>
                      {req.trackingNumber && (
                        <button
                          type="button"
                          onClick={() => copyToClipboard(req.trackingNumber!, "trk-num")}
                          className="text-neutral-500 hover:text-neutral-800 p-0.5 cursor-pointer"
                          title="Copy Tracker ID"
                        >
                          {copiedKey === "trk-num" ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>
                )}
                {(req.sendbackCourierName || req.sendbackTrackingNumber) && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-2.5">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-amber-900">
                      Sent Back to Customer
                    </span>
                    <p className="mt-0.5 font-semibold text-neutral-900">
                      {req.sendbackCourierName || "Courier"}
                    </p>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span className="rounded border border-amber-200 bg-white px-2 py-0.5 font-mono font-bold text-amber-950">
                        {req.sendbackTrackingNumber || "—"}
                      </span>
                      {req.sendbackTrackingNumber && (
                        <button
                          type="button"
                          onClick={() => copyToClipboard(req.sendbackTrackingNumber!, "sendback-trk")}
                          className="cursor-pointer p-0.5 text-neutral-500 hover:text-neutral-800"
                          title="Copy Tracker ID"
                        >
                          {copiedKey === "sendback-trk" ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                    {req.sendbackDeliveredAt && (
                      <p className="mt-1 text-[11px] text-amber-900">
                        Delivered back on {formatDateTime(req.sendbackDeliveredAt)}
                      </p>
                    )}
                  </div>
                )}
                {req.sendbackProofUrl && (
                  <div>
                    <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block">Send-back Proof</span>
                    <button
                      type="button"
                      onClick={() => setPreviewImage(req.sendbackProofUrl!)}
                      className="group relative mt-1 block h-14 w-14 overflow-hidden rounded-lg border border-neutral-300 bg-neutral-100 transition-opacity hover:opacity-90 cursor-pointer"
                    >
                      <Image src={req.sendbackProofUrl} alt="Send-back proof" fill sizes="56px" className="object-cover" unoptimized />
                    </button>
                  </div>
                )}
                {req.shippingSlipUrl && (
                  <div>
                    <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block">Delivery Slip Photo</span>
                    <button
                      type="button"
                      onClick={() => setPreviewImage(req.shippingSlipUrl!)}
                      className="group relative mt-1 block h-14 w-14 overflow-hidden rounded-lg border border-neutral-300 bg-neutral-100 hover:opacity-90 transition-opacity cursor-pointer"
                    >
                      <Image src={req.shippingSlipUrl} alt="Delivery slip" fill sizes="56px" className="object-cover" unoptimized />
                    </button>
                  </div>
                )}
                {req.pickupImageUrl && (
                  <div>
                    <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block">Receipt / Package Image</span>
                    <button
                      type="button"
                      onClick={() => setPreviewImage(req.pickupImageUrl!)}
                      className="group relative mt-1 block h-14 w-14 overflow-hidden rounded-lg border border-neutral-300 bg-neutral-100 hover:opacity-90 transition-opacity cursor-pointer"
                    >
                      <Image src={req.pickupImageUrl} alt="Pickup proof" fill sizes="56px" className="object-cover" unoptimized />
                    </button>
                  </div>
                )}
              </div>
            </Block>
          )}

          <Block title="Products">
            <ul className="space-y-2">
              {req.items.map((i) => (
                <li key={i.orderItemId} className="flex items-center gap-3">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                    {i.image && <Image src={i.image} alt={i.productName} fill sizes="48px" className="object-cover" unoptimized />}
                  </div>
                  <div>
                    <p className="font-semibold">{i.productName}</p>
                    <p className="text-xs text-neutral-500">
                      {[i.variantName, i.color && `Color: ${i.color}`, i.size && `Size: ${i.size}`]
                        .filter(Boolean)
                        .join(" · ")}{" "}
                      · Qty {i.quantity} · {formatPrice(i.unitPrice)}
                    </p>
                    {i.requestedSize && (
                      <p className="text-xs font-semibold text-secondary-700">
                        Requested replacement size: {i.requestedSize}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Block>

          <Block title="Reason">
            <p className="font-semibold">{req.reason}</p>
            {req.description && <p className="mt-1 whitespace-pre-wrap">{req.description}</p>}
            <p className="mt-1 text-xs text-neutral-500">Requested {formatDateTime(req.requestedAt)}</p>
          </Block>

          {req.refundMethod && (
            <Block title="Refund Destination (Cash on Delivery)">
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-secondary-50 px-2 py-0.5 text-xs font-semibold text-secondary-800 border border-secondary-200">
                    {req.refundMethod === "upi" ? <Smartphone className="h-3.5 w-3.5" /> : <Building2 className="h-3.5 w-3.5" />}
                    {req.refundMethod === "upi" ? "Instant UPI Transfer" : "Bank Transfer (NEFT/IMPS)"}
                  </span>
                  {req.refundTransactionRef && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 border border-emerald-200">
                      Ref / UTR: {req.refundTransactionRef}
                    </span>
                  )}
                </div>

                {req.refundMethod === "upi" ? (
                  <div className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2.5 border border-neutral-200">
                    <div>
                      <p className="text-[11px] text-neutral-500 font-medium">Customer UPI ID / VPA</p>
                      <p className="font-mono text-sm font-semibold text-neutral-900">{req.upiId || "—"}</p>
                    </div>
                    {req.upiId && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 gap-1.5 text-xs"
                        onClick={() => copyToClipboard(req.upiId!, "upi")}
                      >
                        {copiedKey === "upi" ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                        {copiedKey === "upi" ? "Copied" : "Copy UPI"}
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="grid gap-2.5 sm:grid-cols-2 rounded-lg bg-neutral-50 p-3 border border-neutral-200 text-xs">
                    <div>
                      <p className="text-[11px] text-neutral-500 font-medium">Account Holder</p>
                      <p className="font-semibold text-neutral-900">{req.bankAccountHolder || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-neutral-500 font-medium">Bank Name</p>
                      <p className="font-semibold text-neutral-900">{req.bankName || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-neutral-500 font-medium">Account Number</p>
                      <p className="font-mono font-semibold text-neutral-900">{req.bankAccountLast4 || "••••"}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[11px] text-neutral-500 font-medium">IFSC Code</p>
                        <p className="font-mono font-semibold uppercase text-neutral-900">{req.bankIfsc || "—"}</p>
                      </div>
                      {req.bankIfsc && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1 text-[11px]"
                          onClick={() => copyToClipboard(req.bankIfsc!, "ifsc")}
                        >
                          {copiedKey === "ifsc" ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                          {copiedKey === "ifsc" ? "Copied" : "Copy IFSC"}
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </Block>
          )}

          {req.status === "rejected" && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">
              <strong>Rejection reason:</strong> {req.rejectionReason}
              {req.rejectedAt && <span className="block text-xs">{formatDateTime(req.rejectedAt)}</span>}
            </div>
          )}
          {req.adminComment && req.status !== "rejected" && (
            <Block title="Admin comment">
              <p>{req.adminComment}</p>
            </Block>
          )}

          <Block title="Unboxing video">
            {req.unboxingVideoUrl ? (
              <video src={req.unboxingVideoUrl} controls preload="metadata" className="max-h-72 w-full rounded-lg bg-black" />
            ) : (
              <p className="text-neutral-500">No video attached (legacy request).</p>
            )}
          </Block>

          <Block title="Request history">
            <ol className="space-y-1 text-xs">
              {req.history.map((h) => (
                <li key={h.id}>
                  <strong>
                    {kind === "returns"
                      ? returnStatusLabel(h.toStatus)
                      : h.toStatus.replace(/_/g, " ")}
                  </strong>{" "}
                  · {formatDateTime(h.createdAt)} ·{" "}
                  <span className="text-neutral-500">{h.actorType}</span>
                  {h.note && <span className="text-neutral-600"> — {h.note}</span>}
                </li>
              ))}
              {req.history.length === 0 && <li className="text-neutral-500">No history yet.</li>}
            </ol>
          </Block>

          {actions.length > 0 && !pending && (
            <div className="flex flex-wrap gap-2 border-t border-neutral-200 pt-3">
              {actions.map((a) => (
                <Button
                  key={a.action}
                  size="sm"
                  variant={DESTRUCTIVE_ACTIONS.includes(a.action) ? "outline" : "default"}
                  className={
                    DESTRUCTIVE_ACTIONS.includes(a.action)
                      ? "border-red-200 text-red-700 hover:bg-red-50"
                      : ""
                  }
                  onClick={() => {
                    setFieldError(null);
                    setPending(a);
                    const origTrack = req.originalCourier?.trackingNumber?.trim();
                    const origCarrier = req.originalCourier?.carrier?.trim();
                    let autoTrack = req.trackingNumber || origTrack || "";
                    let autoCourier = req.courierName || origCarrier || "";

                    // Only the replacement pickup is bound to the original
                    // delivery courier; a return is shipped by the customer
                    // with whatever courier they choose.
                    if (origTrack && (a.action === "pickup" || a.action === "picked-up")) {
                      if (!req.trackingNumber || req.trackingNumber.toUpperCase() !== origTrack.toUpperCase()) {
                        autoTrack = origTrack;
                      }
                      if ((!req.courierName || req.courierName === origTrack) && origCarrier) {
                        autoCourier = origCarrier;
                      }
                    }

                    setCourierName(autoCourier);
                    setTrackingNumber(autoTrack);
                    setPickupImageUrl(req.pickupImageUrl || null);
                    setSlipUrl(req.shippingSlipUrl || null);
                  }}
                >
                  {a.label}
                </Button>
              ))}
            </div>
          )}

          {pending && (
            <div className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3.5">
              <p className="font-semibold text-sm">
                {pending.action === "approve"
                  ? "Approve this request?"
                  : pending.action === "reject"
                    ? "Reject this request"
                    : pending.action === "complete"
                      ? "Complete Refund & Mark Refunded"
                      : pending.action === "qc-fail"
                        ? "Fail the quality check"
                        : `${pending.label}?`}
              </p>

              {pending.action === "approve" && kind === "returns" && (
                <p className="text-xs text-neutral-600">
                  The customer gets {RETURN_SHIP_WINDOW_DAYS} days from today to courier the item
                  back. Put the return address in the box below - it is shown to them with the
                  approval.
                </p>
              )}

              {pending.action === "qc-fail" && (
                <p className="text-xs text-red-700">
                  The item will not be refunded or restocked, and the reason below is shown to the
                  customer. Use this only when the returned item fails inspection. The item is
                  still theirs, so the next step is to courier it back to them.
                </p>
              )}

              {pending.action === "send-back" && (
                <div className="space-y-2.5 rounded-lg border border-amber-200 bg-white p-3 text-xs">
                  <p className="text-amber-900">
                    The quality check failed, so this item is still the customer&apos;s. Enter the
                    courier it is going back with - the customer sees these details on their
                    request.
                  </p>
                  <div className="grid gap-2.5 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block font-semibold text-neutral-700">
                        Courier / Partner *
                      </label>
                      <Input
                        value={sendbackCourier}
                        onChange={(e) => setSendbackCourier(e.target.value)}
                        placeholder="e.g. Delhivery, India Post"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-semibold text-neutral-700">
                        Tracking / AWB No *
                      </label>
                      <Input
                        value={sendbackTracking}
                        onChange={(e) => setSendbackTracking(e.target.value)}
                        placeholder="Tracking number"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-semibold text-neutral-700">
                        Dispatched on
                      </label>
                      <Input
                        type="date"
                        value={pickupDate}
                        onChange={(e) => setPickupDate(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block font-semibold text-neutral-700">
                      Packing / receipt photo (optional)
                    </label>
                    {sendbackProofUrl ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPreviewImage(sendbackProofUrl)}
                          className="relative h-14 w-14 overflow-hidden rounded-lg border border-neutral-200"
                        >
                          <Image
                            src={sendbackProofUrl}
                            alt="Send-back proof"
                            fill
                            sizes="56px"
                            className="object-cover"
                            unoptimized
                          />
                        </button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setSendbackProofUrl(null)}
                        >
                          <X className="mr-1 h-3.5 w-3.5" />
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isUploadingImage}
                        onClick={() => {
                          uploadTargetRef.current = "sendback";
                          fileInputRef.current?.click();
                        }}
                      >
                        <Upload className="mr-1 h-3.5 w-3.5" />
                        {isUploadingImage ? "Uploading…" : "Upload photo"}
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {pending.action === "delivered-back" && (
                <p className="text-xs text-neutral-600">
                  Confirms the customer has the item back. The request can be closed after this.
                </p>
              )}

              {pending.action === "expire" && (
                <p className="text-xs text-neutral-600">
                  Closes the request because the customer did not ship the item before the
                  deadline. No refund is issued.
                </p>
              )}

              {pending.action === "cancel" && (
                <p className="text-xs text-neutral-600">
                  Cancels the request on the customer&apos;s behalf. The item stays with them and
                  they may raise a fresh request while the return window is open.
                </p>
              )}

              {pending.action === "refund" && kind === "returns" && (
                <div className="space-y-2.5 rounded-lg border border-emerald-200 bg-white p-3 text-xs">
                  <p className="text-emerald-800">
                    This marks the quality check as passed and initiates the refund. Say what
                    happens to the item itself - the customer is refunded either way.
                  </p>
                  <div className="space-y-2">
                    {RETURN_DISPOSITIONS.map((value) => (
                      <label
                        key={value}
                        className={`flex cursor-pointer gap-2.5 rounded-lg border p-2.5 ${
                          disposition === value
                            ? value === "damaged"
                              ? "border-red-300 bg-red-50"
                              : "border-emerald-300 bg-emerald-50"
                            : "border-neutral-200 hover:bg-neutral-50"
                        }`}
                      >
                        <input
                          type="radio"
                          name="return-disposition"
                          value={value}
                          checked={disposition === value}
                          onChange={() => setDisposition(value)}
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-emerald-600"
                        />
                        <span>
                          <span className="block font-semibold text-neutral-800">
                            {RETURN_DISPOSITION_LABELS[value]}
                          </span>
                          <span className="block text-neutral-600">
                            {RETURN_DISPOSITION_HINTS[value]}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                  {disposition === "damaged" && (
                    <p className="text-red-700">
                      Note the damage in the box below - it is kept on the write-off entry in the
                      stock ledger.
                    </p>
                  )}

                </div>
              )}

              {showArrivedPicker && (
                <div className="space-y-2.5 rounded-lg border border-sky-200 bg-white p-3 text-xs">
                  <div className="space-y-2">
                    <p className="font-semibold text-neutral-800">
                      Which item actually arrived?
                    </p>
                    <p className="text-neutral-600">
                      Leave this alone when the parcel holds what the customer ordered. When a
                      different item came back, pick the SKU that really turned up - stock is
                      credited to that one instead of the one on the order line.
                    </p>
                    {req.items.map((line) => {
                      const picked = arrivedItems[line.orderItemId];
                      const isSearching = arrivedSearchFor === line.orderItemId;
                      return (
                        <div
                          key={line.orderItemId}
                          className="rounded-lg border border-neutral-200 p-2.5"
                        >
                          <p className="font-medium text-neutral-800">
                            Ordered: {line.productName}
                            {line.variantName ? ` · ${line.variantName}` : ""} × {line.quantity}
                          </p>
                          {picked ? (
                            <div className="mt-1.5 flex items-center justify-between gap-2">
                              <span className="text-amber-900">
                                Arrived: <span className="font-semibold">{picked.label}</span>{" "}
                                <span className="text-neutral-500">{picked.sku}</span>
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setArrivedItems((prev) => {
                                    const next = { ...prev };
                                    delete next[line.orderItemId];
                                    return next;
                                  })
                                }
                              >
                                Clear
                              </Button>
                            </div>
                          ) : isSearching ? (
                            <div className="mt-1.5 space-y-1.5">
                              <Input
                                autoFocus
                                value={arrivedSearch}
                                onChange={(e) => setArrivedSearch(e.target.value)}
                                placeholder="Search by product name or SKU..."
                              />
                              <div className="max-h-44 overflow-auto rounded-lg border border-neutral-200">
                                {arrivedOptions.length === 0 ? (
                                  <p className="px-3 py-2 text-neutral-500">
                                    {isSearchingArrived ? "Searching..." : "No products found"}
                                  </p>
                                ) : (
                                  arrivedOptions.map((o) => (
                                    <button
                                      type="button"
                                      key={o.variantUnitPriceId}
                                      onClick={() => {
                                        setArrivedItems((prev) => ({
                                          ...prev,
                                          [line.orderItemId]: {
                                            variantUnitPriceId: o.variantUnitPriceId,
                                            label: o.label,
                                            sku: o.sku,
                                          },
                                        }));
                                        setArrivedSearchFor(null);
                                        setArrivedSearch("");
                                      }}
                                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-neutral-50"
                                    >
                                      <span>
                                        <span className="font-medium text-neutral-900">
                                          {o.label}
                                        </span>
                                        <span className="ml-2 text-neutral-500">{o.sku}</span>
                                      </span>
                                      <span className="text-neutral-500">Stock {o.stock}</span>
                                    </button>
                                  ))
                                )}
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setArrivedSearchFor(null);
                                  setArrivedSearch("");
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="mt-1.5"
                              onClick={() => {
                                setArrivedSearchFor(line.orderItemId);
                                setArrivedSearch("");
                              }}
                            >
                              A different item arrived
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {pending.action === "shipped" && (
                <div className="space-y-2.5 rounded-lg border border-sky-200 bg-white p-3 text-xs">
                  <p className="font-semibold text-sky-950">
                    Courier details as given by the customer
                  </p>
                  <p className="text-neutral-600">
                    The customer picks their own courier, so this is not checked against the
                    original delivery shipment. Correct it here whenever they send an update.
                  </p>
                  <div className="grid gap-2.5 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block font-semibold text-neutral-700">
                        Courier / Partner *
                      </label>
                      <Input
                        value={courierName}
                        onChange={(e) => setCourierName(e.target.value)}
                        placeholder="e.g. Delhivery, India Post"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-semibold text-neutral-700">
                        Tracking / AWB No *
                      </label>
                      <Input
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                        placeholder="Tracking number"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-semibold text-neutral-700">
                        Shipped on
                      </label>
                      <Input
                        type="date"
                        value={pickupDate}
                        onChange={(e) => setPickupDate(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="border-t border-neutral-100 pt-2.5">
                    <p className="font-semibold text-neutral-700">
                      Courier / Delivery Slip Photo *
                    </p>
                    <p className="mt-0.5 text-neutral-600">
                      The customer normally uploads this themselves. Attach it here only when
                      they sent it to you another way.
                    </p>
                    {slipUrl ? (
                      <div className="mt-2 flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => setPreviewImage(slipUrl)}
                          className="relative h-12 w-12 shrink-0 overflow-hidden rounded border border-neutral-200 bg-neutral-100 cursor-pointer"
                        >
                          <Image
                            src={slipUrl}
                            alt="Delivery slip"
                            fill
                            sizes="48px"
                            className="object-cover"
                            unoptimized
                          />
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-emerald-700">Slip photo attached</p>
                          <button
                            type="button"
                            className="text-sky-700 underline cursor-pointer"
                            onClick={() => {
                              uploadTargetRef.current = "slip";
                              fileInputRef.current?.click();
                            }}
                          >
                            Replace photo
                          </button>
                        </div>
                        <button
                          type="button"
                          aria-label="Remove photo"
                          className="rounded-full p-1 text-neutral-500 hover:bg-neutral-100 cursor-pointer"
                          onClick={() => setSlipUrl(null)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        disabled={isUploadingImage}
                        onClick={() => {
                          uploadTargetRef.current = "slip";
                          fileInputRef.current?.click();
                        }}
                      >
                        {isUploadingImage ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Upload className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        {isUploadingImage ? "Uploading…" : "Upload slip photo"}
                      </Button>
                    )}
                    {!slipUrl && (
                      <p className="mt-1.5 font-semibold text-amber-800">
                        ⚠️ The slip photo is mandatory before the return can be marked as shipped.
                      </p>
                    )}
                  </div>
                </div>
              )}
              {pending.action === "refund" && (
                <p className="text-xs text-neutral-600">
                  {req.refundMethod
                    ? "This order was paid by cash on delivery - pay the customer using the refund details above, then mark the request refunded."
                    : "The refund will be sent to the original payment method automatically. If the gateway rejects it, settle it manually and mark the request refunded."}
                </p>
              )}
              {pending.action === "pickup" && (
                <div className="space-y-2.5 rounded-lg border border-neutral-200 bg-white p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-neutral-700">Official Return ID:</span>
                    <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {req.returnNumber || "—"}
                    </span>
                  </div>
                  {req.shippingAddress && (
                    <div className="pt-2 border-t border-neutral-100">
                      <span className="font-semibold text-neutral-800">Customer Pickup Address:</span>
                      <p className="text-neutral-600 mt-0.5">
                        {req.shippingAddress.fullName} · {req.shippingAddress.phone}
                        <br />
                        {req.shippingAddress.addressLine1}
                        {req.shippingAddress.addressLine2 ? `, ${req.shippingAddress.addressLine2}` : ""}
                        {req.shippingAddress.landmark ? ` (Near: ${req.shippingAddress.landmark})` : ""}
                        <br />
                        {req.shippingAddress.city}, {req.shippingAddress.state} - {req.shippingAddress.pincode}
                      </p>
                    </div>
                  )}
                  <div className="space-y-1 pt-2 border-t border-neutral-100">
                    <label className="text-xs font-semibold text-neutral-700">Schedule Pickup Date &amp; Time</label>
                    <input
                      type="datetime-local"
                      value={pickupDate}
                      onChange={(e) => setPickupDate(e.target.value)}
                      className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm w-full sm:w-auto"
                    />
                  </div>

                  {req.originalCourier && (
                    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-2.5 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-neutral-700">Delivered Courier Consignment No:</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-neutral-900 bg-white px-2 py-0.5 rounded border border-neutral-200">
                            {req.originalCourier.carrier ? `${req.originalCourier.carrier} · ` : ""}{req.originalCourier.trackingNumber}
                          </span>
                          {trackingNumber.trim().toUpperCase() !== req.originalCourier.trackingNumber.toUpperCase() && (
                            <button
                              type="button"
                              onClick={() => {
                                setTrackingNumber(req.originalCourier!.trackingNumber);
                                if (req.originalCourier?.carrier && !courierName) setCourierName(req.originalCourier.carrier);
                                setFieldError(null);
                              }}
                              className="text-[11px] font-bold text-secondary-700 underline hover:text-secondary-800 cursor-pointer"
                            >
                              Auto-fill
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-[11px] text-neutral-500">
                        Package being picked up must have this same courier number. Pickup cannot proceed on mismatch.
                      </p>
                    </div>
                  )}

                  <div className="grid gap-2.5 sm:grid-cols-2 pt-2 border-t border-neutral-100">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-neutral-700">Courier Name / No</label>
                      <Input
                        value={courierName}
                        onChange={(e) => setCourierName(e.target.value)}
                        placeholder="e.g. Delhivery, Blue Dart, DTDC"
                        className="bg-white text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-neutral-700">Tracker ID / AWB No</label>
                      <Input
                        value={trackingNumber}
                        onChange={(e) => {
                          setTrackingNumber(e.target.value);
                          setFieldError(null);
                        }}
                        placeholder="e.g. TRK9876543210 or Docket No"
                        className={`font-mono text-xs bg-white ${
                          hasCourierMismatch
                            ? "border-red-400 focus-visible:ring-red-400"
                            : isCourierMatched
                              ? "border-emerald-500 focus-visible:ring-emerald-500"
                              : ""
                        }`}
                      />
                      {req.originalCourier?.trackingNumber && (
                        <div>
                          {isCourierMatched ? (
                            <p className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 mt-1">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              Courier number matches delivered product ({req.originalCourier.trackingNumber}) ✓
                            </p>
                          ) : trackingNumber.trim() ? (
                            <p className="flex items-center gap-1 text-[11px] font-bold text-red-600 mt-1">
                              <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                              Mismatch! Delivered: {req.originalCourier.trackingNumber} — Pickup not allowed.
                            </p>
                          ) : (
                            <p className="text-[11px] text-amber-700 mt-1">
                              Delivered consignment no: <strong>{req.originalCourier.trackingNumber}</strong>
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-neutral-100">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-neutral-700">
                        Courier Receipt / Package Photo <span className="text-red-500 font-bold">* (Mandatory)</span>
                      </label>
                      {isMissingMandatoryPhoto && (
                        <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          Photo required
                        </span>
                      )}
                    </div>
                    {pickupImageUrl ? (
                      <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-2">
                        <button
                          type="button"
                          onClick={() => setPreviewImage(pickupImageUrl)}
                          className="relative h-12 w-12 overflow-hidden rounded-md border border-neutral-300 bg-white shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
                        >
                          <Image src={pickupImageUrl} alt="Pickup image" fill sizes="48px" className="object-cover" unoptimized />
                        </button>
                        <div className="min-w-0 flex-1 text-xs">
                          <p className="font-semibold text-emerald-800">Photo uploaded</p>
                          <button
                            type="button"
                            onClick={() => setPreviewImage(pickupImageUrl)}
                            className="text-[11px] text-secondary-700 underline hover:text-secondary-800"
                          >
                            Click to view full size
                          </button>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs text-red-600 hover:bg-red-50"
                          onClick={() => setPickupImageUrl(null)}
                        >
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={isUploadingImage}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              uploadTargetRef.current = "pickup";
                              fileInputRef.current?.click();
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 cursor-pointer transition-colors shadow-2xs"
                          >
                            {isUploadingImage ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-secondary-600" />
                            ) : (
                              <Upload className="h-3.5 w-3.5 text-neutral-500" />
                            )}
                            <span>{isUploadingImage ? "Uploading..." : "Upload Receipt / Package Photo"}</span>
                          </button>
                          <span className="text-[11px] text-neutral-400">PNG, JPG up to 5MB</span>
                        </div>
                        <p className="text-[11px] font-medium text-amber-700">
                          ⚠️ Package photo upload is mandatory before scheduling pickup.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {pending.action === "picked-up" && (
                <div className="space-y-2.5 rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-950">Verify Return ID on Package:</span>
                    <span className="font-mono font-black text-emerald-900 bg-white px-2.5 py-1 rounded border border-emerald-300 shadow-2xs">
                      {req.returnNumber || "—"}
                    </span>
                  </div>
                  {req.shippingAddress && (
                    <div className="pt-1.5 border-t border-emerald-200/70 text-emerald-950">
                      <span className="font-semibold">Customer Pickup Location:</span>
                      <p className="text-[11px] text-emerald-900 mt-0.5">
                        {req.shippingAddress.fullName} · {req.shippingAddress.phone}
                        <br />
                        {req.shippingAddress.addressLine1}, {req.shippingAddress.city} - {req.shippingAddress.pincode}
                      </p>
                    </div>
                  )}

                  {req.originalCourier && (
                    <div className="rounded-lg border border-emerald-300 bg-white p-2.5 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-emerald-950">Delivered Courier Consignment No:</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-emerald-950 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
                            {req.originalCourier.carrier ? `${req.originalCourier.carrier} · ` : ""}{req.originalCourier.trackingNumber}
                          </span>
                          {trackingNumber.trim().toUpperCase() !== req.originalCourier.trackingNumber.toUpperCase() && (
                            <button
                              type="button"
                              onClick={() => {
                                setTrackingNumber(req.originalCourier!.trackingNumber);
                                if (req.originalCourier?.carrier && !courierName) setCourierName(req.originalCourier.carrier);
                                setFieldError(null);
                              }}
                              className="text-[11px] font-bold text-secondary-700 underline hover:text-secondary-800 cursor-pointer"
                            >
                              Auto-fill
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-[11px] text-emerald-800">
                        Package being picked up must have this same courier number. Pickup cannot proceed on mismatch.
                      </p>
                    </div>
                  )}

                  <div className="grid gap-2.5 sm:grid-cols-2 pt-2 border-t border-emerald-200/60">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-emerald-950">Courier Name / No</label>
                      <Input
                        value={courierName}
                        onChange={(e) => setCourierName(e.target.value)}
                        placeholder="e.g. Delhivery, Blue Dart, DTDC"
                        className="bg-white text-xs border-emerald-300"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-emerald-950">Tracker ID / AWB No</label>
                      <Input
                        value={trackingNumber}
                        onChange={(e) => {
                          setTrackingNumber(e.target.value);
                          setFieldError(null);
                        }}
                        placeholder="e.g. TRK9876543210 or Docket No"
                        className={`font-mono text-xs bg-white ${
                          hasCourierMismatch
                            ? "border-red-400 focus-visible:ring-red-400"
                            : isCourierMatched
                              ? "border-emerald-500 focus-visible:ring-emerald-500"
                              : "border-emerald-300"
                        }`}
                      />
                      {req.originalCourier?.trackingNumber && (
                        <div>
                          {isCourierMatched ? (
                            <p className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 mt-1">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              Courier number matches delivered product ({req.originalCourier.trackingNumber}) ✓
                            </p>
                          ) : trackingNumber.trim() ? (
                            <p className="flex items-center gap-1 text-[11px] font-bold text-red-600 mt-1">
                              <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                              Mismatch! Delivered: {req.originalCourier.trackingNumber} — Pickup not allowed.
                            </p>
                          ) : (
                            <p className="text-[11px] text-amber-800 mt-1">
                              Delivered consignment no: <strong>{req.originalCourier.trackingNumber}</strong>
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-emerald-200/60">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-emerald-950">
                        Courier Receipt / Package Photo <span className="text-red-600 font-bold">* (Mandatory)</span>
                      </label>
                      {isMissingMandatoryPhoto && (
                        <span className="text-[11px] font-semibold text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                          Photo required
                        </span>
                      )}
                    </div>
                    {pickupImageUrl ? (
                      <div className="flex items-center gap-3 rounded-lg border border-emerald-300 bg-white p-2">
                        <button
                          type="button"
                          onClick={() => setPreviewImage(pickupImageUrl)}
                          className="relative h-12 w-12 overflow-hidden rounded-md border border-emerald-300 bg-white shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
                        >
                          <Image src={pickupImageUrl} alt="Pickup image" fill sizes="48px" className="object-cover" unoptimized />
                        </button>
                        <div className="min-w-0 flex-1 text-xs">
                          <p className="font-semibold text-emerald-800">Photo attached</p>
                          <button
                            type="button"
                            onClick={() => setPreviewImage(pickupImageUrl)}
                            className="text-[11px] text-secondary-700 underline hover:text-secondary-800"
                          >
                            Click to view full size
                          </button>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs text-red-600 hover:bg-red-50"
                          onClick={() => setPickupImageUrl(null)}
                        >
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={isUploadingImage}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              uploadTargetRef.current = "pickup";
                              fileInputRef.current?.click();
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-100/50 cursor-pointer transition-colors shadow-2xs"
                          >
                            {isUploadingImage ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-secondary-600" />
                            ) : (
                              <Upload className="h-3.5 w-3.5 text-emerald-700" />
                            )}
                            <span>{isUploadingImage ? "Uploading..." : "Upload Receipt / Package Photo"}</span>
                          </button>
                          <span className="text-[11px] text-emerald-700">PNG, JPG up to 5MB</span>
                        </div>
                        <p className="text-[11px] font-medium text-emerald-900">
                          ⚠️ Package photo upload is mandatory to confirm pickup.
                        </p>
                      </div>
                    )}
                  </div>

                  <p className="text-[11px] text-emerald-800 pt-1">
                    Confirm that the product package has been collected from this customer address and the Return ID tag matches.
                  </p>
                </div>
              )}
              {pending.action === "complete" && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-700">
                    Bank Reference / UTR Number (Optional)
                  </label>
                  <Input
                    value={transactionRef}
                    onChange={(e) => setTransactionRef(e.target.value)}
                    placeholder="e.g. UTR-20261016-83921 or TXN_987654"
                    className="font-mono text-xs bg-white"
                  />
                  <p className="text-[11px] text-neutral-500">
                    Enter the bank UTR or IMPS reference number for financial audit tracking.
                  </p>
                </div>
              )}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700">
                  {(kind === "returns" ? REASON_LABELS[pending.action] : undefined) ??
                    (pending.action === "reject"
                      ? "Rejection Reason *"
                      : "Admin Comment (Optional)")}
                </label>
                <Textarea
                  value={comment}
                  maxLength={500}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={
                    pending.action === "reject"
                      ? "Describe why this request is being rejected"
                      : pending.action === "qc-fail"
                        ? "Describe what failed the quality check"
                        : pending.action === "approve" && kind === "returns"
                          ? "Return address the customer should courier the item to"
                          : pending.action === "cancel"
                            ? "Why the customer is cancelling"
                            : "Internal note or remark"
                  }
                  className="bg-white"
                />
              </div>
              {hasCourierMismatch && (
                <p className="text-xs font-bold text-red-600 flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                  Courier number mismatch! Pickup cannot be confirmed (Expected: {originalTracking}).
                </p>
              )}
              {isMissingMandatoryPhoto && !hasCourierMismatch && (
                <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5 bg-amber-50 border border-amber-200 p-2 rounded-lg">
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                  Package photo is mandatory to confirm pickup. Please upload a receipt or package photo.
                </p>
              )}
              {fieldError && <p className="text-xs font-medium text-red-600">{fieldError}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => setPending(null)} disabled={mutation.isPending}>
                  Back
                </Button>
                <Button
                  size="sm"
                  onClick={confirm}
                  disabled={mutation.isPending || isUploadingImage || hasCourierMismatch || isMissingMandatoryPhoto}
                  className={pending.action === "reject" ? "bg-red-600 text-white hover:bg-red-700" : ""}
                >
                  {mutation.isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
                  Confirm
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {previewImage && (
        <Modal open={Boolean(previewImage)} onClose={() => setPreviewImage(null)} title="Receipt / Package Photo" className="max-w-2xl">
          <div className="relative h-[60vh] w-full overflow-hidden rounded-lg bg-neutral-950 flex items-center justify-center">
            <Image src={previewImage} alt="Preview" fill className="object-contain" unoptimized />
          </div>
          <div className="mt-3 flex justify-between items-center">
            <a
              href={previewImage}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-secondary-700 font-medium underline"
            >
              Open original file
            </a>
            <Button size="sm" variant="outline" onClick={() => setPreviewImage(null)}>
              Close
            </Button>
          </div>
        </Modal>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUploadImage(file);
          e.target.value = "";
        }}
      />
    </Modal>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-200 p-3">
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-neutral-500">{title}</p>
      {children}
    </div>
  );
}
