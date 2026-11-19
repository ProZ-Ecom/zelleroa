import type { Metadata } from "next";
import { Package, Percent, Truck } from "lucide-react";
import { BulkOrderForm } from "@/features/bulk-orders/components/BulkOrderForm";
import { constructMetadata } from "@/lib/seo";

export const metadata: Metadata = constructMetadata({
  title: "Bulk Order Enquiry",
  description:
    "Ordering in large quantities for a business, event, or gifting? Inquire about special bulk pricing, custom packaging, and corporate orders at Zellora.",
  canonicalUrl: "/bulk-order",
});

export default function BulkOrderPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="text-center mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 font-serif">
          Bulk Order Enquiry
        </h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-xl mx-auto">
          Ordering in large quantities for a business, event, or gifting? Share
          your requirements below and our team will get back to you with
          special bulk pricing.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="flex items-center gap-3 rounded-xl border border-gray-200 p-4">
          <Percent className="h-6 w-6 text-primary shrink-0" />
          <span className="text-sm text-gray-700">Special bulk pricing</span>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-gray-200 p-4">
          <Package className="h-6 w-6 text-primary shrink-0" />
          <span className="text-sm text-gray-700">Custom packaging available</span>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-gray-200 p-4">
          <Truck className="h-6 w-6 text-primary shrink-0" />
          <span className="text-sm text-gray-700">Dedicated delivery support</span>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-xs">
        <BulkOrderForm />
      </div>
    </div>
  );
}
