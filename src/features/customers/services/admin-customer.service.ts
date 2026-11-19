import { ApiError } from "@/lib/api/api-error";
import { adminCustomerRepository } from "../repositories/admin-customer.repository";
import type {
  AdminCustomerListInput,
  AdminCustomerOrdersInput,
} from "../validations/admin-customer.schema";
import type {
  AdminCustomerListResponse,
  AdminCustomerDetailDto,
  AdminCustomerAddressDto,
  AdminCustomerOrdersResponse,
  AdminCustomerCartDto,
  AdminCustomersCountResponse,
} from "../types/admin-customer.types";

export const adminCustomerService = {
  async getAdminCustomers(
    params: AdminCustomerListInput
  ): Promise<AdminCustomerListResponse> {
    return adminCustomerRepository.findAdminCustomers(params);
  },

  async countAdminCustomers(
    params: AdminCustomerListInput
  ): Promise<AdminCustomersCountResponse> {
    return adminCustomerRepository.countAdminCustomers(params);
  },

  async getCustomerDetail(uuid: string): Promise<AdminCustomerDetailDto> {
    const customer = await adminCustomerRepository.findCustomerByUuid(uuid);
    if (!customer) {
      throw ApiError.notFound("Customer not found");
    }
    return customer;
  },

  async getCustomerAddresses(uuid: string): Promise<AdminCustomerAddressDto[]> {
    const addresses =
      await adminCustomerRepository.findCustomerAddressesByCustomerUuid(uuid);
    if (addresses === null) {
      throw ApiError.notFound("Customer not found");
    }
    return addresses;
  },

  async getCustomerOrders(
    uuid: string,
    params: AdminCustomerOrdersInput
  ): Promise<AdminCustomerOrdersResponse> {
    const result =
      await adminCustomerRepository.findCustomerOrdersByCustomerUuid(
        uuid,
        params
      );
    if (result === null) {
      throw ApiError.notFound("Customer not found");
    }
    return result;
  },

  async getCustomerCart(
    uuid: string
  ): Promise<{ data: AdminCustomerCartDto | null; message: string }> {
    const cart =
      await adminCustomerRepository.findCustomerActiveCartByCustomerUuid(uuid);
    if (cart === undefined) {
      throw ApiError.notFound("Customer not found");
    }
    if (cart === null) {
      return {
        data: null,
        message: "Customer has no active cart",
      };
    }
    return {
      data: cart,
      message: "Customer current cart fetched successfully",
    };
  },

  async updateCustomerStatus(
    uuid: string,
    isActive: boolean,
    adminSessionUserId?: string,
    blockReason?: string
  ): Promise<AdminCustomerDetailDto> {
    if (!isActive && !blockReason?.trim()) {
      throw ApiError.badRequest("A reason is required to block this account");
    }

    const customer = await adminCustomerRepository.findCustomerByUuid(uuid);
    if (!customer) {
      throw ApiError.notFound("Customer not found");
    }

    let adminInternalId: number | undefined;
    if (adminSessionUserId) {
      const adminUser = await adminCustomerRepository.findCustomerUserByUuid(adminSessionUserId);
      if (adminUser) {
        adminInternalId = typeof adminUser.id === "bigint" ? Number(adminUser.id) : adminUser.id;
      }
    }

    const updated = await adminCustomerRepository.updateCustomerStatus(
      uuid,
      isActive,
      adminInternalId,
      blockReason?.trim()
    );

    if (!updated) {
      throw ApiError.notFound("Customer not found");
    }

    return updated;
  },
};
