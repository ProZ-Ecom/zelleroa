import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import type { Prisma } from "@/generated/prisma";
import { db } from "@/lib/db/prisma";
import { ApiError } from "@/lib/api/api-error";
import { encryptField } from "@/lib/security/field-crypto";
import { uploadService } from "@/features/uploads/services/upload.service";
import { writeAudit } from "./commission-audit";
import { resolveAgentRef } from "./commission.queries";
import type { AuditActor } from "../constants";
import { calculateCompletion, type CompletionInput } from "../lib/profile-completion";
import {
  sectionSchemas,
  type DocKind,
  type ProfileSection,
  type ReviewInput,
} from "../validations/agent-profile.schema";

const DOC_MAX_BYTES = 5 * 1024 * 1024;

/** Magic-byte sniffing: the client-declared MIME type is never trusted for KYC documents. */
function sniffDocument(buf: Buffer): { ext: string; contentType: string } | null {
  if (buf.length > 4 && buf.subarray(0, 4).toString("latin1") === "%PDF") return { ext: ".pdf", contentType: "application/pdf" };
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: ".jpg", contentType: "image/jpeg" };
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { ext: ".png", contentType: "image/png" };
  }
  if (buf.length > 12 && buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") {
    return { ext: ".webp", contentType: "image/webp" };
  }
  return null;
}

const CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

/** KYC documents live outside `public/` and `/document`, so they are only reachable through the authenticated routes. */
function privateRoot() {
  return process.env.PRIVATE_UPLOAD_DIR ? path.resolve(process.env.PRIVATE_UPLOAD_DIR) : path.join(process.cwd(), "private-uploads");
}

const DOC_COLUMN = { aadhaar: "aadhaar_doc", pan: "pan_doc", bank: "bank_proof_doc" } as const;
const DOC_TARGET = { aadhaar: "kyc", pan: "kyc", bank: "bank" } as const;


const isoDate = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const withCountryCode = (v: string) => `+91${v}`;

const profileSelect = {
  id: true,
  uuid: true,
  name: true,
  email: true,
  phone: true,
  avatar: true,
  agent_profile: true,
} satisfies Prisma.UserSelect;
type ProfileUser = Prisma.UserGetPayload<{ select: typeof profileSelect }>;

function completionInput(u: ProfileUser): CompletionInput {
  const p = u.agent_profile;
  return {
    name: u.name,
    dob: isoDate(p?.dob),
    gender: p?.gender,
    hasPhoto: Boolean(u.avatar),
    phone: u.phone,
    email: u.email,
    addr: {
      line1: p?.addr_line1,
      city: p?.addr_city,
      district: p?.addr_district,
      state: p?.addr_state,
      pincode: p?.addr_pincode,
      country: p?.addr_country,
    },
    hasAadhaar: Boolean(p?.aadhaar_enc),
    hasAadhaarDoc: Boolean(p?.aadhaar_doc),
    hasPan: Boolean(p?.pan_enc),
    hasPanDoc: Boolean(p?.pan_doc),
    bank: {
      holder: p?.bank_account_holder,
      bankName: p?.bank_name,
      hasAccount: Boolean(p?.bank_account_number_enc),
      ifsc: p?.bank_ifsc,
      branch: p?.bank_branch,
      hasProof: Boolean(p?.bank_proof_doc),
    },
  };
}

/**
 * The profile as the UI sees it. Aadhaar, PAN and the account number are never returned in full -
 * only a masked form - and document files are referenced by presence flag, not by path.
 */
