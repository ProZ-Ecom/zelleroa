"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  useCustomerAddresses,
  useCreateCustomerAddress,
  useUpdateCustomerAddress,
  useDeleteCustomerAddress,
} from "../../hooks/use-customer-address";
import {
  createCustomerAddressSchema,
  updateCustomerAddressSchema,
  type CreateCustomerAddressInput,
} from "../../validations/customer-address.schema";
import type { CustomerAddressResponse } from "../../types/customer-address.types";
import { CustomDropdown } from "./CustomDropdown";
import { usePincodeLookup } from "@/features/addresses/hooks/use-pincode-lookup";
import { Select } from "@/components/ui/select";



const LABEL_OPTIONS = [
  { value: "home", label: "Home" },
  { value: "work", label: "Work / Office" },
  { value: "parents", label: "Parents / Family" },
  { value: "other", label: "Other" },
];

type AddressFormData = {
  label: string;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  addressType: "shipping" | "billing";
  isDefault: boolean;
};

function getDirtyAddressFields(
  current: AddressFormData,
  initial: AddressFormData
): Record<string, any> {
  const dirty: Record<string, any> = {};

  if (current.fullName.trim() !== initial.fullName.trim()) {
    dirty.fullName = current.fullName.trim();
  }

  if (current.phone.trim() !== initial.phone.trim()) {
    dirty.phone = current.phone.trim();
  }

  if (current.label.trim() !== initial.label.trim()) {
    dirty.label = current.label.trim() || undefined;
  }

  if (current.addressType !== initial.addressType) {
    dirty.addressType = current.addressType;
  }

  if (current.addressLine1.trim() !== initial.addressLine1.trim()) {
    dirty.addressLine1 = current.addressLine1.trim();
  }

  if (current.addressLine2.trim() !== initial.addressLine2.trim()) {
    dirty.addressLine2 = current.addressLine2.trim() || undefined;
  }

  if (current.landmark.trim() !== initial.landmark.trim()) {
    dirty.landmark = current.landmark.trim() || undefined;
  }

  if (current.city.trim() !== initial.city.trim()) {
    dirty.city = current.city.trim();
  }

  if (current.state.trim() !== initial.state.trim()) {
    dirty.state = current.state.trim();
  }

  if (current.pincode.trim() !== initial.pincode.trim()) {
    dirty.pincode = current.pincode.trim();
  }

  if (current.isDefault !== initial.isDefault) {
    dirty.isDefault = current.isDefault;
  }

  return dirty;
}

