import { NextResponse } from "next/server";
import { ApiError, isApiError, handlePrismaError } from "./api-error";

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T | null;
  message: string;
  /** Machine-readable error code (e.g. ACCOUNT_BLOCKED), when the backend supplies one. */
  code?: string;
  errors?: string[];
  meta?: PaginationMeta;
  details?: unknown;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  pageSize?: number;
  total: number;
  totalPages: number;
}

export interface PaginationParams {
  page: number;
  limit: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export function apiSuccess<T>(
  data: T,
  message = "Success",
  status = 200,
  meta?: PaginationMeta
): NextResponse<ApiResponse<T>> {
  const serializedData = JSON.parse(
    JSON.stringify(data, (_, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );

  return NextResponse.json(
    { success: true, data: serializedData, message, meta },
    { status }
  );
}

export function apiCreated<T>(
  data: T,
  message = "Created successfully"
): NextResponse<ApiResponse<T>> {
  return apiSuccess(data, message, 201);
}

export function apiNoContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

export function apiError(
  message = "Something went wrong",
  status = 500,
  errors?: string[],
  details?: unknown,
  code?: string
): NextResponse<ApiResponse<null>> {
  return NextResponse.json(
    { success: false, data: null, message, code, errors, details },
    { status }
  );
}

export function apiNotFound(
  message = "Resource not found"
): NextResponse<ApiResponse<null>> {
  return apiError(message, 404);
}

export function apiUnauthorized(
  message = "You must be logged in"
): NextResponse<ApiResponse<null>> {
  return apiError(message, 401);
}

export function apiForbidden(
  message = "You don't have permission"
): NextResponse<ApiResponse<null>> {
  return apiError(message, 403);
}

export function apiConflict(
  message = "Resource already exists"
): NextResponse<ApiResponse<null>> {
  return apiError(message, 409);
}

export function apiValidationError(
  errors: string[],
  message = "Validation failed"
): NextResponse<ApiResponse<null>> {
  return apiError(message, 422, errors);
}

export function apiFromError(error: unknown): NextResponse<ApiResponse<null>> {
  if (isApiError(error)) {
    const res = apiError(error.message, error.statusCode, error.errors, error.details, error.code);
    const retryAfter = (error.details as { retryAfterSeconds?: number } | undefined)?.retryAfterSeconds;
    if (error.statusCode === 429 && typeof retryAfter === "number") {
      res.headers.set("Retry-After", String(retryAfter));
    }
    return res;
  }

  const prismaError = handlePrismaError(error);
  if (prismaError && prismaError.message !== "A database error occurred") {
    return apiError(prismaError.message, prismaError.statusCode, prismaError.errors);
  }

  console.error("Unhandled API error:", error);
  return apiError("Something went wrong", 500);
}
