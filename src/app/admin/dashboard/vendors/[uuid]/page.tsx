"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowLeft, Pencil, Plus, Power } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTableSkeleton } from "@/components/admin/AdminTableSkeleton";
import { DataTable } from "@/components/admin/data-table/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { FormModal } from "@/components/common/FormModal";
import { VendorForm } from "@/features/purchases/components/VendorForm";
import { PurchaseStatusBadge } from "@/features/purchases/components/PurchaseStatusBadge";
import {
  usePurchaseOrder,
  usePurchaseOrders,
  useVendor,
  useVendorMutations,
} from "@/features/purchases/hooks";
import { formatDate } from "@/lib/utils";
import type { PurchaseOrderResponse } from "@/features/purchases/types";

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
      <p className="text-sm text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function PurchaseDetailModal({ uuid, onClose }: { uuid: string | null; onClose: () => void }) {
  const { data: po, isLoading, error } = usePurchaseOrder(uuid);
  return (
    <FormModal
      open={!!uuid}
      onClose={onClose}
      title={po ? po.poNumber : "Purchase details"}
      description={po ? `${po.vendor.name}${po.invoiceNumber ? ` · Invoice ${po.invoiceNumber}` : ""}` : undefined}
      size="xl"
    >
      {isLoading && <Skeleton className="h-40" />}
      {error && <p className="text-sm text-red-600">Could not load this purchase.</p>}
      {po && (
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <PurchaseStatusBadge status={po.status} />
            <span>Purchase date: {po.purchaseDate ? formatDate(po.purchaseDate) : "—"}</span>
            <span>Invoice: {po.invoiceNumber ?? "—"}</span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-neutral-200">
            <table className="w-full">
              <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
                <tr>
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2">Colour</th>
                  <th className="px-3 py-2">Size</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Price</th>
                  <th className="px-3 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {po.items?.map((i) => (
                  <tr key={i.id} className="border-t border-neutral-100">
                    <td className="px-3 py-2">
                      <p className="font-medium">{i.productName}</p>
                      <p className="text-xs text-neutral-500">{i.sku}</p>
                    </td>
                    <td className="px-3 py-2">{i.colorName ?? "—"}</td>
                    <td className="px-3 py-2">{i.sizeName ?? i.unitName ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {i.quantityOrdered}
                      {i.quantityReceived > 0 && (
                        <span className="block text-xs text-neutral-500">{i.quantityReceived} received</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{inr(i.unitCost)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{inr(i.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-neutral-200 bg-neutral-50">
                <tr>
                  <td colSpan={5} className="px-3 py-1.5 text-right">Subtotal</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{inr(po.subtotal)}</td>
                </tr>
                <tr>
                  <td colSpan={5} className="px-3 py-1.5 text-right">Additional charges</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{inr(po.additionalCharges)}</td>
                </tr>
                <tr className="font-semibold">
                  <td colSpan={5} className="px-3 py-2 text-right">Total</td>
                  <td className="px-3 py-2 text-right tabular-nums">{inr(po.totalAmount)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          {po.notes && <p className="text-neutral-600">{po.notes}</p>}
          <div className="flex justify-end">
            <Link href={`/admin/dashboard/purchase-orders/${po.id}`}>
              <Button variant="outline" className="rounded-xl">Open full purchase</Button>
            </Link>
          </div>
        </div>
      )}
    </FormModal>
  );
}

export default function VendorDetailPage() {
  const { uuid } = useParams<{ uuid: string }>();
  const { data: vendor, isLoading, error, refetch } = useVendor(uuid);
  const { update } = useVendorMutations();
  const [page, setPage] = useState(1);
  const [editOpen, setEditOpen] = useState(false);
  const [toggleOpen, setToggleOpen] = useState(false);
  const [openPurchase, setOpenPurchase] = useState<string | null>(null);

  const purchases = usePurchaseOrders({ vendorId: uuid, page, pageSize: 10 });

  const columns: ColumnDef<PurchaseOrderResponse>[] = [
    {
      accessorKey: "poNumber",
      header: "Purchase",
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => setOpenPurchase(row.original.id)}
          className="font-semibold text-secondary-700 hover:underline"
        >
          {row.original.poNumber}
        </button>
      ),
    },
    {
      id: "date",
      header: "Date",
      cell: ({ row }) => (
        <span className="text-sm">
          {formatDate(row.original.purchaseDate ?? row.original.createdAt)}
        </span>
      ),
    },
    { id: "invoice", header: "Invoice", cell: ({ row }) => row.original.invoiceNumber ?? "—" },
    { id: "items", header: "Items", cell: ({ row }) => row.original.itemCount },
    {
      id: "total",
      header: "Amount",
      cell: ({ row }) => <span className="font-medium tabular-nums">{inr(row.original.totalAmount)}</span>,
    },
    { id: "status", header: "Status", cell: ({ row }) => <PurchaseStatusBadge status={row.original.status} /> },
  ];

  if (isLoading) return <AdminTableSkeleton />;
  if (error || !vendor) return <ErrorState message="Failed to load vendor" onRetry={() => refetch()} />;

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-auto">
      <AdminPageHeader
        title={vendor.name}
        description={`${vendor.code} · Purchase history and details`}
        breadcrumbs={
          <Link
            href="/admin/dashboard/vendors"
            className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-800"
          >
            <ArrowLeft className="h-4 w-4" /> Vendors
          </Link>
        }
        actions={
          <>
            <Button variant="outline" className="h-11 rounded-xl" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" /> Edit
            </Button>
            <Button variant="outline" className="h-11 rounded-xl" onClick={() => setToggleOpen(true)}>
              <Power className="mr-2 h-4 w-4" /> {vendor.isActive ? "Disable" : "Enable"}
            </Button>
            <Link href="/admin/dashboard/purchase-orders/new">
              <Button className="h-11 rounded-xl bg-[var(--color-primary-500)] text-white hover:bg-[var(--color-primary-600)]">
                <Plus className="mr-2 h-4 w-4" /> New purchase
              </Button>
            </Link>
          </>
        }
      />

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Total purchases" value={String(vendor.stats.totalPurchases)} />
        <Stat label="Total purchase amount" value={inr(vendor.stats.totalPurchaseAmount)} />
        <Stat
          label="Last purchase date"
          value={vendor.stats.lastPurchaseDate ? formatDate(vendor.stats.lastPurchaseDate) : "—"}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="rounded-2xl border border-neutral-200 bg-white p-5 text-sm xl:col-span-1">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Vendor details</h2>
            <Badge variant={vendor.isActive ? "success" : "outline"}>{vendor.isActive ? "Active" : "Disabled"}</Badge>
          </div>
          <dl className="space-y-2.5">
            {(
              [
                ["Contact person", vendor.contactPerson],
                ["Phone", vendor.phone],
                ["Email", vendor.email],
                ["GST number", vendor.gstin],
                ["Address", vendor.address],
                ["Added on", formatDate(vendor.createdAt)],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="text-neutral-500">{k}</dt>
                <dd className="text-right">{v || "—"}</dd>
              </div>
            ))}
          </dl>
          {vendor.notes && <p className="mt-3 border-t border-neutral-100 pt-3 text-neutral-700">{vendor.notes}</p>}
        </section>

        <section className="xl:col-span-2">
          <h2 className="mb-3 font-semibold">Purchase history</h2>
          {purchases.isLoading && !purchases.data ? (
            <AdminTableSkeleton />
          ) : (
            <DataTable
              columns={columns}
              data={purchases.data?.data ?? []}
              emptyMessage="No purchases from this vendor yet"
              pageSize={10}
              page={purchases.data?.meta?.page ?? page}
              totalPages={purchases.data?.meta?.totalPages ?? 1}
              totalItems={purchases.data?.meta?.total ?? 0}
              onPageChange={setPage}
              className="bg-white"
            />
          )}
        </section>
      </div>

      <FormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Update Vendor"
        description="Update supplier details"
        size="lg"
      >
        <VendorForm
          initial={vendor}
          submitLabel="Update Vendor"
          isLoading={update.isPending}
          onSubmit={async (form) => {
            await update.mutateAsync({ uuid, data: { ...form } });
            setEditOpen(false);
          }}
        />
      </FormModal>

      <ConfirmDialog
        open={toggleOpen}
        onClose={() => setToggleOpen(false)}
        onConfirm={() =>
          update.mutate({ uuid, data: { isActive: !vendor.isActive } }, { onSuccess: () => setToggleOpen(false) })
        }
        title={vendor.isActive ? "Disable Vendor" : "Enable Vendor"}
        description={
          vendor.isActive
            ? `${vendor.name} will no longer be selectable for new purchases. Past purchases are kept.`
            : `${vendor.name} will be available for new purchases again.`
        }
        confirmText={vendor.isActive ? "Disable" : "Enable"}
        variant={vendor.isActive ? "destructive" : "default"}
        isLoading={update.isPending}
      />

      <PurchaseDetailModal uuid={openPurchase} onClose={() => setOpenPurchase(null)} />
    </div>
  );
}
