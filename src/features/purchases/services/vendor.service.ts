import crypto from "crypto";
import { db } from "@/lib/db/prisma";
import { ApiError } from "@/lib/api/api-error";
import { retireUniqueValue } from "@/lib/utils/retire-unique-value";
import { userRepository } from "@/features/users/repositories/user.repository";
import type { Prisma } from "@/generated/prisma";
import type { GetVendorsParams, VendorResponse } from "../types";
import type { VendorInput } from "../validations/purchase.schema";

export async function getAdminInternalId(email?: string | null): Promise<bigint | null> {
  if (!email) return null;
  const user = await userRepository.findByEmail(email);
  if (!user) return null;
  return BigInt(user.internalId || user.id);
}

function format(v: {
  uuid: string;
  code: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: Date;
}): VendorResponse {
  return {
    id: v.uuid,
    code: v.code,
    name: v.name,
    contactPerson: v.contact_person,
    phone: v.phone,
    email: v.email,
    gstin: v.gstin,
    address: v.address,
    notes: v.notes,
    isActive: v.is_active,
    createdAt: v.created_at.toISOString(),
  };
}

async function findLiveByUuid(uuid: string) {
  const vendor = await db.vendors.findFirst({ where: { uuid, deleted_at: null } });
  if (!vendor) throw ApiError.notFound("Vendor not found");
  return vendor;
}

async function assertNameFree(name: string, excludeId?: bigint) {
  const dup = await db.vendors.findFirst({
    where: { name, deleted_at: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
  });
  if (dup) throw ApiError.conflict(`A vendor named '${name}' already exists`);
}

export const vendorService = {
  async list(params: GetVendorsParams) {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 10;
    const where: Prisma.vendorsWhereInput = {
      deleted_at: null,
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search } },
              { code: { contains: params.search } },
              { phone: { contains: params.search } },
              { contact_person: { contains: params.search } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      db.vendors.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.vendors.count({ where }),
    ]);
    return {
      data: rows.map(format),
      meta: { page, limit: pageSize, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  },

  async get(uuid: string) {
    const vendor = await findLiveByUuid(uuid);
    // Cancelled and rejected orders never brought goods in, so they don't count as purchases.
    const agg = await db.purchase_orders.aggregate({
      where: { vendor_id: vendor.id, status: { notIn: ["CANCELLED", "REJECTED"] } },
      _count: { _all: true },
      _sum: { total_amount: true },
      _max: { purchase_date: true, created_at: true },
    });
    const last = agg._max.purchase_date ?? agg._max.created_at;
    return {
      ...format(vendor),
      stats: {
        totalPurchases: agg._count._all,
        totalPurchaseAmount: Number(agg._sum.total_amount ?? 0),
        lastPurchaseDate: last ? last.toISOString() : null,
      },
    };
  },

  async create(input: VendorInput, adminEmail?: string | null) {
    await assertNameFree(input.name);
    const adminId = await getAdminInternalId(adminEmail);
    const uuid = crypto.randomUUID();
    const vendor = await db.$transaction(async (tx) => {
      const created = await tx.vendors.create({
        data: {
          uuid,
          code: `TMP-${uuid.slice(0, 8)}`,
          name: input.name,
          contact_person: input.contactPerson,
          phone: input.phone,
          email: input.email,
          gstin: input.gstin,
          address: input.address,
          notes: input.notes,
          is_active: input.isActive ?? true,
          created_by: adminId,
          updated_by: adminId,
        },
      });
      return tx.vendors.update({
        where: { id: created.id },
        data: { code: `VEN-${String(created.id).padStart(4, "0")}` },
      });
    });
    return format(vendor);
  },

  async update(uuid: string, input: Partial<VendorInput>, adminEmail?: string | null) {
    const existing = await findLiveByUuid(uuid);
    if (input.name && input.name !== existing.name) {
      await assertNameFree(input.name, existing.id);
    }
    const adminId = await getAdminInternalId(adminEmail);
    const updated = await db.vendors.update({
      where: { id: existing.id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.contactPerson !== undefined && { contact_person: input.contactPerson }),
        ...(input.phone !== undefined && { phone: input.phone }),
        ...(input.email !== undefined && { email: input.email }),
        ...(input.gstin !== undefined && { gstin: input.gstin }),
        ...(input.address !== undefined && { address: input.address }),
        ...(input.notes !== undefined && { notes: input.notes }),
        ...(input.isActive !== undefined && { is_active: input.isActive }),
        updated_by: adminId,
      },
    });
    return format(updated);
  },

  async remove(uuid: string, adminEmail?: string | null) {
    const existing = await findLiveByUuid(uuid);
    const open = await db.purchase_orders.count({
      where: {
        vendor_id: existing.id,
        status: { in: ["PENDING_APPROVAL", "APPROVED", "ORDERED", "PARTIALLY_RECEIVED"] },
      },
    });
    if (open > 0) {
      throw ApiError.badRequest("Vendor has open purchase orders. Complete or cancel them first.");
    }
    const adminId = await getAdminInternalId(adminEmail);
    await db.vendors.update({
      where: { id: existing.id },
      data: {
        deleted_at: new Date(),
        is_active: false,
        code: retireUniqueValue(existing.code, existing.id, 30),
        updated_by: adminId,
      },
    });
    return { message: "Vendor deleted successfully" };
  },
};
