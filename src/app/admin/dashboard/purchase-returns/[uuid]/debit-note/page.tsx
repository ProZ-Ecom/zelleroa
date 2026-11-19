"use client";

import { useParams } from "next/navigation";
import { AdminTableSkeleton } from "@/components/admin/AdminTableSkeleton";
import { ErrorState } from "@/components/ui/error-state";
import { InvoicePrintButton } from "@/features/invoice/components/InvoicePrintButton";
import { rupeesInWords } from "@/features/invoice/utils/amount-in-words";
import { usePurchaseReturn } from "@/features/purchases/hooks";
import { returnReasonLabels } from "@/features/purchases/components/PurchaseReturnBadges";
import { useCompany } from "@/features/company/hooks/use-company";
import "./debit-note.css";

const money = (n: number) => `₹${n.toFixed(2)}`;

/**
 * The document sent to the vendor for goods returned: what went back, why, and
 * the amount owed. Printed from the browser, so it needs no PDF toolchain.
 */
export default function DebitNotePage() {
  const { uuid } = useParams<{ uuid: string }>();
  const { data: ret, isLoading, error, refetch } = usePurchaseReturn(uuid);
  const { data: company } = useCompany();

  if (isLoading) return <AdminTableSkeleton />;
  if (error || !ret) return <ErrorState message="Failed to load the return" onRetry={() => refetch()} />;

  const sellerLines = [
    company?.address,
    [company?.city, company?.state, company?.pincode].filter(Boolean).join(", "),
    company?.gstNumber ? `GSTIN: ${company.gstNumber}` : null,
    company?.phone,
  ].filter(Boolean) as string[];

  return (
    <div className="dn-screen">
      <div className="no-print">
        <InvoicePrintButton />
      </div>

      <div className="dn-page">
        <h1 className="dn-title">Debit Note</h1>
        <p className="dn-sub">Goods returned to vendor</p>

        <div className="dn-head">
          <div>
            <h2>{company?.companyName ?? "Zellora"}</h2>
            {sellerLines.map((l) => (
              <p key={l}>{l}</p>
            ))}
          </div>
          <div style={{ textAlign: "right" }}>
            <p>
              <span className="dn-label">Debit note no. </span>
              <strong>{ret.debitNoteNumber ?? ret.returnNumber}</strong>
            </p>
            <p>
              <span className="dn-label">Return ref. </span>
              {ret.returnNumber}
            </p>
            <p>
              <span className="dn-label">Date </span>
              {ret.returnDate ?? new Date(ret.createdAt).toISOString().slice(0, 10)}
            </p>
            <p>
              <span className="dn-label">Status </span>
              {ret.status}
            </p>
          </div>
        </div>

        <div className="dn-parties">
          <div className="dn-party">
            <p className="dn-label">Vendor</p>
            <p>
              <strong>{ret.vendor.name}</strong> ({ret.vendor.code})
            </p>
            {ret.vendor.address && <p>{ret.vendor.address}</p>}
            {ret.vendor.gstin && <p>GSTIN: {ret.vendor.gstin}</p>}
          </div>
          <div className="dn-party">
            <p className="dn-label">Against purchase</p>
            <p>
              <strong>{ret.purchaseOrder.poNumber}</strong>
            </p>
            {ret.purchaseOrder.invoiceNumber && <p>Vendor invoice: {ret.purchaseOrder.invoiceNumber}</p>}
          </div>
        </div>

        <table className="dn-table">
          <thead>
            <tr>
              <th style={{ width: "6%" }}>#</th>
              <th>Description</th>
              <th style={{ width: "16%" }}>Reason</th>
              <th style={{ width: "10%" }} className="dn-num">
                Qty
              </th>
              <th style={{ width: "14%" }} className="dn-num">
                Rate
              </th>
              <th style={{ width: "16%" }} className="dn-num">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {ret.items?.map((i, idx) => (
              <tr key={i.id}>
                <td>{idx + 1}</td>
                <td>
                  <strong>{i.productName}</strong>
                  <br />
                  {[i.variantName, i.colorName, i.sizeName ?? i.unitName].filter(Boolean).join(" · ")}
                  {" · "}
                  {i.sku}
                  {i.notes ? ` — ${i.notes}` : ""}
                </td>
                <td>{returnReasonLabels[i.reason]}</td>
                <td className="dn-num">{i.quantity}</td>
                <td className="dn-num">{money(i.unitCost)}</td>
                <td className="dn-num">{money(i.lineTotal)}</td>
              </tr>
            ))}
            <tr className="dn-total-row">
              <td colSpan={5} className="dn-num">
                Total
              </td>
              <td className="dn-num">{money(ret.totalAmount)}</td>
            </tr>
          </tbody>
        </table>

        <div className="dn-words">Amount in words: {rupeesInWords(ret.totalAmount)}</div>

        {ret.notes && <p className="dn-note">{ret.notes}</p>}

        <div className="dn-foot">
          <div>
            <p className="dn-label">Received by (vendor)</p>
            <div className="dn-sign" style={{ marginTop: 40 }}>
              Signature &amp; date
            </div>
          </div>
          <div>
            <p className="dn-label" style={{ textAlign: "right" }}>
              For {company?.companyName ?? "Zellora"}
            </p>
            <div className="dn-sign" style={{ marginTop: 40 }}>
              Authorised signatory
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
