"use client";

import { Modal } from "@/components/ui/modal";
import { useAdminObject } from "../../hooks/use-admin-agents";
import { StatusBadge, dateTime, humanize } from "../shared";

interface AuditEntry {
  id: string;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  actorRole: string | null;
  note: string | null;
  createdAt: string;
}

interface Props {
  type: "commission" | "payout";
  id: string | null;
  title: string;
  onClose: () => void;
}

export function AuditModal({ type, id, title, onClose }: Props) {
  const { data, isLoading, error } = useAdminObject<AuditEntry[]>(
    `audit-${type}`,
    `/api/admin/commissions/audit?type=${type}&id=${encodeURIComponent(id ?? "")}`,
    Boolean(id)
  );

  return (
    <Modal open={Boolean(id)} onClose={onClose} title={title} description="Every action on this record, oldest first.">
      <div className="max-h-[60vh] overflow-y-auto">
        {isLoading && <p className="py-6 text-center text-sm text-neutral-500">Loading…</p>}
        {error && <p className="py-6 text-center text-sm text-red-600">Could not load the history.</p>}
        {data && data.length === 0 && <p className="py-6 text-center text-sm text-neutral-500">No history recorded.</p>}
        <ol className="flex flex-col gap-3">
          {data?.map((e) => (
            <li key={e.id} className="rounded-xl border border-neutral-200 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-neutral-900">{humanize(e.action)}</span>
                <span className="text-xs text-neutral-500">{dateTime(e.createdAt)}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-600">
                {e.fromStatus && e.toStatus && e.fromStatus !== e.toStatus && (
                  <>
                    <StatusBadge status={e.fromStatus} /> → <StatusBadge status={e.toStatus} />
                  </>
                )}
                {e.actorRole && <span>by {e.actorRole.toLowerCase()}</span>}
              </div>
              {e.note && <p className="mt-1 text-xs text-neutral-500">{e.note}</p>}
            </li>
          ))}
        </ol>
      </div>
    </Modal>
  );
}
