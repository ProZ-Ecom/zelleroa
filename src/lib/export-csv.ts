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

/** Directly downloads raw rows with headers as a UTF-8 BOM CSV. */
export function downloadCsv(
  headers: string[],
  rows: (string | number | null | undefined)[][],
  fileName: string
): void {
  const headerLine = headers.map((h) => escapeCsv(String(h)));
  const lines = rows.map((row) => row.map((cell) => escapeCsv(formatCell(cell))).join(","));
  const csv = "\uFEFF" + [headerLine.join(","), ...lines].join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  const dateStr = new Date().toISOString().slice(0, 10);
  const cleanName = fileName.replace(/\.csv$/i, "").replace(new RegExp(`-${dateStr}$`), "");
  a.download = `${cleanName}-${dateStr}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Exports the table's rows (selected rows if any, else all rows currently listed) as CSV. */
export function exportTableToCsv<TData>(table: Table<TData>, fileName: string): void {
  const columns = table
    .getAllLeafColumns()
    .filter(
      (c) =>
        c.getIsVisible() &&
        !SKIPPED_COLUMNS.has(c.id.toLowerCase())
    );

  const selected = table.getSelectedRowModel().rows;
  const rows = selected.length ? selected : table.getRowModel().rows;

  const headerLine = columns.map((c) => {
    const h = c.columnDef.header;
    return escapeCsv(typeof h === "string" ? h : c.id);
  });
  const lines = rows.map((row) =>
    columns
      .map((c) => {
        let val: unknown;
        if (typeof c.accessorFn === "function") {
          try {
            val = row.getValue(c.id);
          } catch {
            val = undefined;
          }
        }
        if (val === undefined || val === null) {
          const orig = row.original as Record<string, unknown> | undefined;
          val = orig?.[c.id];
        }
        return escapeCsv(formatCell(val));
      })
      .join(",")
  );

  const csv = "\uFEFF" + [headerLine.join(","), ...lines].join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  const dateStr = new Date().toISOString().slice(0, 10);
  const cleanName = fileName.replace(/\.csv$/i, "").replace(new RegExp(`-${dateStr}$`), "");
  a.download = `${cleanName}-${dateStr}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
