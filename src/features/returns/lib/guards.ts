import { Prisma } from "@/generated/prisma";
import { db } from "@/lib/db/prisma";
import {
  REPLACEMENT_ACTIVE_STATUSES,
  RETURN_ACTIVE_STATUSES,
} from "./policy";

type Tx = Prisma.TransactionClient;

/**
 * Serialises request creation per order so two simultaneous submissions for
 * the same item can't both pass the duplicate check.
 */
export async function lockOrder(tx: Tx, orderId: bigint) {
  await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE`;
}

/**
 * A request "consumes" an item while it is in flight or completed. Rejected
 * requests (and the closed state they end in) free the item again.
 */
const consumingReturn = (orderItemIds: bigint[]): Prisma.return_itemsWhereInput => ({
  order_item_id: { in: orderItemIds },
  is_active: true,
  return_requests: {
    is_active: true,
    OR: [
      { status: { in: RETURN_ACTIVE_STATUSES } },
      { status: "closed", rejected_at: null },
    ],
  },
});

const consumingReplacement = (
  orderItemIds: bigint[]
): Prisma.replacement_request_itemsWhereInput => ({
  order_item_id: { in: orderItemIds },
  is_active: true,
  replacement_request: {
    is_active: true,
    OR: [
      { status: { in: REPLACEMENT_ACTIVE_STATUSES } },
      { status: "closed", rejected_at: null },
    ],
  },
});

export interface ItemConflict {
  orderItemId: bigint;
  kind: "return" | "replacement";
  status: string;
}

/** Order items that already have an active (or completed) return / replacement. */
export async function findItemConflicts(
  client: Tx | typeof db,
  orderItemIds: bigint[]
): Promise<ItemConflict[]> {
  if (orderItemIds.length === 0) return [];
  const [returns, replacements] = await Promise.all([
    client.return_items.findMany({
      where: consumingReturn(orderItemIds),
      select: { order_item_id: true, return_requests: { select: { status: true } } },
    }),
    client.replacement_request_items.findMany({
      where: consumingReplacement(orderItemIds),
      select: { order_item_id: true, replacement_request: { select: { status: true } } },
    }),
  ]);
  return [
    ...returns.map((r) => ({
      orderItemId: r.order_item_id,
      kind: "return" as const,
      status: r.return_requests.status,
    })),
    ...replacements.map((r) => ({
      orderItemId: r.order_item_id,
      kind: "replacement" as const,
      status: r.replacement_request.status,
    })),
  ];
}

/** True when a stored video URL is still attached to any request. */
export async function isVideoReferenced(url: string): Promise<boolean> {
  const [r, p] = await Promise.all([
    db.return_requests.count({ where: { unboxing_video_url: url } }),
    db.replacement_requests.count({ where: { unboxing_video_url: url } }),
  ]);
  return r + p > 0;
}
