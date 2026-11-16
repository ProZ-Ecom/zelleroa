"use client";

import {
  AlertTriangle,
  Banknote,
  BarChart3,
  CreditCard,
  History,
  IndianRupee,
  Package,
  QrCode,
  Receipt,
  Scale,
} from "lucide-react";
import { PageContainer } from "@/components/admin/PageContainer";
import {
  CHART_COLORS,
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
  ShareBar,
  TrendChart,
  compareLabelFor,
  count,
  dateLabel,
  formatCsvDateTime,
  money,
  moneyExact,
} from "@/features/reports/components/report-ui";
import { reportErrorMessage, useReport, useReportOptions } from "@/features/reports/hooks/use-report";
import { POS_STATUS_OPTIONS, POS_TENDER_OPTIONS } from "@/features/reports/lib/report-labels";
import type {
  PosCashierRow,
  PosProductRow,
  PosReport,
  PosShiftRow,
  PosTenderRow,
} from "@/features/reports/services/pos-report.service";
import { cn } from "@/lib/utils";

const tenderColumns: Column<PosTenderRow>[] = [
  {
    header: "Tender",
    cell: (r) => (
      <div className="flex items-center gap-2">
        <span className="font-semibold text-neutral-900">{r.label}</span>
        <span className="text-[11px] font-mono text-neutral-400">({r.code})</span>
      </div>
    ),
    csv: (r) => r.label,
  },
  { header: "Bills", align: "right", cell: (r) => count(r.bills), csv: (r) => r.bills },
  { header: "Total Collected", align: "right", cell: (r) => moneyExact(r.sales), csv: (r) => r.sales },
  { header: "Avg Ticket", align: "right", cell: (r) => moneyExact(r.avgTicket), csv: (r) => r.avgTicket },
  { header: "Share", align: "right", cell: (r) => <ShareBar share={r.share} />, csv: (r) => r.share },
];

const cashierColumns: Column<PosCashierRow>[] = [
  {
    header: "Cashier",
    cell: (r) => (
      <div>
        <p className="font-semibold text-neutral-900">{r.name}</p>
        <p className="text-xs text-neutral-500">{r.email}</p>
      </div>
    ),
    csv: (r) => r.name,
  },
  { header: "Bills", align: "right", cell: (r) => count(r.bills), csv: (r) => r.bills },
  { header: "Net Sales", align: "right", cell: (r) => moneyExact(r.netSales), csv: (r) => r.netSales },
  { header: "Avg Ticket", align: "right", cell: (r) => moneyExact(r.avgBillValue), csv: (r) => r.avgBillValue },
  {
    header: "Voided Bills",
    align: "right",
    cell: (r) =>
      r.voidedBills > 0 ? (
        <span className="font-semibold text-amber-700">{count(r.voidedBills)}</span>
      ) : (
        <span className="text-neutral-400">0</span>
      ),
    csv: (r) => r.voidedBills,
  },
  {
    header: "Cash Discrepancy",
    align: "right",
    cell: (r) => {
      if (r.cashVariance === 0) {
        return <span className="font-medium text-emerald-700">₹0.00</span>;
      }
      return (
        <span className={cn("font-semibold", r.cashVariance < 0 ? "text-rose-700" : "text-emerald-700")}>
          {r.cashVariance > 0 ? "+" : ""}
          {moneyExact(r.cashVariance)}
        </span>
      );
    },
    csv: (r) => r.cashVariance,
  },
  { header: "Sales Share", align: "right", cell: (r) => <ShareBar share={r.share} />, csv: (r) => r.share },
];

const productColumns: Column<PosProductRow>[] = [
  {
    header: "Product",
    cell: (r) => (
      <div>
        <p className="font-semibold text-neutral-900">{r.name}</p>
        {r.sku && <p className="font-mono text-xs text-neutral-400">SKU: {r.sku}</p>}
      </div>
    ),
    csv: (r) => r.name,
  },
  { header: "Units Sold", align: "right", cell: (r) => count(r.units), csv: (r) => r.units },
  { header: "Sales Generated", align: "right", cell: (r) => moneyExact(r.sales), csv: (r) => r.sales },
  { header: "Share", align: "right", cell: (r) => <ShareBar share={r.share} />, csv: (r) => r.share },
];

