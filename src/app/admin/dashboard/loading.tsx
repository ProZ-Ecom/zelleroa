import { Spinner } from "@/components/ui/spinner";

export default function AdminDashboardLoading() {
  return (
    <div className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-3">
      <Spinner size="lg" />
      <p className="text-sm text-neutral-600">Loading dashboard...</p>
    </div>
  );
}
