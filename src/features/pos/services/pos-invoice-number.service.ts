import type { Prisma } from "@/generated/prisma";

type Tx = Prisma.TransactionClient;

/**
 * Indian financial year label for a date: 1 April to 31 March, as "26-27".
 * GST bill series restart with the financial year, so the counter is keyed by it.
 */
export function financialYearLabel(date: Date): string {
  const year = date.getFullYear();
  // Months are 0-based: 3 is April.
  const startYear = date.getMonth() >= 3 ? year : year - 1;
  const two = (y: number) => String(y % 100).padStart(2, "0");
  return `${two(startYear)}-${two(startYear + 1)}`;
}

/**
 * The next bill number for a counter, reserved inside the caller's transaction.
 *
 * `SELECT ... FOR UPDATE` on the counter row is the whole point. Reading
 * `MAX(invoice_number) + 1` in application code looks equivalent and is not:
 * three cashiers pressing Pay in the same second all read the same maximum and
 * all write the same number. Here the second cashier's transaction blocks on the
 * row until the first commits, so the series is gapless and unique - which is
 * what GST requires of it. The unique index on `orders.invoice_number` is the
 * backstop if anyone ever bypasses this function.
 *
 * Must be called inside a transaction; the lock is released when it commits.
 */
export async function nextInvoiceNumber(
  tx: Tx,
  params: { storeId: bigint; prefix: string; series?: string; at?: Date }
): Promise<string> {
  const series = params.series ?? "SALE";
  const financialYear = financialYearLabel(params.at ?? new Date());

  // Create the row for this (store, series, year) if this is the year's first
  // bill. Concurrent first bills race here, so the loser's insert is ignored and
  // both go on to lock the same row below.
  await tx.$executeRaw`
    INSERT IGNORE INTO pos_invoice_counters (store_id, series, financial_year, last_number)
    VALUES (${params.storeId}, ${series}, ${financialYear}, 0)`;

  const rows = await tx.$queryRaw<Array<{ last_number: number }>>`
    SELECT last_number FROM pos_invoice_counters
    WHERE store_id = ${params.storeId}
      AND series = ${series}
      AND financial_year = ${financialYear}
    FOR UPDATE`;

  const next = Number(rows[0]?.last_number ?? 0) + 1;

  await tx.$executeRaw`
    UPDATE pos_invoice_counters SET last_number = ${next}
    WHERE store_id = ${params.storeId}
      AND series = ${series}
      AND financial_year = ${financialYear}`;

  const suffix = series === "SALE" ? "" : `/${series}`;
  return `${params.prefix}${suffix}/${financialYear}/${String(next).padStart(4, "0")}`;
}
