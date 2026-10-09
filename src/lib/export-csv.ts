import type { Table } from "@tanstack/react-table";

const SKIPPED_COLUMNS = new Set(["select", "actions", "action", "expander"]);

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(formatCell).join("; ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function escapeCsv(value: string): string {
  // Neutralise spreadsheet formula injection, then quote if needed.
  const safe = /^[=+\-@\t\r]/.test(value) && Number.isNaN(Number(value)) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Exports the table's rows (selected rows if any, else all rows currently listed) as CSV. */
export function exportTableToCsv<TData>(table: Table<TData>, fileName: string): void {
  const columns = table
    .getAllLeafColumns()
    .filter(
      (c) =>
        c.getIsVisible() &&
        !SKIPPED_COLUMNS.has(c.id.toLowerCase()) &&
        typeof c.accessorFn === "function"
    );

  const selected = table.getSelectedRowModel().rows;
  const rows = selected.length ? selected : table.getRowModel().rows;

  const headerLine = columns.map((c) => {
    const h = c.columnDef.header;
    return escapeCsv(typeof h === "string" ? h : c.id);
  });
  const lines = rows.map((row) =>
    columns.map((c) => escapeCsv(formatCell(row.getValue(c.id)))).join(",")
  );

  const csv = "﻿" + [headerLine.join(","), ...lines].join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileName}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export interface CsvColumn<TData> {
  key?: keyof TData | string;
  header: string;
  accessor?: (row: TData) => unknown;
}

/** Exports raw array data to CSV using column definitions or object keys. */
export function exportDataToCsv<TData extends Record<string, any>>(
  data: TData[],
  fileName: string,
  columns?: CsvColumn<TData>[]
): void {
  if (!data || data.length === 0) return;

  const cols: CsvColumn<TData>[] =
    columns && columns.length > 0
      ? columns
      : Object.keys(data[0])
          .filter((k) => !SKIPPED_COLUMNS.has(k.toLowerCase()))
          .map((k) => ({ key: k, header: k }));

  const headerLine = cols.map((c) => escapeCsv(c.header));
  const lines = data.map((row) =>
    cols
      .map((c) => {
        let val: unknown;
        if (c.accessor) {
          val = c.accessor(row);
        } else if (c.key) {
          val = row[c.key as string];
        }
        return escapeCsv(formatCell(val));
      })
      .join(",")
  );

  const csv = "﻿" + [headerLine.join(","), ...lines].join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileName}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
