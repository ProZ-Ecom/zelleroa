"use client";

import { AlertTriangle, Archive, PackageX, Warehouse } from "lucide-react";
import { PageContainer } from "@/components/admin/PageContainer";
import {
  type Column,
  DataTable,
  ExportButton,
  MetricCard,
  Note,
  Panel,
  RangeCaption,
  ReportError,
  ReportFilters,
  ReportSkeleton,
  count,
  dateLabel,
  formatCsvDateTime,
  money,
  moneyExact,
  percent,
} from "@/features/reports/components/report-ui";
import { reportErrorMessage, useReport, useReportOptions } from "@/features/reports/hooks/use-report";
import type {
  InventoryReport,
  LedgerRow,
  MovementRow,
  StockRow,
} from "@/features/reports/services/inventory-report.service";

const BUCKET_OPTIONS = [
  { value: "low", label: "Low stock only" },
  { value: "out", label: "Out of stock only" },
  { value: "dead", label: "Dead stock only" },
];

function StatusPill({ status }: { status: StockRow["status"] }) {
  const map = {
    out: { label: "Out of stock", cls: "bg-rose-50 text-rose-700" },
    low: { label: "Low", cls: "bg-amber-50 text-amber-700" },
    ok: { label: "OK", cls: "bg-emerald-50 text-emerald-700" },
  }[status];
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${map.cls}`}>{map.label}</span>;
}

const stockColumns: Column<StockRow>[] = [
  { header: "SKU", cell: (r) => <span className="font-mono text-xs">{r.sku}</span>, csv: (r) => r.sku },
  { header: "Product", cell: (r) => r.product, csv: (r) => r.product },
  { header: "Category", cell: (r) => r.category, csv: (r) => r.category },
  { header: "Brand", cell: (r) => r.brand, csv: (r) => r.brand },
  { header: "Status", cell: (r) => <StatusPill status={r.status} />, csv: (r) => r.status },
  { header: "On hand", align: "right", cell: (r) => count(r.onHand), csv: (r) => r.onHand },
  { header: "Reserved", align: "right", cell: (r) => count(r.reserved), csv: (r) => r.reserved },
  { header: "Sellable", align: "right", cell: (r) => count(r.sellable), csv: (r) => r.sellable },
  { header: "Reorder at", align: "right", cell: (r) => count(r.reorderLevel), csv: (r) => r.reorderLevel },
  { header: "Avg cost", align: "right", cell: (r) => (r.avgCost == null ? "—" : moneyExact(r.avgCost)), csv: (r) => r.avgCost },
  {
    header: "Value at cost",
    align: "right",
    cell: (r) => (r.valueAtCost == null ? "—" : moneyExact(r.valueAtCost)),
    csv: (r) => r.valueAtCost,
  },
  { header: "Value at price", align: "right", cell: (r) => moneyExact(r.valueAtPrice), csv: (r) => r.valueAtPrice },
  { header: "Sold in period", align: "right", cell: (r) => count(r.soldInRange), csv: (r) => r.soldInRange },
  { header: "Last movement", cell: (r) => dateLabel(r.lastMovementAt), csv: (r) => formatCsvDateTime(r.lastMovementAt) },
];

const alertColumns: Column<StockRow>[] = [
  { header: "SKU", cell: (r) => <span className="font-mono text-xs">{r.sku}</span>, csv: (r) => r.sku },
  { header: "Product", cell: (r) => r.product, csv: (r) => r.product },
  { header: "On hand", align: "right", cell: (r) => count(r.onHand), csv: (r) => r.onHand },
  { header: "Reorder at", align: "right", cell: (r) => count(r.reorderLevel), csv: (r) => r.reorderLevel },
  { header: "Sold in period", align: "right", cell: (r) => count(r.soldInRange), csv: (r) => r.soldInRange },
  { header: "Last movement", cell: (r) => dateLabel(r.lastMovementAt), csv: (r) => formatCsvDateTime(r.lastMovementAt) },
];

const movementColumns: Column<MovementRow>[] = [
  { header: "Movement", cell: (r) => r.label, csv: (r) => r.label },
  {
    header: "Direction",
    cell: (r) => (
      <span className={r.direction === "in" ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"}>
        {r.direction === "in" ? "Stock in" : "Stock out"}
      </span>
    ),
    csv: (r) => r.direction,
  },
  { header: "Entries", align: "right", cell: (r) => count(r.entries), csv: (r) => r.entries },
  { header: "Units", align: "right", cell: (r) => count(r.units), csv: (r) => r.units },
];

const ledgerColumns: Column<LedgerRow>[] = [
  { header: "When", cell: (r) => dateLabel(r.at), csv: (r) => formatCsvDateTime(r.at) },
  { header: "SKU", cell: (r) => <span className="font-mono text-xs">{r.sku}</span>, csv: (r) => r.sku },
  { header: "Movement", cell: (r) => r.movementType ?? r.type, csv: (r) => r.movementType ?? r.type },
  {
    header: "Qty",
    align: "right",
    cell: (r) => (
      <span className={r.type === "in" ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"}>
        {r.type === "in" ? "+" : "−"}
        {count(Math.abs(r.quantity))}
      </span>
    ),
    csv: (r) => r.quantity,
  },
  { header: "Before", align: "right", cell: (r) => (r.previousStock == null ? "—" : count(r.previousStock)), csv: (r) => r.previousStock },
  { header: "After", align: "right", cell: (r) => (r.newStock == null ? "—" : count(r.newStock)), csv: (r) => r.newStock },
  { header: "Reference", cell: (r) => r.reference ?? "—", csv: (r) => r.reference },
  { header: "Note", cell: (r) => r.note ?? "—", csv: (r) => r.note },
];

export default function InventoryReportPage() {
  const { filters, setFilters, data, isLoading, isFetching, error, refetch } = useReport<InventoryReport>(
    "/api/admin/reports/inventory"
  );
  const { data: options } = useReportOptions();

  const costCoverage = data && data.totals.skus ? Math.round((data.totals.costedSkus / data.totals.skus) * 1000) / 10 : 0;

  return (
    <PageContainer
      title="Inventory Report"
      description="What you are holding, what it is worth, what needs reordering, and every movement behind it."
      breadcrumbs={[
        { label: "Dashboard", href: "/admin/dashboard" },
        { label: "Reports", href: "/admin/dashboard/reports" },
        { label: "Inventory" },
      ]}
    >
      <div className="flex flex-col gap-5">
        <Panel>
          <ReportFilters
            value={filters}
            onChange={setFilters}
            extras={[
              { name: "category", label: "Category", options: options?.categories ?? [] },
              { name: "brand", label: "Brand", options: options?.brands ?? [] },
              { name: "bucket", label: "Show", options: BUCKET_OPTIONS },
            ]}
          />
        </Panel>

        {error ? (
          <ReportError message={reportErrorMessage(error)} onRetry={() => refetch()} />
        ) : isLoading || !data ? (
          <ReportSkeleton />
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <RangeCaption from={data.range.from} to={data.range.to} days={data.range.days} />
              {isFetching && <span className="text-xs text-neutral-400">Updating…</span>}
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <MetricCard
                label="Stock value at cost"
                value={money(data.totals.valueAtCost)}
                hint={`Based on the ${percent(costCoverage)} of SKUs that have a cost`}
                icon={Warehouse}
              />
              <MetricCard
                label="Stock value at price"
                value={money(data.totals.valueAtPrice)}
                hint="What it would fetch at list price"
              />
              <MetricCard
                label="Units on hand"
                value={count(data.totals.unitsOnHand)}
                hint={`${count(data.totals.unitsReserved)} already reserved`}
              />
              <MetricCard
                label="Sellable now"
                value={count(data.totals.unitsSellable)}
                hint="On hand less reserved"
                tone="good"
              />
              <MetricCard
                label="Out of stock"
                value={count(data.totals.outOfStock)}
                hint="Live SKUs with nothing on hand"
                icon={PackageX}
                tone={data.totals.outOfStock > 0 ? "bad" : "good"}
              />
              <MetricCard
                label="Low stock"
                value={count(data.totals.lowStock)}
                hint="At or below the reorder level"
                icon={AlertTriangle}
                tone={data.totals.lowStock > 0 ? "warn" : "good"}
              />
              <MetricCard
                label="Dead stock"
                value={count(data.totals.deadStock)}
                hint="Stock on hand, no movement in 90 days"
                icon={Archive}
                tone={data.totals.deadStock > 0 ? "warn" : "good"}
              />
              <MetricCard
                label="Moved in period"
                value={`+${count(data.totals.movementIn)} / −${count(data.totals.movementOut)}`}
                hint="Units in and out of the ledger"
              />
            </div>

            <Panel title="Stock movement in this period" hint="Every ledger entry rolled up by what it was for.">
              <DataTable
                rows={data.movements}
                columns={movementColumns}
                rowKey={(r) => r.key}
                empty="No stock moved in this period."
              />
            </Panel>

            <div className="grid gap-5 lg:grid-cols-2">
              <Panel
                title="Needs reordering"
                hint="At or below the reorder level, up to 50."
                action={<ExportButton rows={data.alerts.lowStock} columns={alertColumns} fileName="low-stock" />}
              >
                <DataTable
                  rows={data.alerts.lowStock}
                  columns={alertColumns}
                  rowKey={(r) => r.key}
                  empty="Nothing is below its reorder level."
                  maxHeight="max-h-[24rem]"
                />
              </Panel>

              <Panel
                title="Out of stock"
                hint="Live SKUs with nothing on hand, up to 50."
                action={<ExportButton rows={data.alerts.outOfStock} columns={alertColumns} fileName="out-of-stock" />}
              >
                <DataTable
                  rows={data.alerts.outOfStock}
                  columns={alertColumns}
                  rowKey={(r) => r.key}
                  empty="Everything live has stock."
                  maxHeight="max-h-[24rem]"
                />
              </Panel>
            </div>

            <Panel
              title="Dead stock"
              hint="Stock sitting on the shelf with no sale in this period and no movement in 90 days, highest value first."
              action={<ExportButton rows={data.alerts.deadStock} columns={alertColumns} fileName="dead-stock" />}
            >
              <DataTable
                rows={data.alerts.deadStock}
                columns={alertColumns}
                rowKey={(r) => r.key}
                empty="No dead stock."
                maxHeight="max-h-[24rem]"
              />
            </Panel>

            <Panel
              title="Stock on hand"
              hint={
                data.rowsTruncated
                  ? "Showing the top 1,000 by value. Filter by category or brand to narrow it down."
                  : "Sorted by stock value."
              }
              action={<ExportButton rows={data.rows} columns={stockColumns} fileName="stock-on-hand" />}
            >
              <DataTable
                rows={data.rows}
                columns={stockColumns}
                rowKey={(r) => r.key}
                empty="No SKUs match these filters."
                maxHeight="max-h-[36rem]"
              />
            </Panel>

            <Panel
              title="Recent movements"
              hint={
                data.ledgerTruncated
                  ? "The 200 most recent ledger entries in this period."
                  : "Every ledger entry in this period, newest first."
              }
              action={<ExportButton rows={data.ledger} columns={ledgerColumns} fileName="stock-ledger" />}
            >
              <DataTable
                rows={data.ledger}
                columns={ledgerColumns}
                rowKey={(r) => r.id}
                empty="No stock moved in this period."
                maxHeight="max-h-[32rem]"
              />
            </Panel>

            {costCoverage < 99 && (
              <Note tone="warn">
                Cost is only known once a SKU has been received against a purchase, so the value at cost covers{" "}
                {percent(costCoverage)} of SKUs. The rest show a dash rather than a guess.
              </Note>
            )}

            <Note>
              Stock levels and the movement list both come from the inventory ledger, so the two always reconcile. The
              period filter affects the movement figures and “sold in period”; stock on hand is always current.
            </Note>
          </>
        )}
      </div>
    </PageContainer>
  );
}