const shiftColumns: Column<PosShiftRow>[] = [
  {
    header: "Cashier & Store",
    cell: (r) => (
      <div>
        <p className="font-semibold text-neutral-900">{r.cashierName}</p>
        <p className="text-xs text-neutral-500">{r.storeName}</p>
      </div>
    ),
    csv: (r) => `${r.cashierName} (${r.storeName})`,
  },
  { header: "Opened At", cell: (r) => dateLabel(r.openedAt), csv: (r) => formatCsvDateTime(r.openedAt) },
  {
    header: "Closed At",
    cell: (r) =>
      r.closedAt ? (
        dateLabel(r.closedAt)
      ) : (
        <span className="font-medium text-blue-600">Active (Open)</span>
      ),
    csv: (r) => (r.closedAt ? formatCsvDateTime(r.closedAt) : "Open"),
  },
  { header: "Opening Float", align: "right", cell: (r) => moneyExact(r.openingCash), csv: (r) => r.openingCash },
  {
    header: "Closing Counted",
    align: "right",
    cell: (r) => (r.closingCash != null ? moneyExact(r.closingCash) : "—"),
    csv: (r) => r.closingCash ?? "",
  },
  {
    header: "Expected",
    align: "right",
    cell: (r) => (r.expectedCash != null ? moneyExact(r.expectedCash) : "—"),
    csv: (r) => r.expectedCash ?? "",
  },
  {
    header: "Discrepancy",
    align: "right",
    cell: (r) => {
      if (r.variance == null) return "—";
      if (r.variance === 0) return <span className="font-medium text-emerald-700">₹0.00</span>;
      return (
        <div className="flex flex-col items-end">
          <span className={cn("font-semibold", r.variance < 0 ? "text-rose-700" : "text-emerald-700")}>
            {r.variance > 0 ? "+" : ""}
            {moneyExact(r.variance)}
          </span>
          {r.varianceReason && (
            <span className="max-w-[140px] truncate text-[11px] text-neutral-500" title={r.varianceReason}>
              {r.varianceReason}
            </span>
          )}
        </div>
      );
    },
    csv: (r) => r.variance ?? "",
  },
  {
    header: "Status",
    cell: (r) => (
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider",
          r.status === "OPEN"
            ? "border border-blue-200 bg-blue-50 text-blue-700"
            : "border border-neutral-200 bg-neutral-100 text-neutral-700"
        )}
      >
        {r.status}
      </span>
    ),
    csv: (r) => r.status,
  },
];

