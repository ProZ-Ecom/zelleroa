import { db } from "@/lib/db/prisma";
import type { Prisma } from "@/generated/prisma";
import type { CustomerProfileResponse } from "../types";

export function formatCustomerProfile(
  profile: {
    id: bigint;
    uuid: string | null;
    user_id: bigint;
    name: string | null;
    email: string | null;
    phone: string | null;
    is_whatsapp: boolean | null;
    whatsapp_no: string | null;
    dob: Date | null;
    gender: "male" | "female" | "other" | "not_applicable" | null;
    profile_image: string | null;
    referral_code: string | null;
    created_at: Date;
    updated_at: Date;
    users_customer_profiles_user_idTousers?: { uuid: string | null } | null;
  }
): CustomerProfileResponse {
  const profileUuid = profile.uuid || String(profile.id);
  const userUuid =
    profile.users_customer_profiles_user_idTousers?.uuid ||
    String(profile.user_id);

  let formattedDob: string | null = null;
  if (profile.dob) {
    formattedDob = profile.dob.toISOString().split("T")[0];
  }

  return {
    id: profileUuid,
    userId: userUuid,
    name: profile.name ?? null,
    email: profile.email ?? null,
    phone: profile.phone ?? null,
    isWhatsapp: Boolean(profile.is_whatsapp),
    whatsappNo: profile.whatsapp_no ?? null,
    dob: formattedDob,
    gender: profile.gender ?? null,
    profileImage: profile.profile_image ?? null,
    referralCode: profile.referral_code ?? null,
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
  };
}

export const customerProfileRepository = {
  async findByUserId(userId: bigint | number) {
    const profile = await db.customer_profiles.findFirst({
      where: {
        user_id: BigInt(userId),
        is_active: true,
      },
      include: {
        users_customer_profiles_user_idTousers: {
          select: {
            uuid: true,
          },
        },
      },
    });

    return profile;
  },

  async findByUuid(uuid: string) {
    const profile = await db.customer_profiles.findFirst({
      where: {
        uuid,
        is_active: true,
      },
      include: {
        users_customer_profiles_user_idTousers: {
          select: {
            uuid: true,
          },
        },
      },
    });

    return profile;
  },

  async create(data: Prisma.customer_profilesUncheckedCreateInput) {
    const created = await db.customer_profiles.create({
      data,
      include: {
        users_customer_profiles_user_idTousers: {
          select: {
            uuid: true,
          },
        },
      },
    });

    return created;
  },

  async updateByUserId(
    userId: bigint | number,
    data: Prisma.customer_profilesUncheckedUpdateInput
  ) {
    const existing = await this.findByUserId(userId);
    if (!existing) return null;

    const updated = await db.customer_profiles.update({
      where: { id: existing.id },
      data,
      include: {
        users_customer_profiles_user_idTousers: {
          select: {
            uuid: true,
          },
        },
      },
    });

    return updated;
  },
};
