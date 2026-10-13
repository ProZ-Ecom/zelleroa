"use client";

import React from "react";
import { Pencil, Trash2, Star, CheckCircle2, XCircle, Shapes } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AdminItemResponse } from "../types";

export interface ItemCardProps {
  item: AdminItemResponse;
  isSelected?: boolean;
  onSelect?: (item: AdminItemResponse) => void;
  onEdit?: (item: AdminItemResponse) => void;
  onDelete?: (item: AdminItemResponse) => void;
}

export function ItemCard({ item, isSelected, onSelect, onEdit, onDelete }: ItemCardProps) {
  return (
    <div
      onClick={() => onSelect?.(item)}
      className={`group relative flex items-center gap-3 rounded-xl border p-3 transition-all cursor-pointer ${
        isSelected
          ? "border-secondary-600 bg-secondary-50 shadow-sm"
          : "border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50"
      }`}
    >
      <div className="w-12 h-12 rounded-lg bg-neutral-100 overflow-hidden shrink-0 flex items-center justify-center">
        <Shapes className="w-5 h-5 text-neutral-300" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold text-neutral-900 truncate">{item.name}</p>
          {item.isDefault && (
            <span title="Default Item">
              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
            </span>
          )}
        </div>
        <p className="text-xs text-neutral-500 truncate font-mono">{item.slug}</p>
        <div className="flex items-center gap-2 mt-1">
          <span
            className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide ${
              item.isActive ? "text-emerald-600" : "text-neutral-400"
            }`}
          >
            {item.isActive ? (
              <CheckCircle2 className="w-3 h-3" />
            ) : (
              <XCircle className="w-3 h-3" />
            )}
            {item.isActive ? "Active" : "Inactive"}
          </span>
          <span className="text-[10px] text-neutral-400">
            {item.colorCount} color{item.colorCount === 1 ? "" : "s"}
          </span>
          {item.basePrice > 0 && (
            <span className="text-[10px] text-neutral-500 font-semibold">
              ₹{item.basePrice.toFixed(0)}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {onEdit && (
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(item);
            }}
            aria-label="Edit item"
            title="Edit item"
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
        )}
        {onDelete && (
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="text-red-500 hover:text-red-600 border-red-200 hover:bg-red-50"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(item);
            }}
            aria-label="Delete item"
            title="Delete item"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
