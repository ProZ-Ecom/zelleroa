import { redirect } from "next/navigation";

// Stock history now lives in the Stock Movements ledger.
export default function InventoryHistoryRedirect() {
  redirect("/admin/dashboard/inventory/movements");
}
