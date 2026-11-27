import { Skeleton } from "@/components/ui/skeleton";

interface AdminTableSkeletonProps {
  rows?: number;
  columns?: number;
  showStats?: boolean;
  bare?: boolean;
}

function TableGridSkeleton({ rows, columns }: { rows: number; columns: number }) {
  return (
    <div className="flex-1 min-h-0 overflow-x-auto scrollbar-thin flex flex-col rounded-xl border border-[var(--color-neutral-100)]">
      <div className="flex gap-4 border-b border-[var(--color-neutral-100)] bg-[var(--color-neutral-50)] px-4 py-3 min-w-[600px]">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>

      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="flex items-center gap-4 border-b border-[var(--color-neutral-100)] px-4 py-4 last:border-b-0 min-w-[600px]"
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={colIndex} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

function AdminTableSkeleton({ rows = 8, columns = 5, showStats = false, bare = false }: AdminTableSkeletonProps) {
  if (bare) {
    return <TableGridSkeleton rows={rows} columns={columns} />;
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <div className="flex-shrink-0 flex items-center justify-between px-1 py-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-[var(--color-background)] py-1 rounded-2xl">
        {showStats && (
          <div className="flex-shrink-0 flex gap-4 overflow-x-auto pb-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 min-w-64 flex-1 rounded-xl" />
            ))}
          </div>
        )}

        <div className="flex-shrink-0 mt-2 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <Skeleton className="h-11 w-full max-w-md rounded-xl" />
          <Skeleton className="h-11 w-36 rounded-xl" />
        </div>

        <div className="mt-6 flex-1 min-h-0 flex flex-col">
          <TableGridSkeleton rows={rows} columns={columns} />
        </div>
      </div>
    </div>
  );
}

export { AdminTableSkeleton };
