"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Camera, FileCheck2, Loader2, ShieldAlert, Upload } from "lucide-react";
import { apiClient, ApiClientError } from "@/lib/api/api-client";
import { toast } from "@/components/ui/Toast";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { usePincodeLookup } from "@/features/addresses/hooks/use-pincode-lookup";
import type { AgentProfileDto } from "../services/agent-profile.service";
import {
  GENDERS,
  GENDER_LABELS,
  sectionSchemas,
  type DocKind,
  type ProfileSection,
} from "../validations/agent-profile.schema";
import { ProfileCompletionCard } from "./ProfileCompletionCard";
import { StatusBadge, fieldCls } from "./shared";

const STEPS: Array<{ key: ProfileSection; label: string; hint: string }> = [
  { key: "personal", label: "Personal", hint: "Name, contact & photo" },
  { key: "address", label: "Address", hint: "Where you live" },
  { key: "kyc", label: "KYC", hint: "Aadhaar & PAN" },
  { key: "bank", label: "Bank", hint: "Where we pay you" },
];

type Values = Record<string, string>;
type Errors = Record<string, string>;

const stripCountryCode = (v: string | null) => (v ?? "").replace(/^\+91/, "");

/** Formats a 12-digit Aadhaar as 3 groups of 4 digits: XXXX XXXX XXXX */
const formatAadhaar = (val: string) => {
  const digits = val.replace(/\D/g, "").slice(0, 12);
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
};

/** Formats PAN as 10 uppercase alphanumeric characters */
const formatPan = (val: string) => {
  return val.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
};

function initialValues(p: AgentProfileDto): Record<ProfileSection, Values> {
  return {
    personal: {
      name: p.personal.name ?? "",
      phone: stripCountryCode(p.personal.phone),
      altPhone: stripCountryCode(p.personal.altPhone),
      dob: p.personal.dob ?? "",
      gender: p.personal.gender ?? "",
    },
    address: {
      line1: p.address.line1 ?? "",
      line2: p.address.line2 ?? "",
      area: p.address.area ?? "",
      city: p.address.city ?? "",
      district: p.address.district ?? "",
      state: p.address.state ?? "",
      pincode: p.address.pincode ?? "",
      country: p.address.country ?? "India",
    },
    // Sensitive numbers are never sent back to the browser - the boxes start empty.
    kyc: { aadhaar: "", pan: "" },
    bank: {
      accountHolder: p.bank.accountHolder ?? "",
      bankName: p.bank.bankName ?? "",
      accountNumber: "",
      confirmAccountNumber: "",
      ifsc: p.bank.ifsc ?? "",
      branch: p.bank.branch ?? "",
    },
  };
}

/** Fields that must be present for "Save & continue" (a saved masked value counts as present). */
function requiredErrors(section: ProfileSection, v: Values, p: AgentProfileDto): Errors {
  const e: Errors = {};
  const need = (key: string, label: string, ok = Boolean(v[key]?.trim())) => {
    if (!ok) e[key] = `${label} is required`;
  };
  if (section === "personal") {
    need("name", "Full name");
    need("phone", "Mobile number");
    need("dob", "Date of birth");
    need("gender", "Gender");
  } else if (section === "address") {
    need("pincode", "Pincode");
    need("line1", "Address line 1");
    need("city", "City");
    need("district", "District");
    need("state", "State");
    need("country", "Country");
  } else if (section === "kyc") {
    need("aadhaar", "Aadhaar number", Boolean(v.aadhaar) || Boolean(p.kyc.aadhaarMasked));
    need("pan", "PAN number", Boolean(v.pan) || Boolean(p.kyc.panMasked));
    if (!p.kyc.hasAadhaarDoc) e.aadhaarDoc = "Upload your Aadhaar card";
    if (!p.kyc.hasPanDoc) e.panDoc = "Upload your PAN card";
  } else {
    need("accountHolder", "Account holder name");
    need("bankName", "Bank name");
    need("accountNumber", "Account number", Boolean(v.accountNumber) || p.bank.hasAccount);
    need("confirmAccountNumber", "Confirm account number", !v.accountNumber || Boolean(v.confirmAccountNumber));
    need("ifsc", "IFSC code");
    need("branch", "Branch name");
    if (!p.bank.hasProof) e.bankDoc = "Upload a cancelled cheque or bank proof";
  }
  return e;
}

