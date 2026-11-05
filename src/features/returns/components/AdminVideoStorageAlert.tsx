"use client";

import { useState } from "react";
import { AlertTriangle, HardDrive, Trash2, ShieldCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useAdminStorageUsage, useClearStorage } from "../hooks/use-returns";
import { toast } from "@/components/ui/Toast";

export function AdminVideoStorageAlert() {
  const { data: usage, isLoading, refetch } = useAdminStorageUsage();
  const clearMutation = useClearStorage();
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (isLoading || !usage || !usage.isReached) {
    return null;
  }

  const handleClear = async () => {
    try {
      const res = await clearMutation.mutateAsync();
      toast.success(
        "Storage Cleared Safely",
        `Cleared ${res.totalCleared} unboxing video(s). All other files were untouched.`
      );
      setConfirmOpen(false);
      refetch();
    } catch (err: any) {
      toast.error("Cleanup Error", err?.message || "Failed to clear video storage");
    }
  };

  return (
    <>
      <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-sm dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="space-y-1">
            <div className="font-semibold text-sm sm:text-base">
              Video Storage Alert: {usage.usedPercent}% Reached ({usage.totalMb} MB / {usage.limitMb} MB)
            </div>
            <p className="text-xs sm:text-sm text-amber-800 dark:text-amber-300">
              Unboxing video storage has reached the 80% threshold ({usage.fileCount} video files).
              You can safely clear old videos to free up space.
            </p>
            <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 pt-0.5 font-medium">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              <span>Safe Cleanup: Only unboxing videos will be removed. All other files in Google Drive remain untouched.</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
          <Button
            size="sm"
            variant="destructive"
            className="bg-amber-700 hover:bg-amber-800 text-white font-medium shadow-sm"
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            Clear Storage
          </Button>
        </div>
      </div>

      <ClearConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleClear}
        isPending={clearMutation.isPending}
        usage={usage}
      />
    </>
  );
}

export function AdminVideoStorageButton() {
  const { data: usage, refetch } = useAdminStorageUsage();
  const clearMutation = useClearStorage();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleClear = async () => {
    try {
      const res = await clearMutation.mutateAsync();
      toast.success(
        "Storage Cleared Safely",
        `Cleared ${res.totalCleared} unboxing video(s). All other files were untouched.`
      );
      setConfirmOpen(false);
      refetch();
    } catch (err: any) {
      toast.error("Cleanup Error", err?.message || "Failed to clear video storage");
    }
  };

  const isWarning = usage?.isReached ?? false;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setConfirmOpen(true)}
        className={
          isWarning
            ? "border-amber-400 text-amber-700 hover:bg-amber-50"
            : "text-neutral-700 dark:text-neutral-200"
        }
        title={
          usage
            ? `Video Storage: ${usage.totalMb} MB / ${usage.limitMb} MB (${usage.usedPercent}%)`
            : "Check Video Storage"
        }
      >
        <HardDrive className="mr-1.5 h-4 w-4" />
        Storage: {usage ? `${usage.totalMb} MB (${usage.usedPercent}%)` : "Checking..."}
      </Button>

      <ClearConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleClear}
        isPending={clearMutation.isPending}
        usage={usage}
      />
    </>
  );
}

function ClearConfirmModal({
  open,
  onClose,
  onConfirm,
  isPending,
  usage,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
  usage?: any;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 text-red-600 font-semibold text-lg">
          <Trash2 className="h-5 w-5" />
          Clear Unboxing Video Storage
        </div>
      }
      className="max-w-md p-6"
    >
      <div className="space-y-4 pt-2">
        <p className="text-sm text-neutral-600 dark:text-neutral-300">
          Currently using <strong>{usage?.totalMb || 0} MB</strong> of{" "}
          <strong>{usage?.limitMb || 50} MB</strong> ({usage?.usedPercent || 0}%).
          Found <strong>{usage?.fileCount || 0}</strong> unboxing video files.
        </p>

        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
          <div className="font-semibold flex items-center gap-1.5 mb-1 text-emerald-900 dark:text-emerald-200">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Guaranteed File Safety:
          </div>
          Only return unboxing video files will be removed. Any other files in Google Drive or local storage are 100% safe and will <strong>NOT</strong> be touched.
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isPending}
            className="gap-1.5"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Clearing...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Clear Unboxing Videos
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
