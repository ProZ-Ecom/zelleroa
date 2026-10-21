"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { WhatsAppNavTabs } from "@/components/admin/whatsapp/WhatsAppNavTabs";
import {
  PlusCircle,
  Copy,
  Check,
  Send,
  Loader2,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormModal } from "@/components/common/FormModal";
import { Select, type SelectOption } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface TemplateItem {
  id: string;
  name: string;
  category: "FESTIVAL" | "OFFER" | "PROMOTION" | "CUSTOM" | string;
  message: string;
  media_url: string | null;
  created_at: string;
}

const CATEGORY_OPTIONS: SelectOption[] = [
  { value: "FESTIVAL", label: "Festival Special" },
  { value: "OFFER", label: "Discount / Flash Sale" },
  { value: "PROMOTION", label: "Product Launch" },
  { value: "CUSTOM", label: "Custom" },
];

export default function WhatsAppTemplatesPage() {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal State for New Template
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTmplName, setNewTmplName] = useState("");
  const [newTmplCategory, setNewTmplCategory] = useState("FESTIVAL");
  const [newTmplMessage, setNewTmplMessage] = useState("");
  const [newTmplMediaUrl, setNewTmplMediaUrl] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const loadTemplates = React.useCallback(async (showSpinner = false) => {
    if (showSpinner) setIsLoading(true);
    try {
      const res = await fetch("/api/admin/whatsapp/templates");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setTemplates(json.data);
      }
    } catch (err: unknown) {
      console.error("Failed to load templates:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadTemplates(false);
  }, [loadTemplates]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!newTmplName.trim()) {
      setModalError("Please provide a template title.");
      return;
    }
    if (!newTmplMessage.trim()) {
      setModalError("Please provide message body.");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/admin/whatsapp/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTmplName,
          category: newTmplCategory,
          message: newTmplMessage,
          media_url: newTmplMediaUrl || null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setIsModalOpen(false);
        setNewTmplName("");
        setNewTmplMessage("");
        setNewTmplMediaUrl("");
        loadTemplates(true);
      } else {
        setModalError(json.message || "Failed to create template.");
      }
    } catch (err: unknown) {
      setModalError((err as Error).message || "Network error.");
    } finally {
      setIsSaving(false);
    }
  };

  const filteredTemplates =
    activeCategory === "ALL"
      ? templates
      : templates.filter((t) => t.category === activeCategory);

  const categories = [
    { id: "ALL", label: "All Templates" },
    { id: "FESTIVAL", label: "Festivals (Diwali, Pongal)" },
    { id: "OFFER", label: "Offers & Discounts" },
    { id: "PROMOTION", label: "New Launches" },
    { id: "CUSTOM", label: "Custom" },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <AdminPageHeader
        title="WhatsApp Message Templates"
        description="Ready-to-use festive, promotional, and seasonal templates formatted for WhatsApp"
      >
        <Button
          onClick={() => setIsModalOpen(true)}
          className="bg-theme-primary hover:bg-theme-primary-hover text-white gap-2 font-semibold text-xs h-9 transition-colors"
          size="sm"
        >
          <PlusCircle className="w-4 h-4" />
          Create Template
        </Button>
      </AdminPageHeader>

      {/* Tabs */}
      <WhatsAppNavTabs active="templates" />

      {/* Category Filter Pills */}
      <div className="flex flex-wrap items-center gap-2">
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCategory(c.id)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeCategory === c.id
                ? "bg-secondary-600 text-white shadow-xs"
                : "bg-white text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 border border-neutral-200/80 shadow-xs"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Templates Grid */}
      {isLoading ? (
        <div className="p-16 text-center text-neutral-400 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-secondary-600" />
          <span className="text-sm">Loading templates...</span>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="bg-white border border-neutral-200/80 rounded-2xl p-12 text-center space-y-4 shadow-xs">
          <FileText className="w-12 h-12 text-neutral-300 mx-auto" />
          <h3 className="text-base font-semibold text-neutral-800">
            No templates in this category
          </h3>
          <p className="text-xs text-neutral-500 max-w-md mx-auto">
            Create custom templates tailored for festival combos, weekend sales, or new collection launches.
          </p>
          <Button
            onClick={() => setIsModalOpen(true)}
            size="sm"
            className="bg-secondary-600 hover:bg-secondary-700 text-white gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            Create First Template
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((t) => (
            <div
              key={t.id}
              className="bg-white border border-neutral-200/80 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4 group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold tracking-wider uppercase border ${
                      t.category === "FESTIVAL"
                        ? "bg-primary-50 text-primary-800 border-primary-200/80"
                        : t.category === "OFFER"
                        ? "bg-secondary-50 text-secondary-700 border-secondary-200/80"
                        : t.category === "PROMOTION"
                        ? "bg-blue-50 text-blue-700 border-blue-200/80"
                        : "bg-neutral-100 text-neutral-700 border-neutral-200"
                    }`}
                  >
                    {t.category}
                  </span>
                  <button
                    onClick={() => handleCopy(t.message, t.id)}
                    className="text-neutral-400 hover:text-neutral-700 p-1 rounded-md transition-colors cursor-pointer"
                    title="Copy message content"
                  >
                    {copiedId === t.id ? (
                      <Check className="w-4 h-4 text-success-700" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>

                <h3 className="text-base font-bold text-neutral-900 group-hover:text-secondary-600 transition-colors">
                  {t.name}
                </h3>

                {t.media_url && (
                  <div className="relative h-32 rounded-xl overflow-hidden border border-neutral-200">
                    <img
                      src={t.media_url}
                      alt={t.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Message Body with Warm Styled Box */}
                <div className="bg-neutral-50 rounded-xl p-3.5 text-xs text-neutral-800 whitespace-pre-wrap font-sans leading-relaxed border border-neutral-200/80 max-h-48 overflow-y-auto">
                  {t.message}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-neutral-100 flex items-center gap-2">
                <Link
                  href={`/admin/dashboard/whatsapp/campaigns/create?templateId=${t.id}`}
                  className="flex-1"
                >
                  <Button
                    size="sm"
                    className="w-full bg-secondary-600 hover:bg-secondary-700 text-white text-xs gap-1.5 font-semibold shadow-xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Use in Campaign
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE NEW TEMPLATE MODAL (Reusing FormModal, Select, Input, Textarea) */}
      <FormModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Message Template"
        description="Save reusable messages for quick festive and offer blasts."
        size="md"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsModalOpen(false)}
              className="border-neutral-200"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreateTemplate}
              disabled={isSaving}
              size="sm"
              className="bg-secondary-600 hover:bg-secondary-700 text-white shadow-xs"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  Saving...
                </>
              ) : (
                "Save Template"
              )}
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateTemplate} className="space-y-4">
          {modalError && (
            <div className="p-3 bg-error-50 text-error-700 text-xs rounded-xl border border-error-200">
              {modalError}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-700">
              Template Name <span className="text-error-600">*</span>
            </label>
            <Input
              required
              size="sm"
              value={newTmplName}
              onChange={(e) => setNewTmplName(e.target.value)}
              placeholder="e.g. Diwali Sweets 20% Special"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-700">
              Category
            </label>
            <Select
              options={CATEGORY_OPTIONS}
              value={newTmplCategory}
              onValueChange={(val) => setNewTmplCategory(val)}
              size="sm"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-neutral-700">
                Message Content <span className="text-error-600">*</span>
              </label>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setNewTmplMessage((m) => m + " {{customer_name}}")}
                  className="text-[10px] px-2 py-0.5 rounded bg-secondary-50 text-secondary-700 border border-secondary-200 font-mono cursor-pointer hover:bg-secondary-100"
                >
                  + {"{{customer_name}}"}
                </button>
                <button
                  type="button"
                  onClick={() => setNewTmplMessage((m) => m + " {{store_name}}")}
                  className="text-[10px] px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 border border-neutral-200 font-mono cursor-pointer hover:bg-neutral-200"
                >
                  + {"{{store_name}}"}
                </button>
              </div>
            </div>
            <Textarea
              rows={5}
              required
              value={newTmplMessage}
              onChange={(e) => setNewTmplMessage(e.target.value)}
              placeholder="Namaste {{customer_name}}! 🪔..."
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-700">
              Attached Image URL (Optional)
            </label>
            <Input
              size="sm"
              value={newTmplMediaUrl}
              onChange={(e) => setNewTmplMediaUrl(e.target.value)}
              placeholder="https://example.com/banner.jpg"
            />
          </div>
        </form>
      </FormModal>
    </div>
  );
}
