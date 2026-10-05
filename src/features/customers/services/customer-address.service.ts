import crypto from "crypto";
import { db } from "@/lib/db/prisma";
import { ApiError } from "@/lib/api/api-error";
import { userRepository } from "@/features/users/repositories/user.repository";
import { customerProfileRepository } from "../repositories/customer-profile.repository";
import {
  customerAddressRepository,
  formatCustomerAddress,
} from "../repositories/customer-address.repository";
import type {
  CustomerAddressResponse,
  CustomerAddressListParams,
  CustomerAddressListResult,
  AddressType,
} from "../types/customer-address.types";
import type {
  CreateCustomerAddressInput,
  UpdateCustomerAddressInput,
} from "../validations/customer-address.schema";

async function resolveActiveUser(sessionUserId: string) {
  const user = await userRepository.findById(sessionUserId);
  if (!user || !user.internalId) {
    throw ApiError.unauthorized("User account not found");
  }
  if (!user.isActive || user.is_active === false) {
    throw ApiError.accountBlocked("Your account is inactive or blocked. Please contact support.");
  }
  return user;
}

export const customerAddressService = {
  async getAddresses(
    sessionUserId: string,
    params: CustomerAddressListParams = {}
  ): Promise<CustomerAddressResponse[]> {
    const user = await resolveActiveUser(sessionUserId);

    const addresses = await customerAddressRepository.findActiveByUserId(
      user.internalId,
      params
    );
    return addresses.map((addr) => formatCustomerAddress(addr));
  },

  async getAddressesList(
    sessionUserId: string,
    params: CustomerAddressListParams = {}
  ): Promise<CustomerAddressListResult> {
    const user = await resolveActiveUser(sessionUserId);

    return customerAddressRepository.findListWithPagination(
      user.internalId,
      params
    );
  },

  async getAddressByUuid(
    sessionUserId: string,
    uuid: string
  ): Promise<CustomerAddressResponse> {
    const user = await resolveActiveUser(sessionUserId);

    const address = await customerAddressRepository.findByUuidAndUserId(
      uuid,
      user.internalId
    );

    if (!address) {
      throw ApiError.notFound("Address not found");
    }

    return formatCustomerAddress(address);
  },

  async createAddress(
    sessionUserId: string,
    data: CreateCustomerAddressInput
  ): Promise<CustomerAddressResponse> {
    const user = await resolveActiveUser(sessionUserId);

    let profile = await customerProfileRepository.findByUserId(user.internalId);
    if (!profile) {
      const rand = crypto.randomUUID().replace(/-/g, "").toUpperCase().slice(0, 6);
      const referralCode = `REF${user.uuid.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 4)}${rand}`.slice(0, 15);

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

    const addressType: AddressType =
      data.addressType === "billing" ? "billing" : "shipping";

    const label =
      data.label ||
      (addressType === "billing" ? "Billing Address" : "Shipping Address");

    const created = await db.$transaction(async (tx) => {
      const activeCount = await customerAddressRepository.countActiveByUserId(
        user.internalId,
        addressType,
        tx
      );

      // First address of this type automatically becomes default
      const shouldBeDefault = activeCount === 0 || Boolean(data.isDefault);

      if (shouldBeDefault) {
        await customerAddressRepository.clearDefaultAddresses(
          user.internalId,
          addressType,
          tx
        );
      }

      const addressUuid = crypto.randomUUID();

      const newAddress = await customerAddressRepository.create(
        {
          uuid: addressUuid,
          userId: BigInt(user.internalId),
          cust_id: BigInt(profile.id),
          label,
          addressType,
          full_name: data.fullName,
          phone: data.phone,
          address_line1: data.addressLine1,
          address_line2: data.addressLine2 ?? null,
          landmark: data.landmark ?? null,
          city: data.city,
          state: data.state,
          pincode: data.pincode,
          country: data.country || "India",
          latitude: data.latitude ?? null,
          longitude: data.longitude ?? null,
          isDefault: shouldBeDefault,
          status: true,
          is_active: true,
          deleted_at: null,
          created_by: BigInt(user.internalId),
          updated_by: BigInt(user.internalId),
        },
        tx
      );

      return newAddress;
    });

    return formatCustomerAddress(created);
  },

  async updateAddress(
    sessionUserId: string,
    uuid: string,
    data: UpdateCustomerAddressInput
  ): Promise<CustomerAddressResponse> {
    const user = await resolveActiveUser(sessionUserId);

    const existing = await customerAddressRepository.findByUuidAndUserId(
      uuid,
      user.internalId
    );

    if (!existing) {
      throw ApiError.notFound("Address not found");
    }

    const updateData: Record<string, unknown> = {
      updated_by: BigInt(user.internalId),
    };

    if (data.label !== undefined) updateData.label = data.label;
    if (data.addressType !== undefined) updateData.addressType = data.addressType;
    if (data.fullName !== undefined) updateData.full_name = data.fullName;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.addressLine1 !== undefined) updateData.address_line1 = data.addressLine1;
    if (data.addressLine2 !== undefined) updateData.address_line2 = data.addressLine2;
    if (data.landmark !== undefined) updateData.landmark = data.landmark;
    if (data.city !== undefined) updateData.city = data.city;
    if (data.state !== undefined) updateData.state = data.state;
    if (data.pincode !== undefined) updateData.pincode = data.pincode;
    if (data.country !== undefined) updateData.country = data.country;
    if (data.latitude !== undefined) updateData.latitude = data.latitude;
    if (data.longitude !== undefined) updateData.longitude = data.longitude;
    if (data.isDefault !== undefined) updateData.isDefault = data.isDefault;

    const updated = await customerAddressRepository.updateByUuidAndUserId(
      uuid,
      user.internalId,
      updateData
    );

    if (!updated) {
      throw ApiError.notFound("Address not found");
    }

    return formatCustomerAddress(updated);
  },

  async setDefaultAddress(
    sessionUserId: string,
    uuid: string
  ): Promise<{ id: string; isDefault: true }> {
    const user = await resolveActiveUser(sessionUserId);

    const existing = await customerAddressRepository.findByUuidAndUserId(
      uuid,
      user.internalId
    );

    if (!existing) {
      throw ApiError.notFound("Address not found");
    }

    if (existing.isDefault) {
      return { id: uuid, isDefault: true };
    }

    const addressType: AddressType =
      existing.addressType === "billing" ? "billing" : "shipping";

    await db.$transaction(async (tx) => {
      await customerAddressRepository.clearDefaultAddresses(
        user.internalId,
        addressType,
        tx
      );
      await customerAddressRepository.setDefaultAddress(uuid, user.internalId, tx);
    });

    return { id: uuid, isDefault: true };
  },

  async deleteAddress(
    sessionUserId: string,
    uuid: string
  ): Promise<{ success: true; message: string }> {
    const user = await resolveActiveUser(sessionUserId);

    const existing = await customerAddressRepository.findByUuidAndUserId(
      uuid,
      user.internalId
    );

    if (!existing) {
      throw ApiError.notFound("Address not found");
    }

    const addressType: AddressType =
      existing.addressType === "billing" ? "billing" : "shipping";

    await db.$transaction(async (tx) => {
      await customerAddressRepository.softDeleteByUuidAndUserId(
        uuid,
        user.internalId,
        tx
      );

      // If deleted address was default, promote another active address of same type if available
      if (existing.isDefault) {
        const replacement = await customerAddressRepository.findLatestActiveAddress(
          user.internalId,
          uuid,
          tx
        );
        if (replacement && replacement.uuid) {
          await customerAddressRepository.setDefaultAddress(
            replacement.uuid,
            user.internalId,
            tx
          );
        }
      }
    });

    return {
      success: true,
      message: "Address deleted successfully",
    };
  },
};
