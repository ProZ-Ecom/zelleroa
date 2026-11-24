"use client";

import * as React from "react";
import {
  Mail,
  Phone,
  Calendar,
  CheckCircle2,
  Building2,
  Package,
  Hash,
  ExternalLink,
} from "lucide-react";
import { FormModal } from "@/components/common/FormModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useAdminBulkOrderDetail,
  useUpdateBulkOrderStatus,
} from "../hooks";
import type { AdminBulkOrderListItem, BulkOrderEnquiryStatus } from "../types";
import { formatPhone } from "@/lib/utils/format-phone";

interface AdminBulkOrderDetailModalProps {
  enquiry: AdminBulkOrderListItem | null;
  open: boolean;
  onClose: () => void;
}

export function AdminBulkOrderDetailModal({
  enquiry,
  open,
  onClose,
}: AdminBulkOrderDetailModalProps) {
  const uuid = enquiry?.id || null;

  const { data: detailData } = useAdminBulkOrderDetail(open ? uuid : null);

  const { mutate: updateStatus, isPending: isUpdatingStatus } =
    useUpdateBulkOrderStatus();

  const item = detailData || enquiry;

  const [comment, setComment] = React.useState("");

  React.useEffect(() => {
    setComment(item?.adminComment ?? "");
  }, [item?.id, item?.adminComment]);

  if (!item) return null;

  const currentStatus = item.status;
  const isClosed = currentStatus === "closed";

  const handleSaveComment = () => {
    if (!item.id) return;
    updateStatus({
      uuid: item.id,
      status: currentStatus === "new" ? "contacted" : currentStatus,
      comment,
    });
  };

  const handleCloseEnquiry = () => {
    if (!item.id) return;
    updateStatus({ uuid: item.id, status: "closed", comment });
  };

  const getStatusBadge = (status: BulkOrderEnquiryStatus) => {
    switch (status) {
      case "new":
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-200 gap-1 text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            New
          </Badge>
        );
      case "contacted":
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-200 gap-1 text-xs">
            <CheckCircle2 className="h-3 w-3 text-blue-600" />
            Contacted
          </Badge>
        );
      case "closed":
        return (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 gap-1 text-xs">
            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            Closed
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formattedDate = item.createdAt
    ? new Date(item.createdAt).toLocaleDateString("en-IN", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title="Bulk Order Enquiry Details"
      description="View full enquiry details and track follow-up status"
      size="lg"
    >
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-neutral-50 border border-neutral-200">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="h-12 w-12 rounded-full bg-secondary-100 border border-secondary-200 flex items-center justify-center text-secondary-700 font-bold text-lg shrink-0">
              {item.name?.charAt(0)?.toUpperCase() || "C"}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-neutral-900 text-base leading-tight truncate">
                  {item.name}
                </h3>
                {getStatusBadge(currentStatus)}
              </div>
              <div className="flex items-center gap-3 text-xs text-neutral-500 pt-1 flex-wrap">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-neutral-400" />
                  {formattedDate}
                </span>
                <span className="font-mono text-[11px] text-neutral-400">
                  ID: {item.id.slice(0, 8)}...
                </span>
              </div>
            </div>
          </div>

        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-sm">
          <div className="p-3.5 rounded-xl border border-neutral-200 bg-white space-y-1">
            <p className="text-xs font-mono font-medium uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-neutral-400" />
              Email Address
            </p>
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <span className="font-medium text-neutral-900 text-sm break-all">
                {item.email}
              </span>
              <a
                href={`mailto:${item.email}?subject=${encodeURIComponent(
                  "Re: Your Bulk Order Enquiry - Zellora"
                )}`}
                className="text-secondary-600 hover:text-secondary-700 p-1 hover:bg-secondary-50 rounded text-xs inline-flex items-center gap-1 font-semibold shrink-0"
                title="Open Mail Client"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-neutral-200 bg-white space-y-1">
            <p className="text-xs font-mono font-medium uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-neutral-400" />
              Phone Number
            </p>
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <span className="font-medium text-neutral-900 text-sm font-mono">
                {formatPhone(item.phone)}
              </span>
              <a
                href={`tel:${item.phone}`}
                className="text-secondary-600 hover:text-secondary-700 p-1 hover:bg-secondary-50 rounded text-xs inline-flex items-center gap-1 font-semibold shrink-0"
                title="Call Customer"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          {item.companyName && (
            <div className="p-3.5 rounded-xl border border-neutral-200 bg-white space-y-1">
              <p className="text-xs font-mono font-medium uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-neutral-400" />
                Company / Business
              </p>
              <span className="font-medium text-neutral-900 text-sm">
                {item.companyName}
              </span>
            </div>
          )}

          <div className="p-3.5 rounded-xl border border-neutral-200 bg-white space-y-1">
            <p className="text-xs font-mono font-medium uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <Hash className="h-3.5 w-3.5 text-neutral-400" />
              Quantity Requested
            </p>
            <span className="font-medium text-neutral-900 text-sm">
              {item.quantity} units
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-5 space-y-3">
          <div>
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5 text-neutral-400" />
              Product Interest
            </span>
            <h4 className="text-base font-bold text-neutral-900 mt-0.5 leading-snug">
              {item.productInterest || "Not specified"}
            </h4>
          </div>

          {item.message && (
            <div className="border-t border-neutral-100 pt-3">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-neutral-400">
                Additional Requirements
              </span>
              <div className="mt-2 p-3.5 rounded-xl bg-neutral-50 border border-neutral-200/80 text-sm text-neutral-800 whitespace-pre-wrap leading-relaxed">
                {item.message}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-5 space-y-3">
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-neutral-400">
            Follow-up Comment
          </span>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add notes about the call/contact with this customer..."
            rows={4}
            disabled={isClosed}
            className="w-full rounded-xl border border-neutral-300 bg-white p-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-hidden focus:border-secondary-600 focus:ring-2 focus:ring-secondary-600/20 disabled:bg-neutral-50 disabled:text-neutral-500"
          />
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Dismiss
          </Button>
          <div className="flex items-center gap-2">
            {!isClosed && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isUpdatingStatus}
                onClick={handleSaveComment}
              >
                Save Comment
              </Button>
            )}
            {!isClosed && (
              <Button
                type="button"
                size="sm"
                disabled={isUpdatingStatus}
                onClick={handleCloseEnquiry}
                className="bg-secondary-600 hover:bg-secondary-700 text-white"
              >
                Close Enquiry
              </Button>
            )}
          </div>
        </div>
      </div>
    </FormModal>
  );
}
