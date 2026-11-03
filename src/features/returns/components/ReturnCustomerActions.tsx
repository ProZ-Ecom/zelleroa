"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { AlertCircle, Loader2, PackageCheck, Truck, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/Toast";
import { returnsApi } from "../api/returns.api";
import {
  formatStoreDate,
  RETURN_SHIP_WINDOW_DAYS,
  SHIPPING_SLIP_MAX_BYTES,
  SHIPPING_SLIP_MIME_TYPES,
} from "../lib/policy";
import { useCustomerReturnAction } from "../hooks/use-returns";
import type { RequestSummary } from "../lib/summary";

const CANCELLABLE = ["return_requested", "under_review", "approved"];

/**
 * The two steps the customer owns on a return: entering the courier and
 * tracking number once they have posted the parcel, and cancelling while it has
 * not shipped yet. Anything else is the admin's to move.
 */
export function ReturnCustomerActions({ req }: { req: RequestSummary }) {
  const mutation = useCustomerReturnAction();
  const [mode, setMode] = useState<"ship" | "cancel" | null>(null);
  const [courierName, setCourierName] = useState(req.courierName ?? "");
  const [trackingNumber, setTrackingNumber] = useState(req.trackingNumber ?? "");
  const [shippedDate, setShippedDate] = useState("");
  const [cancellationReason, setCancellationReason] = useState("");
  const [slipUrl, setSlipUrl] = useState<string | null>(req.shippingSlipUrl ?? null);
  const [isUploadingSlip, setIsUploadingSlip] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const slipInputRef = useRef<HTMLInputElement>(null);

  const canShip = req.status === "approved";
  const canCancel = CANCELLABLE.includes(req.status);
  if (!canShip && !canCancel) return null;

  const deadline = req.shipDeadlineAt ? new Date(req.shipDeadlineAt) : null;

  const uploadSlip = async (file: File) => {
    if (file.size > SHIPPING_SLIP_MAX_BYTES) {
      setFieldError(
        `Photo is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum is ${SHIPPING_SLIP_MAX_BYTES / (1024 * 1024)} MB.`
      );
      return;
    }
    if (!(SHIPPING_SLIP_MIME_TYPES as readonly string[]).includes(file.type.toLowerCase())) {
      setFieldError("Please upload a JPG, PNG or WebP photo.");
      return;
    }
    setIsUploadingSlip(true);
    try {
      const saved = await returnsApi.uploadShippingSlip(file);
      setSlipUrl(saved.url);
      setFieldError(null);
      toast.success("Delivery slip uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not upload the photo");
    } finally {
      setIsUploadingSlip(false);
      if (slipInputRef.current) slipInputRef.current.value = "";
    }
  };

  const submit = () => {
    if (!mode) return;
    if (mode === "ship") {
      if (courierName.trim().length < 2) {
        setFieldError("Please enter the courier or delivery partner name.");
        return;
      }
      if (trackingNumber.trim().length < 3) {
        setFieldError("Please enter the tracking / AWB number.");
        return;
      }
      if (!slipUrl) {
        setFieldError("A photo of the courier / delivery slip is mandatory.");
        return;
      }
    }
    setFieldError(null);
    mutation.mutate(
      {
        uuid: req.id,
        action: mode === "ship" ? "shipped" : "cancel",
        payload:
          mode === "ship"
            ? {
                courierName: courierName.trim(),
                trackingNumber: trackingNumber.trim(),
                shippingSlipUrl: slipUrl!,
                ...(shippedDate ? { shippedDate: new Date(shippedDate).toISOString() } : {}),
              }
            : {
                ...(cancellationReason.trim()
                  ? { cancellationReason: cancellationReason.trim() }
                  : {}),
              },
      },
      {
        onSuccess: () => {
          toast.success(
            mode === "ship" ? "Tracking details saved" : "Return request cancelled"
          );
          setMode(null);
        },
        onError: (err: Error) => toast.error(err.message || "Could not update the request"),
      }
    );
  };

  return (
    <div className="space-y-3">
      {canShip && !mode && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-950">
          <div className="flex items-start gap-2.5">
            <Truck className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <div className="min-w-0 space-y-2">
              <div>
                <p className="text-[13px] font-bold">What you need to do now</p>
                <ol className="mt-1 space-y-0.5 text-amber-900">
                  <li>1. Pack the item and courier it to the address below.</li>
                  <li>2. Keep the slip the courier gives you and take a clear photo of it.</li>
                  <li>
                    3. Tap <span className="font-semibold">I have shipped the item</span> and enter
                    the courier, tracking number and slip photo.
                  </li>
                </ol>
              </div>
              <p className="text-[11px] text-amber-800">
                Any courier is fine. Requests not shipped within {RETURN_SHIP_WINDOW_DAYS} days of
                approval
                {deadline ? ` (by ${formatStoreDate(deadline)})` : ""} are closed automatically.
              </p>
              {req.adminComment && (
                <div className="rounded-lg border border-amber-200 bg-white/90 p-2.5 text-[11px] text-neutral-800">
                  <p className="font-bold uppercase tracking-wide text-amber-900">
                    Return address &amp; instructions
                  </p>
                  <p className="mt-0.5 whitespace-pre-line leading-relaxed">{req.adminComment}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {mode === "ship" && (
        <div className="space-y-2.5 rounded-xl border border-sky-200 bg-sky-50/70 p-3.5">
          <p className="text-xs font-bold uppercase tracking-wide text-sky-950">
            Shipping details
          </p>
          <div className="grid gap-2.5 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-sky-900">
                Courier / Partner *
              </label>
              <Input
                value={courierName}
                onChange={(e) => setCourierName(e.target.value)}
                placeholder="e.g. Delhivery, India Post"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-sky-900">
                Tracking / AWB No *
              </label>
              <Input
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="Tracking number"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-sky-900">
                Shipped on
              </label>
              <Input
                type="date"
                value={shippedDate}
                onChange={(e) => setShippedDate(e.target.value)}
              />
            </div>
          </div>

          <div className="border-t border-sky-200 pt-2.5">
            <label className="mb-1 block text-[11px] font-semibold text-sky-900">
              Courier / Delivery Slip Photo *
            </label>
            <p className="mb-2 text-[11px] text-sky-800">
              Upload a clear photo of the slip the courier gave you. This is our proof that the
              parcel was posted, so it is mandatory.
            </p>
            <input
              ref={slipInputRef}
              type="file"
              accept={SHIPPING_SLIP_MIME_TYPES.join(",")}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadSlip(file);
              }}
            />
            {slipUrl ? (
              <div className="flex items-center gap-2.5 rounded-lg border border-sky-200 bg-white p-2">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded border border-neutral-200 bg-neutral-100">
                  <Image
                    src={slipUrl}
                    alt="Delivery slip"
                    fill
                    sizes="48px"
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-emerald-800">Slip photo attached</p>
                  <button
                    type="button"
                    className="text-[11px] text-sky-700 underline cursor-pointer"
                    onClick={() => slipInputRef.current?.click()}
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
                disabled={isUploadingSlip}
                onClick={() => slipInputRef.current?.click()}
              >
                {isUploadingSlip ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                )}
                {isUploadingSlip ? "Uploading…" : "Upload slip photo"}
              </Button>
            )}
          </div>
        </div>
      )}

      {mode === "cancel" && (
        <div className="space-y-2.5 rounded-xl border border-red-200 bg-red-50/70 p-3.5">
          <p className="text-xs font-bold uppercase tracking-wide text-red-900">
            Cancel this return request?
          </p>
          <p className="text-[11px] text-red-800">
            The item stays with you. You can raise a new request later, as long as the return
            window is still open.
          </p>
          <Textarea
            rows={2}
            value={cancellationReason}
            onChange={(e) => setCancellationReason(e.target.value)}
            placeholder="Reason (optional)"
          />
        </div>
      )}

      {fieldError && (
        <p className="flex items-center gap-1.5 text-xs font-semibold text-red-700">
          <AlertCircle className="h-3.5 w-3.5" /> {fieldError}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {mode ? (
          <>
            <Button
              size="sm"
              disabled={
                mutation.isPending ||
                isUploadingSlip ||
                (mode === "ship" && !slipUrl)
              }
              className={mode === "cancel" ? "bg-red-600 text-white hover:bg-red-700" : ""}
              onClick={submit}
            >
              {mutation.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {mode === "ship" ? "Save tracking details" : "Yes, cancel request"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => {
                setMode(null);
                setFieldError(null);
              }}
            >
              Back
            </Button>
          </>
        ) : (
          <>
            {canShip && (
              <Button size="sm" onClick={() => setMode("ship")}>
                <PackageCheck className="mr-1.5 h-3.5 w-3.5" /> I have shipped the item
              </Button>
            )}
            {canCancel && (
              <Button
                size="sm"
                variant="outline"
                className="border-red-200 text-red-700 hover:bg-red-50"
                onClick={() => setMode("cancel")}
              >
                <X className="mr-1.5 h-3.5 w-3.5" /> Cancel request
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
