/**
 * Profile completion = weighted share of required fields that are filled.
 * Each section contributes `weight` points x (filled required fields / required fields).
 * Pure and dependency-free so the Sales Partner page, the API and the admin view agree.
 */

export interface CompletionInput {
  name?: string | null;
  dob?: string | null;
  gender?: string | null;
  hasPhoto: boolean;
  phone?: string | null;
  email?: string | null;
  addr: {
    line1?: string | null;
    city?: string | null;
    district?: string | null;
    state?: string | null;
    pincode?: string | null;
    country?: string | null;
  };
  hasAadhaar: boolean;
  hasAadhaarDoc: boolean;
  hasPan: boolean;
  hasPanDoc: boolean;
  bank: {
    holder?: string | null;
    bankName?: string | null;
    hasAccount: boolean;
    ifsc?: string | null;
    branch?: string | null;
    hasProof: boolean;
  };
}

export type SectionKey = "basic" | "contact" | "address" | "kyc" | "bank";
export type StepKey = "personal" | "address" | "kyc" | "bank";

export interface CompletionSection {
  key: SectionKey;
  label: string;
  weight: number;
  filled: number;
  total: number;
  /** Points earned out of `weight`. */
  points: number;
  complete: boolean;
  missing: string[];
  /** Which profile step to open to finish it. */
  step: StepKey;
}

export interface Completion {
  percent: number;
  sections: CompletionSection[];
  incomplete: CompletionSection[];
}

const has = (v: string | null | undefined) => Boolean(v && v.trim());

export function calculateCompletion(p: CompletionInput): Completion {
  const defs: Array<[SectionKey, string, number, StepKey, Array<[string, boolean]>]> = [
    [
      "basic",
      "Basic details",
      20,
      "personal",
      [
        ["Full name", has(p.name)],
        ["Date of birth", has(p.dob)],
        ["Gender", has(p.gender)],
        ["Profile photo", p.hasPhoto],
      ],
    ],
    [
      "contact",
      "Contact details",
      15,
      "personal",
      [
        ["Mobile number", has(p.phone)],
        ["Email address", has(p.email)],
      ],
    ],
    [
      "address",
      "Address",
      20,
      "address",
      [
        ["Address line 1", has(p.addr.line1)],
        ["City", has(p.addr.city)],
        ["District", has(p.addr.district)],
        ["State", has(p.addr.state)],
        ["Pincode", has(p.addr.pincode)],
        ["Country", has(p.addr.country)],
      ],
    ],
    [
      "kyc",
      "KYC",
      20,
      "kyc",
      [
        ["Aadhaar number", p.hasAadhaar],
        ["Aadhaar card", p.hasAadhaarDoc],
        ["PAN number", p.hasPan],
        ["PAN card", p.hasPanDoc],
      ],
    ],
    [
      "bank",
      "Bank details",
      25,
      "bank",
      [
        ["Account holder name", has(p.bank.holder)],
        ["Bank name", has(p.bank.bankName)],
        ["Account number", p.bank.hasAccount],
        ["IFSC code", has(p.bank.ifsc)],
        ["Branch name", has(p.bank.branch)],
        ["Bank proof", p.bank.hasProof],
      ],
    ],
  ];

  const sections: CompletionSection[] = defs.map(([key, label, weight, step, fields]) => {
    const filled = fields.filter(([, ok]) => ok).length;
    return {
      key,
      label,
      weight,
      filled,
      total: fields.length,
      points: (weight * filled) / fields.length,
      complete: filled === fields.length,
      missing: fields.filter(([, ok]) => !ok).map(([name]) => name),
      step,
    };
  });

  return {
    percent: Math.round(sections.reduce((sum, s) => sum + s.points, 0)),
    sections,
    incomplete: sections.filter((s) => !s.complete),
  };
}