function Field({ label, error, hint, required, children }: { label: string; error?: string; hint?: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
      <span>
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
      {hint && !error && <span className="font-normal text-neutral-400">{hint}</span>}
      {error && <span className="font-normal text-red-600">{error}</span>}
    </label>
  );
}

function DocUpload({
  kind,
  label,
  uploaded,
  error,
  onUploaded,
}: {
  kind: DocKind;
  label: string;
  uploaded: boolean;
  error?: string;
  onUploaded: (p: AgentProfileDto) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large", "Choose a file under 5 MB.");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiClient.post<AgentProfileDto>(`/api/agent/profile/document/${kind}`, fd);
      onUploaded(res.data as AgentProfileDto);
      toast.success(`${label} uploaded`);
    } catch (err) {
      toast.error("Upload failed", err instanceof ApiClientError ? err.message : "Please try again.");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
      <span>
        {label} <span className="text-red-500">*</span>
      </span>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-neutral-300 p-3">
        {uploaded ? <FileCheck2 className="h-5 w-5 text-emerald-600" /> : <Upload className="h-5 w-5 text-neutral-400" />}
        <span className="text-sm text-neutral-700">{uploaded ? "Uploaded" : "JPG, PNG, WebP or PDF · max 5 MB"}</span>
        <div className="ml-auto flex items-center gap-2">
          {uploaded && (
            <a href={`/api/agent/profile/document/${kind}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-neutral-700 underline">
              View
            </a>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => ref.current?.click()}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-neutral-200 px-3 text-sm font-medium hover:bg-neutral-50 disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {uploaded ? "Replace" : "Choose file"}
          </button>
        </div>
        <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      </div>
      {error && <span className="font-normal text-red-600">{error}</span>}
    </div>
  );
}

function VerificationNote({ status, remarks, label }: { status: string; remarks: string | null; label: string }) {
  if (status === "not_submitted") return null;
  return (
    <div
      className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-sm ${
        status === "verified"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : status === "rejected"
            ? "border-red-200 bg-red-50 text-red-800"
            : "border-amber-200 bg-amber-50 text-amber-800"
      }`}
    >
      {status === "verified" ? <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" /> : <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />}
      <div>
        <p className="font-semibold">
          {label}: <StatusBadge status={status} className="align-middle" />
        </p>
        {status === "pending" && <p className="text-xs">Submitted – waiting for admin review.</p>}
        {status === "verified" && <p className="text-xs">Editing these details will send them for review again.</p>}
        {status === "rejected" && remarks && <p className="text-xs">Reason: {remarks}</p>}
      </div>
    </div>
  );
}

export function ProfileWizard({ initial, initialStep }: { initial: AgentProfileDto; initialStep?: string }) {
  const router = useRouter();
  const [profile, setProfile] = useState(initial);
  const [values, setValues] = useState(() => initialValues(initial));
  const [errors, setErrors] = useState<Errors>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [saving, setSaving] = useState<"draft" | "next" | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<ProfileSection>(STEPS.some((s) => s.key === initialStep) ? (initialStep as ProfileSection) : "personal");

  const {
    isLoading: isPinLoading,
    lookupError: pinLookupError,
    postOffices,
    triggerLookup,
    resetLookup,
  } = usePincodeLookup();

  // Broadcasts profile updates to AgentNav (header & sidebar avatar rings) instantly without page reload
  const notifyProfileUpdated = (updated: AgentProfileDto) => {
    setProfile(updated);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("agent-profile-updated", { detail: updated }));
    }
    router.refresh();
  };

  const v = values[step];
  const set = (key: string, value: string) => {
    setValues((all) => ({ ...all, [step]: { ...all[step], [key]: value } }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: "" }));
  };
  const goTo = (s: string) => {
    setStep(s as ProfileSection);
    setErrors({});
    setBanner(null);
  };

  // Pre-load postal area options if an existing address has a 6-digit pincode
  useEffect(() => {
    if (step === "address" && values.address.pincode?.length === 6 && postOffices.length === 0) {
      triggerLookup(values.address.pincode);
    }
  }, [step, values.address.pincode, postOffices.length, triggerLookup]);

  const handlePincodeChange = (rawVal: string) => {
    const digits = rawVal.replace(/\D/g, "").slice(0, 6);
    setValues((all) => ({
      ...all,
      address: {
        ...all.address,
        pincode: digits,
        ...(digits.length !== 6 ? { city: "", district: "", state: "" } : {}),
      },
    }));

    if (errors.pincode || errors.city || errors.district || errors.state) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.pincode;
        if (digits.length === 6) {
          delete next.city;
          delete next.district;
          delete next.state;
        }
        return next;
      });
    }

    if (digits.length !== 6) {
      resetLookup();
      return;
    }

    triggerLookup(digits, {
      onSuccess: ({ city, district, state, country, postOffices: offices }) => {
        setValues((all) => ({
          ...all,
          address: {
            ...all.address,
            pincode: digits,
            district: district || city,
            state,
            city: city || district,
            country: country || "India",
            area: all.address.area || offices[0]?.name || "",
          },
        }));
        setErrors((prev) => {
          const next = { ...prev };
          delete next.pincode;
          delete next.city;
          delete next.district;
          delete next.state;
          delete next.country;
          return next;
        });
      },
      onClear: () => {
        setValues((all) => ({
          ...all,
          address: {
            ...all.address,
            pincode: digits,
            city: "",
            district: "",
            state: "",
          },
        }));
      },
    });
  };

  const save = async (strict: boolean) => {
    setBanner(null);
    const found: Errors = {};
    const parsed = sectionSchemas[step].safeParse(v);
    if (!parsed.success) for (const i of parsed.error.issues) found[String(i.path[0])] ??= i.message;
    if (strict) Object.assign(found, Object.fromEntries(Object.entries(requiredErrors(step, v, profile)).filter(([k]) => !found[k])));
    setErrors(found);
    if (Object.keys(found).length) {
      setBanner("Please fix the highlighted fields.");
      return;
    }

    setSaving(strict ? "next" : "draft");
    try {
      const res = await apiClient.put<AgentProfileDto>("/api/agent/profile/details", { section: step, strict, data: v });
      notifyProfileUpdated(res.data as AgentProfileDto);
      // Secrets leave the form as soon as they are stored.
      setValues((all) =>
        step === "kyc"
          ? { ...all, kyc: { aadhaar: "", pan: "" } }
          : step === "bank"
            ? { ...all, bank: { ...all.bank, accountNumber: "", confirmAccountNumber: "" } }
            : all
      );
      toast.success(strict ? "Saved" : "Draft saved");
      if (strict) {
        const next = STEPS[STEPS.findIndex((s) => s.key === step) + 1];
        if (next) goTo(next.key);
      }
    } catch (err) {
      if (err instanceof ApiClientError && err.errors?.length) {
        const mapped: Errors = {};
        const general: string[] = [];
        for (const line of err.errors) {
          const idx = line.indexOf(": ");
          if (idx > 0 && /^\w+$/.test(line.slice(0, idx))) mapped[line.slice(0, idx)] ??= line.slice(idx + 2);
          else general.push(line);
        }
        setErrors(mapped);
        setBanner(general.length ? general.join(" · ") : err.message);
      } else {
        setBanner(err instanceof ApiClientError ? err.message : "Could not save. Please try again.");
      }
    } finally {
      setSaving(null);
    }
  };

  const uploadPhoto = async (file: File | undefined) => {
    if (!file) return;
    setPhotoBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiClient.post<AgentProfileDto>("/api/agent/profile/photo", fd);
      notifyProfileUpdated(res.data as AgentProfileDto);
      toast.success("Profile photo updated");
    } catch (err) {
      toast.error("Upload failed", err instanceof ApiClientError ? err.message : "Please try again.");
    } finally {
      setPhotoBusy(false);
      if (photoRef.current) photoRef.current.value = "";
    }
  };

  const text = (key: string, label: string, opts: { required?: boolean; hint?: string; type?: string; inputMode?: "numeric" | "tel"; maxLength?: number; upper?: boolean; placeholder?: string } = {}) => (
    <Field label={label} required={opts.required} error={errors[key]} hint={opts.hint}>
      <input
        className={`${fieldCls} ${errors[key] ? "border-red-300" : ""} ${opts.upper ? "uppercase" : ""}`}
        type={opts.type ?? "text"}
        inputMode={opts.inputMode}
        maxLength={opts.maxLength}
        placeholder={opts.placeholder}
        value={v[key] ?? ""}
        onChange={(e) => set(key, e.target.value)}
        autoComplete="off"
      />
    </Field>
  );

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-5">
      <ProfileCompletionCard completion={profile.completion} onNavigate={goTo} compact />

      <nav className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Profile steps">
        {STEPS.map((s, i) => {
          const done = profile.completion.sections.filter((c) => c.step === s.key).every((c) => c.complete);
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => goTo(s.key)}
              aria-current={step === s.key ? "step" : undefined}
              className={`flex min-h-[56px] items-center gap-3 rounded-xl border px-3 text-left transition-colors ${
                step === s.key ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white hover:bg-neutral-50"
              }`}
            >
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${done ? "bg-emerald-500 text-white" : step === s.key ? "bg-white text-neutral-900" : "bg-neutral-100 text-neutral-600"}`}>
                {done ? "✓" : i + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{s.label}</span>
                <span className={`hidden truncate text-[11px] sm:block ${step === s.key ? "text-neutral-300" : "text-neutral-500"}`}>{s.hint}</span>
              </span>
            </button>
          );
        })}
      </nav>

      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xs">
        <div className="flex flex-col gap-4 p-4 sm:p-5">
          {banner && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{banner}</div>}

          {step === "personal" && (
            <>
              <div className="flex items-center gap-4">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-neutral-100">
                  {profile.personal.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.personal.photo} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-2xl font-bold text-neutral-400">{(profile.personal.name ?? "?").charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div>
                  <button
                    type="button"
                    disabled={photoBusy}
                    onClick={() => photoRef.current?.click()}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-neutral-200 px-3 text-sm font-medium hover:bg-neutral-50 disabled:opacity-60"
                  >
                    {photoBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                    {profile.personal.photo ? "Change photo" : "Upload photo"}
                  </button>
                  <p className="mt-1 text-xs text-neutral-500">JPG, PNG or WebP · max 5 MB</p>
                  <input ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => uploadPhoto(e.target.files?.[0])} />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {text("name", "Full name", { required: true })}
                <Field label="Email address" hint="Your login email – contact support to change it">
                  <input className={`${fieldCls} bg-neutral-50 text-neutral-500`} value={profile.personal.email ?? ""} readOnly />
                </Field>
                {text("phone", "Mobile number", { required: true, inputMode: "tel", maxLength: 10, hint: "10-digit number", placeholder: "9876543210" })}
                {text("altPhone", "Alternate mobile number", { inputMode: "tel", maxLength: 10 })}
                <Field label="Date of birth" required error={errors.dob}>
                  <input className={`${fieldCls} ${errors.dob ? "border-red-300" : ""}`} type="date" max={today} value={v.dob} onChange={(e) => set("dob", e.target.value)} />
                </Field>
                <Field label="Gender" required error={errors.gender}>
                  <Select
                    portal={true}
                    searchable={false}
                    className={cn(
                      "w-full",
                      errors.gender && "[&_.ui-dropdown-trigger]:!border-red-400 [&_.ui-dropdown-trigger]:focus:ring-red-100"
                    )}
                    placeholder="Select gender…"
                    options={GENDERS.map((g) => ({
                      value: g,
                      label: GENDER_LABELS[g],
                    }))}
                    value={v.gender ?? ""}
                    onValueChange={(val) => set("gender", val)}
                  />
                </Field>
              </div>
            </>
          )}

          {step === "address" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field
                  label="Pincode"
                  required
                  error={errors.pincode || (pinLookupError ?? undefined)}
                  hint="6-digit Indian PIN code. City, district and state are automatically detected."
                >
                  <div className="relative">
                    <input
                      className={`${fieldCls} ${errors.pincode || pinLookupError ? "border-red-300" : ""}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="e.g. 636001"
                      value={v.pincode ?? ""}
                      onChange={(e) => handlePincodeChange(e.target.value)}
                      autoComplete="off"
                    />
                    {isPinLoading && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
                      </div>
                    )}
                  </div>
                </Field>
              </div>

              {text("line1", "Address line 1", { required: true, placeholder: "House / Flat No., Building, Street" })}
              {text("line2", "Address line 2", { placeholder: "Landmark, Apartment (optional)" })}

              <Field
                label="Area / Street / Locality"
                error={errors.area}
                hint={postOffices.length > 0 ? `${postOffices.length} postal localities found` : "Locality or nearby post office"}
              >
                {postOffices.length > 0 ? (
                  <Select
                    portal={true}
                    className={cn(
                      "w-full",
                      errors.area && "[&_.ui-dropdown-trigger]:!border-red-400 [&_.ui-dropdown-trigger]:focus:ring-red-100"
                    )}
                    placeholder="Select post office / locality…"
                    options={[
                      ...(v.area && !postOffices.some((po) => po.value.toLowerCase() === v.area.toLowerCase())
                        ? [{ value: v.area, label: v.area }]
                        : []),
                      ...postOffices.map((po) => ({
                        value: po.value,
                        label: `${po.label}${po.description ? ` (${po.description})` : ""}`,
                      })),
                    ]}
                    value={v.area ?? ""}
                    onValueChange={(val) => set("area", val)}
                  />
                ) : (
                  <input
                    className={`${fieldCls} ${errors.area ? "border-red-300" : ""}`}
                    placeholder="Enter area or street"
                    value={v.area ?? ""}
                    onChange={(e) => set("area", e.target.value)}
                  />
                )}
              </Field>

              <Field
                label="City"
                required
                error={errors.city}
                hint="Auto-filled from pincode (change pincode to edit)"
              >
                <input
                  className={`${fieldCls} bg-neutral-100 text-neutral-600 cursor-not-allowed border-neutral-200 select-none shadow-none focus:outline-none`}
                  value={v.city ?? ""}
                  readOnly
                  tabIndex={-1}
                  placeholder={isPinLoading ? "Fetching city..." : "Auto-filled from pincode"}
                />
              </Field>

              <Field
                label="District"
                required
                error={errors.district}
                hint="Auto-filled from pincode (change pincode to edit)"
              >
                <input
                  className={`${fieldCls} bg-neutral-100 text-neutral-600 cursor-not-allowed border-neutral-200 select-none shadow-none focus:outline-none`}
                  value={v.district ?? ""}
                  readOnly
                  tabIndex={-1}
                  placeholder={isPinLoading ? "Fetching district..." : "Auto-filled from pincode"}
                />
              </Field>

              <Field
                label="State"
                required
                error={errors.state}
                hint="Auto-filled from pincode (change pincode to edit)"
              >
                <input
                  className={`${fieldCls} bg-neutral-100 text-neutral-600 cursor-not-allowed border-neutral-200 select-none shadow-none focus:outline-none`}
                  value={v.state ?? ""}
                  readOnly
                  tabIndex={-1}
                  placeholder={isPinLoading ? "Fetching state..." : "Auto-filled from pincode"}
                />
              </Field>

              <Field label="Country" required hint="Default country">
                <input
                  className={`${fieldCls} bg-neutral-100 text-neutral-600 cursor-not-allowed border-neutral-200 select-none shadow-none focus:outline-none`}
                  value={v.country || "India"}
                  readOnly
                  tabIndex={-1}
                />
              </Field>
            </div>
          )}

          {step === "kyc" && (
            <>
              <VerificationNote status={profile.kyc.status} remarks={profile.kyc.remarks} label="KYC" />
              <p className="text-xs text-neutral-500">
                Your numbers are stored encrypted and only ever shown masked. Documents are kept in private storage that only you and the admin team can open.
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label="Aadhaar number"
                  required
                  error={errors.aadhaar}
                  hint={
                    profile.kyc.aadhaarMasked
                      ? "Saved – type a new 12-digit number only to replace it"
                      : "12-digit UIDAI number (e.g. 1234 5678 9012)"
                  }
                >
                  <input
                    className={`${fieldCls} ${errors.aadhaar ? "border-red-300" : ""}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={14}
                    placeholder={profile.kyc.aadhaarMasked ?? "1234 5678 9012"}
                    value={v.aadhaar ?? ""}
                    onChange={(e) => set("aadhaar", formatAadhaar(e.target.value))}
                    autoComplete="off"
                  />
                </Field>

                <Field
                  label="PAN number"
                  required
                  error={errors.pan}
                  hint={
                    profile.kyc.panMasked
                      ? "Saved – type a new number only to replace it"
                      : "10-character PAN (e.g. ABCDE1234F)"
                  }
                >
                  <input
                    className={`${fieldCls} uppercase ${errors.pan ? "border-red-300" : ""}`}
                    type="text"
                    maxLength={10}
                    placeholder={profile.kyc.panMasked ?? "ABCDE1234F"}
                    value={v.pan ?? ""}
                    onChange={(e) => set("pan", formatPan(e.target.value))}
                    autoComplete="off"
                  />
                </Field>

                <DocUpload kind="aadhaar" label="Aadhaar card" uploaded={profile.kyc.hasAadhaarDoc} error={errors.aadhaarDoc} onUploaded={notifyProfileUpdated} />
                <DocUpload kind="pan" label="PAN card" uploaded={profile.kyc.hasPanDoc} error={errors.panDoc} onUploaded={notifyProfileUpdated} />
              </div>
            </>
          )}

          {step === "bank" && (
            <>
              <VerificationNote status={profile.bank.status} remarks={profile.bank.remarks} label="Bank details" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {text("accountHolder", "Account holder name", { required: true })}
                {text("bankName", "Bank name", { required: true })}
                {text("accountNumber", "Account number", {
                  required: true,
                  inputMode: "numeric",
                  maxLength: 18,
                  placeholder: profile.bank.accountMasked ?? "",
                  hint: profile.bank.accountMasked ? "Saved – type a new number only to replace it" : "9–18 digits",
                })}
                {text("confirmAccountNumber", "Confirm account number", { required: Boolean(v.accountNumber) || !profile.bank.hasAccount, inputMode: "numeric", maxLength: 18 })}
                {text("ifsc", "IFSC code", { required: true, upper: true, maxLength: 11, placeholder: "HDFC0001234" })}
                {text("branch", "Branch name", { required: true })}
                <div className="sm:col-span-2">
                  <DocUpload kind="bank" label="Cancelled cheque / bank proof" uploaded={profile.bank.hasProof} error={errors.bankDoc} onUploaded={notifyProfileUpdated} />
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 bg-neutral-50 px-4 py-3 sm:px-5">
          <p className="text-xs text-neutral-500">Save a draft any time and come back later.</p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving !== null}
              onClick={() => save(false)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 text-sm font-medium hover:bg-neutral-50 disabled:opacity-60"
            >
              {saving === "draft" && <Loader2 className="h-4 w-4 animate-spin" />}
              Save draft
            </button>
            <button
              type="button"
              disabled={saving !== null}
              onClick={() => save(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-neutral-900 px-5 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-60"
            >
              {saving === "next" && <Loader2 className="h-4 w-4 animate-spin" />}
              {step === "bank" ? "Save" : "Save & continue"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
