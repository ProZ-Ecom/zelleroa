import { signIn, signOut } from "next-auth/react";
import { ApiError } from "@/lib/api/api-error";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from "@/lib/auth/jwt";
import { userRepository } from "@/features/users/repositories/user.repository";
import { apiClient } from "@/lib/api/api-client";
import type { LoginInput, RegisterInput } from "@/lib/validations/auth";
import { verifyCredentialsWithProtection } from "./login-protection.service";

export const authService = {
  async authenticateUser(data: LoginInput) {
    const user = await verifyCredentialsWithProtection(data.email, data.password);

    const userUuid = user.uuid || user.id.toString();
    const userRole = user.roleName || user.role?.name || "CUSTOMER";

    await userRepository.update(user.id, { last_login_at: new Date() } as never);

    const accessToken = generateAccessToken({
      userId: userUuid, // Pass UUID string into JWT
      email: user.email ?? "",
      role: userRole,
    });

    const refreshToken = generateRefreshToken({
      userId: userUuid,
    });

    return {
      user: {
        id: userUuid, // Expose user's UUID in the id property of response DTO sent to FE
        name: user.name,
        email: user.email ?? "",
        phone: user.phone ?? null,
        role: userRole,
      },
      accessToken,
      refreshToken,
    };
  },

  async refreshAccessToken(refreshToken: string) {
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw ApiError.unauthorized("Invalid or expired refresh token");
    }

    const user = await userRepository.findById(payload.userId);
    if (!user || user.status !== "active") {
      throw ApiError.unauthorized("User account is inactive or no longer exists");
    }

    const userUuid = user.uuid || user.id.toString();
    const userRole = user.roleName || user.role?.name || "CUSTOMER";

    const accessToken = generateAccessToken({
      userId: userUuid,
      email: user.email ?? "",
      role: userRole,
    });

    return { accessToken };
  },
};

// Client-side authentication helpers
export async function loginWithCredentials(data: LoginInput) {
  const result = await signIn("credentials", {
    email: data.email,
    password: data.password,
    redirect: false,
  });

  if (result?.error) {
    return { success: false, message: "Invalid email or password" };
  }

  return { success: true, message: "Signed in successfully" };
}

export async function registerUser(data: RegisterInput) {
  const result = await apiClient.post("/api/auth/register", {
    name: data.name,
    email: data.email,
    phone: data.phone,
    password: data.password,
  });

  return result;
}

export async function logoutUser() {
  await signOut({ redirect: false });
}
