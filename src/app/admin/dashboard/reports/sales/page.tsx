"use client";

import { BarChart3, IndianRupee, Package, ShoppingCart } from "lucide-react";
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
  money,
  moneyExact,
} from "@/features/reports/components/report-ui";
import { reportErrorMessage, useReport, useReportOptions } from "@/features/reports/hooks/use-report";
import { ORDER_SOURCE_OPTIONS } from "@/features/reports/lib/report-labels";
import type { SalesBreakdownRow, SalesReport } from "@/features/reports/services/sales-report.service";

function breakdownColumns(firstHeader: string, showUnits = true): Column<SalesBreakdownRow>[] {
  return [
    { header: firstHeader, cell: (r) => r.label, csv: (r) => r.label },
    { header: "Orders", align: "right", cell: (r) => count(r.orders), csv: (r) => r.orders },
    ...(showUnits ? [{ header: "Units", align: "right" as const, cell: (r: SalesBreakdownRow) => count(r.units), csv: (r: SalesBreakdownRow) => r.units }] : []),
    { header: "Sales", align: "right", cell: (r) => moneyExact(r.netSales), csv: (r) => r.netSales },
    { header: "Share", align: "right", cell: (r) => <ShareBar share={r.share} />, csv: (r) => r.share },
  ];
}

export default function SalesReportPage() {
  const { filters, setFilters, data, isLoading, isFetching, error, refetch } = useReport<SalesReport>(
    "/api/admin/reports/sales"
  );
  const { data: options } = useReportOptions();

  const compare = data ? compareLabelFor(data.range.days) : undefined;

  return (
    <PageContainer
      title="Sales Report"
      description="How much you sold, where it came from, and how that compares with the period before."
      breadcrumbs={[
        { label: "Dashboard", href: "/admin/dashboard" },
        { label: "Reports", href: "/admin/dashboard/reports" },
        { label: "Sales" },
      ]}
    >
      <div className="flex flex-col gap-5">
        <Panel>
          <ReportFilters
            value={filters}
            onChange={setFilters}
            extras={[
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
                label="Net sales"
                value={money(data.totals.netSales)}
                hint="What customers were billed, delivery included"
                delta={data.changes.netSales}
                compareLabel={compare}
                icon={IndianRupee}
                tone="good"
              />
              <MetricCard
                label="Orders"
                value={count(data.totals.orders)}
                hint="Cancelled and returned orders excluded"
                delta={data.changes.orders}
                compareLabel={compare}
                icon={ShoppingCart}
              />
              <MetricCard
                label="Average order"
                value={money(data.totals.avgOrderValue)}
                hint="Net sales ÷ orders"
                delta={data.changes.avgOrderValue}
                compareLabel={compare}
                icon={BarChart3}
              />
              <MetricCard
                label="Units sold"
                value={count(data.totals.units)}
                hint="Across all order lines"
                delta={data.changes.units}
                compareLabel={compare}
                icon={Package}
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
                hint="Coupons and offers together"
                delta={data.changes.discount}
                compareLabel={compare}
                tone="warn"
              />
              <MetricCard
                label="Tax collected"
                value={money(data.totals.tax)}
                delta={data.changes.tax}
                compareLabel={compare}
              />
              <MetricCard
                label="Delivery charged"
                value={money(data.totals.shipping)}
                delta={data.changes.shipping}
                compareLabel={compare}
              />
            </div>

            <Panel title="Sales over time" hint={`Grouped by ${data.range.bucket}. Hover a point to read the exact figure.`}>
              <TrendChart
                data={data.trend}
                bucket={data.range.bucket}
                format={(n) => money(n)}
                series={[
                  { key: "net", label: "Net sales", value: (r) => r.netSales, color: CHART_COLORS.primary },
                  { key: "gross", label: "Product value", value: (r) => r.grossSales, color: CHART_COLORS.teal },
                ]}
              />
            </Panel>

            <Panel title="Orders over time" hint={`Order count per ${data.range.bucket}.`}>
              <TrendChart
                data={data.trend}
                bucket={data.range.bucket}
                format={(n) => count(n)}
                height={180}
                series={[{ key: "orders", label: "Orders", value: (r) => r.orders, color: CHART_COLORS.violet, kind: "bar" }]}
              />
            </Panel>

            <div className="grid gap-5 lg:grid-cols-2">
              <Panel
                title="By category"
                hint="Share is of product value, so discounts and delivery do not distort it."
                action={
                  <ExportButton rows={data.byCategory} columns={breakdownColumns("Category")} fileName="sales-by-category" />
                }
              >
                <DataTable
                  rows={data.byCategory}
                  columns={breakdownColumns("Category")}
                  rowKey={(r) => r.key}
                  empty="No category sales in this period."
                  emptyHint="Products need a category set for them to appear here."
                />
              </Panel>

              <Panel
                title="By brand"
                action={<ExportButton rows={data.byBrand} columns={breakdownColumns("Brand")} fileName="sales-by-brand" />}
              >
                <DataTable
                  rows={data.byBrand}
                  columns={breakdownColumns("Brand")}
                  rowKey={(r) => r.key}
                  empty="No brand sales in this period."
                />
              </Panel>

              <Panel title="Where orders came from">
                <DataTable
                  rows={data.bySource}
                  columns={breakdownColumns("Channel", false)}
                  rowKey={(r) => r.key}
                  empty="No orders in this period."
                />
              </Panel>

              <Panel title="Top sales partners" hint="Highest ten by net sales.">
                <DataTable
                  rows={data.byAgent}
                  columns={breakdownColumns("Sales partner", false)}
                  rowKey={(r) => r.key}
                  empty="No partner-linked orders in this period."
                  emptyHint="Only orders carrying a referral code or an assigned partner count here."
                />
              </Panel>

              <Panel
                title="Top products"
                action={<ExportButton rows={data.topProducts} columns={breakdownColumns("Product")} fileName="top-products" />}
              >
                <DataTable
                  rows={data.topProducts}
                  columns={breakdownColumns("Product")}
                  rowKey={(r) => r.key}
                  empty="No products sold in this period."
                />
              </Panel>

              <Panel
                title="Top customers"
                action={
                  <ExportButton rows={data.topCustomers} columns={breakdownColumns("Customer", false)} fileName="top-customers" />
                }
              >
                <DataTable
                  rows={data.topCustomers}
                  columns={breakdownColumns("Customer", false)}
                  rowKey={(r) => r.key}
                  empty="No customers bought in this period."
                />
              </Panel>
            </div>

            <Note>
              Cancelled and returned orders are left out of every figure on this page. For the cancellation and return
              picture, open the Orders report.
            </Note>
          </>
        )}
      </div>
    </PageContainer>
  );
}
