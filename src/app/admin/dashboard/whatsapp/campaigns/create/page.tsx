"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { WhatsAppNavTabs } from "@/components/admin/whatsapp/WhatsAppNavTabs";
import {
  ArrowLeft,
  ArrowRight,
  Users,
  MessageSquare,
  Clock,
  Sparkles,
  Search,
  Image as ImageIcon,
  UploadCloud,
  X,
  AlertTriangle,
  ShieldCheck,
  Send,
  Loader2,
  Calendar,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, type SelectOption } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Radio } from "@/components/ui/Radio";

const CAMPAIGN_TYPE_OPTIONS: SelectOption[] = [
  { value: "FESTIVAL", label: "Festival Special (Diwali, Pongal, New Year)" },
  { value: "OFFER", label: "Special Discount / Flash Sale" },
  { value: "PROMOTION", label: "New Product Launch" },
  { value: "GENERAL", label: "General Announcement" },
];

interface CustomerItem {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  cleanPhone: string;
  isWhatsapp: boolean;
  orderCount: number;
  lastOrderDate: string | null;
  isRecentBuyer: boolean;
  isValidPhone: boolean;
}

interface TemplateItem {
  id: string;
  name: string;
  category: string;
  message: string;
  media_url: string | null;
}

function CreateCampaignContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateIdParam = searchParams.get("templateId");

  // Step state (1: Details, 2: Audience, 3: Message, 4: Schedule & Launch)
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Form states
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("FESTIVAL");
  const [message, setMessage] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);

  // Customer Audience states
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [customerFilter, setCustomerFilter] = useState("whatsapp_only");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set());

  // Templates
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  // Scheduling states
  const [scheduleMode, setScheduleMode] = useState<"NOW" | "SCHEDULED">("NOW");
  const [scheduledDateTime, setScheduledDateTime] = useState<string>("");

  // Submission
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Fetch Templates
  useEffect(() => {
    async function loadTemplates() {
      try {
        const res = await fetch("/api/admin/whatsapp/templates");
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setTemplates(json.data);
          if (templateIdParam) {
            const matched = json.data.find((t: TemplateItem) => t.id === templateIdParam);
            if (matched) {
              setMessage(matched.message);
              if (matched.media_url) setMediaUrl(matched.media_url);
              setSelectedTemplateId(matched.id);
            }
          }
        }
      } catch (e: unknown) {
        console.error("Failed to fetch templates:", e);
      }
    }
    loadTemplates();
  }, [templateIdParam]);

  // Fetch Customers when audience filter changes
  useEffect(() => {
    async function loadCustomers() {
      setIsLoadingCustomers(true);
      try {
        const res = await fetch(`/api/admin/whatsapp/customers?filter=${customerFilter}`);
        const json = await res.json();
        if (json.success && json.data?.customers) {
          const list: CustomerItem[] = json.data.customers;
          setCustomers(list);
          // Auto-select all by default if set is empty
          setSelectedCustomerIds((prev) => (prev.size === 0 ? new Set(list.map((c) => c.id)) : prev));
        }
      } catch (e: unknown) {
        console.error("Failed to load customers:", e);
      } finally {
        setIsLoadingCustomers(false);
      }
    }
    loadCustomers();
  }, [customerFilter]);

  const templateOptions: SelectOption[] = useMemo(
    () => [
      { value: "", label: "-- Choose a Festive or Promo Preset --" },
      ...templates.map((t) => ({
        value: t.id,
        label: `[${t.category}] ${t.name}`,
      })),
    ],
    [templates]
  );

  // Handle template selection change
  const handleSelectTemplate = (tId: string) => {
    setSelectedTemplateId(tId);
    const tmpl = templates.find((t) => t.id === tId);
    if (tmpl) {
      setMessage(tmpl.message);
      if (tmpl.media_url) setMediaUrl(tmpl.media_url);
      if (!name) setName(tmpl.name);
    }
  };

  // Filtered customer list by search query
  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers;
    const q = searchQuery.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        (c.email && c.email.toLowerCase().includes(q))
    );
  }, [customers, searchQuery]);

  // Toggle single customer
  const toggleCustomer = (id: string) => {
    const next = new Set(selectedCustomerIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedCustomerIds(next);
  };

  // Select all / Deselect all
  const selectAllFiltered = () => {
    const next = new Set(selectedCustomerIds);
    filteredCustomers.forEach((c) => next.add(c.id));
    setSelectedCustomerIds(next);
  };

  const deselectAllFiltered = () => {
    const next = new Set(selectedCustomerIds);
    filteredCustomers.forEach((c) => next.delete(c.id));
    setSelectedCustomerIds(next);
  };

  // Insert variable tag into message
  const insertVariable = (variable: string) => {
    setMessage((prev) => prev + " " + variable);
  };

  // Media file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingMedia(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (json.success && json.data?.url) {
        setMediaUrl(json.data.url);
      } else {
        alert(json.message || "Failed to upload image.");
      }
    } catch (err: unknown) {
      alert("Image upload error: " + (err as Error)?.message);
    } finally {
      setIsUploadingMedia(false);
    }
  };

  // Calculate estimated completion time (average ~3.5 seconds per recipient)
  const totalSelected = selectedCustomerIds.size;
  const estSeconds = totalSelected * 3.5;
  const estMinutes = Math.ceil(estSeconds / 60);

  // Submit Campaign
  const handleLaunchCampaign = async () => {
    setSubmitError(null);
    if (!name.trim()) {
      setSubmitError("Please enter a campaign name.");
      setCurrentStep(1);
      return;
    }
    if (totalSelected === 0) {
      setSubmitError("Please select at least 1 customer recipient.");
      setCurrentStep(2);
      return;
    }
    if (!message.trim()) {
      setSubmitError("Please compose a message.");
      setCurrentStep(3);
      return;
    }
    if (scheduleMode === "SCHEDULED" && !scheduledDateTime) {
      setSubmitError("Please pick a scheduled date and time.");
      return;
    }

    // Build recipient list
    const selectedCustomers = customers
      .filter((c) => selectedCustomerIds.has(c.id))
      .map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.cleanPhone || c.phone,
      }));

    setIsSubmitting(true);
    try {
      const payload = {
        name,
        description,
        type,
        message,
        media_url: mediaUrl || null,
        scheduled_at: scheduleMode === "SCHEDULED" ? new Date(scheduledDateTime).toISOString() : null,
        recipients: selectedCustomers,
      };

      const res = await fetch("/api/admin/whatsapp/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        router.push("/admin/dashboard/whatsapp/campaigns");
      } else {
        setSubmitError(json.message || "Failed to create campaign.");
      }
    } catch (err: unknown) {
      setSubmitError((err as Error)?.message || "Network error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps = [
    { num: 1, title: "Campaign Info", icon: Sparkles },
    { num: 2, title: "Select Audience", icon: Users },
    { num: 3, title: "Compose Message", icon: MessageSquare },
    { num: 4, title: "Schedule & Launch", icon: Clock },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <AdminPageHeader
        title="Create WhatsApp Campaign"
        description="Deliver festival offers, flash sales, and product updates safely to 200–500 customers"
      >
        <Link href="/admin/dashboard/whatsapp/campaigns">
          <Button variant="outline" size="sm" className="gap-2 border-neutral-200">
            <ArrowLeft className="w-4 h-4" />
            Back to Campaigns
          </Button>
        </Link>
      </AdminPageHeader>

      {/* Tabs */}
      <WhatsAppNavTabs active="campaigns" />

      {/* Stepper Header */}
      <div className="bg-white border border-neutral-200/80 rounded-2xl p-4 shadow-xs">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          {steps.map((s, idx) => {
            const isDone = currentStep > s.num;
            const isCurrent = currentStep === s.num;

            return (
              <React.Fragment key={s.num}>
                <button
                  onClick={() => setCurrentStep(s.num)}
                  className={`flex items-center gap-3 p-2 rounded-xl transition-all cursor-pointer ${
                    isCurrent
                      ? "text-secondary-600 font-semibold"
                      : isDone
                      ? "text-neutral-700"
                      : "text-neutral-400"
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold transition-colors ${
                      isCurrent
                        ? "bg-secondary-600 text-white shadow-xs"
                        : isDone
                        ? "bg-secondary-100 text-secondary-700"
                        : "bg-neutral-100 text-neutral-400"
                    }`}
                  >
                    {isDone ? <Check className="w-4 h-4 stroke-[3]" /> : s.num}
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-xs text-neutral-400 font-normal">Step {s.num}</p>
                    <p className="text-sm font-medium">{s.title}</p>
                  </div>
                </button>
                {idx < steps.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 rounded transition-colors ${
                      currentStep > s.num ? "bg-secondary-600" : "bg-neutral-200"
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Error Alert */}
      {submitError && (
        <div className="bg-error-50 border border-error-200 rounded-xl p-4 flex items-center gap-3 text-error-700 text-sm">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{submitError}</span>
        </div>
      )}

      {/* STEP 1: CAMPAIGN INFO */}
      {currentStep === 1 && (
        <div className="bg-white border border-neutral-200/80 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="border-b border-neutral-100 pb-4">
            <h2 className="text-lg font-bold text-neutral-900">1. Campaign Details</h2>
            <p className="text-sm text-neutral-500 mt-0.5">
              Give your campaign a recognizable name and category for analytics.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-neutral-700">
                Campaign Name <span className="text-error-600">*</span>
              </label>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Diwali Sweets & Mixture 20% Off"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-neutral-700">
                Campaign Type
              </label>
              <Select
                options={CAMPAIGN_TYPE_OPTIONS}
                value={type}
                onValueChange={(val) => setType(val)}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-semibold text-neutral-700">
                Internal Description / Notes (Optional)
              </label>
              <Textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Sent to customers who ordered during last month's sale."
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-neutral-100">
            <Button
              onClick={() => {
                if (!name.trim()) {
                  setSubmitError("Please enter a campaign name.");
                  return;
                }
                setSubmitError(null);
                setCurrentStep(2);
              }}
              className="bg-theme-primary hover:bg-theme-primary-hover text-white gap-2 px-6 font-semibold transition-colors"
            >
              Next: Select Audience
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2: SELECT AUDIENCE */}
      {currentStep === 2 && (
        <div className="bg-white border border-neutral-200/80 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-neutral-900">
                2. Select Customer Audience
              </h2>
              <p className="text-sm text-neutral-500 mt-0.5">
                Pick verified customers from your store database. Safe anti-ban quota is 200–500 per run.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3.5 py-1.5 rounded-xl bg-secondary-50 border border-secondary-200/80 text-secondary-700 font-bold text-xs">
                Selected: {totalSelected} of {customers.length}
              </span>
            </div>
          </div>

          {/* Safety Notice if > 500 */}
          {totalSelected > 500 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3 text-amber-800 text-xs">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-600" />
              <span>
                <strong>Anti-Ban Warning:</strong> You have selected {totalSelected} customers. While our
                sequential queue includes 2.5s–4.5s jitter delays, sending to more than 500 recipients in a
                single run on a personal WhatsApp number carries risk. We recommend 200–500 customers per batch.
              </span>
            </div>
          )}

          {/* Audience Filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: "whatsapp_only", label: "WhatsApp Ready Only" },
              { id: "recent_buyers", label: "Recent Buyers (Last 30 Days)" },
              { id: "with_orders", label: "Customers With Orders" },
              { id: "all", label: "All Database Customers" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setCustomerFilter(f.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  customerFilter === f.id
                    ? "bg-secondary-600 text-white shadow-xs"
                    : "bg-white text-neutral-600 hover:bg-neutral-50 border border-neutral-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Search and Bulk Select */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="w-full sm:w-80">
              <Input
                size="sm"
                leftIcon={<Search className="w-4 h-4 text-neutral-400" />}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by customer name or phone..."
              />
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={selectAllFiltered}
                className="text-xs h-8 border-neutral-200"
              >
                Select All ({filteredCustomers.length})
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={deselectAllFiltered}
                className="text-xs h-8 text-neutral-500 border-neutral-200"
              >
                Deselect All
              </Button>
            </div>
          </div>

          {/* Customer Table List */}
          <div className="border border-neutral-200/80 rounded-xl overflow-hidden max-h-[380px] overflow-y-auto">
            {isLoadingCustomers ? (
              <div className="p-12 text-center text-neutral-400 flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-secondary-600" />
                <span className="text-xs">Loading customer contacts...</span>
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="p-12 text-center text-neutral-400 text-xs">
                No customers match the current filter or search criteria.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 text-neutral-600 uppercase tracking-wider sticky top-0 border-b border-neutral-200 font-semibold">
                  <tr>
                    <th className="p-3 w-10 text-center">
                      <div className="flex justify-center">
                        <Checkbox
                          checked={
                            filteredCustomers.length > 0 &&
                            filteredCustomers.every((c) => selectedCustomerIds.has(c.id))
                          }
                          onChange={(e) => {
                            if (e.target.checked) selectAllFiltered();
                            else deselectAllFiltered();
                          }}
                        />
                      </div>
                    </th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Phone Number</th>
                    <th className="p-3">Orders</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredCustomers.map((c) => {
                    const isSelected = selectedCustomerIds.has(c.id);
                    return (
                      <tr
                        key={c.id}
                        onClick={() => toggleCustomer(c.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-secondary-50/40"
                            : "hover:bg-neutral-50/60"
                        }`}
                      >
                        <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-center">
                            <Checkbox
                              checked={isSelected}
                              onChange={() => toggleCustomer(c.id)}
                            />
                          </div>
                        </td>
                        <td className="p-3 font-medium text-neutral-900">
                          <div>{c.name}</div>
                          {c.email && (
                            <div className="text-[10px] text-neutral-400">{c.email}</div>
                          )}
                        </td>
                        <td className="p-3 font-mono text-neutral-600">
                          +{c.cleanPhone}
                        </td>
                        <td className="p-3 text-neutral-600">
                          {c.orderCount} order{c.orderCount === 1 ? "" : "s"}
                        </td>
                        <td className="p-3">
                          {c.isRecentBuyer ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                              Recent Buyer
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-100 text-neutral-600 border border-neutral-200">
                              Standard
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex justify-between pt-4 border-t border-neutral-100">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(1)}
              className="gap-2 border-neutral-200"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <Button
              onClick={() => {
                if (totalSelected === 0) {
                  setSubmitError("Please select at least 1 customer recipient.");
                  return;
                }
                setSubmitError(null);
                setCurrentStep(3);
              }}
              className="bg-theme-primary hover:bg-theme-primary-hover text-white gap-2 px-6 font-semibold transition-colors"
            >
              Next: Compose Message ({totalSelected})
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: COMPOSE MESSAGE & MEDIA */}
      {currentStep === 3 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Editor Column */}
          <div className="lg:col-span-7 bg-white border border-neutral-200/80 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
            <div className="border-b border-neutral-100 pb-4">
              <h2 className="text-lg font-bold text-neutral-900">
                3. Compose Message & Media
              </h2>
              <p className="text-sm text-neutral-500 mt-0.5">
                Personalize with tags. Use *bold* for emphasis.
              </p>
            </div>

            {/* Quick Template Picker */}
            {templates.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-neutral-700">
                  Load From Saved Template (Optional)
                </label>
                <Select
                  options={templateOptions}
                  value={selectedTemplateId}
                  onValueChange={(val) => handleSelectTemplate(val)}
                  size="sm"
                  placeholder="-- Choose a Festive or Promo Preset --"
                />
              </div>
            )}

            {/* Variable insertion buttons */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-700">
                Click to Insert Dynamic Customer Tag:
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => insertVariable("{{customer_name}}")}
                  className="px-2.5 py-1 rounded-lg bg-secondary-50 hover:bg-secondary-100 border border-secondary-200 text-secondary-700 text-xs font-mono font-medium transition-colors cursor-pointer"
                >
                  + {"{{customer_name}}"}
                </button>
                <button
                  type="button"
                  onClick={() => insertVariable("{{store_name}}")}
                  className="px-2.5 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-700 text-xs font-mono font-medium transition-colors cursor-pointer"
                >
                  + {"{{store_name}}"}
                </button>
              </div>
            </div>

            {/* Message Textarea */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-neutral-700">
                  Message Content <span className="text-error-600">*</span>
                </label>
                <span className="text-xs text-neutral-400">{message.length} characters</span>
              </div>
              <Textarea
                rows={8}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={`Namaste {{customer_name}}! ✨\n\nCelebrate this festive season with curated designer fashion & luxury timepieces from Zellora! Use coupon *FESTIVE20* for 20% OFF today.`}
              />
            </div>

            {/* Image Attachment */}
            <div className="space-y-3 pt-2 border-t border-neutral-100">
              <label className="text-sm font-semibold text-neutral-700 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-secondary-600" />
                Campaign Banner / Product Image (Optional)
              </label>

              {mediaUrl ? (
                <div className="relative border border-neutral-200 rounded-xl p-3 bg-neutral-50 flex items-center gap-4">
                  <img
                    src={mediaUrl}
                    alt="Banner preview"
                    className="w-16 h-16 object-cover rounded-lg border border-neutral-200"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-neutral-900 truncate">
                      {mediaUrl}
                    </p>
                    <p className="text-[10px] text-neutral-500">Attached image will be sent with text caption.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMediaUrl("")}
                    className="p-1.5 rounded-lg text-error-600 hover:bg-error-50 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="border-2 border-dashed border-neutral-200 hover:border-secondary-500 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-colors bg-neutral-50 text-center">
                    <UploadCloud className="w-6 h-6 text-neutral-400 mb-1" />
                    <span className="text-xs font-medium text-neutral-700">
                      {isUploadingMedia ? "Uploading..." : "Upload Image File"}
                    </span>
                    <span className="text-[10px] text-neutral-400">JPG, PNG up to 5MB</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      disabled={isUploadingMedia}
                      className="hidden"
                    />
                  </label>
                  <div className="flex flex-col justify-center space-y-1">
                    <span className="text-[11px] text-neutral-500">Or paste image URL:</span>
                    <Input
                      size="sm"
                      value={mediaUrl}
                      onChange={(e) => setMediaUrl(e.target.value)}
                      placeholder="https://example.com/banner.jpg"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between pt-4 border-t border-neutral-100">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(2)}
                className="gap-2 border-neutral-200"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
              <Button
                onClick={() => {
                  if (!message.trim()) {
                    setSubmitError("Please compose a message.");
                    return;
                  }
                  setSubmitError(null);
                  setCurrentStep(4);
                }}
                className="bg-theme-primary hover:bg-theme-primary-hover text-white gap-2 px-6 font-semibold transition-colors"
              >
                Next: Schedule & Launch
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Live Preview Column */}
          <div className="lg:col-span-5 space-y-4">
            <div className="sticky top-6 bg-[#E5DDD5] border border-neutral-300 rounded-3xl overflow-hidden shadow-lg">
              {/* WhatsApp Mockup Header */}
              <div className="bg-[#075E54] text-white px-4 py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-emerald-700 border border-emerald-400 flex items-center justify-center font-bold text-sm">
                  Z
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold truncate leading-tight">Zellora</h4>
                  <p className="text-[11px] text-emerald-200 truncate">Official Admin Account</p>
                </div>
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>

              {/* Chat Bubble Body */}
              <div className="p-4 space-y-3 min-h-[360px] flex flex-col justify-end bg-opacity-70">
                <div className="self-center bg-white/90 backdrop-blur px-3 py-1 rounded-full text-[10px] text-neutral-600 font-medium shadow-xs">
                  Today
                </div>

                <div className="self-end max-w-[88%] bg-[#DCF8C6] text-neutral-900 rounded-2xl rounded-tr-sm p-3 shadow-sm space-y-2 border border-emerald-200/50">
                  {mediaUrl && (
                    <div className="rounded-xl overflow-hidden border border-emerald-200 bg-black/5">
                      <img
                        src={mediaUrl}
                        alt="Preview"
                        className="w-full h-40 object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    </div>
                  )}

                  <p className="text-xs whitespace-pre-wrap leading-relaxed">
                    {message
                      ? message
                          .replace(/{{customer_name}}/g, "Priya")
                          .replace(/{{store_name}}/g, "Zellora")
                      : "Start typing your message to preview how customers will see it on their phones..."}
                  </p>

                  <div className="flex items-center justify-end gap-1 text-[10px] text-neutral-500">
                    <span>12:00 PM</span>
                    <span className="text-emerald-600 font-bold">✓✓</span>
                  </div>
                </div>
              </div>

              {/* Mockup Footer */}
              <div className="bg-neutral-100 px-4 py-2 text-center text-[11px] text-neutral-500 border-t border-neutral-200">
                Live Customer WhatsApp Preview
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: SCHEDULE & LAUNCH */}
      {currentStep === 4 && (
        <div className="bg-white border border-neutral-200/80 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="border-b border-neutral-100 pb-4">
            <h2 className="text-lg font-bold text-neutral-900">
              4. Review, Schedule & Launch
            </h2>
            <p className="text-sm text-neutral-500 mt-0.5">
              Verify your anti-ban delivery parameters and start your campaign.
            </p>
          </div>

          {/* Anti-ban Safeguard Badge Box */}
          <div className="bg-secondary-50/60 border border-secondary-200/80 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-secondary-800 font-bold text-sm">
              <ShieldCheck className="w-5 h-5 text-secondary-600 flex-shrink-0" />
              <span>Anti-Ban Delivery Safeguards Active</span>
            </div>
            <ul className="text-xs text-secondary-900 space-y-1.5 list-disc list-inside">
              <li>
                <strong>Strict 1-by-1 Sequential Queue:</strong> Zero simultaneous blasting. Each message
                is delivered after the previous one finishes.
              </li>
              <li>
                <strong>Human Typing Simulation:</strong> Baileys sends a WhatsApp <em>composing</em> signal
                with a randomized <strong>2.5s – 4.5s jitter delay</strong> between contacts.
              </li>
              <li>
                <strong>Circuit Breaker:</strong> If your phone loses connection, the campaign pauses automatically
                rather than dropping messages.
              </li>
            </ul>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-neutral-200/80 bg-neutral-50">
              <p className="text-xs text-neutral-500 font-medium">Selected Recipients</p>
              <p className="text-2xl font-bold text-neutral-900 mt-1">
                {totalSelected}{" "}
                <span className="text-xs font-normal text-neutral-500">contacts</span>
              </p>
            </div>
            <div className="p-4 rounded-xl border border-neutral-200/80 bg-neutral-50">
              <p className="text-xs text-neutral-500 font-medium">Estimated Delivery Time</p>
              <p className="text-2xl font-bold text-neutral-900 mt-1">
                ~{estMinutes}{" "}
                <span className="text-xs font-normal text-neutral-500">minutes</span>
              </p>
            </div>
            <div className="p-4 rounded-xl border border-neutral-200/80 bg-neutral-50">
              <p className="text-xs text-neutral-500 font-medium">Cost</p>
              <p className="text-2xl font-bold text-success-700 mt-1">
                ₹0.00{" "}
                <span className="text-xs font-normal text-neutral-500">(100% Free Forever)</span>
              </p>
            </div>
          </div>

          {/* Schedule Options */}
          <div className="space-y-4 pt-2">
            <label className="text-sm font-semibold text-neutral-700">
              When should this campaign start?
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                onClick={() => setScheduleMode("NOW")}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  scheduleMode === "NOW"
                    ? "border-secondary-600 bg-secondary-50/40 ring-2 ring-secondary-600/20"
                    : "border-neutral-200 hover:bg-neutral-50"
                }`}
              >
                <Radio
                  name="scheduleMode"
                  value="NOW"
                  checked={scheduleMode === "NOW"}
                  onValueChange={() => setScheduleMode("NOW")}
                  label="Send Immediately"
                  description="Worker begins 1-by-1 safe delivery in the background right now."
                />
              </div>

              <div
                onClick={() => setScheduleMode("SCHEDULED")}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  scheduleMode === "SCHEDULED"
                    ? "border-secondary-600 bg-secondary-50/40 ring-2 ring-secondary-600/20"
                    : "border-neutral-200 hover:bg-neutral-50"
                }`}
              >
                <Radio
                  name="scheduleMode"
                  value="SCHEDULED"
                  checked={scheduleMode === "SCHEDULED"}
                  onValueChange={() => setScheduleMode("SCHEDULED")}
                  label="Schedule for Later"
                  description="Background scheduler triggers automatically at your chosen date & time."
                />
              </div>
            </div>

            {scheduleMode === "SCHEDULED" && (
              <div className="space-y-2 pt-2">
                <label className="text-xs font-semibold text-neutral-700">
                  Select Execution Date & Time <span className="text-error-600">*</span>
                </label>
                <div className="max-w-sm">
                  <Input
                    type="datetime-local"
                    value={scheduledDateTime}
                    onChange={(e) => setScheduledDateTime(e.target.value)}
                  />
                </div>
                <p className="text-[11px] text-neutral-500">
                  Example: Pick 12:00 PM today. The server will start processing at 12:00 PM without requiring your browser tab to stay open.
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-between pt-6 border-t border-neutral-100">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(3)}
              className="gap-2 border-neutral-200"
              disabled={isSubmitting}
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <Button
              onClick={handleLaunchCampaign}
              disabled={isSubmitting}
              className="bg-theme-primary hover:bg-theme-primary-hover text-white gap-2 px-8 py-2.5 text-sm font-semibold transition-colors"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating Campaign...
                </>
              ) : scheduleMode === "SCHEDULED" ? (
                <>
                  <Calendar className="w-4 h-4" />
                  Schedule Campaign
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Launch Safe Campaign Now
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CreateCampaignPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center text-neutral-400 flex items-center justify-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-secondary-600" />
          <span>Loading campaign wizard...</span>
        </div>
      }
    >
      <CreateCampaignContent />
    </Suspense>
  );
}
