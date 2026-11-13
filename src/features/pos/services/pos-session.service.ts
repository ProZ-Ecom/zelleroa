import { ApiError } from "@/lib/api/api-error";
import { db } from "@/lib/db/prisma";
import type { Prisma } from "@/generated/prisma";
import { resolveStore } from "./pos-store.service";
import type { PosSessionDto, PosSessionSummary } from "../types";
import type {
  PosShiftCloseInput,
  PosShiftListInput,
  PosShiftOpenInput,
} from "../validations/pos.schema";

type Tx = Prisma.TransactionClient;

/** Payment method codes the counter books against; one per tender. */
export const POS_METHOD_CODES = {
  CASH: "POS_CASH",
  UPI: "POS_UPI",
  CARD: "POS_CARD",
} as const;

const sessionInclude = {
  store: { select: { id: true, name: true } },
  staff: { select: { id: true, name: true } },
} satisfies Prisma.pos_sessionsInclude;

type SessionWithRefs = Prisma.pos_sessionsGetPayload<{ include: typeof sessionInclude }>;

function toDto(row: SessionWithRefs): PosSessionDto {
  return {
    id: Number(row.id),
    uuid: row.uuid,
    status: row.status,
    storeId: Number(row.store_id),
    storeName: row.store.name,
    staffUserId: Number(row.staff_user_id),
    staffName: row.staff.name ?? "",
    openedAt: row.opened_at.toISOString(),
    openingCash: Number(row.opening_cash),
    closedAt: row.closed_at?.toISOString() ?? null,
    closingCashCounted:
      row.closing_cash_counted === null ? null : Number(row.closing_cash_counted),
    expectedCash: row.expected_cash === null ? null : Number(row.expected_cash),
    cashVariance: row.cash_variance === null ? null : Number(row.cash_variance),
    varianceReason: row.variance_reason,
  };
}

const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

/**
 * The shift a cashier is currently billing in.
 *
 * Every billing call goes through this: a bill with no open shift has no
 * drawer to belong to, so the day's cash could never be reconciled to a person.
 */
export async function requireOpenSession(tx: Tx, staffUserId: bigint) {
  const session = await tx.pos_sessions.findFirst({
    where: { staff_user_id: staffUserId, status: "OPEN" },
    orderBy: { id: "desc" },
  });
  if (!session) {
    throw ApiError.badRequest("Open your shift before billing");
  }
  return session;
}

/** Money that moved through one shift, computed from its orders and payments. */
async function computeSummary(sessionId: bigint, openingCash: number) {
  const orders = await db.order.findMany({
    where: { pos_session_id: sessionId },
    select: {
      order_status: true,
      totalAmount: true,
      payments: {
        where: { is_active: true },
        select: { amount: true, payment_methods: { select: { code: true } } },
      },
    },
  });

  let billCount = 0;
  let voidedCount = 0;
  let grossSales = 0;
  let refunds = 0;
  let cash = 0;
  let upi = 0;
  let card = 0;

  for (const order of orders) {
    const voided = order.order_status === "cancelled";
    const total = Number(order.totalAmount);
    if (voided) {
      voidedCount += 1;
      refunds += total;
    } else {
      billCount += 1;
      grossSales += total;
    }

    for (const payment of order.payments) {
      const amount = Number(payment.amount);
      const code = payment.payment_methods.code;
      // A voided bill took the money and gave it straight back, so it nets to
      // zero in the drawer and is left out of the tender totals entirely.
      // (A bill voided in a LATER shift is still counted against the shift that
      // sold it, so the cash the later cashier hands back is not reflected in
      // their drawer - give a void its own session row if that becomes common.)
      if (voided) continue;
      if (code === POS_METHOD_CODES.CASH) cash += amount;
      else if (code === POS_METHOD_CODES.UPI) upi += amount;
      else if (code === POS_METHOD_CODES.CARD) card += amount;
    }
  }

  return {
    billCount,
    voidedCount,
    grossSales: round2(grossSales),
    /** Value of the bills that were voided, shown so a manager can see them. */
    refunds: round2(refunds),
    // A voided bill is already left out of grossSales, so netSales must not
    // subtract it a second time - that would drive the figure negative on a
    // shift whose only bills were voided.
    netSales: round2(grossSales),
    cash: round2(cash),
    upi: round2(upi),
    card: round2(card),
    expectedCash: round2(openingCash + cash),
  };
}

