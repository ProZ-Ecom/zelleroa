import { notFound, redirect } from "next/navigation";

import { TaxInvoice } from "@/features/invoice/components/TaxInvoice";
import { InvoicePrintButton } from "@/features/invoice/components/InvoicePrintButton";
import { invoiceService } from "@/features/invoice/services/invoice.service";
import type { InvoiceDto } from "@/features/invoice/types";
import { getPageSessionUser } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/constants";
import "@/features/invoice/components/tax-invoice.css";

export const dynamic = "force-dynamic";

export default async function OrderInvoicePage({
  params,
}: {
  params: Promise<{ uuid: string }>;
}) {
  const { uuid } = await params;

  const user = await getPageSessionUser();
  if (!user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/invoice/${uuid}`)}`);
  }

  // Staff print any order; customers only get their own.
  const isStaff = user.role === ROLES.ADMIN || user.role === ROLES.STAFF;

  let invoice: InvoiceDto;
  try {
    invoice = await invoiceService.getOrderInvoice(
      uuid,
      isStaff ? undefined : user.id
    );
  } catch (error) {
    console.error(`[invoice] failed to build invoice for order ${uuid}:`, error);
    if (error instanceof Error && error.message === "Company settings not found") {
      return (
        <div className="ti-screen">
          <div className="mx-auto max-w-md rounded-md bg-white p-6 text-center shadow">
            <h1 className="text-lg font-semibold">Invoice can&apos;t be generated yet</h1>
            <p className="mt-2 text-sm text-neutral-600">
              Company details (name, address, GSTIN) haven&apos;t been set up. An admin
              needs to fill them in under Admin → Settings, then reload this page.
            </p>
          </div>
        </div>
      );
    }
    notFound();
  }

  return (
    <div className="ti-screen">
      <InvoicePrintButton />
      <TaxInvoice invoice={invoice} />
    </div>
  );
}
