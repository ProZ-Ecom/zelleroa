"use client";

import { useRef, useState } from "react";
import { AlertTriangle, Download, FileSpreadsheet, Upload } from "lucide-react";
import { readSheet } from "read-excel-file/browser";
import writeExcelFile from "write-excel-file/browser";
import type { ZodType } from "zod";
import { FormModal } from "@/components/common/FormModal";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/Toast";

const MAX_ROWS = 500;
const MAX_BYTES = 2 * 1024 * 1024;

export interface ImportColumn {
  /** Key used in the row object passed to `schema` / `prepare`. */
  key: string;
  /** Header text in the Excel file (matched ignoring case and spaces). */
  header: string;
  /** Example values shown in the downloadable sample (one per sample row). */
  samples: (string | number)[];
  /** Short guidance shown to the user in the dialog, like a form field's info message. */
  info?: string;
  required?: boolean;
  type?: "text" | "number";
}

interface ExcelImportDialogProps {
  open: boolean;
  onClose: () => void;
  /** e.g. "Brands" */
  title: string;
  /** File name for the sample download, without extension. */
  sampleFileName: string;
  columns: ImportColumn[];
  /** Validates one row (after `prepare`). The parsed output is sent to `createRow`. */
  schema: ZodType;
  /** Optional step to turn raw cell values into the shape `schema` expects (lookups, defaults). */
  prepare?: (row: Record<string, unknown>) => Record<string, unknown> | { error: string };
  createRow: (payload: Record<string, unknown>) => Promise<unknown>;
  onImported: () => void;
  /** Extra guidance shown under the sample button, e.g. allowed values. */
  hint?: string;
  /**
   * Shown as a highlighted notice before the upload steps and again in the result summary.
   * Use it where an image belongs on the record but cannot travel in a spreadsheet, so the
   * user knows the import leaves something for them to finish.
   */
  imageNotice?: string;
}

type RowStatus = "valid" | "invalid" | "created" | "failed";

interface PreviewRow {
  line: number;
  values: Record<string, unknown>;
  payload?: Record<string, unknown>;
  status: RowStatus;
  message?: string;
}

const norm = (v: unknown) => String(v ?? "").toLowerCase().replace(/\s+/g, "");

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : "Failed";
}