export function AddressesTab() {
  const { data: addresses = [], isLoading, error, refetch } = useCustomerAddresses();
  const createMutation = useCreateCustomerAddress();
  const updateMutation = useUpdateCustomerAddress();
  const deleteMutation = useDeleteCustomerAddress();

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dirtyFields, setDirtyFields] = useState<Set<string>>(new Set());
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  // Custom dropdown open state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    isLoading: isPincodeLoading,
    lookupError: pincodeLookupError,
    postOffices,
    selectedPostOffice,
    setSelectedPostOffice,
    triggerLookup: triggerPincodeLookup,
    resetLookup: resetPincodeLookup,
  } = usePincodeLookup();

  const [formData, setFormData] = useState<AddressFormData>({
    label: "home",
    fullName: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    landmark: "",
    city: "",
    state: "",
    pincode: "",
    country: "India",
    addressType: "shipping",
    isDefault: false,
  });

  const handlePincodeChange = (val: string) => {
    const cleanPin = val.replace(/\D/g, "").slice(0, 6);
    setFormData((prev) => ({
      ...prev,
      pincode: cleanPin,
      // If pincode is changed or removed (< 6 digits), clear city and state immediately
      ...(cleanPin.length !== 6 ? { city: "", state: "" } : {}),
    }));

    if (editingId) {
      setDirtyFields((prev) => new Set(prev).add("pincode").add("city").add("state"));
    }

    if (fieldErrors.pincode || fieldErrors.city || fieldErrors.state) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.pincode;
        if (cleanPin.length === 6) {
          delete next.city;
          delete next.state;
        }
        return next;
      });
    }

    if (cleanPin.length === 6) {
      triggerPincodeLookup(cleanPin, {
        onSuccess: ({ city, state }) => {
          setFormData((prev) => ({
            ...prev,
            city,
            state,
          }));
          setFieldErrors((prev) => {
            const next = { ...prev };
            delete next.city;
            delete next.state;
            return next;
          });
        },
        onClear: () => {
          setFormData((prev) => ({
            ...prev,
            city: "",
            state: "",
          }));
        },
      });
    } else {
      resetPincodeLookup();
    }
  };


  // Handle clicking outside custom dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const validateForm = (data: AddressFormData): Record<string, string> => {
    const errors: Record<string, string> = {};

    if (!data.fullName || !data.fullName.trim()) {
      errors.fullName = "Full Name is required";
    } else if (data.fullName.trim().length > 150) {
      errors.fullName = "Full Name cannot exceed 150 characters";
    }

    const cleanPhone = (data.phone || "").trim().replace(/\D/g, "");
    if (!data.phone || !data.phone.trim()) {
      errors.phone = "Phone Number is required";
    } else if (cleanPhone.length !== 10 || !/^[6-9]\d{9}$/.test(cleanPhone)) {
      errors.phone = "Please enter a valid 10-digit Indian phone number";
    }

    if (!data.addressLine1 || !data.addressLine1.trim()) {
      errors.addressLine1 = "Address Line 1 is required";
    } else if (data.addressLine1.trim().length > 255) {
      errors.addressLine1 = "Address Line 1 cannot exceed 255 characters";
    }

    const cleanPincode = (data.pincode || "").trim().replace(/\D/g, "");
    if (!data.pincode || !data.pincode.trim()) {
      errors.pincode = "PIN Code is required";
    } else if (cleanPincode.length !== 6 || !/^\d{6}$/.test(cleanPincode)) {
      errors.pincode = "Please enter a valid 6-digit PIN code";
    }

    if (!data.city || !data.city.trim()) {
      errors.city = "City is required";
    } else if (data.city.trim().length > 100) {
      errors.city = "City cannot exceed 100 characters";
    }

    if (!data.state || !data.state.trim()) {
      errors.state = "State is required";
    } else if (data.state.trim().length > 100) {
      errors.state = "State cannot exceed 100 characters";
    }

    return errors;
  };

  const handleBlur = (field: keyof AddressFormData) => {
    const val = typeof formData[field] === "string" ? (formData[field] as string).trim() : "";
    let error: string | null = null;

    if (field === "fullName") {
      if (!val) error = "Full Name is required";
      else if (val.length > 150) error = "Full Name cannot exceed 150 characters";
    } else if (field === "phone") {
      const clean = val.replace(/\D/g, "");
      if (!val) error = "Phone Number is required";
      else if (clean.length !== 10 || !/^[6-9]\d{9}$/.test(clean)) {
        error = "Please enter a valid 10-digit Indian phone number";
      }
    } else if (field === "addressLine1") {
      if (!val) error = "Address Line 1 is required";
      else if (val.length > 255) error = "Address Line 1 cannot exceed 255 characters";
    } else if (field === "pincode") {
      const clean = val.replace(/\D/g, "");
      if (!val) error = "PIN Code is required";
      else if (clean.length !== 6 || !/^\d{6}$/.test(clean)) {
        error = "Please enter a valid 6-digit PIN code";
      }
    } else if (field === "city") {
      if (!val) error = "City is required";
      else if (val.length > 100) error = "City cannot exceed 100 characters";
    } else if (field === "state") {
      if (!val) error = "State is required";
      else if (val.length > 100) error = "State cannot exceed 100 characters";
    }

    setFieldErrors((prev) => {
      const next = { ...prev };
      if (error) {
        next[field] = error;
      } else {
        delete next[field];
      }
      return next;
    });
  };

  const handleFieldChange = (field: keyof AddressFormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (editingId) {
      setDirtyFields((prev) => new Set(prev).add(field));
    }
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    if (serverError) {
      setServerError(null);
    }
  };

  const handleStartEdit = (address: CustomerAddressResponse) => {
    const loadedData: AddressFormData = {
      label: address.label || "home",
      fullName: address.fullName || "",
      phone: address.phone ? address.phone.replace(/^\+91/, "").trim() : "",
      addressLine1: address.addressLine1 || "",
      addressLine2: address.addressLine2 || "",
      landmark: address.landmark || "",
      city: address.city || "",
      state: address.state || "",
      pincode: address.pincode || "",
      country: address.country || "India",
      addressType: (address.addressType as "shipping" | "billing") || "shipping",
      isDefault: Boolean(address.isDefault),
    };

    setFormData(loadedData);
    setDirtyFields(new Set());
    setEditingId(address.id);
    setFieldErrors({});
    setServerError(null);
    setIsAdding(true);

    if (address.pincode && address.pincode.replace(/\D/g, "").length === 6) {
      triggerPincodeLookup(address.pincode);
    }
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setDirtyFields(new Set());
    setFieldErrors({});
    setServerError(null);
    setIsDropdownOpen(false);
    resetPincodeLookup();
    setFormData({
      label: "home",
      fullName: "",
      phone: "",
      addressLine1: "",
      addressLine2: "",
      landmark: "",
      city: "",
      state: "",
      pincode: "",
      country: "India",
      addressType: "shipping",
      isDefault: false,
    });
  };


  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setServerError(null);

    // Validate all required fields simultaneously with equal priority
    const formValidationErrors = validateForm(formData);
    if (Object.keys(formValidationErrors).length > 0) {
      setFieldErrors(formValidationErrors);
      return;
    }

    setFieldErrors({});

    if (editingId) {
      // EDIT MODE: If no fields were touched, exit gracefully
      if (dirtyFields.size === 0) {
        handleCancel();
        return;
      }

      // Construct payload containing strictly only dirty/touched fields
      const dirtyPayload: Record<string, any> = {};
      if (dirtyFields.has("fullName")) dirtyPayload.fullName = formData.fullName.trim();
      if (dirtyFields.has("phone")) dirtyPayload.phone = formData.phone.trim();
      if (dirtyFields.has("label")) dirtyPayload.label = formData.label.trim() || undefined;
      if (dirtyFields.has("addressType")) dirtyPayload.addressType = formData.addressType;
      if (dirtyFields.has("addressLine1")) dirtyPayload.addressLine1 = formData.addressLine1.trim();
      if (dirtyFields.has("addressLine2")) dirtyPayload.addressLine2 = formData.addressLine2.trim() || undefined;
      if (dirtyFields.has("landmark")) dirtyPayload.landmark = formData.landmark.trim() || undefined;
      if (dirtyFields.has("city")) dirtyPayload.city = formData.city.trim();
      if (dirtyFields.has("state")) dirtyPayload.state = formData.state.trim();
      if (dirtyFields.has("pincode")) dirtyPayload.pincode = formData.pincode.trim();
      if (dirtyFields.has("isDefault")) dirtyPayload.isDefault = formData.isDefault;

      // Validate only modified fields with update schema
      const validationResult = updateCustomerAddressSchema.safeParse(dirtyPayload);
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
        await updateMutation.mutateAsync({
          uuid: editingId,
          data: dirtyPayload,
        });
        handleCancel();
      } catch (err: unknown) {
        const errorMsg =
          err instanceof Error
            ? err.message
            : "Failed to update address. Please verify your details.";
        setServerError(errorMsg);
      }
    } else {
      // CREATE MODE: Full payload validation and submission
      const payload: CreateCustomerAddressInput = {
        label: formData.label.trim() || undefined,
        fullName: formData.fullName.trim(),
        phone: formData.phone.trim(),
        addressLine1: formData.addressLine1.trim(),
        addressLine2: formData.addressLine2.trim() || undefined,
        landmark: formData.landmark.trim() || undefined,
        city: formData.city.trim(),
        state: formData.state.trim(),
        pincode: formData.pincode.trim(),
        country: formData.country || "India",
        addressType: formData.addressType || "shipping",
        isDefault: formData.isDefault,
      };

      const validationResult = createCustomerAddressSchema.safeParse(payload);
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
        await createMutation.mutateAsync(payload);
        handleCancel();
      } catch (err: unknown) {
        const errorMsg =
          err instanceof Error
            ? err.message
            : "Failed to save address. Please verify your details.";
        setServerError(errorMsg);
      }
    }
  };

  const currentLabelObj = LABEL_OPTIONS.find((opt) => opt.value === formData.label) || LABEL_OPTIONS[0];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((n) => (
          <div
            key={n}
            className="bg-theme-surface border border-theme-border rounded-xl p-5 animate-pulse space-y-3 overflow-hidden"
          >
            <div className="h-5 rounded w-1/3 skeleton-shimmer" />
            <div className="h-10 rounded w-full skeleton-shimmer" />
            <div className="h-4 rounded w-1/2 skeleton-shimmer" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-theme-surface border border-theme-border rounded-2xl p-8 text-center space-y-4">
        <p className="text-sm text-theme-text-muted">Failed to load saved addresses.</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="bg-theme-primary text-theme-primary-fg px-5 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 min-w-0">
      {/* Tab Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-xl sm:text-2xl font-bold uppercase tracking-wide text-theme-text-secondary">
          Saved Addresses
        </h2>
        {!isAdding && (
          <button
            type="button"
            onClick={() => {
              handleCancel();
              setIsAdding(true);
            }}
            className="bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-fg text-xs font-semibold uppercase tracking-wider py-2.5 px-5 rounded-lg transition-colors cursor-pointer min-h-[40px]"
          >
            Add New Address
          </button>
        )}
      </div>

      {/* Add / Edit Address Form Modal / Inline */}
      {isAdding && (
        <form
          onSubmit={handleSubmit}
          noValidate
          className="bg-theme-surface border border-theme-border rounded-2xl p-5 sm:p-6 space-y-5 shadow-xs transition-all relative"
        >
          {/* Header with Title and Address Type Toggle */}
          <div className="flex items-center justify-between gap-3 flex-wrap pb-3 border-b border-theme-border-subtle">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-theme-text-secondary">
              {editingId ? "Edit Delivery Address" : "New Delivery Address"}
            </h3>

            {/* Address Type Toggle (Shipping / Billing) */}
            <div className="flex items-center gap-1 bg-theme-surface-warm p-1 rounded-xl border border-theme-border">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleFieldChange("addressType", "shipping")}
                className={`px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-lg transition-all cursor-pointer disabled:opacity-50 ${formData.addressType === "shipping"
                    ? "bg-theme-secondary text-theme-secondary-fg shadow-xs"
                    : "text-theme-text-muted hover:text-theme-text-primary"
                  }`}
              >
                Shipping
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleFieldChange("addressType", "billing")}
                className={`px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-lg transition-all cursor-pointer disabled:opacity-50 ${formData.addressType === "billing"
                    ? "bg-theme-secondary text-theme-secondary-fg shadow-xs"
                    : "text-theme-text-muted hover:text-theme-text-primary"
                  }`}
              >
                Billing
              </button>
            </div>
          </div>

          {/* Server Error Banner */}
          {serverError && (
            <div className="bg-theme-status-can-bg border border-red-200 text-theme-status-can-fg p-3.5 rounded-lg text-xs font-medium">
              <span className="font-semibold">Validation Error:</span> {serverError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Full Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-theme-text-primary flex items-center justify-between">
                <span>
                  Full Name <span className="text-red-500 font-bold">*</span>
                </span>
              </label>
              <input
                type="text"
                disabled={isSubmitting}
                placeholder="Enter your full name"
                value={formData.fullName}
                onChange={(e) => handleFieldChange("fullName", e.target.value)}
                onBlur={() => handleBlur("fullName")}
                className={`border rounded-lg px-3.5 py-2.5 text-xs text-theme-text-primary bg-theme-surface-warm transition-colors outline-none disabled:opacity-50 ${
                  fieldErrors.fullName
                    ? "border-red-500 bg-red-50/20 focus:border-red-500 focus:ring-1 focus:ring-red-500/50 ring-1 ring-red-500/40"
                    : "border-theme-border-input focus:border-theme-primary"
                }`}
              />
              {fieldErrors.fullName && (
                <span className="text-xs text-red-500 font-medium animate-in fade-in duration-150">
                  {fieldErrors.fullName}
                </span>
              )}
            </div>

            {/* Phone Number */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-theme-text-primary flex items-center justify-between">
                <span>
                  Phone Number <span className="text-red-500 font-bold">*</span>
                </span>
              </label>
              <input
                type="tel"
                disabled={isSubmitting}
                maxLength={10}
                placeholder="10-digit mobile number"
                value={formData.phone}
                onChange={(e) => handleFieldChange("phone", e.target.value.replace(/\D/g, ""))}
                onBlur={() => handleBlur("phone")}
                className={`border rounded-lg px-3.5 py-2.5 text-xs text-theme-text-primary bg-theme-surface-warm transition-colors outline-none disabled:opacity-50 ${
                  fieldErrors.phone
                    ? "border-red-500 bg-red-50/20 focus:border-red-500 focus:ring-1 focus:ring-red-500/50 ring-1 ring-red-500/40"
                    : "border-theme-border-input focus:border-theme-primary"
                }`}
              />
              {fieldErrors.phone && (
                <span className="text-xs text-red-500 font-medium animate-in fade-in duration-150">
                  {fieldErrors.phone}
                </span>
              )}
            </div>

            {/* Address Line 1 */}
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-xs font-semibold text-theme-text-primary flex items-center justify-between">
                <span>
                  Address Line 1 <span className="text-red-500 font-bold">*</span>
                </span>
              </label>
              <input
                type="text"
                disabled={isSubmitting}
                placeholder="Flat, House No., Building, Street"
                value={formData.addressLine1}
                onChange={(e) => handleFieldChange("addressLine1", e.target.value)}
                onBlur={() => handleBlur("addressLine1")}
                className={`border rounded-lg px-3.5 py-2.5 text-xs text-theme-text-primary bg-theme-surface-warm transition-colors outline-none disabled:opacity-50 ${
                  fieldErrors.addressLine1
                    ? "border-red-500 bg-red-50/20 focus:border-red-500 focus:ring-1 focus:ring-red-500/50 ring-1 ring-red-500/40"
                    : "border-theme-border-input focus:border-theme-primary"
                }`}
              />
              {fieldErrors.addressLine1 && (
                <span className="text-xs text-red-500 font-medium animate-in fade-in duration-150">
                  {fieldErrors.addressLine1}
                </span>
              )}
            </div>

            {/* Address Line 2 */}
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-xs font-semibold text-theme-text-primary flex items-center justify-between">
                <span>
                  Address Line 2 <span className="text-theme-text-muted font-normal text-[11px]">(Optional)</span>
                </span>
              </label>
              <input
                type="text"
                disabled={isSubmitting}
                placeholder="Area, Colony, Sector"
                value={formData.addressLine2}
                onChange={(e) => handleFieldChange("addressLine2", e.target.value)}
                onBlur={() => handleBlur("addressLine2")}
                className={`border rounded-lg px-3.5 py-2.5 text-xs text-theme-text-primary bg-theme-surface-warm transition-colors outline-none disabled:opacity-50 ${
                  fieldErrors.addressLine2
                    ? "border-red-500 bg-red-50/20 focus:border-red-500 focus:ring-1 focus:ring-red-500/50 ring-1 ring-red-500/40"
                    : "border-theme-border-input focus:border-theme-primary"
                }`}
              />
              {fieldErrors.addressLine2 && (
                <span className="text-xs text-red-500 font-medium animate-in fade-in duration-150">
                  {fieldErrors.addressLine2}
                </span>
              )}
            </div>

            {/* Landmark */}
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-xs font-semibold text-theme-text-primary flex items-center justify-between">
                <span>
                  Landmark <span className="text-theme-text-muted font-normal text-[11px]">(Optional)</span>
                </span>
              </label>
              <input
                type="text"
                disabled={isSubmitting}
                placeholder="e.g. Near Bus Stand, opposite Temple"
                value={formData.landmark}
                onChange={(e) => handleFieldChange("landmark", e.target.value)}
                className="border border-theme-border-input rounded-lg px-3.5 py-2.5 text-xs text-theme-text-primary bg-theme-surface-warm focus:border-theme-primary transition-colors disabled:opacity-50"
              />
            </div>

            {/* PIN Code */}
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-xs font-semibold text-theme-text-primary flex items-center justify-between">
                <span>
                  PIN Code (6 digits) <span className="text-red-500 font-bold">*</span>
                </span>
                {isPincodeLoading && (
                  <span className="text-[11px] text-theme-primary flex items-center gap-1 font-medium">
                    <svg className="animate-spin h-3 w-3 text-current" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Checking postal directory...
                  </span>
                )}
              </label>
              <div className="relative">
                <input
                  type="text"
                  disabled={isSubmitting}
                  maxLength={6}
                  placeholder="e.g. 607106"
                  value={formData.pincode}
                  onChange={(e) => handlePincodeChange(e.target.value)}
                  onBlur={() => handleBlur("pincode")}
                  className={`w-full border rounded-lg px-3.5 py-2.5 text-xs text-theme-text-primary bg-theme-surface-warm transition-colors outline-none disabled:opacity-50 ${
                    fieldErrors.pincode || pincodeLookupError
                      ? "border-red-500 bg-red-50/20 focus:border-red-500 focus:ring-1 focus:ring-red-500/50 ring-1 ring-red-500/40"
                      : "border-theme-border-input focus:border-theme-primary"
                  }`}
                />
                {isPincodeLoading && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="animate-spin h-4 w-4 text-theme-primary" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                )}
              </div>
              {fieldErrors.pincode ? (
                <span className="text-xs text-red-500 font-medium animate-in fade-in duration-150">
                  {fieldErrors.pincode}
                </span>
              ) : pincodeLookupError ? (
                <span className="text-xs text-red-500 font-medium animate-in fade-in duration-150">
                  {pincodeLookupError}
                </span>
              ) : null}
            </div>

            {/* Post Office Dropdown (Admin Select Component) */}
            {postOffices.length > 0 && (
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-xs font-semibold text-theme-text-primary flex items-center justify-between">
                  <span>
                    Select Post Office / Locality ({postOffices.length} found)
                  </span>
                </label>
                <Select
                  options={postOffices.map((po) => ({
                    value: po.value,
                    label: `${po.label}${po.description ? ` (${po.description})` : ""}`,
                  }))}
                  value={selectedPostOffice}
                  onValueChange={(val) => {
                    setSelectedPostOffice(val);
                    handleFieldChange("addressLine2", val || formData.addressLine2);
                  }}
                  placeholder="-- Choose your nearest Post Office / Area --"
                  disabled={isSubmitting}
                />
              </div>
            )}

            {/* City (Auto-filled, ReadOnly, Normal Background) */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-theme-text-primary flex items-center justify-between">
                <span>
                  City / District <span className="text-red-500 font-bold">*</span>
                </span>
                <span className="text-[10px] text-theme-text-muted font-normal">Auto-filled</span>
              </label>
              <input
                type="text"
                readOnly
                tabIndex={-1}
                placeholder={isPincodeLoading ? "Fetching city..." : "Auto-filled from PIN Code"}
                value={formData.city}
                className={`border rounded-lg px-3.5 py-2.5 text-xs text-theme-text-primary bg-theme-surface-warm transition-colors outline-none cursor-default select-none shadow-none ${
                  fieldErrors.city
                    ? "border-red-500 bg-red-50/20 ring-1 ring-red-500/40"
                    : "border-theme-border-input"
                }`}
              />
              {fieldErrors.city && (
                <span className="text-xs text-red-500 font-medium animate-in fade-in duration-150">
                  {fieldErrors.city}
                </span>
              )}
            </div>

            {/* State (Auto-filled, ReadOnly, Normal Background) */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-theme-text-primary flex items-center justify-between">
                <span>
                  State <span className="text-red-500 font-bold">*</span>
                </span>
                <span className="text-[10px] text-theme-text-muted font-normal">Auto-filled</span>
              </label>
              <input
                type="text"
                readOnly
                tabIndex={-1}
                placeholder={isPincodeLoading ? "Fetching state..." : "Auto-filled from PIN Code"}
                value={formData.state}
                className={`border rounded-lg px-3.5 py-2.5 text-xs text-theme-text-primary bg-theme-surface-warm transition-colors outline-none cursor-default select-none shadow-none ${
                  fieldErrors.state
                    ? "border-red-500 bg-red-50/20 ring-1 ring-red-500/40"
                    : "border-theme-border-input"
                }`}
              />
              {fieldErrors.state && (
                <span className="text-xs text-red-500 font-medium animate-in fade-in duration-150">
                  {fieldErrors.state}
                </span>
              )}
            </div>



            {/* Custom Dropdown for Address Label */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-theme-text-primary flex items-center justify-between">
                <span>
                  Address Label <span className="text-theme-text-muted font-normal text-[11px]">(Optional)</span>
                </span>
              </label>
              <CustomDropdown
                options={LABEL_OPTIONS}
                value={formData.label}
                onChange={(val) => handleFieldChange("label", val)}
                disabled={isSubmitting}
              />
            </div>

            {/* Set as Default Checkbox */}
            <label className="flex items-center gap-2.5 cursor-pointer select-none pt-2 sm:col-span-2">
              <input
                type="checkbox"
                disabled={isSubmitting}
                checked={formData.isDefault}
                onChange={(e) => handleFieldChange("isDefault", e.target.checked)}
                className="w-4 h-4 rounded text-theme-primary accent-theme-primary cursor-pointer disabled:opacity-50"
              />
              <span className="text-xs font-medium text-theme-text-primary">
                Set as default delivery address
              </span>
            </label>
          </div>

          {/* Form Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-theme-secondary hover:bg-theme-secondary-hover text-theme-secondary-fg text-xs font-semibold uppercase tracking-wider py-2.5 px-6 rounded-lg transition-colors cursor-pointer min-h-[40px] disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting && (
                <svg className="animate-spin -ml-1 mr-1.5 h-3.5 w-3.5 text-current" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {isSubmitting
                ? editingId
                  ? "Updating..."
                  : "Saving..."
                : editingId
                  ? "Update Address"
                  : "Save Address"}
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleCancel}
              className="border border-theme-border text-theme-text-subtle text-xs font-semibold uppercase tracking-wider py-2.5 px-5 rounded-lg cursor-pointer hover:bg-theme-surface-alt transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Address Cards Grid */}
      {addresses.length === 0 && !isAdding ? (
        <div className="bg-theme-surface border border-theme-border rounded-2xl p-10 text-center shadow-2xs">
          <p className="text-sm text-theme-text-muted">No saved delivery addresses found.</p>
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="bg-theme-secondary hover:bg-theme-secondary-hover text-theme-secondary-fg text-xs font-semibold uppercase tracking-wider py-3 px-6 rounded-lg transition-colors cursor-pointer mt-4 min-h-[44px]"
          >
            Add Address
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {addresses.map((a: CustomerAddressResponse) => {
            const labelUpper = (a.label || "Delivery").toUpperCase();
            const isBilling = a.addressType === "billing";

            return (
              <div
                key={a.id}
                className="bg-theme-surface border border-theme-border rounded-xl p-5 flex flex-col justify-between gap-3 shadow-2xs hover:border-theme-primary/30 transition-all"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold uppercase tracking-wider text-theme-primary">
                      {labelUpper}
                    </span>
                    <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${isBilling
                        ? "bg-purple-100 text-purple-700"
                        : "bg-blue-100 text-blue-700"
                      }`}>
                      {a.addressType || "shipping"}
                    </span>
                    {a.isDefault && (
                      <span className="bg-theme-status-out-bg text-theme-status-out-fg text-[10px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full">
                        Default
                      </span>
                    )}
                  </div>

                  <div className="text-xs sm:text-sm font-semibold text-theme-text-primary">
                    {a.fullName}
                  </div>
                  <div className="text-xs text-theme-text-subtle font-light leading-relaxed">
                    {a.addressLine1}
                    {a.addressLine2 ? `, ${a.addressLine2}` : ""}
                    {a.landmark ? ` (Near ${a.landmark})` : ""}, {a.city} — {a.pincode}, {a.state}
                  </div>
                  <div className="text-xs text-theme-text-muted font-medium">
                    {a.phone}
                  </div>
                </div>

                {/* Card Action Buttons: Set as Default, Edit & Delete */}
                <div className="flex items-center gap-4 pt-2 border-t border-theme-border-subtle text-xs">
                  {!a.isDefault && (
                    <button
                      type="button"
                      onClick={() =>
                        updateMutation.mutate({
                          uuid: a.id,
                          data: { isDefault: true },
                        })
                      }
                      disabled={updateMutation.isPending || deleteMutation.isPending}
                      className="font-medium text-theme-primary hover:text-theme-secondary cursor-pointer transition-colors disabled:opacity-50"
                    >
                      Set as Default
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={updateMutation.isPending || deleteMutation.isPending}
                    onClick={() => handleStartEdit(a)}
                    className="font-medium text-theme-secondary hover:text-theme-primary cursor-pointer transition-colors ml-auto disabled:opacity-50"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={updateMutation.isPending || deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate(a.id)}
                    className="font-medium text-theme-status-can-fg hover:text-red-700 cursor-pointer transition-colors disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
