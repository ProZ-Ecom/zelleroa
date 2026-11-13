import { db } from "@/lib/db/prisma";
import type { Prisma } from "@/generated/prisma";
import { resolveStateCode } from "@/features/invoice/utils/state-codes";
import type { PosStoreDto } from "../types";

type Tx = Prisma.TransactionClient;

export const DEFAULT_STORE_CODE = "MAIN";

type StoreRow = {
  id: bigint;
  uuid: string;
  name: string;
  code: string;
  address: string | null;
  city: string | null;
  state: string | null;
  state_code: string | null;
  pincode: string | null;
  phone: string | null;
  gstin: string | null;
  invoice_prefix: string;
  max_cashier_discount_percent: Prisma.Decimal;
};

/**
 * A counter's own details, with anything left blank filled in from company
 * settings. One store today keeps every field optional: the shop fills in a
 * separate address and GSTIN only when a second branch makes them differ.
 */
export async function toStoreDto(store: StoreRow): Promise<PosStoreDto> {
  const company = await db.company.findFirst({ where: { isActive: true } });

  const address = store.address ?? company?.address ?? "";
  const state = store.state ?? company?.state ?? null;
  const gstin = store.gstin ?? company?.gstNumber ?? null;

  return {
    id: Number(store.id),
    uuid: store.uuid,
    name: store.name,
    code: store.code,
    addressLines: address
      .split(/\r?\n|,/)
      .map((line) => line.trim())
      .filter(Boolean),
    city: store.city ?? company?.city ?? null,
    state,
    stateCode: store.state_code ?? resolveStateCode(state, gstin),
    pincode: store.pincode ?? company?.pincode ?? null,
    phone: store.phone ?? company?.phone ?? null,
    gstin,
    invoicePrefix: store.invoice_prefix,
    maxCashierDiscountPercent: Number(store.max_cashier_discount_percent),
  };
}

/**
 * The counter a cashier is billing at.
 *
 * While there is one store this resolves it without anyone choosing, and
 * creates it from company settings the first time the screen is opened, so
 * rolling POS out needs no setup step. `code` is unique, so two cashiers
 * opening their first shift at once cannot create two stores - the loser's
 * insert is ignored and both read the same row.
 *
 * A second branch changes only the caller: pass `storeId` (from the staff
 * member's assignment) and this stops guessing.
 */
export async function resolveStore(tx: Tx, storeId?: bigint | null): Promise<StoreRow> {
  if (storeId) {
    const picked = await tx.pos_stores.findFirst({ where: { id: storeId, is_active: true } });
    if (picked) return picked as StoreRow;
  }

  const existing = await tx.pos_stores.findFirst({
    where: { is_active: true },
    orderBy: { id: "asc" },
  });
  if (existing) return existing as StoreRow;

  const company = await tx.company.findFirst({ where: { isActive: true } });
  await tx.$executeRaw`
    INSERT IGNORE INTO pos_stores (uuid, name, code, invoice_prefix)
    VALUES (UUID(), ${company?.companyName ?? "Main Counter"}, ${DEFAULT_STORE_CODE}, 'POS')`;

  return (await tx.pos_stores.findFirstOrThrow({
    where: { code: DEFAULT_STORE_CODE },
  })) as StoreRow;
}

export const posStoreService = {
  /** The counter the screen should bill against, as the UI needs it. */
  async getActiveStore(storeId?: bigint | null): Promise<PosStoreDto> {
    const store = await db.$transaction((tx) => resolveStore(tx, storeId));
    return toStoreDto(store);
  },
};
