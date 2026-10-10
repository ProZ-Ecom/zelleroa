"use client";

import { useState } from "react";
import { Eye, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatDateTime } from "@/lib/utils";
import {
  REPLACEMENT_STATUSES,
  RETURN_STATUSES,
  statusLabel,
} from "../lib/policy";
import { useAdminRequests, type RequestKind } from "../hooks/use-returns";
import { RequestStatusBadge } from "./RequestStatusBadge";
import { AdminRequestDetailModal } from "./AdminRequestDetailModal";

const PAGE_SIZE = 10;

export function AdminRequestsTable({ kind }: { kind: RequestKind }) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const statuses = kind === "returns" ? RETURN_STATUSES : REPLACEMENT_STATUSES;
  const { data, isLoading, isFetching, error, refetch } = useAdminRequests(kind, {
    page,
    limit: PAGE_SIZE,
    ...(status ? { status } : {}),
    ...(query ? { search: query } : {}),
  });

  const rows = data?.data ?? [];
  const meta = data?.meta;
  const isReturn = kind === "returns";

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQuery(search.trim());
        }}
      >
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search request, order, customer…"
            className="pl-9"
          />
        </div>
        <Select
          value={status || "all"}
          onValueChange={(v) => {
            setPage(1);
            setStatus(v === "all" ? "" : v);
          }}
          options={[
            { value: "all", label: "All statuses" },
            ...statuses.map((s) => ({ value: s, label: statusLabel(s) })),
          ]}
        />
        <Button type="submit" variant="outline" size="sm">
          Search
        </Button>
      </form>

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-cream-border-subtle bg-white">
        <table className="w-full min-w-[900px] text-left text-xs">
          <thead className="sticky top-0 bg-neutral-50 text-[11px] uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="px-3 py-2.5">Request</th>
              <th className="px-3 py-2.5">Order</th>
              <th className="px-3 py-2.5">Customer</th>
              <th className="px-3 py-2.5">Product</th>
              {isReturn ? (
                <th className="px-3 py-2.5">Qty</th>
              ) : (
                <th className="px-3 py-2.5">Variant → Requested</th>
              )}
              <th className="px-3 py-2.5">Reason</th>
              <th className="px-3 py-2.5">Requested</th>
              {isReturn && <th className="px-3 py-2.5">Deadline</th>}
              <th className="px-3 py-2.5">Status</th>
              <th className="sticky right-0 z-10 bg-neutral-50 px-3 py-2.5 text-center shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={10} className="px-3 py-3">
                    <div className="h-5 w-full rounded skeleton-shimmer" />
                  </td>
                </tr>
              ))}

            {!isLoading && error && (
              <tr>
                <td colSpan={10} className="px-3 py-10 text-center text-red-600">
                  {(error as Error).message || "Failed to load requests."}{" "}
                  <button className="underline" onClick={() => refetch()}>
                    Retry
                  </button>
                </td>
              </tr>
            )}

            {!isLoading && !error && rows.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-12 text-center text-neutral-500">
                  No {isReturn ? "return" : "replacement"} requests found.
                </td>
              </tr>
            )}

            {rows.map((r) => (
              <tr key={r.id} className="group hover:bg-neutral-50/70">
                <td className="px-3 py-2.5 font-mono text-[11px]">{r.id.slice(0, 8).toUpperCase()}</td>
                <td className="px-3 py-2.5 font-mono font-semibold">{r.orderNumber}</td>
                <td className="px-3 py-2.5">
                  <div className="font-semibold">{r.customer.name}</div>
                  <div className="text-neutral-500">{r.customer.phone || r.customer.email}</div>
                </td>
                <td className="px-3 py-2.5">
                  {r.items.map((i) => (
                    <div key={i.orderItemId}>
                      {i.productName}
                      <span className="text-neutral-500"> {[i.color, i.size].filter(Boolean).join(" / ")}</span>
                    </div>
                  ))}
                </td>
                <td className="px-3 py-2.5">
                  {isReturn
                    ? r.items.reduce((s, i) => s + i.quantity, 0)
                    : r.items.map((i) => (
                        <div key={i.orderItemId}>
                          {i.size ?? "—"} → <strong>{i.requestedSize ?? i.size ?? "—"}</strong>
                        </div>
                      ))}
                </td>
                <td className="px-3 py-2.5 max-w-[180px] truncate" title={r.reason}>
                  {r.reason}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">{formatDateTime(r.requestedAt)}</td>
                {isReturn && (
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {r.returnDeadline ? formatDateTime(r.returnDeadline) : "—"}
                  </td>
                )}
                <td className="px-3 py-2.5">
                  <RequestStatusBadge status={r.status} />
                </td>
                <td className="sticky right-0 z-10 bg-white px-3 py-2.5 text-center shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)] group-hover:bg-neutral-50">
                  <Button size="icon" variant="outline" title="View" aria-label="View" onClick={() => setOpenId(r.id)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-neutral-600">
          <span>
            Page {meta.page} of {meta.totalPages} · {meta.total} requests {isFetching ? "· updating…" : ""}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* keyed so pending-action state resets per request */}
      <AdminRequestDetailModal key={openId ?? "closed"} kind={kind} uuid={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
