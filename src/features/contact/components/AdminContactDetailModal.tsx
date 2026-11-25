"use client";

import * as React from "react";
import {
  Mail,
  Phone,
  User,
  Calendar,
  Clock,
  Send,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { FormModal } from "@/components/common/FormModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useAdminContactMessageDetail,
  useUpdateContactMessageStatus,
  useReplyContactMessage,
} from "../hooks";
import type {
  AdminContactMessageListItem,
  ContactMessageResponse,
  ContactMessageStatus,
} from "../types";
import { formatPhone } from "@/lib/utils/format-phone";

interface AdminContactDetailModalProps {
  contact: AdminContactMessageListItem | null;
  open: boolean;
  onClose: () => void;
  onOpenReply?: (contact: AdminContactMessageListItem) => void;
}

export function AdminContactDetailModal({
  contact,
  open,
  onClose,
  onOpenReply,
}: AdminContactDetailModalProps) {
  const [inlineReplyOpen, setInlineReplyOpen] = React.useState(false);
  const [replyText, setReplyText] = React.useState("");

  const uuid = contact?.id || null;

  // Query detail if open
  const { data: detailData, isLoading } = useAdminContactMessageDetail(
    open ? uuid : null
  );

  const { mutate: updateStatus, isPending: isUpdatingStatus } =
    useUpdateContactMessageStatus();
  const { mutate: sendReply, isPending: isSendingReply } =
    useReplyContactMessage();

  const item = detailData || contact;

  React.useEffect(() => {
    if (!open) {
      setInlineReplyOpen(false);
      setReplyText("");
    }
  }, [open]);

  if (!item) return null;

  const currentStatus = item.status;

  const handleStatusChange = (newStatus: ContactMessageStatus) => {
    if (!item.id || newStatus === currentStatus) return;
    updateStatus({ uuid: item.id, status: newStatus });
  };

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!item.id || !replyText.trim()) return;

    sendReply(
      {
        uuid: item.id,
        message: replyText.trim(),
      },
      {
        onSuccess: () => {
          setInlineReplyOpen(false);
          setReplyText("");
        },
      }
    );
  };

  const getStatusBadge = (status: ContactMessageStatus) => {
    switch (status) {
      case "new":
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-200 gap-1 text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            New
          </Badge>
        );
      case "read":
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-200 gap-1 text-xs">
            <CheckCircle2 className="h-3 w-3 text-blue-600" />
            Read
          </Badge>
        );
      case "replied":
        return (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 gap-1 text-xs">
            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            Replied
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
      title="Contact Message Details"
      description="View full inquiry details and reply directly to the customer"
      size="lg"
    >
      <div className="space-y-5">
        {/* Header Summary Card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-neutral-50 border border-neutral-200">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="h-12 w-12 rounded-full bg-secondary-100 border border-secondary-200 flex items-center justify-center text-secondary-700 font-bold text-lg shrink-0">
              {item.name?.charAt(0)?.toUpperCase() || "C"}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-neutral-900 text-base leading-tight truncate">
                  {item.name || "Anonymous Sender"}
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

          {/* Quick Status Toggle Buttons */}
          <div className="flex items-center gap-1.5 self-start sm:self-auto bg-white p-1 rounded-lg border border-neutral-200">
            <span className="text-[10px] font-mono uppercase font-semibold text-neutral-400 px-1.5">
              Status:
            </span>
            {(["new", "read", "replied"] as ContactMessageStatus[]).map((st) => (
              <button
                key={st}
                type="button"
                disabled={isUpdatingStatus}
                onClick={() => handleStatusChange(st)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md capitalize transition-all cursor-pointer ${
                  currentStatus === st
                    ? "bg-secondary-600 text-white shadow-xs"
                    : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Sender Contact Information */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-sm">
          {/* Email */}
          <div className="p-3.5 rounded-xl border border-neutral-200 bg-white space-y-1">
            <p className="text-xs font-mono font-medium uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-neutral-400" />
              Email Address
            </p>
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <span className="font-medium text-neutral-900 text-sm break-all">
                {item.email || "—"}
              </span>
              {item.email && (
                <a
                  href={`mailto:${item.email}?subject=${encodeURIComponent(
                    `Re: ${item.subject || "Your Inquiry at Zellora"}`
                  )}`}
                  className="text-secondary-600 hover:text-secondary-700 p-1 hover:bg-secondary-50 rounded text-xs inline-flex items-center gap-1 font-semibold shrink-0"
                  title="Open Mail Client"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </div>

          {/* Phone */}
          <div className="p-3.5 rounded-xl border border-neutral-200 bg-white space-y-1">
            <p className="text-xs font-mono font-medium uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-neutral-400" />
              Phone Number
            </p>
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <span className="font-medium text-neutral-900 text-sm font-mono">
                {formatPhone(item.phone)}
              </span>
              {item.phone && (
                <a
                  href={`tel:${item.phone}`}
                  className="text-secondary-600 hover:text-secondary-700 p-1 hover:bg-secondary-50 rounded text-xs inline-flex items-center gap-1 font-semibold shrink-0"
                  title="Call Customer"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Message Subject & Body Card */}
        <div className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-5 space-y-3">
          <div>
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-neutral-400">
              Subject
            </span>
            <h4 className="text-base font-bold text-neutral-900 mt-0.5 leading-snug">
              {item.subject || "No Subject Provided"}
            </h4>
          </div>

          <div className="border-t border-neutral-100 pt-3">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-neutral-400">
              Message Content
            </span>
            <div className="mt-2 p-3.5 rounded-xl bg-neutral-50 border border-neutral-200/80 text-sm text-neutral-800 whitespace-pre-wrap leading-relaxed">
              {item.message || "—"}
            </div>
          </div>
        </div>

        {/* Inline Email Reply Section */}
        {inlineReplyOpen ? (
          <form
            onSubmit={handleSendReply}
            className="rounded-xl border border-secondary-200 bg-secondary-50/40 p-4 sm:p-5 space-y-3.5 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-md bg-secondary-100 text-secondary-700">
                  <Send className="h-3.5 w-3.5" />
                </div>
                <h4 className="text-sm font-bold text-neutral-900">
                  Reply to {item.name} ({item.email})
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setInlineReplyOpen(false)}
                className="text-xs text-neutral-500 hover:text-neutral-800 font-semibold cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <div>
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder={`Type your reply to ${item.name} here...`}
                rows={5}
                required
                className="w-full rounded-xl border border-neutral-300 bg-white p-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-hidden focus:border-secondary-600 focus:ring-2 focus:ring-secondary-600/20"
              />
              <div className="flex items-center justify-between text-xs text-neutral-400 mt-1">
                <span>An official email will be delivered to {item.email}</span>
                <span>{replyText.length} chars</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setInlineReplyOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSendingReply || !replyText.trim()}
                className="bg-secondary-600 hover:bg-secondary-700 text-white gap-1.5"
              >
                <Send className="h-3.5 w-3.5" />
                {isSendingReply ? "Sending Email..." : "Send Reply Email"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <p className="text-xs text-neutral-500">
              Need to respond to this customer? Click below to send an email reply.
            </p>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                className="flex-1 sm:flex-initial"
              >
                Close
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  if (onOpenReply) {
                    onOpenReply(item);
                  } else {
                    setInlineReplyOpen(true);
                  }
                }}
                className="flex-1 sm:flex-initial bg-secondary-600 hover:bg-secondary-700 text-white gap-1.5"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Reply via Email</span>
              </Button>
            </div>
          </div>
        )}
      </div>
    </FormModal>
  );
}
