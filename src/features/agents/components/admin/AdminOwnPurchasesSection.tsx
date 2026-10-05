"use client";

import { useState } from "react";
import type { OwnPurchaseRow } from "../../services/agent.service";
import { errorMessage, useAdminList } from "../../hooks/use-admin-agents";
import { ButtonPager, Panel, SimpleTable, StatusBadge, TableSkeleton, dateOnly, money } from "../shared";

/** Orders the Sales Partner bought for themselves. These never earn commission - referral orders live in their own tab. */
export function AdminOwnPurchasesSection({ agentId }: { agentId: string }) {
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useAdminList<OwnPurchaseRow>("own-purchases", `/api/admin/agents/${agentId}/purchases`, { page, limit: 20 });

  return (
    <Panel title="Own purchases (no commission)">
      {error ? (
        <p className="px-5 py-10 text-center text-sm text-red-600">{errorMessage(error)}</p>
      ) : isLoading ? (
        <TableSkeleton />
      ) : (
        <>
          <SimpleTable
            rows={data?.data ?? []}
            rowKey={(r) => r.id}
            empty="This Sales Partner has not purchased anything for themselves."
            columns={[
              {
                header: "Order",
                cell: (r) => <span className="font-mono text-xs">{r.orderNumber}</span>,
              },
              { header: "Date", cell: (r) => dateOnly(r.orderDate) },
              { header: "Total", cell: (r) => <strong>{money(r.total)}</strong> },
              { header: "Order status", cell: (r) => <StatusBadge status={r.orderStatus} /> },
              { header: "Payment", cell: (r) => <StatusBadge status={r.paymentStatus} /> },
            ]}
          />
          <ButtonPager page={page} totalPages={data?.meta.totalPages ?? 1} total={data?.meta.total ?? 0} onPage={setPage} />
        </>
      )}
    </Panel>
  );
}
