"use client";

import React, { useState, useEffect } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { WhatsAppNavTabs } from "@/components/admin/whatsapp/WhatsAppNavTabs";
import {
  MessageCircle,
  QrCode,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Send,
  LogOut,
  Smartphone,
  ShieldCheck,
  Zap,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { WHATSAPP_TEMPLATES } from "@/lib/whatsapp/whatsapp-utils";

interface WhatsAppStatusData {
  status: "DISCONNECTED" | "PAIRING" | "CONNECTED";
  qr: string | null;
  user: {
    id: string;
    name?: string;
    phone: string;
  } | null;
  errorMessage: string | null;
}

export default function AdminWhatsAppPage() {
  const [data, setData] = useState<WhatsAppStatusData>({
    status: "DISCONNECTED",
    qr: null,
    user: null,
    errorMessage: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // Message Sender State
  const [recipientPhone, setRecipientPhone] = useState("");
  const [messageText, setMessageText] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);

  // Fetch status
  const loadStatus = React.useCallback(async (showSpinner = false) => {
    if (showSpinner) setIsLoading(true);
    try {
      const res = await fetch("/api/admin/whatsapp/status", { cache: "no-store" });
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      }
    } catch (err: unknown) {
      console.error("Failed to fetch WhatsApp status:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial status fetch once on page mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadStatus(false);
  }, [loadStatus]);

  // Poll ONLY while actively awaiting QR code scan in PAIRING mode
  useEffect(() => {
    if (data.status !== "PAIRING") {
      return; // Zero polling when DISCONNECTED or CONNECTED
    }

    const interval = setInterval(() => {
      if (!document.hidden) {
        loadStatus(false);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [data.status, loadStatus]);

  // Connect / Request QR
  const handleConnect = async () => {
    setIsConnecting(true);
    setSendResult(null);
    // Switch to pairing state immediately so user sees QR loading box with spinner
    setData((prev) => ({ ...prev, status: "PAIRING" }));
    try {
      const res = await fetch("/api/admin/whatsapp/connect", {
        method: "POST",
      });
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      }
    } catch (err) {
      console.error("Failed to start WhatsApp connection:", err);
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect
  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to log out and disconnect your WhatsApp session?")) {
      return;
    }

    setIsDisconnecting(true);
    setSendResult(null);
    try {
      const res = await fetch("/api/admin/whatsapp/disconnect", {
        method: "POST",
      });
      const json = await res.json();
      if (json.success) {
        setData({
          status: "DISCONNECTED",
          qr: null,
          user: null,
          errorMessage: null,
        });
      }
    } catch (err) {
      console.error("Failed to disconnect WhatsApp:", err);
    } finally {
      setIsDisconnecting(false);
    }
  };

  // Apply Template
  const handleSelectTemplate = (templateObj: (typeof WHATSAPP_TEMPLATES)[0]) => {
    setSelectedTemplateId(templateObj.id);
    setMessageText(templateObj.template("1042", "Valued Customer", "450"));
  };

  // Send Message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientPhone.trim()) {
      setSendResult({ success: false, message: "Please enter a valid recipient phone number." });
      return;
    }
    if (!messageText.trim()) {
      setSendResult({ success: false, message: "Please type a message to send." });
      return;
    }

    setIsSending(true);
    setSendResult(null);

    try {
      const res = await fetch("/api/admin/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: recipientPhone.trim(),
          message: messageText.trim(),
        }),
      });

      const json = await res.json();
      if (json.success) {
        setSendResult({
          success: true,
          message: `Message sent successfully to ${recipientPhone}!`,
        });
        setMessageText("");
        setSelectedTemplateId(null);
      } else {
        setSendResult({
          success: false,
          message: json.message || "Failed to deliver message via WhatsApp.",
        });
      }
    } catch (err: unknown) {
      setSendResult({
        success: false,
        message: (err as Error)?.message || "An unexpected error occurred while sending.",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="WhatsApp Integration"
        description="100% free WhatsApp messaging with your personal admin number. Manage device pairing, anti-ban protection, and customer notification templates."
        breadcrumbs={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "WhatsApp" },
        ]}
        actions={
          <div className="flex items-center gap-3">
            {data.status === "CONNECTED" && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Connected: {data.user?.phone || "Admin"}
              </div>
            )}
            {data.status === "PAIRING" && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                Awaiting QR Scan
              </div>
            )}
            {data.status === "DISCONNECTED" && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-100 border border-neutral-300 text-neutral-600 text-xs font-medium">
                <span className="h-2 w-2 rounded-full bg-neutral-400" />
                Offline
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadStatus(true)}
              disabled={isLoading}
              className="gap-1.5 h-8 text-xs font-medium border-neutral-200"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        }
      />

      <WhatsAppNavTabs />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Device Pairing & Connection Status */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card 1: Connection & Pairing Status */}
          <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <Smartphone className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-neutral-900">Device Connection</h2>
                  <p className="text-xs text-neutral-500">Linked via WhatsApp Web protocol</p>
                </div>
              </div>
            </div>

            {/* STATE 1: CONNECTED */}
            {data.status === "CONNECTED" && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200/80 flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-emerald-900">
                      WhatsApp Connected & Active
                    </p>
                    <p className="text-xs text-emerald-700">
                      Messages will be sent directly from{" "}
                      <span className="font-bold">{data.user?.phone}</span>.
                    </p>
                  </div>
                </div>

                <div className="rounded-xl bg-neutral-50 border border-neutral-200/60 p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-500">Admin Account</span>
                    <span className="font-medium text-neutral-900">
                      {data.user?.name || "Zellora Admin"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-500">Linked Number</span>
                    <span className="font-bold font-mono text-neutral-900">
                      {data.user?.phone}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-500">Anti-Ban Protection</span>
                    <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                      <ShieldCheck className="h-3.5 w-3.5" /> Active (1.5s jitter)
                    </span>
                  </div>
                </div>

                <Button
                  variant="destructive"
                  size="md"
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                  className="w-full gap-2 text-xs font-semibold"
                >
                  <LogOut className="h-4 w-4" />
                  {isDisconnecting ? "Disconnecting..." : "Disconnect / Log Out"}
                </Button>
              </div>
            )}

            {/* STATE 2: PAIRING (QR CODE DISPLAY) */}
            {data.status === "PAIRING" && (
              <div className="space-y-5 text-center">
                <div className="space-y-1">
                  <span className="inline-block px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[11px] font-semibold uppercase tracking-wider">
                    Pairing Mode
                  </span>
                  <h3 className="text-sm font-bold text-neutral-900">
                    Scan with your WhatsApp mobile app
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Auto-refreshes when scanned. No passwords needed.
                  </p>
                </div>

                {/* QR Code Container */}
                <div className="mx-auto w-64 h-64 p-3 bg-white rounded-2xl border-2 border-dashed border-emerald-400/80 shadow-md flex items-center justify-center relative group">
                  {data.qr ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={data.qr}
                      alt="WhatsApp Pairing QR Code"
                      className="w-56 h-56 rounded-lg object-contain"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-neutral-400">
                      <RefreshCw className="h-8 w-8 animate-spin text-emerald-600" />
                      <span className="text-xs font-medium text-neutral-600">Generating secure QR key...</span>
                    </div>
                  )}
                </div>

                {/* Instructions */}
                <div className="text-left bg-neutral-50/80 rounded-xl p-4 border border-neutral-200/60 space-y-2">
                  <p className="text-xs font-bold text-neutral-800">How to link your phone:</p>
                  <ol className="text-xs text-neutral-600 space-y-1.5 list-decimal list-inside">
                    <li>Open WhatsApp on your mobile phone</li>
                    <li>
                      Go to <span className="font-semibold">Settings</span> (iOS) or tap{" "}
                      <span className="font-semibold">⋮ More options</span> (Android)
                    </li>
                    <li>
                      Tap <span className="font-semibold text-emerald-700">Linked Devices</span>
                    </li>
                    <li>
                      Tap <span className="font-semibold text-emerald-700">Link a Device</span> and
                      point your camera at the QR code above
                    </li>
                  </ol>
                </div>

                <div className="flex items-center justify-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleConnect}
                    disabled={isConnecting}
                    className="text-xs text-neutral-700 gap-1.5"
                  >
                    <RefreshCw className={`h-3 w-3 ${isConnecting ? "animate-spin" : ""}`} />
                    Regenerate QR
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDisconnect}
                    disabled={isDisconnecting}
                    className="text-xs text-red-600 hover:text-red-700"
                  >
                    Cancel Pairing
                  </Button>
                </div>
              </div>
            )}

            {/* STATE 3: DISCONNECTED */}
            {data.status === "DISCONNECTED" && (
              <div className="space-y-4 text-center py-4">
                <div className="mx-auto h-16 w-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <QrCode className="h-8 w-8" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-sm font-bold text-neutral-900">
                    Ready to Link Your WhatsApp
                  </h3>
                  <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                    Click below to generate a secure pairing QR code. Your session keys are stored
                    locally on the server and reconnect silently.
                  </p>
                </div>

                <Button
                  variant="default"
                  size="md"
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="w-full gap-2 bg-theme-primary hover:bg-theme-primary-hover text-white font-semibold text-xs transition-colors"
                >
                  <MessageCircle className="h-4 w-4" />
                  {isConnecting ? "Starting WhatsApp..." : "Link WhatsApp Device"}
                </Button>
              </div>
            )}
          </div>

          {/* Card 2: Anti-Ban & Performance Highlights */}
          <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs p-5 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              Anti-Ban & Engine Safeguards
            </h3>
            <div className="space-y-2.5">
              <div className="flex items-start gap-2.5 text-xs text-neutral-600">
                <Zap className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <span>
                  <strong className="text-neutral-900 font-semibold">Zero Chat History Sync:</strong>{" "}
                  Never downloads old personal messages, saving 80% RAM (~35MB total).
                </span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-neutral-600">
                <Clock className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <span>
                  <strong className="text-neutral-900 font-semibold">Human Typing Simulation:</strong>{" "}
                  Adds 1.5s–2.5s jitter and active typing presence before sending.
                </span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-neutral-600">
                <ShieldCheck className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span>
                  <strong className="text-neutral-900 font-semibold">Next.js Singleton Lock:</strong>{" "}
                  Prevents duplicate sockets from opening during hot reloads.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Message Sender & Templates */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-secondary-50 text-secondary-600 flex items-center justify-center font-bold">
                  <Send className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-neutral-900">Quick Message Sender</h2>
                  <p className="text-xs text-neutral-500">
                    Send transactional customer alerts or test your connection
                  </p>
                </div>
              </div>
            </div>

            {/* Template Selector Pills */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-700">
                Select a Quick Template:
              </label>
              <div className="flex flex-wrap gap-2">
                {WHATSAPP_TEMPLATES.map((tmpl) => (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => handleSelectTemplate(tmpl)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      selectedTemplateId === tmpl.id
                        ? "bg-secondary-600 text-white shadow-xs"
                        : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200/80"
                    }`}
                  >
                    {tmpl.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Message Form */}
            <form onSubmit={handleSendMessage} className="space-y-4">
              {/* Phone Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-700">
                  Recipient Phone Number:
                </label>
                <div className="relative">
                  <Input
                    type="tel"
                    placeholder="e.g. 9876543210 or +919876543210"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    className="font-mono text-sm h-11"
                  />
                </div>
                <p className="text-[11px] text-neutral-500">
                  Indian 10-digit mobile numbers are automatically formatted with +91 country code.
                </p>
              </div>

              {/* Message Textarea */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-neutral-700">
                    Message Content:
                  </label>
                  <span className="text-[11px] text-neutral-400 font-mono">
                    {messageText.length} characters
                  </span>
                </div>
                <Textarea
                  rows={6}
                  placeholder="Type your WhatsApp notification message here..."
                  value={messageText}
                  onChange={(e) => {
                    setMessageText(e.target.value);
                    setSelectedTemplateId(null);
                  }}
                  className="text-sm font-sans resize-y leading-relaxed"
                />
              </div>

              {/* Feedback Alert */}
              {sendResult && (
                <div
                  className={`p-3.5 rounded-xl text-xs flex items-start gap-2.5 ${
                    sendResult.success
                      ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                      : "bg-red-50 border border-red-200 text-red-800"
                  }`}
                >
                  {sendResult.success ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                  )}
                  <span>{sendResult.message}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setMessageText("");
                    setSelectedTemplateId(null);
                    setSendResult(null);
                  }}
                  className="text-xs text-neutral-500"
                >
                  Clear
                </Button>

                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={isSending || data.status !== "CONNECTED"}
                  className="gap-2 bg-theme-primary hover:bg-theme-primary-hover text-white font-semibold text-xs min-w-[160px] transition-colors"
                >
                  <Send className={`h-3.5 w-3.5 ${isSending ? "animate-pulse" : ""}`} />
                  {isSending
                    ? "Sending..."
                    : data.status !== "CONNECTED"
                      ? "Connect to Send"
                      : "Send WhatsApp"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
