import crypto from "crypto";
import bcrypt from "bcryptjs";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db/prisma";
import { ApiError } from "@/lib/api/api-error";
import { userRepository } from "../repositories/user.repository";
import { otpRepository } from "@/features/auth/repositories/otp.repository";
import { verifyEmailVerificationToken } from "@/lib/auth/jwt";
import {
  normalizeIndianMobile,
  mobileLookupVariants,
  PHONE_ALREADY_REGISTERED_MESSAGE,
} from "@/lib/phone";
import type { GetUserParams, CreateUserInput, UpdateUserInput } from "../types";
import type { RegisterInput } from "../validations/user.schema";

export const userService = {
  async getUsers(params: GetUserParams = {}) {
    return userRepository.findAll(params);
  },

  async getUser(id: string | number | bigint) {
    const user = await userRepository.findById(id);
    if (!user) {
      throw ApiError.notFound("User not found");
    }
    return user;
  },

  async createUser(data: CreateUserInput) {
    const existingUser = await userRepository.findByEmail(data.email);
    if (existingUser) {
      throw ApiError.conflict("An account with this email already exists");
    }

    if (data.phone) {
      const existingPhone = await userRepository.findByPhone(data.phone);
      if (existingPhone) {
        throw ApiError.conflict("An account with this phone number already exists");
      }
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);

    // Registration ALWAYS assigns role_id = 3 (CUSTOMER) and generates a UUID for FE identification
    return userRepository.create({
      uuid: crypto.randomUUID(),
      name: data.name,
      email: data.email,
      password_hash: hashedPassword,
      phone: data.phone ?? undefined,
      role: { connect: { id: BigInt(3) } },
      status: (data.status as "active" | "inactive" | "banned") ?? "active",
    });
  },

  async registerUserWithToken(data: RegisterInput, request?: NextRequest) {
    const registrationEmail = data.email.toLowerCase().trim();
    const name = (data.fullName || data.name || "").trim();
    const rawPhone = (data.mobileNumber || data.phone || "").trim();
    const phone = rawPhone ? normalizeIndianMobile(rawPhone) ?? rawPhone : "";

    if (!data.emailVerificationToken) {
      throw ApiError.badRequest("Email verification is required");
    }

    // 1. Verify token signature, purpose (EMAIL_VERIFICATION), and expiry
    const tokenPayload = verifyEmailVerificationToken(data.emailVerificationToken);

    // 2. Verify token email matches registration email
    if (tokenPayload.email !== registrationEmail) {
      throw ApiError.badRequest("Email verification token does not match registration email");
    }

    // 3. Perform atomic registration & single-use token consumption in a transaction
    try {
    return await db.$transaction(async (tx) => {
      // Check token record in DB for single-use state
      const tokenRecord = await otpRepository.findValidUnusedVerificationTokenRecord(
        registrationEmail,
        tokenPayload.jti,
        tx
      );

      if (!tokenRecord || tokenRecord.is_token_used) {
        throw ApiError.badRequest(
          "Invalid, expired, or already used verification token. Please verify email again."
        );
      }

      // Check duplicate email
      const existingUser = await tx.user.findFirst({
        where: { email: registrationEmail },
      });
      if (existingUser) {
        throw ApiError.conflict("This email address is already registered. Please login instead.");
      }

      // Check duplicate phone
      if (phone) {
        const existingPhone = await tx.user.findFirst({
          where: { phone: { in: mobileLookupVariants(phone) } },
        });
        if (existingPhone) {
          throw ApiError.conflict(PHONE_ALREADY_REGISTERED_MESSAGE);
        }
      }

      const hashedPassword = await bcrypt.hash(data.password, 12);
      const userUuid = crypto.randomUUID();

      // Create user
      const newUser = await tx.user.create({
        data: {
          uuid: userUuid,
          name,
          email: registrationEmail,
          phone: phone || null,
          password_hash: hashedPassword,
          role: { connect: { id: BigInt(3) } }, // CUSTOMER
          status: "active",
          email_verified_at: new Date(),
        },
      });

      // Create customer profile atomically inside the transaction
      const referralCode = "REF" + userUuid.replace(/-/g, "").slice(0, 8).toUpperCase();
      await tx.customer_profiles.create({
        data: {
          uuid: crypto.randomUUID(),
          user_id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          phone: newUser.phone,
          is_whatsapp: false,
          whatsapp_no: null,
          referral_code: referralCode,
          is_active: true,
          status: true,
        },
      });

      // Atomically mark verification token as used inside transaction
      await otpRepository.markVerificationTokenUsed(tokenRecord.id, tx);

      return {
        id: userUuid,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
      };
    });
    } catch (error) {
      // Concurrent registration lost the race on a unique column
      const e = error as { code?: string; meta?: { target?: unknown } };
      if (e?.code === "P2002") {
        const target = String(e.meta?.target ?? "");
        throw ApiError.conflict(
          target.includes("phone")
            ? PHONE_ALREADY_REGISTERED_MESSAGE
            : "This email address is already registered. Please login instead."
        );
      }
      throw error;
    }
  },

  async updateUser(id: string | number | bigint, data: UpdateUserInput) {
    const existing = await userRepository.findById(id);
    if (!existing) {
      throw ApiError.notFound("User not found");
    }

    if (data.email && data.email !== existing.email) {
      const emailExists = await userRepository.findByEmail(data.email);
      if (emailExists) {
        throw ApiError.conflict("An account with this email already exists");
      }
    }

    if (data.phone && data.phone !== existing.phone) {
      const phoneExists = await userRepository.findByPhone(data.phone);
      if (phoneExists && phoneExists.uuid !== existing.uuid && Number(phoneExists.id) !== Number(existing.internalId)) {
        throw ApiError.conflict("An account with this phone number already exists");
      }
    }

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.status !== undefined) updateData.status = data.status;

    return userRepository.update(id, updateData as never);
  },

  async deleteUser(id: string | number | bigint) {
    const existing = await userRepository.findById(id);
    if (!existing) {
      throw ApiError.notFound("User not found");
    }

    return userRepository.delete(id);
  },

  async resetPassword(id: string | number | bigint, password: string) {
    const existing = await userRepository.findById(id);
    if (!existing) {
      throw ApiError.notFound("User not found");
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    return userRepository.resetPassword(id, hashedPassword);
  },

  async toggleStatus(id: string | number | bigint) {
    const existing = await userRepository.findById(id);
    if (!existing) {
      throw ApiError.notFound("User not found");
    }

    const newStatus = existing.status === "active" ? "inactive" : "active";
    return userRepository.update(id, { status: newStatus } as never);
  },
};
