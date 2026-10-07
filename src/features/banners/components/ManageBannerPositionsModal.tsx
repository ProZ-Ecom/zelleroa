"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormModal } from "@/components/common/FormModal";
import {
  useBannerPositions,
  useCreateBannerPosition,
  useUpdateBannerPosition,
  useDeleteBannerPosition,
} from "../hooks";
import { BannerPositionForm } from "./BannerPositionForm";
import type { BannerPositionDto } from "../types";

interface ManageBannerPositionsModalProps {
  open: boolean;
  onClose: () => void;
}

export function ManageBannerPositionsModal({
  open,
  onClose,
}: ManageBannerPositionsModalProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<BannerPositionDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BannerPositionDto | null>(
    null
  );

  const { data, isLoading } = useBannerPositions(
    { limit: 100 },
    { enabled: open }
  );
  const createMutation = useCreateBannerPosition();
  const updateMutation = useUpdateBannerPosition();
  const deleteMutation = useDeleteBannerPosition();

  const positions = data?.data ?? [];

  return (
    <>
      <FormModal
        open={open}
        onClose={onClose}
        title="Manage Banner Positions"
        description="Positions are the placements banners can be assigned to (e.g. home-hero, home-offer, home-popup-offer)."
        size="lg"
      >
        <div className="flex justify-end pb-4">
          <Button
            onClick={() => {
              setEditing(null);
              setIsFormOpen(true);
            }}
            className="h-10 rounded-xl bg-[var(--color-primary-500)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-primary-600)]"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Position
          </Button>
        </div>

        {isLoading ? (
          <p className="py-6 text-center text-sm text-[var(--color-neutral-500)]">
            Loading positions...
          </p>
        ) : positions.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--color-neutral-500)]">
            No banner positions yet. Add one to start uploading banners.
          </p>
        ) : (
          <div className="space-y-2">
            {positions.map((position) => (
              <div
                key={position.id}
                className="flex items-center justify-between rounded-xl border border-[var(--color-neutral-200)] p-3"
              >
                <div>
                  <p className="text-sm font-semibold text-[var(--color-neutral-900)]">
                    {position.name}{" "}
                    <span className="ml-1 font-mono text-xs text-[var(--color-neutral-500)]">
                      {position.slug}
                    </span>
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    {position.page && (
                      <span className="text-xs text-[var(--color-neutral-500)]">
                        Page: {position.page}
                      </span>
                    )}
                    <Badge
                      variant={position.isActive ? "success" : "secondary"}
                      className="text-xs"
                    >
                      {position.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditing(position);
                      setIsFormOpen(true);
                    }}
                    className="h-8 w-8 text-[var(--color-neutral-500)] hover:text-[var(--color-neutral-900)]"
                    title="Edit Position"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteTarget(position)}
                    className="h-8 w-8 text-[var(--color-error-500)] hover:bg-[var(--color-error-50)] hover:text-[var(--color-error-700)]"
                    title="Delete Position"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </FormModal>

      <FormModal
        open={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditing(null);
        }}
        title={editing ? "Edit Position" : "Add Position"}
        size="md"
      >
        <BannerPositionForm
          initialData={editing}
          isLoading={createMutation.isPending || updateMutation.isPending}
          submitLabel={editing ? "Update Position" : "Add Position"}
          onSubmit={async (formData) => {
            if (editing) {
              await updateMutation.mutateAsync({
                uuid: editing.id,
                data: formData,
              });
            } else {
              await createMutation.mutateAsync(formData);
            }
            setIsFormOpen(false);
            setEditing(null);
          }}
        />
      </FormModal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) {
            await deleteMutation.mutateAsync(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
        title="Delete Position"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? Banners assigned to this position will also be removed.`}
        confirmText="Delete Position"
        variant="destructive"
        isLoading={deleteMutation.isPending}
      />
    </>
  );
}