export default function PosReportPage() {
  const { filters, setFilters, data, isLoading, isFetching, error, refetch } = useReport<PosReport>(
    "/api/admin/reports/pos"
  );
  const { data: options } = useReportOptions();

  const compare = data ? compareLabelFor(data.range.days) : undefined;

  return (
    <PageContainer
      title="POS & Counter Sales Report"
      description="Physical counter revenue, tender distributions, cashier performance audits, and register shift reconciliation."
      breadcrumbs={[
        { label: "Dashboard", href: "/admin/dashboard" },
        { label: "Reports", href: "/admin/dashboard/reports" },
        { label: "POS & Counter Sales" },
      ]}
    >
      <div className="flex flex-col gap-5">
        <Panel>
          <ReportFilters
            value={filters}
            onChange={setFilters}
            extras={[
              { name: "tender", label: "Tender method", options: POS_TENDER_OPTIONS },
              { name: "cashier", label: "Cashier", options: options?.cashiers ?? [] },
              { name: "status", label: "Bill status", options: POS_STATUS_OPTIONS },
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

            {/* 10 Core POS Metrics in a Responsive Grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
              <MetricCard
                label="Net counter sales"
                value={money(data.totals.netSales)}
                hint="Total completed POS billing"
                delta={data.changes.netSales}
                compareLabel={compare}
                icon={IndianRupee}
                tone="good"
              />
              <MetricCard
                label="Total bills"
                value={count(data.totals.bills)}
                hint="Completed counter transactions"
                delta={data.changes.bills}
                compareLabel={compare}
                icon={Receipt}
              />
              <MetricCard
                label="Average ticket"
                value={money(data.totals.avgBillValue)}
                hint="Net sales ÷ completed bills"
                delta={data.changes.avgBillValue}
                compareLabel={compare}
                icon={BarChart3}
              />
              <MetricCard
                label="Physical units"
                value={count(data.totals.units)}
                hint="Items checked out at counter"
                delta={data.changes.units}
                compareLabel={compare}
                icon={Package}
              />
              <MetricCard
                label="Cash collections"
                value={money(data.totals.cashSales)}
                hint="Physical drawer cash"
                delta={data.changes.cashSales}
                compareLabel={compare}
                icon={Banknote}
              />
              <MetricCard
                label="UPI collections"
                value={money(data.totals.upiSales)}
                hint="Instant digital QR payments"
                delta={data.changes.upiSales}
                compareLabel={compare}
                icon={QrCode}
              />
              <MetricCard
                label="Card collections"
                value={money(data.totals.cardSales)}
                hint="POS card terminal payments"
                delta={data.changes.cardSales}
                compareLabel={compare}
                icon={CreditCard}
              />
              <MetricCard
                label="Cash discrepancy"
                value={money(data.totals.cashVariance)}
                hint="Drawer variance across shifts"
                delta={data.changes.cashVariance}
                compareLabel={compare}
                icon={Scale}
                tone={data.totals.cashVariance < 0 ? "bad" : "default"}
              />
              <MetricCard
                label="Voided bills"
                value={count(data.totals.voidedBills)}
                hint={`${money(data.totals.voidedAmount)} cancelled value`}
                delta={data.changes.voidedBills}
                compareLabel={compare}
                icon={AlertTriangle}
                tone="warn"
              />
              <MetricCard
                label="Shift sessions"
                value={count(data.totals.totalShifts)}
                hint="Registered drawer sessions"
                delta={data.changes.totalShifts}
                compareLabel={compare}
                icon={History}
              />
            </div>

            {/* Sales Trends Chart */}
            <Panel
              title="Counter revenue over time"
              hint={`Grouped by ${data.range.bucket}. Compares net sales with Cash, UPI, and Card distributions.`}
            >
              <TrendChart
                data={data.trend}
                bucket={data.range.bucket}
                format={(n) => money(n)}
                series={[
                  { key: "net", label: "Net sales", value: (r) => r.netSales, color: CHART_COLORS.primary },
                  { key: "cash", label: "Cash", value: (r) => r.cash, color: CHART_COLORS.teal },
                  { key: "upi", label: "UPI", value: (r) => r.upi, color: CHART_COLORS.indigo },
                  { key: "card", label: "Card", value: (r) => r.card, color: CHART_COLORS.amber },
                ]}
              />
            </Panel>

            {/* Bill Volume Chart */}
            <Panel title="Bill volume over time" hint={`Total completed counter bills per ${data.range.bucket}.`}>
              <TrendChart
                data={data.trend}
                bucket={data.range.bucket}
                format={(n) => count(n)}
                height={180}
                series={[
                  { key: "bills", label: "Bills count", value: (r) => r.bills, color: CHART_COLORS.violet, kind: "bar" },
                ]}
              />
            </Panel>

            {/* Breakdown Grids: Tender & Top Products side by side */}
            <div className="grid gap-5 lg:grid-cols-2">
              {/* Tender breakdown */}
              <Panel
                title="Tender method breakdown"
                hint="Distribution of counter sales across payment instruments."
                action={<ExportButton rows={data.byTender} columns={tenderColumns} fileName="pos-tender-breakdown" />}
              >
                <DataTable
                  rows={data.byTender}
                  columns={tenderColumns}
                  rowKey={(r) => r.code}
                  empty="No tender transactions recorded in this period."
                />
              </Panel>

              {/* Top counter products */}
              <Panel
                title="Top counter products"
                hint="Highest selling items purchased directly at the physical register."
                action={<ExportButton rows={data.topProducts} columns={productColumns} fileName="pos-top-products" />}
              >
                <DataTable
                  rows={data.topProducts}
                  columns={productColumns}
                  rowKey={(r) => r.productId}
                  empty="No physical products rung up in this period."
                />
              </Panel>
            </div>

            {/* Cashier performance audit - Full Width */}
            <Panel
              title="Cashier performance & audit"
              hint="Counter sales, average ticket, voided orders, and drawer discrepancies by staff member."
              action={
                <ExportButton rows={data.byCashier} columns={cashierColumns} fileName="pos-cashier-performance" />
              }
            >
              <DataTable
                rows={data.byCashier}
                columns={cashierColumns}
                rowKey={(r) => r.id}
                empty="No cashier counter activity recorded in this period."
              />
            </Panel>

            {/* Shift Reconciliation Log - Full Width */}
            <Panel
              title="Cashier shift reconciliation log"
              hint="Audit log of opening floats, counted closing cash, and register variance explanations."
              action={<ExportButton rows={data.shifts} columns={shiftColumns} fileName="pos-shift-reconciliations" />}
            >
              <DataTable
                rows={data.shifts}
                columns={shiftColumns}
                rowKey={(r) => r.id}
                empty="No register shifts opened or closed in this period."
              />
            </Panel>

            <Note>
              Cancelled and voided bills are tracked separately for counter audit integrity. Physical register cash
              discrepancies are computed directly from certified shift closing counts against recorded cash sales.
            </Note>
          </>
        )}
      </div>
    </PageContainer>
  );
}
