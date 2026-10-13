"use client";

import React, { useState, useEffect } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { WhatsAppNavTabs } from "@/components/admin/whatsapp/WhatsAppNavTabs";
import {
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  Eye,
  RefreshCw,
  Loader2,
  Search,
  Check,
  XCircle,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormModal } from "@/components/common/FormModal";
import { Input } from "@/components/ui/input";

interface CampaignSummary {
  id: string;
  name: string;
  type: string;
  status: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

interface RecipientLog {
  id: string;
  customer_name: string | null;
  phone_number: string;
  status: "QUEUED" | "SENDING" | "SENT" | "FAILED" | "SKIPPED";
  message_id: string | null;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}

interface CampaignDetailData extends CampaignSummary {
  statusBreakdown: Record<string, number>;
  recipients: RecipientLog[];
}

export default function WhatsAppReportsPage() {
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Drilldown modal states
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [campaignDetail, setCampaignDetail] = useState<CampaignDetailData | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [logSearchQuery, setLogSearchQuery] = useState("");
  const [logStatusFilter, setLogStatusFilter] = useState("ALL");

  const loadData = React.useCallback(async (showSpinner = false) => {
    if (showSpinner) setIsLoading(true);
    try {
      const res = await fetch("/api/admin/whatsapp/campaigns");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setCampaigns(json.data);
      }
    } catch (err: unknown) {
      console.error("Failed to load campaign reports:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData(false);
  }, [loadData]);

  // Open recipient log modal
  const openDetailModal = async (campaignId: string) => {
    setSelectedCampaignId(campaignId);
    setIsLoadingDetail(true);
    try {
      const res = await fetch(`/api/admin/whatsapp/campaigns/${campaignId}`);
      const json = await res.json();
      if (json.success && json.data) {
        setCampaignDetail(json.data);
      }
    } catch (err) {
      console.error("Failed to fetch campaign logs:", err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Close modal
  const closeDetailModal = () => {
    setSelectedCampaignId(null);
    setCampaignDetail(null);
    setLogSearchQuery("");
    setLogStatusFilter("ALL");
  };

  // Aggregated Analytics
  const totalCampaigns = campaigns.length;
  const totalSent = campaigns.reduce((acc, c) => acc + (c.sent_count || 0), 0);
  const totalFailed = campaigns.reduce((acc, c) => acc + (c.failed_count || 0), 0);
  const totalProcessed = totalSent + totalFailed;
  const deliveryRate =
    totalProcessed > 0 ? ((totalSent / totalProcessed) * 100).toFixed(1) : "100.0";

  // Filtered recipient logs
  const filteredRecipients = React.useMemo(() => {
    if (!campaignDetail?.recipients) return [];
    let list = campaignDetail.recipients;

    if (logStatusFilter !== "ALL") {
      list = list.filter((r) => r.status === logStatusFilter);
    }

    if (logSearchQuery.trim()) {
      const q = logSearchQuery.toLowerCase();
      list = list.filter(
        (r) =>
          (r.customer_name && r.customer_name.toLowerCase().includes(q)) ||
          r.phone_number.includes(q)
      );
    }

    return list;
  }, [campaignDetail, logStatusFilter, logSearchQuery]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <AdminPageHeader
        title="WhatsApp Campaign Reports & Delivery Logs"
        description="Monitor delivery rates, recipient status, and real-time delivery telemetry"
      >
        <Button
          onClick={() => loadData(true)}
          variant="outline"
          size="sm"
          className="gap-2 border-neutral-200 text-neutral-700 hover:bg-neutral-50 h-9"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </Button>
      </AdminPageHeader>

      {/* Tabs */}
      <WhatsAppNavTabs active="reports" />

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Campaigns */}
        <div className="bg-white border border-neutral-200/80 rounded-2xl p-5 shadow-xs transition-shadow hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              Total Campaigns
            </span>
            <div className="p-2 rounded-xl bg-secondary-50 text-secondary-600">
              <BarChart3 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-neutral-900 mt-2">
            {totalCampaigns}
          </p>
          <p className="text-xs text-neutral-500 mt-1">Festival & Offer blasts</p>
        </div>

        {/* Messages Delivered */}
        <div className="bg-white border border-neutral-200/80 rounded-2xl p-5 shadow-xs transition-shadow hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              Messages Delivered
            </span>
            <div className="p-2 rounded-xl bg-success-50 text-success-700">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-success-700 mt-2">
            {totalSent.toLocaleString()}
          </p>
          <p className="text-xs text-neutral-500 mt-1">Directly to customer phones</p>
        </div>

        {/* Delivery Rate */}
        <div className="bg-white border border-neutral-200/80 rounded-2xl p-5 shadow-xs transition-shadow hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              Delivery Rate
            </span>
            <div className="p-2 rounded-xl bg-primary-50 text-primary-800">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-neutral-900 mt-2">
            {deliveryRate}%
          </p>
          <p className="text-xs text-neutral-500 mt-1">Successful Baileys handshakes</p>
        </div>

        {/* Failed / Skipped */}
        <div className="bg-white border border-neutral-200/80 rounded-2xl p-5 shadow-xs transition-shadow hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              Failed / Skipped
            </span>
            <div className="p-2 rounded-xl bg-error-50 text-error-700">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-error-700 mt-2">
            {totalFailed.toLocaleString()}
          </p>
          <p className="text-xs text-neutral-500 mt-1">Invalid or unreachable numbers</p>
        </div>
      </div>

      {/* Campaigns Table */}
      <div className="bg-white border border-neutral-200/80 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-5 border-b border-neutral-200/80 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-neutral-900 text-base">
              Campaign Delivery History
            </h3>
            <p className="text-xs text-neutral-500 mt-0.5">
              Review delivery status and click &quot;View Logs&quot; for customer-by-customer breakdown
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="p-16 text-center text-neutral-400 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-secondary-600" />
            <span className="text-sm">Loading campaign performance logs...</span>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="p-16 text-center text-neutral-400 text-sm">
            No campaigns found. Create your first campaign to see delivery reports here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 text-neutral-600 uppercase tracking-wider border-b border-neutral-200 font-semibold">
                <tr>
                  <th className="p-4">Campaign Name</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Recipients</th>
                  <th className="p-4">Delivered</th>
                  <th className="p-4">Failed</th>
                  <th className="p-4">Date</th>
                  <th className="sticky right-0 z-10 bg-neutral-50 p-4 text-center shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {campaigns.map((c) => {
                  return (
                    <tr
                      key={c.id}
                      className="group hover:bg-neutral-50/70 transition-colors"
                    >
                      <td className="p-4 font-semibold text-neutral-900">
                        {c.name}
                      </td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase bg-neutral-100 text-neutral-700 border border-neutral-200/60">
                          {c.type}
                        </span>
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase border ${
                            c.status === "COMPLETED"
                              ? "bg-success-50 text-success-700 border-success-200"
                              : c.status === "RUNNING"
                              ? "bg-blue-50 text-blue-700 border-blue-200 animate-pulse"
                              : c.status === "PAUSED"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : c.status === "SCHEDULED"
                              ? "bg-purple-50 text-purple-700 border-purple-200"
                              : "bg-neutral-100 text-neutral-600 border-neutral-200"
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="p-4 text-neutral-700 font-medium">
                        {c.total_recipients}
                      </td>
                      <td className="p-4 text-success-700 font-bold">
                        {c.sent_count}
                      </td>
                      <td className="p-4 text-error-700 font-bold">
                        {c.failed_count}
                      </td>
                      <td className="p-4 text-neutral-500">
                        {new Date(c.created_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="sticky right-0 z-10 bg-white p-4 text-center shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)] group-hover:bg-neutral-50">
                        <Button
                          size="icon"
                          variant="outline"
                          title="View Logs"
                          aria-label="View Logs"
                          onClick={() => openDetailModal(c.id)}
                          className="h-8 w-8 border-neutral-200 hover:bg-neutral-50"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* RECIPIENT LOG DRILLDOWN MODAL */}
      <FormModal
        open={Boolean(selectedCampaignId)}
        onClose={closeDetailModal}
        title="Recipient Delivery Audit Log"
        description={campaignDetail ? campaignDetail.name : "Loading campaign logs..."}
        size="xl"
        footer={
          <Button size="sm" variant="outline" onClick={closeDetailModal} className="border-neutral-200">
            Close Audit Log
          </Button>
        }
      >
        {isLoadingDetail ? (
          <div className="p-16 text-center text-neutral-400 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-secondary-600" />
            <span className="text-xs">Fetching per-recipient logs...</span>
          </div>
        ) : campaignDetail ? (
          <div className="space-y-4 flex flex-col">
            {/* Stats Breakdown Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 flex-shrink-0">
              <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200/60 text-center">
                <p className="text-[10px] text-neutral-500 uppercase font-semibold">Total</p>
                <p className="text-base font-bold text-neutral-900 mt-0.5">
                  {campaignDetail.total_recipients}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-success-50 border border-success-200/60 text-center">
                <p className="text-[10px] text-success-700 uppercase font-semibold">Sent</p>
                <p className="text-base font-bold text-success-700 mt-0.5">
                  {campaignDetail.statusBreakdown?.SENT || 0}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200/60 text-center">
                <p className="text-[10px] text-blue-700 uppercase font-semibold">Queued</p>
                <p className="text-base font-bold text-blue-700 mt-0.5">
                  {campaignDetail.statusBreakdown?.QUEUED || 0}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-error-50 border border-error-200/60 text-center">
                <p className="text-[10px] text-error-700 uppercase font-semibold">Failed</p>
                <p className="text-base font-bold text-error-700 mt-0.5">
                  {campaignDetail.statusBreakdown?.FAILED || 0}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200/60 text-center">
                <p className="text-[10px] text-amber-700 uppercase font-semibold">Skipped</p>
                <p className="text-base font-bold text-amber-700 mt-0.5">
                  {campaignDetail.statusBreakdown?.SKIPPED || 0}
                </p>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between flex-shrink-0">
              <div className="w-full sm:w-72">
                <Input
                  size="sm"
                  leftIcon={<Search className="w-3.5 h-3.5" />}
                  value={logSearchQuery}
                  onChange={(e) => setLogSearchQuery(e.target.value)}
                  placeholder="Search recipient or phone..."
                />
              </div>
              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                {["ALL", "SENT", "QUEUED", "FAILED"].map((st) => (
                  <button
                    key={st}
                    onClick={() => setLogStatusFilter(st)}
                    className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                      logStatusFilter === st
                        ? "bg-secondary-600 text-white shadow-xs"
                        : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200/80"
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Recipient Logs Table */}
            <div className="border border-neutral-200/80 rounded-xl overflow-hidden max-h-[380px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 text-neutral-600 uppercase tracking-wider sticky top-0 border-b border-neutral-200 font-semibold">
                  <tr>
                    <th className="p-3">Customer Name</th>
                    <th className="p-3">Phone</th>
                    <th className="p-3">Delivery Status</th>
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Notes / Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredRecipients.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-neutral-400">
                        No recipient records match the filter.
                      </td>
                    </tr>
                  ) : (
                    filteredRecipients.map((r) => (
                      <tr key={r.id} className="hover:bg-neutral-50/50">
                        <td className="p-3 font-medium text-neutral-900">
                          {r.customer_name || "Customer"}
                        </td>
                        <td className="p-3 font-mono text-neutral-600">
                          +{r.phone_number}
                        </td>
                        <td className="p-3">
                          {r.status === "SENT" ? (
                            <span className="inline-flex items-center gap-1 text-success-700 font-semibold text-[11px] bg-success-50 px-2 py-0.5 rounded border border-success-200">
                              <Check className="w-3 h-3" /> Sent
                            </span>
                          ) : r.status === "FAILED" ? (
                            <span className="inline-flex items-center gap-1 text-error-700 font-semibold text-[11px] bg-error-50 px-2 py-0.5 rounded border border-error-200">
                              <XCircle className="w-3 h-3" /> Failed
                            </span>
                          ) : r.status === "SENDING" ? (
                            <span className="inline-flex items-center gap-1 text-blue-700 font-semibold text-[11px] bg-blue-50 px-2 py-0.5 rounded border border-blue-200 animate-pulse">
                              <Loader2 className="w-3 h-3 animate-spin" /> Sending
                            </span>
                          ) : (
                            <span className="text-neutral-500 text-[11px] bg-neutral-100 px-2 py-0.5 rounded border border-neutral-200">
                              {r.status}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-neutral-500 text-[11px]">
                          {r.sent_at
                            ? new Date(r.sent_at).toLocaleTimeString("en-IN", {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              })
                            : "—"}
                        </td>
                        <td className="p-3 text-neutral-600 text-[11px]">
                          {r.error_message ? (
                            <span className="text-error-600 truncate block max-w-xs">
                              {r.error_message}
                            </span>
                          ) : r.message_id ? (
                            <span className="font-mono text-[10px] text-neutral-400 truncate block max-w-xs">
                              ID: {r.message_id}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </FormModal>
    </div>
  );
}
