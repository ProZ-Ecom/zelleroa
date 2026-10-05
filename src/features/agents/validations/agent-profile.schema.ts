import { z } from "zod";

/** Indian formats. Kept in one place so the form and the API reject exactly the same things. */
export const mobileRegex = /^[6-9]\d{9}$/;
export const aadhaarRegex = /^[2-9]\d{11}$/;
export const panRegex = /^[A-Z]{5}\d{4}[A-Z]$/;
export const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const accountNumberRegex = /^\d{9,18}$/;
export const pincodeRegex = /^\d{6}$/;

export const GENDERS = ["male", "female", "other", "prefer_not_to_say"] as const;
export const GENDER_LABELS: Record<(typeof GENDERS)[number], string> = {
  male: "Male",
  female: "Female",
  other: "Other",
  prefer_not_to_say: "Prefer not to say",
};

export const PROFILE_SECTIONS = ["personal", "address", "kyc", "bank"] as const;
export type ProfileSection = (typeof PROFILE_SECTIONS)[number];

/** Strips spaces/dashes people type into ID numbers. */
const digitsOnly = (v: string) => v.replace(/[\s-]/g, "");

/** Blank -> undefined, so an empty box means "leave unchanged" and never fails format checks. */
const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const opt = <T extends z.ZodType>(schema: T) => z.preprocess(blankToUndefined, schema.optional());

const text = (label: string, max = 150) =>
  z.string().trim().min(2, `${label} must be at least 2 characters`).max(max, `${label} is too long`);

const mobile = (label: string) =>
  z
    .string()
    .trim()
    .transform((v) => v.replace(/^\+91[\s-]?/, "").replace(/[\s-]/g, ""))
    .refine((v) => mobileRegex.test(v), `${label} must be a valid 10-digit mobile number`);

export const personalSchema = z.object({
  name: opt(text("Full name").regex(/^[A-Za-z .'-]+$/, "Full name can only contain letters and spaces")),
  phone: opt(mobile("Mobile number")),
  altPhone: opt(mobile("Alternate mobile number")),
  dob: opt(
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date of birth")
      .refine((v) => {
        const d = new Date(`${v}T00:00:00Z`);
        if (Number.isNaN(d.getTime())) return false;
        const age = (Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
        return age >= 18 && age <= 100;
      }, "You must be at least 18 years old")
  ),
  gender: opt(z.enum(GENDERS, { message: "Select a gender" })),
});

export const addressSchema = z.object({
  line1: opt(text("Address line 1", 200)),
  line2: opt(z.string().trim().max(200)),
  area: opt(text("Area / street")),
  city: opt(text("City", 100)),
  district: opt(text("District", 100)),
  state: opt(text("State", 100)),
  pincode: opt(z.string().trim().regex(pincodeRegex, "Pincode must be 6 digits")),
  country: opt(text("Country", 100)),
});

export const kycSchema = z.object({
  aadhaar: opt(
    z
      .string()
      .transform(digitsOnly)
      .refine((v) => aadhaarRegex.test(v), "Aadhaar number must be 12 digits")
  ),
  pan: opt(
    z
      .string()
      .trim()
      .toUpperCase()
      .refine((v) => panRegex.test(v), "PAN must look like ABCDE1234F")
  ),
});

export const bankSchema = z
  .object({
    accountHolder: opt(
      text("Account holder name", 100).regex(/^[A-Za-z .'-]+$/, "Name can only contain letters and spaces")
    ),
    bankName: opt(text("Bank name", 100)),
    accountNumber: opt(
      z
        .string()
        .transform(digitsOnly)
        .refine((v) => accountNumberRegex.test(v), "Account number must be 9-18 digits")
    ),
    confirmAccountNumber: opt(z.string().transform(digitsOnly)),
    ifsc: opt(
      z
        .string()
        .trim()
        .toUpperCase()
        .refine((v) => ifscRegex.test(v), "IFSC must look like HDFC0001234")
    ),
    branch: opt(text("Branch name", 150)),
  })
  .superRefine((v, ctx) => {
    if (v.accountNumber && v.accountNumber !== v.confirmAccountNumber) {
      ctx.addIssue({ code: "custom", path: ["confirmAccountNumber"], message: "Account numbers do not match" });
    }
  });

export const sectionSchemas = {
  personal: personalSchema,
  address: addressSchema,
  kyc: kycSchema,
  bank: bankSchema,
} as const;

export const saveSectionSchema = z.object({
  section: z.enum(PROFILE_SECTIONS),
  /** true = "Save & continue": every required field of the section must be present. */
  strict: z.boolean().optional(),
  data: z.record(z.string(), z.unknown()),
});
export type SaveSectionInput = z.infer<typeof saveSectionSchema>;

export const reviewSchema = z
  .object({
    target: z.enum(["kyc", "bank"]),
    action: z.enum(["verify", "reject"]),
    remarks: z.string().trim().max(255).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.action === "reject" && !v.remarks) {
      ctx.addIssue({ code: "custom", path: ["remarks"], message: "Give a reason so the Sales Partner knows what to fix" });
    }
  });
export type ReviewInput = z.infer<typeof reviewSchema>;

export const DOC_KINDS = ["aadhaar", "pan", "bank"] as const;
export type DocKind = (typeof DOC_KINDS)[number];
