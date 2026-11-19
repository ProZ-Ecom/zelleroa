"use client";

import React, { useRef, useState } from "react";
import Image from "next/image";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  MapPin,
  PackageCheck,
  Truck,
  Upload,
  X,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/Toast";
import { returnsApi } from "../api/returns.api";
import { useCustomerReturnAction } from "../hooks/use-returns";
import {
  formatStoreDate,
  getShipWindow,
  SHIPPING_SLIP_MAX_BYTES,
  SHIPPING_SLIP_MIME_TYPES,
} from "../lib/policy";
import type { RequestSummary } from "../lib/summary";

interface ShipReturnModalProps {
  open: boolean;
  request: RequestSummary | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const POPULAR_COURIERS = [
  "India Post",
  "Delhivery",
  "DTDC",
  "Blue Dart",
  "Professional Couriers",
  "ST Courier",
];

export function ShipReturnModal({
  open,
  request,
  onClose,
  onSuccess,
}: ShipReturnModalProps) {
  const mutation = useCustomerReturnAction();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [courierName, setCourierName] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [shippedDate, setShippedDate] = useState(() => {
    try {
      return new Date().toISOString().slice(0, 10);
    } catch {
      return "";
    }
  });
  const [slipUrl, setSlipUrl] = useState<string | null>(null);
  const [isUploadingSlip, setIsUploadingSlip] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Sync initial request values if already partially filled
  React.useEffect(() => {
    if (request && open) {
      setCourierName(request.courierName || "");
      setTrackingNumber(request.trackingNumber || "");
      setSlipUrl(request.shippingSlipUrl || null);
      setFieldError(null);
      setConfirmOpen(false);
      try {
        setShippedDate(new Date().toISOString().slice(0, 10));
      } catch {
        setShippedDate("");
      }
    }
  }, [request, open]);

  const shipDaysInfo = React.useMemo(() => {
    if (!request || request.status !== "approved") return null;
    if (request.shipDeadlineAt) {
      const deadline = new Date(request.shipDeadlineAt);
      if (!Number.isNaN(deadline.getTime())) {
        const now = new Date();
        const expired = now.getTime() > deadline.getTime();
        const diffMs = deadline.getTime() - now.getTime();
        const daysLeft = expired ? 0 : Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
        return { daysLeft, expired, deadline };
      }
    }
    if (request.approvedAt) {
      const sw = getShipWindow(request.approvedAt);
      return { daysLeft: sw.daysLeft, expired: sw.expired, deadline: sw.deadline };
    }
    const sw = getShipWindow(new Date());
    return { daysLeft: sw.daysLeft, expired: sw.expired, deadline: sw.deadline };
  }, [request]);

  if (!request) return null;

  const handleUploadSlip = async (file: File) => {
    if (file.size > SHIPPING_SLIP_MAX_BYTES) {
      setFieldError(
        `Photo is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum is ${SHIPPING_SLIP_MAX_BYTES / (1024 * 1024)} MB.`
      );
      return;
    }
    if (!(SHIPPING_SLIP_MIME_TYPES as readonly string[]).includes(file.type.toLowerCase())) {
      setFieldError("Please upload a JPG, PNG, or WebP photo.");
      return;
    }
    setIsUploadingSlip(true);
    setFieldError(null);
    try {
      const saved = await returnsApi.uploadShippingSlip(file);
      setSlipUrl(saved.url);
      toast.success("Delivery slip uploaded successfully");
    } catch (err: any) {
      setFieldError(err?.message || "Could not upload the courier slip photo.");
      toast.error(err?.message || "Could not upload the photo");
    } finally {
      setIsUploadingSlip(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleValidateAndConfirm = () => {
    if (!courierName.trim() || courierName.trim().length < 2) {
      setFieldError("Please enter the courier or delivery partner name.");
      return;
    }
    if (!trackingNumber.trim() || trackingNumber.trim().length < 3) {
      setFieldError("Please enter the tracking / AWB number.");
      return;
    }
    if (!slipUrl) {
      setFieldError("A clear photo of the courier / delivery receipt slip is mandatory.");
      return;
    }
    setFieldError(null);
    setConfirmOpen(true);
  };

  const handleSubmit = () => {
    if (!request) return;
    setFieldError(null);
    mutation.mutate(
      {
        uuid: request.id,
        action: "shipped",
        payload: {
          courierName: courierName.trim(),
          trackingNumber: trackingNumber.trim(),
          shippingSlipUrl: slipUrl!,
          ...(shippedDate ? { shippedDate: new Date(shippedDate).toISOString() } : {}),
        },
      },
      {
        onSuccess: () => {
          toast.success("Courier details submitted successfully!");
          setConfirmOpen(false);
          onSuccess?.();
          onClose();
        },
        onError: (err: any) => {
          setConfirmOpen(false);
          const msg = err?.message || "Could not save shipping details.";
          setFieldError(msg);
          toast.error("Submission failed", msg);
        },
      }
    );
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        className="max-w-lg w-full p-5 sm:p-6"
      >
        <div className="space-y-4">
          {/* Header */}
          <div className="border-b border-neutral-100 pb-3 pr-8">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                <Truck className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-base font-bold text-neutral-900 tracking-tight">
                  Enter Courier Shipping Details
                </h3>
                <p className="text-xs text-neutral-500">
                  Notify the admin that you have dispatched the parcel
                </p>
              </div>
            </div>

            <div className="mt-2.5 flex items-center gap-2 flex-wrap">
              {request.returnNumber && (
                <div className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  Return ID: {request.returnNumber}
                </div>
              )}

              {shipDaysInfo && (
                <div
                  suppressHydrationWarning
                  className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-md border ${
                    shipDaysInfo.expired
                      ? "bg-red-50 text-red-700 border-red-200"
                      : shipDaysInfo.daysLeft <= 1
                      ? "bg-amber-50 text-amber-800 border-amber-300 animate-pulse"
                      : "bg-blue-50 text-blue-800 border-blue-200"
                  }`}
                  title={shipDaysInfo.deadline ? `Must courier by ${formatStoreDate(shipDaysInfo.deadline)}` : undefined}
                >
                  <Clock className="h-3.5 w-3.5" />
                  {shipDaysInfo.expired
                    ? "Shipping deadline passed"
                    : `${shipDaysInfo.daysLeft} ${shipDaysInfo.daysLeft === 1 ? "day" : "days"} left to ship${shipDaysInfo.deadline ? ` (by ${formatStoreDate(shipDaysInfo.deadline)})` : ""}`}
                </div>
              )}
            </div>
          </div>

          {/* Seller Return Instructions & Address */}
          {request.adminComment && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-950">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 shrink-0 text-amber-700 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-[11px] uppercase tracking-wide text-amber-900">
                    Seller Return Address & Instructions
                  </p>
                  <p className="text-neutral-800 whitespace-pre-line leading-relaxed text-xs">
                    {request.adminComment}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Form Fields */}
          <div className="space-y-3.5">
            {/* Courier Name */}
            <div>
              <label className="block text-xs font-semibold text-neutral-800 mb-1">
                Courier / Delivery Partner <span className="text-red-500">*</span>
              </label>
              <Input
                value={courierName}
                onChange={(e) => setCourierName(e.target.value)}
                placeholder="e.g. India Post, Delhivery, DTDC"
                className="text-xs"
              />
              {/* Quick courier chips */}
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {POPULAR_COURIERS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCourierName(c)}
                    className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors cursor-pointer ${
                      courierName === c
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-neutral-50 text-neutral-600 border-neutral-200 hover:bg-neutral-100"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Tracking Number */}
            <div>
              <label className="block text-xs font-semibold text-neutral-800 mb-1">
                Tracking / AWB Number <span className="text-red-500">*</span>
              </label>
              <Input
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="e.g. AW123456789IN"
                className="text-xs font-mono"
              />
            </div>

            {/* Shipped Date */}
            <div>
              <label className="block text-xs font-semibold text-neutral-800 mb-1">
                Shipped on Date
              </label>
              <Input
                type="date"
                value={shippedDate}
                onChange={(e) => setShippedDate(e.target.value)}
                className="text-xs"
              />
            </div>

            {/* Courier Slip Photo Upload */}
            <div>
              <label className="block text-xs font-semibold text-neutral-800 mb-1">
                Courier / Delivery Receipt Slip Photo <span className="text-red-500">*</span>
              </label>
              <p className="text-[11px] text-neutral-500 mb-2">
                Upload a clear photo of the receipt/slip given by the courier. This proves the package was sent.
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept={SHIPPING_SLIP_MIME_TYPES.join(",")}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleUploadSlip(file);
                }}
              />

              {slipUrl ? (
                <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50/60 p-2.5">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-white">
                    <Image
                      src={slipUrl}
                      alt="Courier Slip Receipt"
                      fill
                      sizes="56px"
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-emerald-800 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Slip Photo Attached
                    </p>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs text-blue-600 hover:underline mt-0.5 cursor-pointer block"
                    >
                      Change photo
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSlipUrl(null)}
                    aria-label="Remove slip photo"
                    className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isUploadingSlip}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-dashed border-2 py-5 rounded-xl flex items-center justify-center gap-2 cursor-pointer text-xs"
                >
                  {isUploadingSlip ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                      <span>Uploading slip photo...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 text-neutral-500" />
                      <span>Upload Courier Slip Photo</span>
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Validation Error Banner */}
          {fieldError && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
              <span>{fieldError}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-neutral-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={mutation.isPending || isUploadingSlip}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={mutation.isPending || isUploadingSlip}
              onClick={handleValidateAndConfirm}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold gap-1.5 cursor-pointer"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <PackageCheck className="h-3.5 w-3.5" />
                  Save Shipping Details
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleSubmit}
        title="Submit Courier Shipping Details?"
        description={`Courier: ${courierName.trim()} · Tracking: ${trackingNumber.trim()}${
          shippedDate ? ` · Dispatched: ${formatStoreDate(new Date(shippedDate))}` : ""
        }. Please ensure the tracking ID and slip photo are accurate, as they will be sent to the seller for verification.`}
        confirmText="Yes, Submit Details"
        cancelText="Review Again"
        variant="default"
        isLoading={mutation.isPending}
      />
    </>
  );
}