export function formatProfile(u: ProfileUser) {
  const p = u.agent_profile;
  return {
    id: u.uuid ?? String(u.id),
    agentCode: p?.agent_code ?? null,
    personal: {
      name: u.name,
      phone: u.phone,
      altPhone: p?.alt_phone ?? null,
      email: u.email,
      dob: isoDate(p?.dob),
      gender: p?.gender ?? null,
      photo: u.avatar,
    },
    address: {
      line1: p?.addr_line1 ?? null,
      line2: p?.addr_line2 ?? null,
      area: p?.addr_area ?? null,
      city: p?.addr_city ?? null,
      district: p?.addr_district ?? null,
      state: p?.addr_state ?? null,
      pincode: p?.addr_pincode ?? null,
      country: p?.addr_country ?? "India",
    },
    kyc: {
      aadhaarMasked: p?.aadhaar_last4 ? `XXXX XXXX ${p.aadhaar_last4}` : null,
      panMasked: p?.pan_last4 ? `••••••${p.pan_last4}` : null,
      hasAadhaarDoc: Boolean(p?.aadhaar_doc),
      hasPanDoc: Boolean(p?.pan_doc),
      status: p?.kyc_status ?? "not_submitted",
      remarks: p?.kyc_remarks ?? null,
      reviewedAt: p?.kyc_reviewed_at?.toISOString() ?? null,
    },
    bank: {
      accountHolder: p?.bank_account_holder ?? null,
      bankName: p?.bank_name ?? null,
      accountMasked: p?.bank_account_last4 ? `••••••${p.bank_account_last4}` : null,
      hasAccount: Boolean(p?.bank_account_number_enc),
      ifsc: p?.bank_ifsc ?? null,
      branch: p?.bank_branch ?? null,
      hasProof: Boolean(p?.bank_proof_doc),
      status: p?.bank_status ?? "not_submitted",
      remarks: p?.bank_remarks ?? null,
      reviewedAt: p?.bank_reviewed_at?.toISOString() ?? null,
    },
    completion: calculateCompletion(completionInput(u)),
  };
}
export type AgentProfileDto = ReturnType<typeof formatProfile>;

function isUniqueViolation(err: unknown) {
  return (err as { code?: string })?.code === "P2002";
}

async function load(agentId: bigint) {
  const user = await db.user.findUnique({ where: { id: agentId }, select: profileSelect });
  if (!user) throw ApiError.notFound("Sales Partner not found");
  return user;
}

/** Strict ("Save & continue") mode: every required field of the step must be filled. The photo is optional here. */
function assertStepComplete(u: ProfileUser, section: ProfileSection) {
  const step = section;
  const missing = calculateCompletion(completionInput(u))
    .incomplete.filter((s) => s.step === step)
    .flatMap((s) => s.missing)
    .filter((m) => m !== "Profile photo");
  if (missing.length) {
    throw ApiError.validation(missing.map((m) => `${m} is required`), "Please fill in the required fields");
  }
}

