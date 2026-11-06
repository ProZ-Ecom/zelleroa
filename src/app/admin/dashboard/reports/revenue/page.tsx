"use client";

import { CreditCard, IndianRupee, Receipt, Wallet } from "lucide-react";
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
  TrendChart,
  compareLabelFor,
  count,
  dateLabel,
  money,
  moneyExact,
  percent,
} from "@/features/reports/components/report-ui";
import { reportErrorMessage, useReport } from "@/features/reports/hooks/use-report";
import { ORDER_STATUS_LABELS } from "@/features/reports/lib/report-labels";
import type {
  OutstandingRow,
  PaymentMethodRow,
  PaymentStatusRow,
  RevenueReport,
  TaxRow,
} from "@/features/reports/services/revenue-report.service";

const taxColumns: Column<TaxRow>[] = [
  { header: "HSN", cell: (r) => r.hsnCode, csv: (r) => r.hsnCode },
  { header: "Description", cell: (r) => r.description, csv: (r) => r.description },
  { header: "GST slab", cell: (r) => r.gstName, csv: (r) => r.gstName },
  { header: "CGST %", align: "right", cell: (r) => percent(r.cgst), csv: (r) => r.cgst },
  { header: "SGST %", align: "right", cell: (r) => percent(r.sgst), csv: (r) => r.sgst },
  { header: "IGST %", align: "right", cell: (r) => percent(r.igst), csv: (r) => r.igst },
  { header: "Units", align: "right", cell: (r) => count(r.units), csv: (r) => r.units },
  { header: "Taxable value", align: "right", cell: (r) => moneyExact(r.taxableValue), csv: (r) => r.taxableValue },
  { header: "Tax", align: "right", cell: (r) => moneyExact(r.taxAmount), csv: (r) => r.taxAmount },
];

const methodColumns: Column<PaymentMethodRow>[] = [
  { header: "Method", cell: (r) => r.label, csv: (r) => r.label },
  { header: "Payments", align: "right", cell: (r) => count(r.orders), csv: (r) => r.orders },
  { header: "Collected", align: "right", cell: (r) => moneyExact(r.amount), csv: (r) => r.amount },
];

const statusColumns: Column<PaymentStatusRow>[] = [
  { header: "Payment status", cell: (r) => r.label, csv: (r) => r.label },
  { header: "Orders", align: "right", cell: (r) => count(r.orders), csv: (r) => r.orders },
  { header: "Order value", align: "right", cell: (r) => moneyExact(r.value), csv: (r) => r.value },
];

const outstandingColumns: Column<OutstandingRow>[] = [
  { header: "Order", cell: (r) => <span className="font-semibold">{r.orderNumber}</span>, csv: (r) => r.orderNumber },
  { header: "Placed", cell: (r) => dateLabel(r.placedAt), csv: (r) => r.placedAt ?? "" },
  { header: "Customer", cell: (r) => r.customer, csv: (r) => r.customer },
  { header: "Order status", cell: (r) => ORDER_STATUS_LABELS[r.status] ?? r.status, csv: (r) => r.status },
  { header: "Order value", align: "right", cell: (r) => moneyExact(r.value), csv: (r) => r.value },
  { header: "Received", align: "right", cell: (r) => moneyExact(r.paid), csv: (r) => r.paid },
  {
    header: "Still due",
    align: "right",
    cell: (r) => <span className="font-semibold text-amber-700">{moneyExact(r.due)}</span>,
    csv: (r) => r.due,
  },
];