export const posSessionService = {
  /** The caller's open shift, or null when they have not started one. */
  async getCurrent(staffUserId: bigint): Promise<PosSessionDto | null> {
    const row = await db.pos_sessions.findFirst({
      where: { staff_user_id: staffUserId, status: "OPEN" },
      orderBy: { id: "desc" },
      include: sessionInclude,
    });
    return row ? toDto(row) : null;
  },

  /**
   * Start a shift. One cashier may hold one open shift at a time; several
   * cashiers hold their own at the same counter, which is the point - each
   * drawer reconciles to one person.
   */
  async open(staffUserId: bigint, input: PosShiftOpenInput): Promise<PosSessionDto> {
    const created = await db.$transaction(async (tx) => {
      const existing = await tx.pos_sessions.findFirst({
        where: { staff_user_id: staffUserId, status: "OPEN" },
      });
      if (existing) {
        throw ApiError.conflict("You already have an open shift");
      }

      const store = await resolveStore(tx, input.storeId ? BigInt(input.storeId) : null);

      return tx.pos_sessions.create({
        data: {
          uuid: crypto.randomUUID(),
          store_id: store.id,
          staff_user_id: staffUserId,
          status: "OPEN",
          opened_at: new Date(),
          opening_cash: input.openingCash,
          created_by: staffUserId,
          updated_by: staffUserId,
        },
        include: sessionInclude,
      });
    });

    return toDto(created);
  },

  /** Running totals for a shift: the close screen reads this before counting. */
  async getSummary(sessionUuid: string): Promise<PosSessionSummary> {
    const row = await db.pos_sessions.findFirst({
      where: { uuid: sessionUuid },
      include: sessionInclude,
    });
    if (!row) throw ApiError.notFound("Shift not found");

    const totals = await computeSummary(row.id, Number(row.opening_cash));
    return { session: toDto(row), ...totals };
  },

  /**
   * Close a shift against counted cash.
   *
   * The variance is computed here, never taken from the client, and a shift
   * that does not balance cannot be closed without a reason - that line is the
   * only record of where the money went.
   */
  async close(
    staffUserId: bigint,
    sessionUuid: string,
    input: PosShiftCloseInput,
    canCloseOthers: boolean
  ): Promise<PosSessionSummary> {
    const session = await db.pos_sessions.findFirst({ where: { uuid: sessionUuid } });
    if (!session) throw ApiError.notFound("Shift not found");
    if (session.status === "CLOSED") throw ApiError.badRequest("This shift is already closed");
    if (session.staff_user_id !== staffUserId && !canCloseOthers) {
      throw ApiError.forbidden("You can only close your own shift");
    }

    const totals = await computeSummary(session.id, Number(session.opening_cash));
    const variance = round2(input.countedCash - totals.expectedCash);
    const reason = input.varianceReason?.trim() || null;
    if (variance !== 0 && !reason) {
      throw ApiError.badRequest(
        `The drawer is ${variance < 0 ? "short" : "over"} by ${Math.abs(variance).toFixed(2)}. Give a reason to close the shift.`
      );
    }

    // Conditional update is the lock: two tabs closing the same shift both read
    // it open, only one flips it.
    const claimed = await db.pos_sessions.updateMany({
      where: { id: session.id, status: "OPEN" },
      data: {
        status: "CLOSED",
        closed_at: new Date(),
        closing_cash_counted: input.countedCash,
        expected_cash: totals.expectedCash,
        cash_variance: variance,
        variance_reason: reason,
        updated_by: staffUserId,
      },
    });
    if (claimed.count !== 1) throw ApiError.conflict("This shift is already closed");

    return posSessionService.getSummary(sessionUuid);
  },

  /** Shift history for the manager's report. */
  async list(params: PosShiftListInput) {
    const where: Prisma.pos_sessionsWhereInput = {
      ...(params.status ? { status: params.status } : {}),
      ...(params.staffUserId ? { staff_user_id: BigInt(params.staffUserId) } : {}),
      ...(params.from || params.to
        ? {
            opened_at: {
              ...(params.from ? { gte: new Date(`${params.from}T00:00:00`) } : {}),
              ...(params.to ? { lte: new Date(`${params.to}T23:59:59`) } : {}),
            },
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      db.pos_sessions.findMany({
        where,
        include: sessionInclude,
        orderBy: { opened_at: "desc" },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      db.pos_sessions.count({ where }),
    ]);

    const data = await Promise.all(
      rows.map(async (row) => {
        const totals = await computeSummary(row.id, Number(row.opening_cash));
        return { session: toDto(row), ...totals } satisfies PosSessionSummary;
      })
    );

    return {
      data,
      meta: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / params.limit)),
      },
    };
  },
};
