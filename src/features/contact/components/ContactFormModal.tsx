"use client";

import * as React from "react";
import { EMAIL_MAX_LENGTH } from "@/lib/validations/email";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";
import {
  X,
  User,
  Mail,
  Phone,
  Tag,
  MessageSquare,
  Send,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import {
  createContactSchema,
  type CreateContactInput,
} from "../validations/contact.schema";
import { useSubmitContact } from "../hooks/use-submit-contact";
import { useCustomerProfile } from "@/features/customers/hooks/use-customer-profile";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export interface ContactFormModalProps {
  open: boolean;
  onClose: () => void;
}

export function ContactFormModal({ open, onClose }: ContactFormModalProps) {
  const [mounted, setMounted] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);

  // Form State
  const [formData, setFormData] = React.useState<CreateContactInput>({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });

  const [fieldErrors, setFieldErrors] = React.useState<
    Partial<Record<keyof CreateContactInput, string>>
  >({});
  const [generalError, setGeneralError] = React.useState<string | null>(null);

  // Authenticated user session & profile for auto-prefill
  const { data: session } = useSession();
  const { data: profile } = useCustomerProfile();

  // Contact submit mutation
  const submitContactMutation = useSubmitContact();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Autofill form when modal opens or profile loads
  React.useEffect(() => {
    if (open) {
      setIsSuccess(false);
      setFieldErrors({});
      setGeneralError(null);

      const initialName = profile?.name || session?.user?.name || "";
      const initialEmail = session?.user?.email || "";
      const initialPhone = profile?.phone || "";

      setFormData({
        name: initialName,
        email: initialEmail,
        phone: initialPhone,
        subject: "",
        message: "",
      });
    }
  }, [open, profile, session]);

  // Handle ESC key to close modal & lock scroll
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onClose();
      }
    };

    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [open, onClose]);

  const handleChange = (
    field: keyof CreateContactInput,
    value: string
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear specific field error on typing
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const copy = { ...prev };
        delete copy[field];
        return copy;
      });
    }
    if (generalError) {
      setGeneralError(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    // Validate using canonical Zod schema
    const validation = createContactSchema.safeParse(formData);

    if (!validation.success) {
      const formattedErrors: Partial<Record<keyof CreateContactInput, string>> =
        {};
      for (const issue of validation.error.issues) {
        const fieldName = issue.path[0] as keyof CreateContactInput;
        if (fieldName && !formattedErrors[fieldName]) {
          formattedErrors[fieldName] = issue.message;
        }
      }
      setFieldErrors(formattedErrors);
      return;
    }

    setFieldErrors({});

    submitContactMutation.mutate(validation.data, {
      onSuccess: () => {
        setIsSuccess(true);
      },
      onError: (err: any) => {
        const message =
          err?.response?.data?.message ||
          err?.message ||
          "Failed to send your message. Please try again or reach out to us directly.";
        setGeneralError(message);
      },
    });
  };

  const handleResetForm = () => {
    setIsSuccess(false);
    setFormData({
      name: profile?.name || session?.user?.name || "",
      email: session?.user?.email || "",
      phone: profile?.phone || "",
      subject: "",
      message: "",
    });
    setFieldErrors({});
    setGeneralError(null);
  };

  if (!open || !mounted) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      {/* Dark Blur Backdrop */}
      <div
        className="fixed inset-0 bg-black/65 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-modal-title"
        className="relative z-10 w-full max-w-xl bg-theme-surface border border-theme-border rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 my-auto flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-[var(--brown-700)] to-[var(--theme-primary,#5C1512)] px-5 sm:px-7 py-5 sm:py-6 text-white shrink-0 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-full bg-white/10 text-amber-200">
                <Sparkles className="w-4 h-4" />
              </span>
              <span className="text-xs uppercase tracking-widest font-bold text-theme-secondary-light">
                Ready to Assist
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1.5 text-white/75 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
              aria-label="Close contact modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <h2
            id="contact-modal-title"
            className="text-xl sm:text-2xl font-bold tracking-tight text-white mt-2"
          >
            {isSuccess ? "Message Received!" : "Contact Us"}
          </h2>
          <p className="text-xs sm:text-sm text-white/80 mt-1 leading-relaxed">
            {isSuccess
              ? "We have received your message and our team will get back to you shortly."
              : "Have a question, bulk order inquiry, or special request? Send us a message."}
          </p>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 scrollbar-thin space-y-5">
          {isSuccess ? (
            /* Success Feedback View */
            <div className="py-6 sm:py-8 flex flex-col items-center text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-inner">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div className="space-y-1.5 max-w-md">
                <h3 className="text-lg sm:text-xl font-bold text-theme-text-primary">
                  Thank You, {formData.name || "Customer"}!
                </h3>
                <p className="text-xs sm:text-sm text-theme-text-subtle leading-relaxed">
                  Your inquiry regarding{" "}
                  <span className="font-semibold text-theme-text-primary">
                    &ldquo;{formData.subject}&rdquo;
                  </span>{" "}
                  has been sent to our customer support team. An acknowledgement
                  email has been sent to{" "}
                  <span className="font-semibold text-theme-text-primary">
                    {formData.email}
                  </span>
                  .
                </p>
              </div>

              <div className="w-full pt-4 border-t border-theme-border flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-theme-primary text-theme-primary-fg hover:bg-theme-primary-hover font-semibold text-sm transition-all duration-150 shadow-xs cursor-pointer min-h-[44px]"
                >
                  Done
                </button>
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-theme-border text-theme-text-primary hover:bg-theme-surface-alt font-medium text-sm transition-all duration-150 cursor-pointer min-h-[44px]"
                >
                  Send Another Message
                </button>
              </div>
            </div>
          ) : (
            /* Form View */
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
              {/* General Error Banner */}
              {generalError && (
                <div className="p-3.5 rounded-xl bg-error-50 border border-error-200 flex items-start gap-2.5 text-error-700 text-xs sm:text-sm animate-in fade-in duration-150">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-error-600" />
                  <span className="flex-1">{generalError}</span>
                </div>
              )}

              {/* Grid 1: Name & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                {/* Full Name */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="contact-name"
                    className="block text-xs font-semibold text-theme-text-primary"
                  >
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-theme-text-muted pointer-events-none">
                      <User className="h-4 w-4" />
                    </span>
                    <input
                      id="contact-name"
                      type="text"
                      placeholder="e.g. John Doe"
                      value={formData.name}
                      onChange={(e) => handleChange("name", e.target.value)}
                      disabled={submitContactMutation.isPending}
                      className={cn(
                        "w-full rounded-xl border pl-9 pr-3.5 py-2.5 text-xs sm:text-sm text-theme-text-primary bg-theme-surface placeholder:text-theme-text-muted transition-colors min-h-[44px]",
                        fieldErrors.name
                          ? "border-error-500 focus:border-error-500 focus:ring-1 focus:ring-error-500"
                          : "border-theme-border focus:border-theme-primary focus:ring-2 focus:ring-theme-primary/15"
                      )}
                    />
                  </div>
                  {fieldErrors.name && (
                    <p className="text-xs text-red-500 font-medium flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{fieldErrors.name}</span>
                    </p>
                  )}
                </div>

                {/* Email Address */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="contact-email"
                    className="block text-xs font-semibold text-theme-text-primary"
                  >
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-theme-text-muted pointer-events-none">
                      <Mail className="h-4 w-4" />
                    </span>
                    <input
                      id="contact-email"
                      type="email"
                      maxLength={EMAIL_MAX_LENGTH}
                      placeholder="e.g. name@example.com"
                      value={formData.email}
                      onChange={(e) => handleChange("email", e.target.value)}
                      disabled={submitContactMutation.isPending}
                      className={cn(
                        "w-full rounded-xl border pl-9 pr-3.5 py-2.5 text-xs sm:text-sm text-theme-text-primary bg-theme-surface placeholder:text-theme-text-muted transition-colors min-h-[44px]",
                        fieldErrors.email
                          ? "border-error-500 focus:border-error-500 focus:ring-1 focus:ring-error-500"
                          : "border-theme-border focus:border-theme-primary focus:ring-2 focus:ring-theme-primary/15"
                      )}
                    />
                  </div>
                  {fieldErrors.email && (
                    <p className="text-xs text-red-500 font-medium flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{fieldErrors.email}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Grid 2: Phone Number & Subject */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                {/* Phone Number */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="contact-phone"
                    className="block text-xs font-semibold text-theme-text-primary"
                  >
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-theme-text-muted pointer-events-none">
                      <Phone className="h-4 w-4" />
                    </span>
                    <input
                      id="contact-phone"
                      type="tel"
                      placeholder="e.g. 9876543210"
                      maxLength={15}
                      value={formData.phone}
                      onChange={(e) => handleChange("phone", e.target.value)}
                      disabled={submitContactMutation.isPending}
                      className={cn(
                        "w-full rounded-xl border pl-9 pr-3.5 py-2.5 text-xs sm:text-sm text-theme-text-primary bg-theme-surface placeholder:text-theme-text-muted transition-colors min-h-[44px]",
                        fieldErrors.phone
                          ? "border-error-500 focus:border-error-500 focus:ring-1 focus:ring-error-500"
                          : "border-theme-border focus:border-theme-primary focus:ring-2 focus:ring-theme-primary/15"
                      )}
                    />
                  </div>
                  {fieldErrors.phone && (
                    <p className="text-xs text-red-500 font-medium flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{fieldErrors.phone}</span>
                    </p>
                  )}
                </div>

                {/* Subject */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="contact-subject"
                    className="block text-xs font-semibold text-theme-text-primary"
                  >
                    Subject <span className="text-red-500">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-theme-text-muted pointer-events-none">
                      <Tag className="h-4 w-4" />
                    </span>
                    <input
                      id="contact-subject"
                      type="text"
                      placeholder="e.g. Order Inquiry / Bulk Order"
                      value={formData.subject}
                      onChange={(e) => handleChange("subject", e.target.value)}
                      disabled={submitContactMutation.isPending}
                      className={cn(
                        "w-full rounded-xl border pl-9 pr-3.5 py-2.5 text-xs sm:text-sm text-theme-text-primary bg-theme-surface placeholder:text-theme-text-muted transition-colors min-h-[44px]",
                        fieldErrors.subject
                          ? "border-error-500 focus:border-error-500 focus:ring-1 focus:ring-error-500"
                          : "border-theme-border focus:border-theme-primary focus:ring-2 focus:ring-theme-primary/15"
                      )}
                    />
                  </div>
                  {fieldErrors.subject && (
                    <p className="text-xs text-red-500 font-medium flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{fieldErrors.subject}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Message Textarea */}
              <div className="space-y-1.5">
                <label
                  htmlFor="contact-message"
                  className="block text-xs font-semibold text-theme-text-primary"
                >
                  Message <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <textarea
                    id="contact-message"
                    rows={4}
                    placeholder="Describe your inquiry, order requirement, or feedback in detail..."
                    value={formData.message}
                    onChange={(e) => handleChange("message", e.target.value)}
                    disabled={submitContactMutation.isPending}
                    className={cn(
                      "w-full rounded-xl border p-3 text-xs sm:text-sm text-theme-text-primary bg-theme-surface placeholder:text-theme-text-muted transition-colors resize-none",
                      fieldErrors.message
                        ? "border-error-500 focus:border-error-500 focus:ring-1 focus:ring-error-500"
                        : "border-theme-border focus:border-theme-primary focus:ring-2 focus:ring-theme-primary/15"
                    )}
                  />
                </div>
                {fieldErrors.message && (
                  <p className="text-xs text-red-500 font-medium flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{fieldErrors.message}</span>
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col-reverse sm:flex-row items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitContactMutation.isPending}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-theme-border text-theme-text-subtle hover:bg-theme-surface-alt font-medium text-xs sm:text-sm transition-colors cursor-pointer disabled:opacity-50 min-h-[44px]"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitContactMutation.isPending}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-theme-primary text-theme-primary-fg hover:bg-theme-primary-hover font-semibold text-xs sm:text-sm transition-all duration-150 shadow-xs active:scale-95 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed min-h-[44px]"
                >
                  {submitContactMutation.isPending ? (
                    <>
                      <Spinner size="sm" className="text-white" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit Message</span>
                      <Send className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

export default ContactFormModal;