export const agentProfileService = {
  async get(agentId: bigint) {
    return formatProfile(await load(agentId));
  },

  async getByRef(agentRef: string) {
    const agentId = await resolveAgentRef(agentRef);
    if (!agentId) throw ApiError.notFound("Sales Partner not found");
    return formatProfile(await load(agentId));
  },

  /**
   * Saves one step. Blank fields are left unchanged, so a Sales Partner can save a partly filled
   * step and come back later. `strict` (Save & continue) additionally requires the whole step.
   */
  async saveSection(agentId: bigint, section: ProfileSection, raw: Record<string, unknown>, strict: boolean) {
    const schema = sectionSchemas[section];
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      throw ApiError.validation(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
    }
    const input = parsed.data as Record<string, string | undefined>;

    const current = await load(agentId);
    const prev = current.agent_profile;
    const profileData: Prisma.agent_profilesUpdateInput = { updated_by: agentId };
    const userData: Prisma.UserUpdateInput = {};
    let kycChanged = false;
    let bankChanged = false;

    if (section === "personal") {
      if (input.name) userData.name = input.name;
      if (input.phone) userData.phone = withCountryCode(input.phone);
      if (input.altPhone) profileData.alt_phone = withCountryCode(input.altPhone);
      if (input.dob) profileData.dob = new Date(`${input.dob}T00:00:00Z`);
      if (input.gender) profileData.gender = input.gender;
    } else if (section === "address") {
      if (input.line1) profileData.addr_line1 = input.line1;
      if (typeof raw.line2 === "string") profileData.addr_line2 = input.line2 ?? null;
      if (input.area) profileData.addr_area = input.area;
      if (input.city) profileData.addr_city = input.city;
      if (input.district) profileData.addr_district = input.district;
      if (input.state) profileData.addr_state = input.state;
      if (input.pincode) profileData.addr_pincode = input.pincode;
      if (input.country) profileData.addr_country = input.country;
    } else if (section === "kyc") {
      if (input.aadhaar) {
        profileData.aadhaar_enc = encryptField(input.aadhaar);
        profileData.aadhaar_last4 = input.aadhaar.slice(-4);
        kycChanged = true;
      }
      if (input.pan) {
        profileData.pan_enc = encryptField(input.pan);
        profileData.pan_last4 = input.pan.slice(-4);
        kycChanged = true;
      }
    } else {
      if (input.accountHolder) profileData.bank_account_holder = input.accountHolder;
      if (input.bankName) profileData.bank_name = input.bankName;
      if (input.ifsc) profileData.bank_ifsc = input.ifsc;
      if (input.branch) profileData.bank_branch = input.branch;
      if (input.accountNumber) {
        profileData.bank_account_number_enc = encryptField(input.accountNumber);
        profileData.bank_account_last4 = input.accountNumber.slice(-4);
      }
      bankChanged = Boolean(input.accountHolder || input.bankName || input.ifsc || input.branch || input.accountNumber);
      // Payout requests read the saved method; a bank section with no method yet means bank transfer.
      if (bankChanged && !prev?.preferred_payout_method) profileData.preferred_payout_method = "bank_transfer";
    }

    try {
      await db.$transaction(async (tx) => {
        if (Object.keys(userData).length) await tx.user.update({ where: { id: agentId }, data: userData });
        await tx.agent_profiles.update({ where: { user_id: agentId }, data: profileData });
        await this.refreshVerification(tx, agentId, { kycChanged, bankChanged });
        await writeAudit(tx, {
          entityType: "agent",
          entityId: agentId,
          agentId,
          action: `profile_${section}_saved`,
          actor: { id: agentId, role: "AGENT" },
          // Field names only - never the values.
          metadata: { fields: Object.keys(input).filter((k) => input[k] !== undefined && !k.toLowerCase().includes("account") && k !== "aadhaar" && k !== "pan") },
        });
      });
    } catch (err) {
      if (isUniqueViolation(err)) throw ApiError.conflict("This mobile number is already used by another account");
      throw err;
    }

    const fresh = await load(agentId);
    if (strict) assertStepComplete(fresh, section);
    return formatProfile(fresh);
  },

  /**
   * Keeps the review status honest after an edit. A complete, changed section goes (back) to
   * "pending" for the admin; anything verified that changed loses its verified badge.
   */
  async refreshVerification(
    tx: Prisma.TransactionClient,
    agentId: bigint,
    changed: { kycChanged?: boolean; bankChanged?: boolean }
  ) {
    const user = await tx.user.findUnique({ where: { id: agentId }, select: profileSelect });
    const p = user?.agent_profile;
    if (!user || !p) return;
    const c = calculateCompletion(completionInput(user));
    const kycComplete = c.sections.find((s) => s.key === "kyc")!.complete;
    const bankComplete = c.sections.find((s) => s.key === "bank")!.complete;
    const data: Prisma.agent_profilesUpdateInput = {};

    if (changed.kycChanged) {
      data.kyc_status = kycComplete ? "pending" : "not_submitted";
      data.kyc_remarks = null;
    } else if (kycComplete && p.kyc_status === "not_submitted") {
      data.kyc_status = "pending";
    }
    if (changed.bankChanged) {
      data.bank_status = bankComplete ? "pending" : "not_submitted";
      data.bank_remarks = null;
    } else if (bankComplete && p.bank_status === "not_submitted") {
      data.bank_status = "pending";
    }
    if (Object.keys(data).length) await tx.agent_profiles.update({ where: { user_id: agentId }, data });
  },

  async saveDocument(agentId: bigint, kind: DocKind, file: File) {
    if (!(file instanceof File) || file.size === 0) throw ApiError.badRequest("No file provided");
    if (file.size > DOC_MAX_BYTES) throw ApiError.badRequest("File is larger than 5 MB");
    const buffer = Buffer.from(await file.arrayBuffer());
    const kind_ = sniffDocument(buffer);
    if (!kind_) throw ApiError.badRequest("Upload a JPG, PNG, WebP or PDF file");

    const column = DOC_COLUMN[kind];
    const user = await load(agentId);
    const previous = user.agent_profile?.[column] ?? null;

    const dir = path.join(privateRoot(), "agent-kyc", String(agentId));
    await fs.mkdir(dir, { recursive: true });
    const filename = `${kind}-${crypto.randomUUID()}${kind_.ext}`;
    await fs.writeFile(path.join(dir, filename), buffer);

    try {
      await db.$transaction(async (tx) => {
        await tx.agent_profiles.update({ where: { user_id: agentId }, data: { [column]: filename, updated_by: agentId } });
        await this.refreshVerification(tx, agentId, {
          kycChanged: DOC_TARGET[kind] === "kyc",
          bankChanged: DOC_TARGET[kind] === "bank",
        });
        await writeAudit(tx, {
          entityType: "agent",
          entityId: agentId,
          agentId,
          action: `${kind}_document_uploaded`,
          actor: { id: agentId, role: "AGENT" },
        });
      });
    } catch (err) {
      await fs.rm(path.join(dir, filename), { force: true });
      throw err;
    }
    if (previous) await fs.rm(path.join(dir, path.basename(previous)), { force: true });
    return formatProfile(await load(agentId));
  },

  /** Reads a stored document. Callers authorise first: the owner by session, admins by role. */
  async readDocument(agentId: bigint, kind: DocKind) {
    const user = await load(agentId);
    const stored = user.agent_profile?.[DOC_COLUMN[kind]];
    if (!stored) throw ApiError.notFound("No document uploaded");
    const filename = path.basename(stored);
    try {
      const buffer = await fs.readFile(path.join(privateRoot(), "agent-kyc", String(agentId), filename));
      return { buffer, contentType: CONTENT_TYPES[path.extname(filename)] ?? "application/octet-stream", filename };
    } catch {
      throw ApiError.notFound("Document file is missing. Ask the Sales Partner to upload it again.");
    }
  },

  async readDocumentByRef(agentRef: string, kind: DocKind) {
    const agentId = await resolveAgentRef(agentRef);
    if (!agentId) throw ApiError.notFound("Sales Partner not found");
    return this.readDocument(agentId, kind);
  },

  /** Profile photo: public avatar image, same storage and rules as customer photos. */
  async savePhoto(agentId: bigint, formData: FormData) {
    const user = await load(agentId);
    const old = user.avatar;
    formData.set("folder", "customers");
    const { path: newPath } = await uploadService.handleSingleFileUpload(formData);
    try {
      await db.user.update({ where: { id: agentId }, data: { avatar: newPath } });
    } catch (err) {
      await uploadService.deleteUploadedFile(newPath, "customers");
      throw err;
    }
    if (old && old !== newPath) await uploadService.deleteUploadedFile(old, "customers").catch(() => undefined);
    return formatProfile(await load(agentId));
  },

  /** Admin: approve or reject the KYC or the bank details. Only a complete section can be verified. */
  async review(agentRef: string, input: ReviewInput, actor: AuditActor) {
    const agentId = await resolveAgentRef(agentRef);
    if (!agentId) throw ApiError.notFound("Sales Partner not found");
    const user = await load(agentId);
    const p = user.agent_profile;
    if (!p) throw ApiError.notFound("Sales Partner profile not found");

    const section = calculateCompletion(completionInput(user)).sections.find((s) => s.key === input.target)!;
    if (input.action === "verify" && !section.complete) {
      throw ApiError.badRequest(`Cannot verify yet - still missing: ${section.missing.join(", ")}`);
    }
    const fromStatus = input.target === "kyc" ? p.kyc_status : p.bank_status;
    const toStatus = input.action === "verify" ? "verified" : "rejected";
    const remarks = input.remarks?.trim() || null;
    const data: Prisma.agent_profilesUpdateInput =
      input.target === "kyc"
        ? { kyc_status: toStatus, kyc_remarks: remarks, kyc_reviewed_at: new Date(), kyc_reviewed_by: actor.id }
        : { bank_status: toStatus, bank_remarks: remarks, bank_reviewed_at: new Date(), bank_reviewed_by: actor.id };

    await db.$transaction(async (tx) => {
      await tx.agent_profiles.update({ where: { user_id: agentId }, data });
      await writeAudit(tx, {
        entityType: "agent",
        entityId: agentId,
        agentId,
        action: `${input.target}_${toStatus}`,
        fromStatus,
        toStatus,
        actor,
        note: remarks,
      });
    });
    return formatProfile(await load(agentId));
  },
};
