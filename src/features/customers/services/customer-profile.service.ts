import crypto from "crypto";
import { ApiError } from "@/lib/api/api-error";
import { userRepository } from "@/features/users/repositories/user.repository";
import {
  customerProfileRepository,
  formatCustomerProfile,
} from "../repositories/customer-profile.repository";
import { uploadService } from "@/features/uploads/services/upload.service";
import type { CustomerProfileResponse } from "../types";
import type { UpdateCustomerProfileInput } from "../validations/customer-profile.schema";

function generateReferralCode(uuidOrId?: string): string {
  const rand = crypto.randomUUID().replace(/-/g, "").toUpperCase().slice(0, 6);
  const prefix = uuidOrId ? uuidOrId.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 4) : "ZELL";
  return `REF${prefix}${rand}`.slice(0, 15);
}

async function resolveActiveUser(sessionUserId: string) {
  const user = await userRepository.findById(sessionUserId);
  if (!user || !user.internalId) {
    throw ApiError.notFound("User account not found");
  }
  if (!user.isActive || user.is_active === false) {
    throw ApiError.accountBlocked("Your account is inactive or blocked. Please contact support.");
  }
  return user;
}

export const customerProfileService = {
  async getCustomerProfile(sessionUserId: string): Promise<CustomerProfileResponse> {
    const user = await resolveActiveUser(sessionUserId);

    let profile = await customerProfileRepository.findByUserId(user.internalId);

    // Auto-initialize profile if it doesn't exist yet for existing user
    if (!profile) {
      const referralCode = generateReferralCode(user.uuid || String(user.internalId));
      profile = await customerProfileRepository.create({
        uuid: crypto.randomUUID(),
        user_id: BigInt(user.internalId),
        name: user.name,
        email: user.email,
        phone: user.phone,
        is_whatsapp: false,
        whatsapp_no: null,
        referral_code: referralCode,
        is_active: true,
        status: true,
      });
    }

    return formatCustomerProfile(profile);
  },

  async updateCustomerProfile(
    sessionUserId: string,
    data: UpdateCustomerProfileInput
  ): Promise<CustomerProfileResponse> {
    const user = await resolveActiveUser(sessionUserId);

    let existingProfile = await customerProfileRepository.findByUserId(user.internalId);

    if (!existingProfile) {
      const referralCode = generateReferralCode(user.uuid || String(user.internalId));
      existingProfile = await customerProfileRepository.create({
        uuid: crypto.randomUUID(),
        user_id: BigInt(user.internalId),
        name: user.name,
        email: user.email,
        phone: user.phone,
        is_whatsapp: false,
        whatsapp_no: null,
        referral_code: referralCode,
        is_active: true,
        status: true,
      });
    }

    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) {
      updateData.name = data.name;
      // Sync user name if updated
      await userRepository.update(user.internalId, { name: data.name });
    }

    if (data.dob !== undefined) {
      updateData.dob = data.dob ? new Date(data.dob) : null;
    }

    if (data.gender !== undefined) {
      updateData.gender = data.gender;
    }

    // WhatsApp logic
    if (data.isWhatsapp === true) {
      updateData.is_whatsapp = true;
      updateData.whatsapp_no = data.whatsappNo || null;
    } else if (data.isWhatsapp === false) {
      updateData.is_whatsapp = false;
      updateData.whatsapp_no = null; // Clear whatsappNo when isWhatsapp is false
    } else if (data.whatsappNo !== undefined) {
      if (existingProfile.is_whatsapp) {
        updateData.whatsapp_no = data.whatsappNo || null;
      } else {
        updateData.whatsapp_no = null;
      }
    }

    const updated = await customerProfileRepository.updateByUserId(
      user.internalId,
      updateData
    );

    if (!updated) {
      throw ApiError.notFound("Customer profile not found");
    }

    return formatCustomerProfile(updated);
  },

  async updateCustomerProfileImage(
    sessionUserId: string,
    formData: FormData
  ): Promise<{ profileImage: string }> {
    const user = await resolveActiveUser(sessionUserId);

    let profile = await customerProfileRepository.findByUserId(user.internalId);
    if (!profile) {
      const referralCode = generateReferralCode(user.uuid || String(user.internalId));
      profile = await customerProfileRepository.create({
        uuid: crypto.randomUUID(),
        user_id: BigInt(user.internalId),
        name: user.name,
        email: user.email,
        phone: user.phone,
        is_whatsapp: false,
        whatsapp_no: null,
        referral_code: referralCode,
        is_active: true,
        status: true,
      });
    }

    const oldImagePath = profile.profile_image;

    // Ensure folder is set to "customers"
    formData.set("folder", "customers");

    // 1. Upload new image first
    const uploadResult = await uploadService.handleSingleFileUpload(formData);
    const newImagePath = uploadResult.path;

    // 2. Try DB update
    try {
      await customerProfileRepository.updateByUserId(user.internalId, {
        profile_image: newImagePath,
      });
      await userRepository.update(user.internalId, { avatar: newImagePath });
    } catch (dbError) {
      // If DB update fails, clean up newly uploaded file & leave old image unchanged
      await uploadService.deleteUploadedFile(newImagePath, "customers");
      throw dbError;
    }

    // 3. Only after DB update succeeds, delete old image file if replacing
    if (oldImagePath && oldImagePath !== newImagePath) {
      await uploadService.deleteUploadedFile(oldImagePath, "customers");
    }

    return {
      profileImage: newImagePath,
    };
  },

  async removeCustomerProfileImage(
    sessionUserId: string
  ): Promise<{ profileImage: null }> {
    const user = await resolveActiveUser(sessionUserId);

    const profile = await customerProfileRepository.findByUserId(user.internalId);
    if (!profile || !profile.profile_image) {
      return { profileImage: null };
    }

    const oldImagePath = profile.profile_image;

    // 1. Update DB first
    await customerProfileRepository.updateByUserId(user.internalId, {
      profile_image: null,
    });
    await userRepository.update(user.internalId, { avatar: null });

    // 2. After DB update succeeds, delete physical file from disk
    await uploadService.deleteUploadedFile(oldImagePath, "customers");

    return {
      profileImage: null,
    };
  },
};