export default function RevenueReportPage() {
  const { filters, setFilters, data, isLoading, isFetching, error, refetch } = useReport<RevenueReport>(
    "/api/admin/reports/revenue"
  );

  const compare = data ? compareLabelFor(data.range.days) : undefined;
  const taxTotal = data?.tax.reduce((s, r) => s + r.taxAmount, 0) ?? 0;
  const unmapped = data?.tax.find((r) => r.hsnCode === "Not mapped");

  return (
    <PageContainer
      title="Revenue Report"
      description="What was billed, what has actually been collected, and what is still owed."
      breadcrumbs={[
        { label: "Dashboard", href: "/admin/dashboard" },
        { label: "Reports", href: "/admin/dashboard/reports" },
        { label: "Revenue" },
      ]}
    >
      <div className="flex flex-col gap-5">
        <Panel>
          <ReportFilters value={filters} onChange={setFilters} />
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
                label="Net revenue"
                value={money(data.totals.netRevenue)}
                hint="Billed on orders placed in this period"
                delta={data.changes.netRevenue}
                compareLabel={compare}
                icon={IndianRupee}
                tone="good"
              />
              <MetricCard
                label="Collected"
                value={money(data.totals.collected)}
                hint="Successful payments only"
                delta={data.changes.collected}
                compareLabel={compare}
                icon={Wallet}
                tone="good"
              />
              <MetricCard
                label="Still to collect"
                value={money(data.totals.outstanding)}
                hint="Net revenue less what came in"
                delta={data.changes.outstanding}
                compareLabel={compare}
                icon={CreditCard}
                tone={data.totals.outstanding > 0 ? "warn" : "default"}
              />
              <MetricCard
                label="Refunded"
                value={money(data.totals.refunded)}
                hint="Completed refunds in this period"
                delta={data.changes.refunded}
                compareLabel={compare}
                tone={data.totals.refunded > 0 ? "warn" : "default"}
              />
              <MetricCard
                label="Product value"
                value={money(data.totals.grossSales)}
                hint="Before discount, tax and delivery"
                delta={data.changes.grossSales}
                compareLabel={compare}
              />
              <MetricCard
                label="Discount given"
                value={money(data.totals.discount)}
                hint={`${money(data.totals.coupons)} of it from coupons`}
                delta={data.changes.discount}
                compareLabel={compare}
                tone="warn"
              />
              <MetricCard
                label="Tax collected"
                value={money(data.totals.tax)}
                hint="Payable on these orders"
                delta={data.changes.tax}
                compareLabel={compare}
                icon={Receipt}
              />
              <MetricCard
                label="Partner commission"
                value={money(data.totals.commission)}
                hint="Earned in this period, cancellations excluded"
                delta={data.changes.commission}
                compareLabel={compare}
                tone="warn"
              />
            </div>

            <Panel title="Revenue over time" hint={`Net revenue, tax and discount per ${data.range.bucket}.`}>
              <TrendChart
                data={data.trend}
                bucket={data.range.bucket}
                format={(n) => money(n)}
                series={[
                  { key: "net", label: "Net revenue", value: (r) => r.netRevenue, color: CHART_COLORS.primary },
                  { key: "tax", label: "Tax", value: (r) => r.tax, color: CHART_COLORS.amber },
                  { key: "discount", label: "Discount", value: (r) => r.discount, color: CHART_COLORS.rose },
                ]}
              />
            </Panel>

            <Panel
              title="Tax summary by HSN"
              hint={`Taxable value is the line total less its tax. Total tax in this period: ${moneyExact(taxTotal)}.`}
              action={<ExportButton rows={data.tax} columns={taxColumns} fileName="tax-summary-by-hsn" />}
            >
              <DataTable
                rows={data.tax}
                columns={taxColumns}
                rowKey={(r) => r.hsnCode}
                empty="Nothing sold in this period."
                maxHeight="max-h-[28rem]"
              />
            </Panel>

            {unmapped && (
              <Note tone="warn">
                {moneyExact(unmapped.taxableValue)} of taxable value sits under “Not mapped” because those products have
                no HSN code set. Set the HSN code on the product for this to split correctly.
              </Note>
            )}

            <div className="grid gap-5 lg:grid-cols-2">
              <Panel
                title="How customers paid"
                hint="Only successful payments. Cash collected on delivery appears once it is marked received."
                action={<ExportButton rows={data.paymentMethods} columns={methodColumns} fileName="payment-methods" />}
              >
                <DataTable
                  rows={data.paymentMethods}
                  columns={methodColumns}
                  rowKey={(r) => r.code}
                  empty="No payments recorded in this period."
                  emptyHint="Cash-on-delivery orders only show up here after the cash is booked."
                />
              </Panel>

              <Panel title="Orders by payment status">
                <DataTable
                  rows={data.paymentStatus}
                  columns={statusColumns}
                  rowKey={(r) => r.status}
                  empty="No orders in this period."
                />
              </Panel>
            </div>

            <Panel
              title="Orders still to collect"
              hint={
                data.outstandingTruncated
                  ? "Showing the 300 most recent unpaid orders. Narrow the period to see the rest."
                  : "Orders whose successful payments do not cover the total."
              }
              action={<ExportButton rows={data.outstanding} columns={outstandingColumns} fileName="outstanding-orders" />}
            >
              <DataTable
                rows={data.outstanding}
                columns={outstandingColumns}
                rowKey={(r) => r.id}
                empty="Everything in this period is paid for."
                maxHeight="max-h-[28rem]"
              />
            </Panel>

            <Note>
              Net revenue counts orders placed in this period; collected and refunded count money that moved in it, so the
              two will not always match day for day.
            </Note>
          </>
        )}
      </div>
    </PageContainer>
  );
}
