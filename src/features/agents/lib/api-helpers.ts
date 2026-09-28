import type { Session } from "next-auth";
import { db } from "@/lib/db/prisma";
import { ApiError } from "@/lib/api/api-error";
import { agentService } from "../services/agent.service";
import type { AuditActor } from "../constants";

export type FilterMap = Record<string, string | undefined>;

/** Copies the whitelisted query-string keys, trimmed, dropping empties. */
export function readQuery(searchParams: URLSearchParams | undefined, keys: string[]): FilterMap {
  const out: FilterMap = {};
  for (const key of keys) {
    const value = searchParams?.get(key)?.trim();
    if (value) out[key] = value.slice(0, 100);
  }
  return out;
}

export function readPaging(searchParams: URLSearchParams | undefined) {
  const page = Number(searchParams?.get("page"));
  const limit = Number(searchParams?.get("limit") ?? searchParams?.get("pageSize"));
  return {
    page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
    limit: Number.isFinite(limit) && limit > 0 ? Math.min(100, Math.floor(limit)) : 20,
  };
}

/** The signed-in agent's internal id, derived from the session only - never from the request. */
export async function requireSessionAgent(session: Session | null | undefined) {
  const userId = (session?.user as { id?: string } | undefined)?.id;
  return agentService.requireAgentContext(userId);
}

/** Audit actor (internal id + role) for the signed-in admin/staff/customer. */
export async function resolveActor(session: Session | null | undefined): Promise<AuditActor> {
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) throw ApiError.unauthorized();
  const row = await db.user.findFirst({
    where: { OR: [{ uuid: user.id }, ...(/^\d+$/.test(user.id) ? [{ id: BigInt(user.id) }] : [])] },
    select: { id: true },
  });
  if (!row) throw ApiError.unauthorized();
  const role = (user.role ?? "USER").toUpperCase();
  return { id: row.id, role: (["ADMIN", "STAFF", "AGENT", "CUSTOMER"].includes(role) ? role : "USER") as AuditActor["role"] };
}
