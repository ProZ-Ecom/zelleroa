"use client";

import { MapPin, Repeat, UserPlus, Users } from "lucide-react";
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
import { reportErrorMessage, useReport } from "@/features/reports/hooks/use-report";
import type {
  AcquisitionRow,
  CustomersReport,
  GeoRow,
  TopCustomerRow,
} from "@/features/reports/services/customers-report.service";

const customerColumns: Column<TopCustomerRow>[] = [
  { header: "Customer", cell: (r) => r.name, csv: (r) => r.name },
  { header: "ID", cell: (r) => r.custId ?? "—", csv: (r) => r.custId },
  { header: "Phone", cell: (r) => r.phone ?? "—", csv: (r) => r.phone },
  { header: "City", cell: (r) => r.city ?? "—", csv: (r) => r.city },
  { header: "Orders", align: "right", cell: (r) => count(r.orders), csv: (r) => r.orders },
  { header: "Spent", align: "right", cell: (r) => moneyExact(r.revenue), csv: (r) => r.revenue },
  { header: "Average order", align: "right", cell: (r) => moneyExact(r.avgOrderValue), csv: (r) => r.avgOrderValue },
  { header: "Last order", cell: (r) => dateLabel(r.lastOrderAt), csv: (r) => formatCsvDateTime(r.lastOrderAt) },
  {
    header: "Since last order",
    align: "right",
    cell: (r) =>
      r.daysSinceLastOrder == null ? "—" : r.daysSinceLastOrder === 0 ? "Today" : days(r.daysSinceLastOrder),
    csv: (r) => r.daysSinceLastOrder,
  },
];

const geoColumns = (header: string): Column<GeoRow>[] => [
  { header, cell: (r) => r.label, csv: (r) => r.label },
  { header: "Customers", align: "right", cell: (r) => count(r.customers), csv: (r) => r.customers },
  { header: "Orders", align: "right", cell: (r) => count(r.orders), csv: (r) => r.orders },
  { header: "Revenue", align: "right", cell: (r) => moneyExact(r.revenue), csv: (r) => r.revenue },
  { header: "Share", align: "right", cell: (r) => <ShareBar share={r.share} />, csv: (r) => r.share },
];

const acquisitionColumns: Column<AcquisitionRow>[] = [
  { header: "Came through", cell: (r) => r.label, csv: (r) => r.label },
  { header: "Customers", align: "right", cell: (r) => count(r.customers), csv: (r) => r.customers },
  { header: "Orders", align: "right", cell: (r) => count(r.orders), csv: (r) => r.orders },
  { header: "Revenue", align: "right", cell: (r) => moneyExact(r.revenue), csv: (r) => r.revenue },
  { header: "Share", align: "right", cell: (r) => <ShareBar share={r.share} />, csv: (r) => r.share },
];