export function ExcelImportDialog({
  open,
  onClose,
  title,
  sampleFileName,
  columns,
  schema,
  prepare,
  createRow,
  onImported,
  hint,
  imageNotice,
}: ExcelImportDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [finished, setFinished] = useState(false);

  const reset = () => {
    setFileName("");
    setRows([]);
    setImporting(false);
    setFinished(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const close = () => {
    if (importing) return;
    reset();
    onClose();
  };

  const downloadSample = async () => {
    const sampleCount = Math.max(...columns.map((c) => c.samples.length));
    const headerRow = columns.map((c) => ({
      value: c.required ? `${c.header} *` : c.header,
      fontWeight: "bold" as const,
    }));
    const body = Array.from({ length: sampleCount }, (_, i) =>
      columns.map((c) => {
        const v = c.samples[i];
        return v === undefined ? null : { value: v };
      })
    );
    await writeExcelFile([headerRow, ...body] as never).toFile(`${sampleFileName}-sample.xlsx`);
  };

  const handleFile = async (file: File) => {
    reset();
    if (!/\.xlsx$/i.test(file.name)) return toast.error("Invalid file", "Upload an .xlsx Excel file");
    if (file.size > MAX_BYTES) return toast.error("File too large", "Maximum size is 2 MB");

    let sheet: unknown[][];
    try {
      sheet = (await readSheet(file)) as unknown[][];
    } catch {
      return toast.error("Could not read file", "Save it as .xlsx and try again");
    }

    const header = sheet[0] ?? [];
    const colIndex = columns.map((c) =>
      header.findIndex((h) => norm(h).replace(/\*$/, "") === norm(c.header))
    );
    const missing = columns.filter((c, i) => c.required && colIndex[i] < 0);
    if (missing.length > 0) {
      return toast.error("Columns missing", missing.map((c) => c.header).join(", "));
    }

    const body = sheet.slice(1).filter((r) => r.some((cell) => cell !== null && cell !== ""));
    if (body.length === 0) return toast.error("No data", "The file has no rows below the header");
    if (body.length > MAX_ROWS) return toast.error("Too many rows", `Maximum ${MAX_ROWS} rows per upload`);

    const parsed = body.map((r, i): PreviewRow => {
      const values: Record<string, unknown> = {};
      columns.forEach((c, ci) => {
        const raw = colIndex[ci] >= 0 ? r[colIndex[ci]] : undefined;
        if (raw === null || raw === undefined || raw === "") {
          values[c.key] = undefined;
        } else if (c.type === "number") {
          values[c.key] = Number(raw);
        } else {
          values[c.key] = String(raw).trim();
        }
      });

      const prepared = prepare ? prepare(values) : values;
      if ("error" in prepared && typeof prepared.error === "string") {
        return { line: i + 2, values, status: "invalid", message: prepared.error };
      }
      const result = schema.safeParse(prepared);
      if (!result.success) {
        return {
          line: i + 2,
          values,
          status: "invalid",
          message: result.error.issues[0]?.message ?? "Invalid row",
        };
      }
      return { line: i + 2, values, payload: result.data as Record<string, unknown>, status: "valid" };
    });

    setFileName(file.name);
    setRows(parsed);
  };

  const validCount = rows.filter((r) => r.status === "valid").length;
  const createdCount = rows.filter((r) => r.status === "created").length;
  const failedCount = rows.filter((r) => r.status === "invalid" || r.status === "failed").length;

  const runImport = async () => {
    setImporting(true);
    const next = [...rows];
    for (let i = 0; i < next.length; i++) {
      const row = next[i];
      if (row.status !== "valid" || !row.payload) continue;
      try {
        await createRow(row.payload);
        next[i] = { ...row, status: "created" };
      } catch (err) {
        next[i] = { ...row, status: "failed", message: errorMessage(err) };
      }
      setRows([...next]);
    }
    setImporting(false);
    setFinished(true);
    const created = next.filter((r) => r.status === "created").length;
    if (created > 0) {
      toast.success("Import complete", `${created} ${title.toLowerCase()} added.`);
      onImported();
    }
  };

  return (
    <FormModal
      open={open}
      onClose={close}
      title={`Import ${title}`}
      description="Upload an Excel (.xlsx) file to add many records at once"
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={close} disabled={importing}>
            {finished ? "Close" : "Cancel"}
          </Button>
          {!finished && rows.length > 0 && (
            <Button
              onClick={runImport}
              disabled={importing || validCount === 0}
              className="bg-theme-primary hover:bg-theme-primary-hover text-white"
            >
              {importing ? "Importing…" : `Import ${validCount} valid row${validCount === 1 ? "" : "s"}`}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {imageNotice && (
          <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{imageNotice}</p>
          </div>
        )}

        <div className="flex flex-col gap-3 rounded-xl border border-dashed border-[var(--color-neutral-300)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-[var(--color-neutral-600)]">
            <p className="font-medium text-[var(--color-neutral-900)]">1. Download the sample file</p>
            <p>Fill it in with your data. Columns marked * are required.</p>
            {hint && <p className="mt-1 text-xs">{hint}</p>}
            <ul className="mt-2 space-y-0.5 text-xs">
              {columns.map((c) => (
                <li key={c.key}>
                  <span className="font-medium text-[var(--color-neutral-800)]">
                    {c.header}
                    {c.required ? " *" : ""}:
                  </span>{" "}
                  {c.info ?? (c.required ? "Required" : "Optional")}
                </li>
              ))}
            </ul>
          </div>
          <Button variant="outline" onClick={downloadSample} className="shrink-0">
            <Download className="mr-2 h-4 w-4" />
            Download sample
          </Button>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-dashed border-[var(--color-neutral-300)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-[var(--color-neutral-600)]">
            <p className="font-medium text-[var(--color-neutral-900)]">2. Upload your file</p>
            <p className="flex items-center gap-1">
              {fileName ? (
                <>
                  <FileSpreadsheet className="h-4 w-4" /> {fileName}
                </>
              ) : (
                `.xlsx, up to ${MAX_ROWS} rows`
              )}
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
          <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={importing} className="shrink-0">
            <Upload className="mr-2 h-4 w-4" />
            {fileName ? "Choose another" : "Choose file"}
          </Button>
        </div>

        {rows.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-[var(--color-neutral-700)]">
              {finished
                ? `${createdCount} added, ${failedCount} not added`
                : `${validCount} ready to import, ${failedCount} with errors (skipped)`}
            </p>
            {finished && imageNotice && createdCount > 0 && (
              <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{imageNotice}</p>
              </div>
            )}
            <div className="max-h-72 overflow-auto rounded-xl border border-[var(--color-neutral-200)]">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-[var(--color-neutral-50)] text-xs text-[var(--color-neutral-600)]">
                  <tr>
                    <th className="px-3 py-2">Row</th>
                    {columns.map((c) => (
                      <th key={c.key} className="px-3 py-2">
                        {c.header}
                      </th>
                    ))}
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.line} className="border-t border-[var(--color-neutral-100)]">
                      <td className="px-3 py-2 text-[var(--color-neutral-500)]">{r.line}</td>
                      {columns.map((c) => (
                        <td key={c.key} className="px-3 py-2">
                          {r.values[c.key] === undefined ? "—" : String(r.values[c.key])}
                        </td>
                      ))}
                      <td className="px-3 py-2">
                        {r.status === "valid" && <span className="text-[var(--color-neutral-500)]">Ready</span>}
                        {r.status === "created" && <span className="text-[var(--color-success-700)]">Added</span>}
                        {(r.status === "invalid" || r.status === "failed") && (
                          <span className="text-[var(--color-error-600)]">{r.message}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </FormModal>
  );
}
