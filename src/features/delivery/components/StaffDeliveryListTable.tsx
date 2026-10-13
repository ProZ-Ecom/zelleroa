"use client";

import { useState, useMemo } from "react";
import { ColumnDef } from "@tanstack/react-table";
import {
  Eye,
  Truck,
  CheckCircle2,
  Check,
  Phone,
  MessageSquare,
  Clock,
  RotateCcw,
  Loader2,
  MapPin,
  Calendar,
} from "lucide-react";
import { DataTable } from "@/components/admin/data-table/DataTable";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { formatDateTime, formatPrice } from "@/lib/utils";
import {
  useStaffDeliveries,
  useStaffDeliveriesCount,
  useAcceptDelivery,
  useMarkOutForDelivery,
} from "../hooks";
import { DeliveryStatusBadge, AssignmentStatusBadge } from "./DeliveryStatusBadge";
import { DeliveryStatsCards } from "./DeliveryStatsCards";
import { DeliveryStatusTabs } from "./DeliveryStatusTabs";
import { StaffDeliveryDetailModal } from "./StaffDeliveryDetailModal";
import { MarkDeliveredModal } from "./MarkDeliveredModal";
import type { StaffDeliveryListItem } from "../types/delivery.types";

interface StaffDeliveryListTableProps {
  initialStatus?: string;
}

