"use client";

import { CheckCircle2, Clock, ShoppingCart, Truck, XCircle } from "lucide-react";
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
  days,
  formatCsvDateTime,
  money,
  moneyExact,
  percent,
} from "@/features/reports/components/report-ui";
import { reportErrorMessage, useReport, useReportOptions } from "@/features/reports/hooks/use-report";
import {
  ORDER_SOURCE_OPTIONS,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_OPTIONS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_OPTIONS,
} from "@/features/reports/lib/report-labels";
import type {
  OrderListRow,
  OrdersReport,
  ReasonRow,
  StatusRow,
} from "@/features/reports/services/orders-report.service";

const statusColumns = (header: string): Column<StatusRow>[] => [
  { header, cell: (r) => r.label, csv: (r) => r.label },
  { header: "Orders", align: "right", cell: (r) => count(r.orders), csv: (r) => r.orders },
  { header: "Value", align: "right", cell: (r) => moneyExact(r.value), csv: (r) => r.value },
  { header: "Share", align: "right", cell: (r) => <ShareBar share={r.share} />, csv: (r) => r.share },
];

/** `by` means the canceller on cancellations and the request status on returns. */
const reasonColumns = (byHeader: string, showValue = true): Column<ReasonRow>[] => [
  { header: "Reason", cell: (r) => r.reason, csv: (r) => r.reason },
  { header: byHeader, cell: (r) => humanise(r.by), csv: (r) => humanise(r.by) },
  { header: "Requests", align: "right", cell: (r) => count(r.orders), csv: (r) => r.orders },
  ...(showValue
    ? [
        {
          header: "Value",
          align: "right" as const,
          cell: (r: ReasonRow) => moneyExact(r.value),
          csv: (r: ReasonRow) => r.value,
        },
      ]
    : []),
];

