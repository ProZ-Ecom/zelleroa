"use client";

import { Package, PackageX, Percent, TrendingUp } from "lucide-react";
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
  ShareBar,
  count,
  money,
  moneyExact,
  percent,
} from "@/features/reports/components/report-ui";
import { reportErrorMessage, useReport, useReportOptions } from "@/features/reports/hooks/use-report";
import type { GroupRow, ProductsReport, SkuRow } from "@/features/reports/services/products-report.service";

const skuColumns: Column<SkuRow>[] = [
  { header: "SKU", cell: (r) => <span className="font-mono text-xs">{r.sku}</span>, csv: (r) => r.sku },
  { header: "Product", cell: (r) => r.product, csv: (r) => r.product },
  { header: "Variant", cell: (r) => r.variant, csv: (r) => r.variant },
  { header: "Category", cell: (r) => r.category, csv: (r) => r.category },
  { header: "Brand", cell: (r) => r.brand, csv: (r) => r.brand },
  { header: "Units", align: "right", cell: (r) => count(r.units), csv: (r) => r.units },
  { header: "Orders", align: "right", cell: (r) => count(r.orders), csv: (r) => r.orders },
  { header: "Revenue", align: "right", cell: (r) => moneyExact(r.revenue), csv: (r) => r.revenue },
  { header: "Cost", align: "right", cell: (r) => (r.cost == null ? "—" : moneyExact(r.cost)), csv: (r) => r.cost },
  {
    header: "Margin",
    align: "right",
    cell: (r) =>
      r.margin == null ? (
        <span className="text-neutral-400">—</span>
      ) : (
        <span className={r.margin >= 0 ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"}>
          {moneyExact(r.margin)}
        </span>
      ),
    csv: (r) => r.margin,
  },
  { header: "Margin %", align: "right", cell: (r) => percent(r.marginPercent), csv: (r) => r.marginPercent },
  { header: "Returned", align: "right", cell: (r) => count(r.returnedUnits), csv: (r) => r.returnedUnits },
  { header: "In stock", align: "right", cell: (r) => count(r.stock), csv: (r) => r.stock },
];

const groupColumns = (header: string): Column<GroupRow>[] => [
  { header, cell: (r) => r.label, csv: (r) => r.label },
  { header: "SKUs", align: "right", cell: (r) => count(r.skus), csv: (r) => r.skus },
  { header: "Units", align: "right", cell: (r) => count(r.units), csv: (r) => r.units },
  { header: "Revenue", align: "right", cell: (r) => moneyExact(r.revenue), csv: (r) => r.revenue },
  { header: "Share", align: "right", cell: (r) => <ShareBar share={r.share} />, csv: (r) => r.share },
];

const compactSkuColumns: Column<SkuRow>[] = [
  { header: "SKU", cell: (r) => <span className="font-mono text-xs">{r.sku}</span>, csv: (r) => r.sku },
  { header: "Product", cell: (r) => r.product, csv: (r) => r.product },
  { header: "Units", align: "right", cell: (r) => count(r.units), csv: (r) => r.units },
  { header: "Revenue", align: "right", cell: (r) => moneyExact(r.revenue), csv: (r) => r.revenue },
  { header: "In stock", align: "right", cell: (r) => count(r.stock), csv: (r) => r.stock },
];

export default function ProductsReportPage() {
  const { filters, setFilters, data, isLoading, isFetching, error, refetch } = useReport<ProductsReport>(
    "/api/admin/reports/products"
  );
  const { data: options } = useReportOptions();

  return (
    <PageContainer
      title="Products Report"
      description="What sold, what did not, and what each SKU actually earned."
      breadcrumbs={[
        { label: "Dashboard", href: "/admin/dashboard" },
        { label: "Reports", href: "/admin/dashboard/reports" },
        { label: "Products" },
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
                label="Revenue"
                value={money(data.totals.revenue)}
                hint="Across all order lines in this period"
                icon={TrendingUp}
                tone="good"
              />
              <MetricCard label="Units sold" value={count(data.totals.units)} icon={Package} />
              <MetricCard
                label="SKUs that sold"
                value={count(data.totals.skusSold)}
                hint={`${count(data.totals.zeroSaleSkus)} live SKUs sold nothing`}
              />
              <MetricCard
                label="Margin"
                value={data.totals.margin ? money(data.totals.margin) : "—"}
                hint={
                  data.totals.costCoverage >= 99
                    ? "On all revenue"
                    : `Only on the ${percent(data.totals.costCoverage)} of revenue that has a cost`
                }
                icon={Percent}
                tone={data.totals.margin >= 0 ? "good" : "bad"}
              />
              <MetricCard
                label="Margin %"
                value={percent(data.totals.marginPercent)}
                hint="Margin ÷ costed revenue"
              />
              <MetricCard
                label="Cost recorded"
                value={moneyExact(data.totals.cost)}
                hint={`Covers ${percent(data.totals.costCoverage)} of revenue`}
              />
              <MetricCard
                label="Units returned"
                value={count(data.totals.returnedUnits)}
                hint={`${percent(data.totals.returnRate)} of units sold`}
                tone={data.totals.returnRate > 10 ? "bad" : "default"}
              />
              <MetricCard
                label="Nothing sold"
                value={count(data.totals.zeroSaleSkus)}
                hint="Live SKUs with no sale in this period"
                icon={PackageX}
                tone={data.totals.zeroSaleSkus > 0 ? "warn" : "default"}
              />
            </div>

            {data.totals.costCoverage < 99 && (
              <Note tone="warn">
                Cost is only known for SKUs that have been received against a purchase, so margin here covers{" "}
                {percent(data.totals.costCoverage)} of revenue. Record purchase receipts to close the gap.
              </Note>
            )}

            <div className="grid gap-5 lg:grid-cols-2">
              <Panel
                title="Best sellers"
                hint="Top ten by units sold."
                action={<ExportButton rows={data.bestSellers} columns={compactSkuColumns} fileName="best-sellers" />}
              >
                <DataTable rows={data.bestSellers} columns={compactSkuColumns} rowKey={(r) => r.key} empty="Nothing sold in this period." />
              </Panel>

              <Panel
                title="Slow movers"
                hint="Sold at least one, but the fewest."
                action={<ExportButton rows={data.slowMovers} columns={compactSkuColumns} fileName="slow-movers" />}
              >
                <DataTable rows={data.slowMovers} columns={compactSkuColumns} rowKey={(r) => r.key} empty="Nothing sold in this period." />
              </Panel>

              <Panel
                title="By category"
                action={<ExportButton rows={data.byCategory} columns={groupColumns("Category")} fileName="products-by-category" />}
              >
                <DataTable
                  rows={data.byCategory}
                  columns={groupColumns("Category")}
                  rowKey={(r) => r.key}
                  empty="Nothing sold in this period."
                />
              </Panel>

              <Panel
                title="By brand"
                action={<ExportButton rows={data.byBrand} columns={groupColumns("Brand")} fileName="products-by-brand" />}
              >
                <DataTable
                  rows={data.byBrand}
                  columns={groupColumns("Brand")}
                  rowKey={(r) => r.key}
                  empty="Nothing sold in this period."
                />
              </Panel>
            </div>

            <Panel
              title="Sold nothing in this period"
              hint={
                data.zeroSaleTruncated
                  ? `${count(data.totals.zeroSaleSkus)} live SKUs sold nothing. Showing the first 100.`
                  : "Live SKUs with no sale in this period."
              }
              action={<ExportButton rows={data.zeroSale} columns={compactSkuColumns} fileName="zero-sale-skus" />}
            >
              <DataTable
                rows={data.zeroSale}
                columns={compactSkuColumns}
                rowKey={(r) => r.key}
                empty="Every live SKU sold at least one unit."
                maxHeight="max-h-[24rem]"
              />
            </Panel>

            <Panel
              title="Every SKU that sold"
              hint={
                data.skusTruncated
                  ? "Showing the top 1,000 by revenue. Filter by category or brand to narrow it down."
                  : "Sorted by revenue."
              }
              action={<ExportButton rows={data.skus} columns={skuColumns} fileName="sku-performance" />}
            >
              <DataTable
                rows={data.skus}
                columns={skuColumns}
                rowKey={(r) => r.key}
                empty="Nothing sold in this period."
                maxHeight="max-h-[36rem]"
              />
            </Panel>
          </>
        )}
      </div>
    </PageContainer>
  );
}