export function StaffDeliveryListTable({
  initialStatus = "all",
}: StaffDeliveryListTableProps) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);

  const [viewShipmentId, setViewShipmentId] = useState<string | null>(null);
  const [deliverShipment, setDeliverShipment] = useState<{
    id: string;
    orderNumber: string;
    customerName: string;
  } | null>(null);

  const [timeScope, setTimeScope] = useState<"allTime" | "today">("today");

  // Map tab filter to backend status query
  const backendStatus =
    statusFilter === "all"
      ? undefined
      : (statusFilter as "pending" | "picked_up" | "in_transit" | "out_for_delivery" | "delivered" | "failed");

  const { data, isLoading, error, refetch, isFetching } = useStaffDeliveries({
    page,
    limit: pageSize,
    search: search.trim() || undefined,
    status: backendStatus,
    sortBy: "createdAt",
    sortOrder: "desc",
  });

  const { data: countData, isLoading: isCountLoading } = useStaffDeliveriesCount({
    search: search.trim() || undefined,
  });

  const acceptMutation = useAcceptDelivery();
  const outForDeliveryMutation = useMarkOutForDelivery();

  const deliveries = data?.data ?? [];
  const meta = data?.meta;

  const activeCounts =
    timeScope === "today" ? countData?.today : countData?.allTime;

  const tabCounts = {
    all: activeCounts?.total ?? (timeScope === "today" ? countData?.today.total ?? 0 : meta?.total ?? 0),
    pending: activeCounts?.pending ?? 0,
    in_transit: activeCounts?.in_transit ?? 0,
    out_for_delivery: activeCounts?.out_for_delivery ?? 0,
    delivered: activeCounts?.delivered ?? 0,
    failed: activeCounts?.failed ?? 0,
  };

  const isTodayDate = (dateInput: Date | string | null | undefined) => {
    if (!dateInput) return false;
    const d = new Date(dateInput);
    const today = new Date();
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  };

  const displayedDeliveries = useMemo(() => {
    if (timeScope === "today") {
      return deliveries.filter(
        (d) =>
          isTodayDate(d.createdAt) ||
          isTodayDate(d.order?.placedAt) ||
          isTodayDate(d.order?.createdAt) ||
          d.deliverySlot?.slotDate?.toLowerCase() === "today"
      );
    }
    return deliveries;
  }, [deliveries, timeScope]);

  const handleTabChange = (tabId: string) => {
    setStatusFilter(tabId);
    setPage(1);
  };

  const handleAccept = (uuid: string) => {
    acceptMutation.mutate(uuid, {
      onSuccess: () => refetch(),
    });
  };

  const handleOutForDelivery = (uuid: string) => {
    outForDeliveryMutation.mutate(uuid, {
      onSuccess: () => refetch(),
    });
  };

  const isTransitionPending =
    acceptMutation.isPending || outForDeliveryMutation.isPending;

  const columns: ColumnDef<StaffDeliveryListItem, unknown>[] = [
    {
      accessorKey: "order",
      header: "Order / Placed",
      cell: ({ row }) => {
        const order = row.original.order;
        return (
          <div className="leading-snug">
            <button
              type="button"
              onClick={() => setViewShipmentId(row.original.id)}
              className="text-left font-bold text-neutral-900 hover:text-secondary-600 transition-colors cursor-pointer"
            >
              #{order?.orderNumber || "—"}
            </button>
            <div className="text-[11px] text-neutral-400 font-mono">
              {formatDateTime(order?.placedAt || order?.createdAt || row.original.createdAt)}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "customer",
      header: "Customer & Phone",
      cell: ({ row }) => {
        const customer = row.original.customer;
        return (
          <div className="leading-snug max-w-[200px]">
            <div className="font-semibold text-neutral-900 truncate">
              {customer?.name || "Customer"}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-neutral-700 font-mono mt-0.5">
              <span>{customer?.phone || customer?.email || "—"}</span>
              {customer?.phone && (
                <a
                  href={`tel:${customer.phone}`}
                  className="text-emerald-700 hover:text-emerald-800 transition-colors"
                  title="Call customer"
                >
                  <Phone className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "shippingAddress",
      header: "Destination",
      cell: ({ row }) => {
        const addr = row.original.shippingAddress;
        if (!addr) return <span className="text-xs text-neutral-400">—</span>;

        return (
          <div className="leading-snug max-w-[220px]">
            <div className="text-xs font-medium text-neutral-900 truncate" title={addr.addressLine1}>
              {addr.addressLine1}
            </div>
            <div className="text-[11px] text-neutral-500 truncate">
              {addr.city}, {addr.pincode}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "deliverySlot",
      header: "Slot Time",
      cell: ({ row }) => {
        const slot = row.original.deliverySlot;
        if (!slot) {
          return (
            <span className="text-xs text-neutral-400 font-mono">Standard Delivery</span>
          );
        }

        return (
          <div className="leading-snug text-xs text-neutral-700">
            <div className="font-medium text-neutral-900">
              {slot.slotDate || "Today"}
            </div>
            <div className="text-[11px] text-neutral-500">
              {slot.startTime || "09:00"} - {slot.endTime || "21:00"}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "totalAmount",
      header: "Total",
      cell: ({ row }) => (
        <span className="font-bold text-neutral-900 tabular-nums text-sm">
          {formatPrice(row.original.order?.totalAmount ?? 0)}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Delivery Status",
      cell: ({ row }) => (
        <div className="space-y-1">
          <DeliveryStatusBadge status={row.original.status} />
          {row.original.assignmentStatus === "pending" && (
            <div>
              <AssignmentStatusBadge status="pending" />
            </div>
          )}
        </div>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const isPending =
          row.original.assignmentStatus === "pending" ||
          (!row.original.acceptedAt && row.original.status === "pending");

        const canMarkOutForDelivery =
          row.original.assignmentStatus === "accepted" &&
          row.original.status !== "out_for_delivery" &&
          row.original.status !== "delivered";

        const canMarkDelivered = row.original.status === "out_for_delivery";

        return (
          <div className="flex items-center justify-center gap-1.5">
            {/* Quick 1-click Accept */}
            {isPending && (
              <button
                type="button"
                onClick={() => handleAccept(row.original.id)}
                disabled={isTransitionPending}
                title="Accept Delivery"
                className="inline-flex items-center gap-1 h-8 w-8 justify-center rounded-lg border border-amber-300 bg-amber-50 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition-all cursor-pointer shadow-2xs"
              >
                <Check className="h-4 w-4" />
              </button>
            )}

            {/* Quick 1-click Out for Delivery */}
            {canMarkOutForDelivery && (
              <button
                type="button"
                onClick={() => handleOutForDelivery(row.original.id)}
                disabled={isTransitionPending}
                title="Mark Out for Delivery"
                className="inline-flex items-center gap-1 h-8 w-8 justify-center rounded-lg border border-indigo-300 bg-indigo-50 text-xs font-semibold text-indigo-800 hover:bg-indigo-100 transition-all cursor-pointer shadow-2xs"
              >
                <Truck className="h-4 w-4" />
              </button>
            )}

            {/* Quick 1-click Mark Delivered */}
            {canMarkDelivered && (
              <button
                type="button"
                onClick={() =>
                  setDeliverShipment({
                    id: row.original.id,
                    orderNumber: row.original.order?.orderNumber || "",
                    customerName: row.original.customer?.name || "",
                  })
                }
                title="Mark as Delivered"
                className="inline-flex items-center gap-1 h-8 w-8 justify-center rounded-lg border border-emerald-600 bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700 transition-all cursor-pointer shadow-xs"
              >
                <CheckCircle2 className="h-4 w-4" />
              </button>
            )}

            {/* View Full Details */}
            <button
              type="button"
              onClick={() => setViewShipmentId(row.original.id)}
              title="View Delivery Details"
              className="grid h-8 w-8 place-items-center rounded-lg border border-cream-border-subtle bg-white text-xs text-neutral-600 hover:bg-cream-200 hover:text-secondary-800 transition-colors cursor-pointer"
            >
              <Eye className="h-4 w-4" />
            </button>
          </div>
        );
      },
    },
  ];

  if (isLoading && !data) {
    return <LoadingState text="Loading staff deliveries..." />;
  }

  if (error) {
    return (
      <ErrorState
        message="Failed to load deliveries"
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col gap-3">
      {/* Stats Cards */}
      <DeliveryStatsCards
        items={displayedDeliveries}
        totalCount={activeCounts?.total ?? meta?.total}
        countData={countData}
        isLoading={isLoading || isCountLoading}
        scope={timeScope}
        onScopeChange={(newScope) => {
          setTimeScope(newScope);
          setPage(1);
        }}
      />

      {/* Tabs & Filter Toolbar */}
      <div className="mt-1 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <SearchInput
            placeholder="Search by order #, customer, phone, city..."
            value={search}
            onSearch={(val) => {
              setSearch(val.trim());
              setPage(1);
            }}
            className="w-full max-w-md bg-cream-50 border-cream-border-subtle"
          />

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-10 px-2.5 rounded-xl border-cream-border bg-white hover:bg-cream-100 cursor-pointer shrink-0"
            title="Refresh list"
          >
            <RotateCcw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          

          {/* Status Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto">
            <DeliveryStatusTabs
              activeTab={statusFilter}
              onTabChange={handleTabChange}
              counts={tabCounts}
            />
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col mt-1">
        <DataTable
          columns={columns}
          data={displayedDeliveries}
          pageSize={pageSize}
          pageSizeOptions={[10, 20, 30, 50]}
          page={meta?.page ?? page}
          totalPages={
            meta?.totalPages ??
            Math.max(1, Math.ceil((meta?.total ?? displayedDeliveries.length) / pageSize))
          }
          totalItems={
            timeScope === "today"
              ? (countData?.today.total ?? displayedDeliveries.length)
              : (meta?.total ?? deliveries.length)
          }
          onPageChange={setPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setPage(1);
          }}
          className="bg-white"
          emptyMessage={
            timeScope === "today"
              ? "No assigned deliveries scheduled or placed today."
              : "No assigned deliveries found for this filter."
          }
        />
      </div>

      {/* Delivery Detail Modal */}
      <StaffDeliveryDetailModal
        isOpen={Boolean(viewShipmentId)}
        onClose={() => setViewShipmentId(null)}
        shipmentId={viewShipmentId}
        onRefresh={() => refetch()}
      />

      {/* Mark Delivered Modal */}
      <MarkDeliveredModal
        isOpen={Boolean(deliverShipment)}
        onClose={() => setDeliverShipment(null)}
        shipmentId={deliverShipment?.id ?? null}
        orderNumber={deliverShipment?.orderNumber}
        customerName={deliverShipment?.customerName}
        onSuccess={() => refetch()}
      />
    </div>
  );
}
