"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { WhatsAppNavTabs } from "@/components/admin/whatsapp/WhatsAppNavTabs";
import {
  Send,
  PlusCircle,
  Play,
  Pause,
  XCircle,
  RotateCcw,
  Clock,
  CheckCircle2,
  RefreshCw,
  Trash2,
  Users,
  Sparkles,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface CampaignItem {
  id: string;
  uuid: string;
  name: string;
  description: string | null;
  type: string;
  status: "DRAFT" | "SCHEDULED" | "RUNNING" | "PAUSED" | "COMPLETED" | "CANCELLED";
  message: string;
  media_url: string | null;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
}

export default function WhatsAppCampaignsPage() {
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const loadCampaigns = React.useCallback(async (showSpinner = false) => {
    if (showSpinner) setIsLoading(true);
    try {
      const url =
        filterStatus === "ALL"
          ? "/api/admin/whatsapp/campaigns"
          : `/api/admin/whatsapp/campaigns?status=${filterStatus}`;
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setCampaigns(json.data);
      }
    } catch (err: unknown) {
      console.error("Failed to load campaigns:", err);
    } finally {
      setIsLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCampaigns(false);
  }, [loadCampaigns]);

  // Fast polling if any campaign is currently RUNNING to animate progress bar
  useEffect(() => {
    const hasRunning = campaigns.some((c) => c.status === "RUNNING");
    if (!hasRunning) return;

    const interval = setInterval(() => {
      if (!document.hidden) {
        loadCampaigns(false);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [campaigns, loadCampaigns]);

  // Execute Action (Pause, Resume, Cancel, Retry Failed)
  const handleAction = async (
    campaignId: string,
    action: "PAUSE" | "RESUME" | "CANCEL" | "RETRY_FAILED"
  ) => {
    setActionLoadingId(`${campaignId}-${action}`);
    try {
      const res = await fetch(`/api/admin/whatsapp/campaigns/${campaignId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (json.success) {
        await loadCampaigns(false);
      } else {
        alert(json.message || "Failed to perform action");
      }
    } catch (err: unknown) {
      alert((err as Error)?.message || "Action failed");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Delete Campaign
  const handleDelete = async (campaignId: string) => {
    if (!confirm("Are you sure you want to delete this campaign? This action cannot be undone.")) {
      return;
    }

    setActionLoadingId(`${campaignId}-DELETE`);
    try {
      const res = await fetch(`/api/admin/whatsapp/campaigns/${campaignId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        setCampaigns((prev) => prev.filter((c) => c.id !== campaignId));
      } else {
        alert(json.message || "Failed to delete campaign");
      }
    } catch (err: unknown) {
      alert((err as Error)?.message || "Delete failed");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Metrics
  const totalCampaigns = campaigns.length;
  const runningCampaigns = campaigns.filter((c) => c.status === "RUNNING").length;
  const scheduledCampaigns = campaigns.filter((c) => c.status === "SCHEDULED").length;
  const totalSentMessages = campaigns.reduce((acc, c) => acc + (c.sent_count || 0), 0);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="WhatsApp Campaigns"
        description="Schedule promotional festival offers, track live delivery progress, and reach 200–500 targeted customers safely with zero simultaneous blasting."
        breadcrumbs={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "WhatsApp", href: "/admin/dashboard/whatsapp" },
          { label: "Campaigns" },
        ]}
      />

      <WhatsAppNavTabs />

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-neutral-200/80 p-5 shadow-xs flex items-center gap-4">
          <div className="h-11 w-11 rounded-xl bg-secondary-50 text-secondary-600 flex items-center justify-center">
            <Send className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-neutral-500">Total Campaigns</p>
            <p className="text-xl font-bold text-neutral-900">{totalCampaigns}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-neutral-200/80 p-5 shadow-xs flex items-center gap-4">
          <div className="h-11 w-11 rounded-xl bg-success-50 text-success-700 flex items-center justify-center">
            <Play className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-neutral-500">Running Now</p>
            <p className="text-xl font-bold text-success-700">{runningCampaigns}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-neutral-200/80 p-5 shadow-xs flex items-center gap-4">
          <div className="h-11 w-11 rounded-xl bg-primary-50 text-primary-800 flex items-center justify-center">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-neutral-500">Scheduled</p>
            <p className="text-xl font-bold text-primary-800">{scheduledCampaigns}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-neutral-200/80 p-5 shadow-xs flex items-center gap-4">
          <div className="h-11 w-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-neutral-500">Messages Delivered</p>
            <p className="text-xl font-bold text-neutral-900">{totalSentMessages.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-neutral-200/80 shadow-xs">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
          {["ALL", "RUNNING", "SCHEDULED", "PAUSED", "COMPLETED", "CANCELLED"].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                filterStatus === st
                  ? "bg-secondary-600 text-white shadow-xs"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {st.charAt(0) + st.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadCampaigns(true)}
            disabled={isLoading}
            className="h-8 text-xs font-medium gap-1.5 border-neutral-200"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Link href="/admin/dashboard/whatsapp/campaigns/create">
            <Button size="sm" className="h-8 text-xs font-semibold gap-1.5 bg-theme-primary hover:bg-theme-primary-hover text-white transition-colors">
              <PlusCircle className="h-3.5 w-3.5" />
              New Campaign
            </Button>
          </Link>
        </div>
      </div>

      {/* Campaigns List */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-neutral-200/80 p-12 text-center text-neutral-400">
          <RefreshCw className="h-8 w-8 mx-auto animate-spin mb-3 text-secondary-600" />
          <p className="text-sm font-medium">Loading campaigns...</p>
        </div>
      ) : campaigns.length === 0 ? (
        <div className="bg-white rounded-2xl border border-neutral-200/80 p-12 text-center space-y-4 shadow-xs">
          <div className="h-16 w-16 rounded-2xl bg-secondary-50 text-secondary-600 mx-auto flex items-center justify-center">
            <Sparkles className="h-8 w-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-neutral-900">No campaigns found</h3>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto">
              Create your first WhatsApp campaign to send festive discounts and product updates to your
              loyal customers.
            </p>
          </div>
          <Link href="/admin/dashboard/whatsapp/campaigns/create">
            <Button size="md" className="gap-2 bg-theme-primary hover:bg-theme-primary-hover text-white font-semibold text-xs transition-colors">
              <PlusCircle className="h-4 w-4" />
              Create Your First Campaign
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map((camp) => {
            const total = camp.total_recipients || 1;
            const progress = Math.min(100, Math.round(((camp.sent_count + camp.failed_count) / total) * 100));

            return (
              <div
                key={camp.id}
                className="bg-white rounded-2xl border border-neutral-200/80 p-5 shadow-xs space-y-4 hover:border-neutral-300 transition-all"
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-sm font-bold text-neutral-900">{camp.name}</h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-neutral-100 text-neutral-700">
                        {camp.type.replace(/_/g, " ")}
                      </span>
                    </div>
                    {camp.description && (
                      <p className="text-xs text-neutral-500 line-clamp-1">{camp.description}</p>
                    )}
                  </div>

                  {/* Status Pill */}
                  <div className="flex items-center gap-2">
                    {camp.status === "RUNNING" && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        Running ({progress}%)
                      </span>
                    )}
                    {camp.status === "SCHEDULED" && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        <Clock className="h-3.5 w-3.5" />
                        Scheduled:{" "}
                        {camp.scheduled_at
                          ? new Date(camp.scheduled_at).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "Soon"}
                      </span>
                    )}
                    {camp.status === "PAUSED" && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-900">
                        <Pause className="h-3.5 w-3.5" />
                        Paused
                      </span>
                    )}
                    {camp.status === "COMPLETED" && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-900">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Completed
                      </span>
                    )}
                    {camp.status === "CANCELLED" && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-neutral-100 text-neutral-600">
                        <XCircle className="h-3.5 w-3.5" />
                        Cancelled
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress Bar (Visible if running, paused, or completed) */}
                {camp.total_recipients > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-medium text-neutral-600">
                      <span>
                        Progress:{" "}
                        <strong className="text-neutral-900">
                          {camp.sent_count} / {camp.total_recipients}
                        </strong>{" "}
                        delivered
                        {camp.failed_count > 0 && (
                          <span className="text-red-600 ml-2 font-medium">
                            ({camp.failed_count} failed)
                          </span>
                        )}
                      </span>
                      <span className="font-bold text-neutral-900">{progress}%</span>
                    </div>

                    <div className="w-full h-2.5 rounded-full bg-neutral-100 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 rounded-full ${
                          camp.status === "RUNNING"
                            ? "bg-emerald-500 animate-pulse"
                            : camp.status === "COMPLETED"
                              ? "bg-emerald-600"
                              : "bg-secondary-600"
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Message Snippet & Actions Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-xs text-neutral-500 border-t border-neutral-100">
                  <div className="flex items-center gap-4">
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-neutral-400" />
                      {camp.total_recipients} customers
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-neutral-400" />
                      {new Date(camp.created_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {camp.status === "RUNNING" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAction(camp.id, "PAUSE")}
                        disabled={actionLoadingId === `${camp.id}-PAUSE`}
                        className="h-8 text-xs text-amber-700 hover:bg-amber-50 gap-1.5"
                      >
                        <Pause className="h-3 w-3" />
                        Pause
                      </Button>
                    )}

                    {camp.status === "PAUSED" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAction(camp.id, "RESUME")}
                        disabled={actionLoadingId === `${camp.id}-RESUME`}
                        className="h-8 text-xs text-emerald-700 hover:bg-emerald-50 gap-1.5"
                      >
                        <Play className="h-3 w-3" />
                        Resume
                      </Button>
                    )}

                    {camp.failed_count > 0 && camp.status !== "RUNNING" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAction(camp.id, "RETRY_FAILED")}
                        disabled={actionLoadingId === `${camp.id}-RETRY_FAILED`}
                        className="h-8 text-xs text-blue-700 hover:bg-blue-50 gap-1.5"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Retry Failed ({camp.failed_count})
                      </Button>
                    )}

                    {camp.status !== "COMPLETED" && camp.status !== "CANCELLED" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAction(camp.id, "CANCEL")}
                        disabled={actionLoadingId === `${camp.id}-CANCEL`}
                        className="h-8 text-xs text-neutral-500 hover:text-neutral-800"
                      >
                        Cancel
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(camp.id)}
                      disabled={actionLoadingId === `${camp.id}-DELETE`}
                      className="h-8 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 p-2"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
