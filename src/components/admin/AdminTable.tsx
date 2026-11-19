"use client";

import * as React from "react";
import { Download, X } from "lucide-react";
import { DataTable, type DataTableProps } from "@/components/admin/data-table/DataTable";
import { cn } from "@/lib/utils";

interface AdminTableProps<TData, TValue>
  extends Omit<DataTableProps<TData, TValue>, "onExport"> {
  onExport?: (rows: TData[]) => void;
  bulkActions?: React.ReactNode;
}


function AdminTable<TData, TValue>({
  columns,
  data,
  onExport,
  bulkActions,
  ...props
}: AdminTableProps<TData, TValue>) {
  const [rowSelection, setRowSelection] = React.useState<Record<number, boolean>>({});
  const [tableKey, setTableKey] = React.useState(0);

  const selectedCount = Object.keys(rowSelection).length;
  const hasSelection = selectedCount > 0;

  const handleClearSelection = () => {
    setRowSelection({});
    setTableKey((k) => k + 1);
  };

  const handleExport = () => {
    if (!onExport) return;
    if (hasSelection) {
      const selectedRows = data.filter((_, index) => rowSelection[index]);
      onExport(selectedRows);
    } else {
      onExport(data);
    }
  };

  return (
    <div className="flex flex-1 min-h-0 flex-col h-full space-y-4">
      {hasSelection && bulkActions && (
        <div className="flex-shrink-0 flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-primary">
              {selectedCount} row(s) selected
            </span>
            <button
              onClick={handleClearSelection}
              className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              <X className="h-3 w-3" />
              Clear selection
            </button>
          </div>
          <div className="flex items-center gap-2">{bulkActions}</div>
        </div>
      )}

      {onExport && (
        <div className="flex-shrink-0 flex justify-end">
          <button
            onClick={handleExport}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium",
              "text-gray-700 hover:bg-gray-50 transition-colors"
            )}
          >
            <Download className="h-4 w-4" />
            Export{hasSelection ? ` (${selectedCount})` : " All"}
          </button>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <DataTable
          key={tableKey}
          columns={columns}
          data={data}
          {...props}
        />
      </div>
    </div>
  );
}

export { AdminTable };
export type { AdminTableProps };
