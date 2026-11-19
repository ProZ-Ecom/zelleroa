"use client";

import React, { useState, useEffect } from "react";
import type { CustomerProfileResponse } from "../../types";
import { useUpdateCustomerProfile } from "../../hooks/use-customer-profile";

import { updateCustomerProfileSchema } from "../../validations/customer-profile.schema";
import { CustomDropdown } from "./CustomDropdown";

interface ProfileDetailsTabProps {
  profile?: CustomerProfileResponse | null;
  isLoading?: boolean;
}

export function ProfileDetailsTab({
  profile,
  isLoading,
}: ProfileDetailsTabProps) {
  const updateMutation = useUpdateCustomerProfile();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "other" | "not_applicable" | "">("");
  const [isWhatsapp, setIsWhatsapp] = useState(false);
  const [whatsappNo, setWhatsappNo] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (profile) {
      setName(profile.name || "");
      setPhone(profile.phone || "");
      setEmail(profile.email || "");
      setDob(profile.dob ? profile.dob.slice(0, 10) : "");
      setGender(profile.gender || "");
      setIsWhatsapp(profile.isWhatsapp || false);
      setWhatsappNo(profile.whatsappNo || "");
    }
  }, [profile]);

  const handleFieldChange = (setter: React.Dispatch<React.SetStateAction<any>>, field: string, val: any) => {
    setter(val);
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    if (message) setMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setFieldErrors({});

    const payload = {
      name: name.trim() || undefined,
      dob: dob || null,
      gender: (gender || null) as "male" | "female" | "other" | "not_applicable" | null,
      isWhatsapp,
      whatsappNo: isWhatsapp ? (whatsappNo.trim() || undefined) : null,
    };

    const validationResult = updateCustomerProfileSchema.safeParse(payload);
    if (!validationResult.success) {
      const errors: Record<string, string> = {};
      validationResult.error.issues.forEach((issue) => {
        const fieldName = String(issue.path[0] || "general");
        if (!errors[fieldName]) {
          errors[fieldName] = issue.message;
        }
      });
      setFieldErrors(errors);
      return;
    }

    try {
      await updateMutation.mutateAsync(payload);

      setMessage({ type: "success", text: "Profile updated successfully!" });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to update profile";
      setMessage({ type: "error", text: errorMsg });
    }
  };

  const handleReset = () => {
    if (profile) {
      setName(profile.name || "");
      setPhone(profile.phone || "");
      setEmail(profile.email || "");
      setDob(profile.dob ? profile.dob.slice(0, 10) : "");
      setGender(profile.gender || "");
      setIsWhatsapp(profile.isWhatsapp || false);
      setWhatsappNo(profile.whatsappNo || "");
      setMessage(null);
    }
  };

  const userInitial = name ? name.trim().slice(0, 2).toUpperCase() : "U";

  if (isLoading) {
    return (
      <div className="bg-theme-surface border border-theme-border rounded-2xl p-6 sm:p-8 animate-pulse space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-theme-border flex-shrink-0" />
          <div className="space-y-2 flex-1">
            <div className="h-4 w-36 bg-theme-border rounded" />
            <div className="h-3 w-48 bg-theme-border-subtle rounded" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-20 bg-theme-border-subtle rounded" />
              <div className="h-11 w-full bg-theme-border rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-theme-surface border border-theme-border rounded-2xl shadow-2xs min-w-0">
      <div className="px-5 py-4 border-b border-theme-border-subtle bg-theme-surface-alt rounded-t-2xl">
        <h2 className="text-sm sm:text-base font-semibold uppercase tracking-wider text-theme-text-secondary">
          Profile Details
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="p-5 sm:p-7 flex flex-col gap-6">
        {/* Avatar Section */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-theme-primary flex items-center justify-center font-bold text-lg sm:text-2xl text-theme-secondary-light">
            {userInitial}
          </div>
          <div>
            <div className="text-sm font-semibold text-theme-text-primary">
              {name || "Your Account"}
            </div>
            <div className="text-xs text-theme-text-muted mt-0.5">
              {email || phone || "Personal Details"}
            </div>
          </div>
        </div>

        {/* Feedback Message */}
        {message && (
          <div
            className={`p-3 rounded-lg text-xs font-medium ${
              message.type === "success"
                ? "bg-theme-status-del-bg text-theme-status-del-fg"
                : "bg-theme-status-can-bg text-theme-status-can-fg"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Form Fields Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          <label className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-theme-text-muted">
              Full Name
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => handleFieldChange(setName, "name", e.target.value)}
              placeholder="Enter your full name"
              className={`border rounded-lg px-3.5 py-3 text-xs sm:text-sm text-theme-text-primary bg-theme-surface-warm focus:border-theme-primary transition-colors min-h-[44px] ${
                fieldErrors.name ? "border-red-500 bg-red-50/20" : "border-theme-border-input"
              }`}
            />
            {fieldErrors.name && (
              <span className="text-xs text-red-500 font-medium">{fieldErrors.name}</span>
            )}
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-theme-text-muted">
              Mobile Number
            </span>
            <input
              type="tel"
              value={phone}
              readOnly
              placeholder="Registered mobile number"
              className="border border-theme-border-input rounded-lg px-3.5 py-3 text-xs sm:text-sm text-theme-text-primary bg-theme-surface-alt cursor-not-allowed min-h-[44px]"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-theme-text-muted">
              Email Address
            </span>
            <input
              type="email"
              value={email}
              readOnly
              placeholder="Registered email address"
              className="border border-theme-border-input rounded-lg px-3.5 py-3 text-xs sm:text-sm text-theme-text-primary bg-theme-surface-alt cursor-not-allowed min-h-[44px]"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-theme-text-muted">
              Date of Birth
            </span>
            <input
              type="date"
              value={dob}
              onChange={(e) => handleFieldChange(setDob, "dob", e.target.value)}
              className={`border rounded-lg px-3.5 py-3 text-xs sm:text-sm text-theme-text-primary bg-theme-surface-warm focus:border-theme-primary transition-colors min-h-[44px] ${
                fieldErrors.dob ? "border-red-500 bg-red-50/20" : "border-theme-border-input"
              }`}
            />
            {fieldErrors.dob && (
              <span className="text-xs text-red-500 font-medium">{fieldErrors.dob}</span>
            )}
          </label>

          <CustomDropdown
            label="Gender"
            placeholder="Select Gender"
            options={[
              { value: "female", label: "Female" },
              { value: "male", label: "Male" },
              { value: "other", label: "Other" },
              { value: "not_applicable", label: "Not Applicable" },
            ]}
            value={gender}
            onChange={(val) =>
              handleFieldChange(
                setGender,
                "gender",
                val as "male" | "female" | "other" | "not_applicable" | ""
              )
            }
            disabled={updateMutation.isPending}
            error={fieldErrors.gender}
            triggerClassName="min-h-[44px] py-3 text-xs sm:text-sm"
          />

          <div className="flex flex-col gap-2 justify-center">
            <label className="flex items-center gap-2.5 cursor-pointer mt-4">
              <input
                type="checkbox"
                checked={isWhatsapp}
                onChange={(e) => handleFieldChange(setIsWhatsapp, "isWhatsapp", e.target.checked)}
                className="w-4 h-4 rounded text-theme-primary accent-theme-primary cursor-pointer"
              />
              <span className="text-xs font-medium text-theme-text-primary">
                Receive order updates on WhatsApp
              </span>
            </label>
            {isWhatsapp && (
              <div className="flex flex-col gap-1 mt-2">
                <input
                  type="tel"
                  value={whatsappNo}
                  onChange={(e) => handleFieldChange(setWhatsappNo, "whatsappNo", e.target.value)}
                  placeholder="+91 WhatsApp Number"
                  className={`border rounded-lg px-3.5 py-2.5 text-xs text-theme-text-primary bg-theme-surface-warm focus:border-theme-primary transition-colors ${
                    fieldErrors.whatsappNo ? "border-red-500 bg-red-50/20" : "border-theme-border-input"
                  }`}
                />
                {fieldErrors.whatsappNo && (
                  <span className="text-xs text-red-500 font-medium">{fieldErrors.whatsappNo}</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 flex-wrap pt-2">
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="bg-theme-secondary hover:bg-theme-secondary-hover text-theme-secondary-fg text-xs font-semibold uppercase tracking-wider py-3.5 px-7 rounded-lg transition-colors cursor-pointer disabled:opacity-50 min-h-[44px]"
          >
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="border border-theme-border hover:bg-theme-surface-alt text-theme-text-subtle text-xs font-semibold uppercase tracking-wider py-3.5 px-6 rounded-lg transition-colors cursor-pointer min-h-[44px]"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