/** "out_for_delivery" -> "Out for delivery", for values with no label map of their own. */
function humanise(value: string) {
  const spaced = value.replace(/_/g, " ").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const orderColumns: Column<OrderListRow>[] = [
  { header: "Order", cell: (r) => <span className="font-semibold">{r.orderNumber}</span>, csv: (r) => r.orderNumber },
  { header: "Placed", cell: (r) => dateLabel(r.placedAt), csv: (r) => formatCsvDateTime(r.placedAt) },
  { header: "Customer", cell: (r) => r.customer, csv: (r) => r.customer },
  { header: "Status", cell: (r) => ORDER_STATUS_LABELS[r.status] ?? r.status, csv: (r) => r.status },
  { header: "Payment", cell: (r) => PAYMENT_STATUS_LABELS[r.paymentStatus] ?? r.paymentStatus, csv: (r) => r.paymentStatus },
  { header: "Items", align: "right", cell: (r) => count(r.items), csv: (r) => r.items },
  { header: "Value", align: "right", cell: (r) => moneyExact(r.value), csv: (r) => r.value },
  {
    header: "Delivered in",
    align: "right",
    cell: (r) => (r.deliveryDays == null ? "—" : r.deliveryDays < 1 ? "Same day" : days(r.deliveryDays)),
    csv: (r) => r.deliveryDays,
  },
];

export default function OrdersReportPage() {
  const { filters, setFilters, data, isLoading, isFetching, error, refetch } = useReport<OrdersReport>(
    "/api/admin/reports/orders"
  );
  const { data: options } = useReportOptions();

  const compare = data ? compareLabelFor(data.range.days) : undefined;

  return (
    <PageContainer
      title="Orders Report"
      description="Where orders sit in the pipeline, how fast they get delivered, and why they fall through."
      breadcrumbs={[
        { label: "Dashboard", href: "/admin/dashboard" },
        { label: "Reports", href: "/admin/dashboard/reports" },
        { label: "Orders" },
      ]}
    >
      <div className="flex flex-col gap-5">
        <Panel>
          <ReportFilters
            value={filters}
            onChange={setFilters}
            extras={[
              { name: "status", label: "Order status", options: ORDER_STATUS_OPTIONS },
              { name: "paymentStatus", label: "Payment status", options: PAYMENT_STATUS_OPTIONS },
              { name: "source", label: "Order came from", options: ORDER_SOURCE_OPTIONS },
              { name: "agent", label: "Sales partner", options: options?.agents ?? [] },
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
                label="Orders placed"
                value={count(data.totals.orders)}
                hint="Everything placed in this period"
                delta={data.changes.orders}
                compareLabel={compare}
                icon={ShoppingCart}
              />
              <MetricCard
                label="Delivered"
                value={count(data.totals.delivered)}
                hint={`${percent(data.totals.fulfilmentRate)} of orders placed`}
                delta={data.changes.delivered}
                compareLabel={compare}
                icon={CheckCircle2}
                tone="good"
              />
              <MetricCard
                label="Still in progress"
                value={count(data.totals.inProgress)}
                hint="Pending through to out for delivery"
                delta={data.changes.inProgress}
                compareLabel={compare}
                icon={Clock}
                tone="warn"
              />
              <MetricCard
                label="Average delivery time"
                value={data.totals.avgDeliveryDays == null ? "—" : days(data.totals.avgDeliveryDays)}
                hint="From placed to delivered"
                delta={data.changes.avgDeliveryDays}
                compareLabel={compare}
                icon={Truck}
              />
              <MetricCard
                label="Cancelled"
                value={count(data.totals.cancelled)}
                hint={`${percent(data.totals.cancelRate)} of orders placed`}
                delta={data.changes.cancelled}
                compareLabel={compare}
                icon={XCircle}
                tone={data.totals.cancelRate > 10 ? "bad" : "default"}
              />
              <MetricCard
                label="Returned"
                value={count(data.totals.returned)}
                hint={`${percent(data.totals.returnRate)} of orders placed`}
                delta={data.changes.returned}
                compareLabel={compare}
                tone={data.totals.returnRate > 10 ? "bad" : "default"}
              />
              <MetricCard
                label="Order value"
                value={money(data.totals.value)}
                hint="All orders, cancelled included"
                delta={data.changes.value}
                compareLabel={compare}
              />
              <MetricCard
                label="Value lost to cancellations"
                value={money(data.totals.cancelledValue)}
                delta={data.changes.cancelledValue}
                compareLabel={compare}
                tone="warn"
              />
            </div>

            <Panel title="Orders over time" hint={`Placed, delivered and cancelled per ${data.range.bucket}.`}>
              <TrendChart
                data={data.trend}
                bucket={data.range.bucket}
                format={(n) => count(n)}
                series={[
                  { key: "placed", label: "Placed", value: (r) => r.placed, color: CHART_COLORS.primary },
                  { key: "delivered", label: "Delivered", value: (r) => r.delivered, color: CHART_COLORS.teal },
                  { key: "cancelled", label: "Cancelled", value: (r) => r.cancelled, color: CHART_COLORS.rose },
                ]}
              />
            </Panel>

            <div className="grid gap-5 lg:grid-cols-2">
              <Panel
                title="Pipeline by stage"
                hint="Where the orders placed in this period are sitting right now."
                action={<ExportButton rows={data.byStatus} columns={statusColumns("Stage")} fileName="orders-by-stage" />}
              >
                <DataTable
                  rows={data.byStatus}
                  columns={statusColumns("Stage")}
                  rowKey={(r) => r.status}
                  empty="No orders in this period."
                />
              </Panel>

              <Panel title="Payment status">
                <DataTable
                  rows={data.byPaymentStatus}
                  columns={statusColumns("Payment status")}
                  rowKey={(r) => r.status}
                  empty="No orders in this period."
                />
              </Panel>

              <Panel
                title="Why orders were cancelled"
                action={
                  <ExportButton
                    rows={data.cancellationReasons}
                    columns={reasonColumns("Cancelled by")}
                    fileName="cancellation-reasons"
                  />
                }
              >
                <DataTable
                  rows={data.cancellationReasons}
                  columns={reasonColumns("Cancelled by")}
                  rowKey={(r) => `${r.reason}-${r.by}`}
                  empty="No cancellations in this period."
                  emptyHint="That is the good outcome."
                />
              </Panel>

              <Panel
                title="Why items were returned"
                hint="Counted by return request, which may cover several items of one order."
                action={
                  <ExportButton rows={data.returnReasons} columns={reasonColumns("Request status", false)} fileName="return-reasons" />
                }
              >
                <DataTable
                  rows={data.returnReasons}
                  columns={reasonColumns("Request status", false)}
                  rowKey={(r) => `${r.reason}-${r.by}`}
                  empty="No return requests in this period."
                />
              </Panel>
            </div>

            <Panel
              title="Orders in this period"
              hint={
                data.ordersTruncated
                  ? "Showing the 500 most recent. Narrow the period or add a filter to see the rest."
                  : undefined
              }
              action={<ExportButton rows={data.orders} columns={orderColumns} fileName="orders" />}
            >
              <DataTable
                rows={data.orders}
                columns={orderColumns}
                rowKey={(r) => r.id}
                empty="No orders match these filters."
                maxHeight="max-h-[32rem]"
              />
            </Panel>

            <Note>
              Delivery time is measured from when the order was placed to when delivery was confirmed, so it only covers
              orders that reached Delivered.
            </Note>
          </>
        )}
      </div>
    </PageContainer>
  );
}
