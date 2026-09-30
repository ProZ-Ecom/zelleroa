import type { Prisma } from "@/generated/prisma";
import { db } from "@/lib/db/prisma";
import type { AuditActor } from "../constants";

type Client = Prisma.TransactionClient | typeof db;

export interface AuditEntry {
  entityType: "commission" | "payout" | "assignment" | "rate" | "agent";
  entityId: bigint;
  agentId?: bigint | null;
  action: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  actor: AuditActor;
  note?: string | null;
  metadata?: Prisma.InputJsonValue;
}

/** Append-only audit trail for every commission / payout / assignment / rate action. */
export async function writeAudit(client: Client, entry: AuditEntry) {
  await client.commission_audit_logs.create({
    data: {
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      agent_id: entry.agentId ?? null,
      action: entry.action,
      from_status: entry.fromStatus ?? null,
      to_status: entry.toStatus ?? null,
      actor_id: entry.actor.id,
      actor_role: entry.actor.role,
      note: entry.note ? entry.note.slice(0, 500) : null,
      metadata: entry.metadata,
    },
  });
}
