"use client";

import { MapPin, Pencil, Trash2, Star, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatPhone } from "@/lib/utils/format-phone";
import type { AddressItem } from "../types";

interface AddressCardProps {
  address: AddressItem;
  selected?: boolean;
  selectable?: boolean;
  onSelect?: (id: number) => void;
  onEdit?: (address: AddressItem) => void;
  onDelete?: (id: number) => void;
  onSetDefault?: (id: number) => void;
}

function formatAddress(address: AddressItem): string {
  const parts = [
    address.addressLine1,
    address.addressLine2,
    [address.city, address.state, address.postalCode].filter(Boolean).join(", "),
    address.country,
  ].filter(Boolean);
  return parts.join(", ");
}

export function AddressCard({
  address,
  selected = false,
  selectable = false,
  onSelect,
  onEdit,
  onDelete,
  onSetDefault,
}: AddressCardProps) {
  const actions = (
    <div className="flex items-center gap-1">
      {onSetDefault && !address.isDefault && (
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground"
          onClick={() => onSetDefault(address.id)}
        >
          <Star className="mr-1 h-3.5 w-3.5" />
          Set default
        </Button>
      )}
      {onEdit && (
        <Button variant="ghost" size="icon" onClick={() => onEdit(address)} aria-label="Edit address">
          <Pencil className="h-4 w-4" />
        </Button>
      )}
      {onDelete && (
        <Button
          variant="ghost"
          size="icon"
          className="text-error-600"
          onClick={() => onDelete(address.id)}
          aria-label="Delete address"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );

  const content = (
    <div
      className={cn(
        "flex h-full flex-col rounded-xl border p-4 transition-colors",
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-gray-200 bg-white hover:border-gray-300",
        selectable && "cursor-pointer"
      )}
      onClick={selectable && onSelect ? () => onSelect(address.id) : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <p className="font-medium text-sm">
            {address.firstName} {address.lastName}
          </p>
        </div>
        {selected && (
          <Badge variant="success">
            <Check className="mr-1 h-3 w-3" /> Selected
          </Badge>
        )}
      </div>

      <p className="mt-2 text-sm text-muted-foreground">{formatAddress(address)}</p>
      <p className="mt-1 text-xs text-muted-foreground">Mobile: {formatPhone(address.phone)}</p>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {address.isDefault && <Badge variant="secondary">Default</Badge>}
        </div>
        {!selectable && actions}
      </div>
    </div>
  );

  return content;
}
