"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { FormModal } from "@/components/common/FormModal";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/Toast";
import { useAdminProducts } from "@/features/products/hooks";
import { useAdminTag, useAssignTagProducts } from "../hooks";
import type { AdminTagResponse } from "../types";

interface TagProductsModalProps {
  tag: AdminTagResponse | null;
  onClose: () => void;
}

/** Lets an admin pick every product that should carry the tag, in one save. */
export function TagProductsModal({ tag, onClose }: TagProductsModalProps) {
  return (
    <FormModal
      open={!!tag}
      onClose={onClose}
      title={tag ? `Products tagged "${tag.name}"` : "Tag products"}
      description="Tick every product that should carry this tag. Saving replaces the tag's current product list."
      size="lg"
    >
      {/* Keyed by tag so each tag opens with a fresh search and selection. */}
      {tag && <TagProductsPicker key={tag.id} tag={tag} onClose={onClose} />}
    </FormModal>
  );
}

function TagProductsPicker({ tag, onClose }: { tag: AdminTagResponse; onClose: () => void }) {
  const [search, setSearch] = React.useState("");
  // Changes made on top of the tag's saved products: id -> checked (true) or unchecked (false).
  const [changes, setChanges] = React.useState<Map<string, boolean>>(new Map());

  const { data: detail } = useAdminTag(tag.id);
  const { data: results, isFetching } = useAdminProducts({
    page: 1,
    pageSize: 50,
    search: search.trim() || undefined,
  });
  const assignMutation = useAssignTagProducts();

  const savedIds = React.useMemo(
    () => new Set((detail?.data?.products ?? []).map((p) => p.id)),
    [detail]
  );
  const isChecked = (id: string) => changes.get(id) ?? savedIds.has(id);

  const selectedIds = React.useMemo(() => {
    const ids = new Set(savedIds);
    changes.forEach((checked, id) => (checked ? ids.add(id) : ids.delete(id)));
    return ids;
  }, [savedIds, changes]);

  const toggle = (id: string) => {
    setChanges((prev) => new Map(prev).set(id, !isChecked(id)));
  };

  const handleSave = async () => {
    try {
      await assignMutation.mutateAsync({
        id: tag.id,
        productIds: Array.from(selectedIds),
        action: "set",
      });
      toast.success("Tag products updated");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Failed to update tag products");
    }
  };

  const products = results?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-neutral-400)]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products..."
          className="h-11 w-full rounded-xl border border-theme-border bg-white pl-9 pr-3 text-sm outline-none focus:border-theme-primary"
        />
      </div>

      <div className="max-h-72 space-y-1 overflow-y-auto rounded-xl border border-theme-border p-2">
        {products.length === 0 ? (
          <p className="p-4 text-center text-sm text-theme-text-muted">
            {isFetching ? "Loading products..." : "No products found."}
          </p>
        ) : (
          products.map((product) => (
            <div key={product.id} className="rounded-lg px-2 py-1.5 hover:bg-theme-surface-alt">
              <Checkbox
                checked={isChecked(product.id)}
                onChange={() => toggle(product.id)}
                label={product.name}
              />
            </div>
          ))
        )}
      </div>

      <p className="text-xs text-theme-text-muted">{selectedIds.size} product(s) selected</p>

      <div className="flex justify-end pt-2">
        <Button
          type="button"
          onClick={handleSave}
          disabled={assignMutation.isPending || !detail}
          className="h-11 rounded-xl bg-theme-primary hover:bg-theme-primary-hover px-6 text-sm font-semibold text-white"
        >
          {assignMutation.isPending ? "Saving..." : "Save Products"}
        </Button>
      </div>
    </div>
  );
}
