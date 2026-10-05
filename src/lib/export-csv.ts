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