export default function CustomersReportPage() {
  const { filters, setFilters, data, isLoading, isFetching, error, refetch } = useReport<CustomersReport>(
    "/api/admin/reports/customers"
  );

  const compare = data ? compareLabelFor(data.range.days) : undefined;

  return (
    <PageContainer
      title="Customers Report"
      description="Who bought, who came back, where they are, and who has gone quiet."
      breadcrumbs={[
        { label: "Dashboard", href: "/admin/dashboard" },
        { label: "Reports", href: "/admin/dashboard/reports" },
        { label: "Customers" },
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
                label="Customers who bought"
                value={count(data.totals.buyers)}
                hint="Distinct customers with an order"
                delta={data.changes.buyers}
                compareLabel={compare}
                icon={Users}
                tone="good"
              />
              <MetricCard
                label="New buyers"
                value={count(data.totals.newBuyers)}
                hint="Their first ever order fell in this period"
                delta={data.changes.newBuyers}
                compareLabel={compare}
                icon={UserPlus}
              />
              <MetricCard
                label="Returning buyers"
                value={count(data.totals.returningBuyers)}
                hint={`${percent(data.totals.repeatRate)} of buyers had ordered before`}
                delta={data.changes.returningBuyers}
                compareLabel={compare}
                icon={Repeat}
                tone="good"
              />
              <MetricCard
                label="Sign-ups"
                value={count(data.totals.signups)}
                hint="New accounts, whether or not they bought"
                delta={data.changes.signups}
                compareLabel={compare}
              />
              <MetricCard
                label="Revenue"
                value={money(data.totals.revenue)}
                delta={data.changes.revenue}
                compareLabel={compare}
              />
              <MetricCard
                label="Spend per customer"
                value={money(data.totals.revenuePerBuyer)}
                hint="Revenue ÷ customers who bought"
                delta={data.changes.revenuePerBuyer}
                compareLabel={compare}
              />
              <MetricCard
                label="Orders per customer"
                value={data.totals.avgOrdersPerBuyer.toFixed(2)}
                delta={data.changes.avgOrdersPerBuyer}
                compareLabel={compare}
              />
              <MetricCard
                label="Average order"
                value={money(data.totals.avgOrderValue)}
                delta={data.changes.avgOrderValue}
                compareLabel={compare}
              />
            </div>

            <Panel
              title="New and returning over time"
              hint={`Per ${data.range.bucket}. A buyer counts as new in the bucket holding their first ever order.`}
            >
              <TrendChart
                data={data.trend}
                bucket={data.range.bucket}
                format={(n) => count(n)}
                series={[
                  { key: "new", label: "New buyers", value: (r) => r.newBuyers, color: CHART_COLORS.primary, kind: "bar" },
                  {
                    key: "returning",
                    label: "Returning buyers",
                    value: (r) => r.returningBuyers,
                    color: CHART_COLORS.teal,
                    kind: "bar",
                  },
                  { key: "signups", label: "Sign-ups", value: (r) => r.signups, color: CHART_COLORS.amber },
                ]}
              />
            </Panel>

            <Panel
              title="Top customers"
              hint="Highest 25 by spend in this period."
              action={<ExportButton rows={data.topCustomers} columns={customerColumns} fileName="top-customers" />}
            >
              <DataTable
                rows={data.topCustomers}
                columns={customerColumns}
                rowKey={(r) => r.id}
                empty="Nobody bought in this period."
                maxHeight="max-h-[28rem]"
              />
            </Panel>

            <div className="grid gap-5 lg:grid-cols-2">
              <Panel
                title="By state"
                hint="From the shipping address on each order."
                action={<ExportButton rows={data.byState} columns={geoColumns("State")} fileName="customers-by-state" />}
              >
                <DataTable
                  rows={data.byState}
                  columns={geoColumns("State")}
                  rowKey={(r) => r.key}
                  empty="No shipping addresses in this period."
                  maxHeight="max-h-[24rem]"
                />
              </Panel>

              <Panel
                title="Top cities"
                hint="Highest 15 by revenue."
                action={<ExportButton rows={data.byCity} columns={geoColumns("City")} fileName="customers-by-city" />}
              >
                <DataTable
                  rows={data.byCity}
                  columns={geoColumns("City")}
                  rowKey={(r) => r.key}
                  empty="No shipping addresses in this period."
                  maxHeight="max-h-[24rem]"
                />
              </Panel>
            </div>

            <Panel title="How they reached you" hint="Split by how each order was placed.">
              <DataTable
                rows={data.acquisition}
                columns={acquisitionColumns}
                rowKey={(r) => r.key}
                empty="No orders in this period."
              />
            </Panel>

            <Panel
              title="Gone quiet"
              hint="Past buyers with no order in the last 90 days, highest lifetime spend first. Not limited to the selected period."
              action={<ExportButton rows={data.churnRisk} columns={customerColumns} fileName="churn-risk-customers" />}
            >
              <DataTable
                rows={data.churnRisk}
                columns={customerColumns}
                rowKey={(r) => r.id}
                empty="Every past buyer has ordered in the last 90 days."
                maxHeight="max-h-[28rem]"
              />
            </Panel>

            <Note>
              <MapPin className="mr-1 inline h-3 w-3" />
              Location comes from the shipping address recorded on the order, not from the customer’s saved address, so it
              reflects where the goods actually went.
            </Note>
          </>
        )}
      </div>
    </PageContainer>
  );
}
