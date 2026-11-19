"use client";

function Block({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-2xl bg-[var(--color-neutral-100)] ${className}`} />;
}

function CardGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Block key={i} className="h-32" />
      ))}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8 p-6" aria-busy="true" aria-label="Loading dashboard">
      <Block className="h-10 w-72" />
      <div className="space-y-3">
        <Block className="h-5 w-48" />
        <CardGrid />
      </div>
      <div className="space-y-3">
        <Block className="h-5 w-48" />
        <CardGrid />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Block className="h-80 lg:col-span-2" />
        <Block className="h-80" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Block className="h-64" />
        <Block className="h-64" />
        <Block className="h-64" />
      </div>
    </div>
  );
}

export { DashboardSkeleton };
