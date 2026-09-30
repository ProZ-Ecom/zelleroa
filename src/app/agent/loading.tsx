import { Panel, TableSkeleton } from "@/features/agents/components/shared";

export default function AgentLoading() {
  return (
    <>
      <div className="h-8 w-64 animate-pulse rounded-lg bg-neutral-200" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-neutral-200/70" />
        ))}
      </div>
      <Panel>
        <TableSkeleton />
      </Panel>
    </>
  );
}
