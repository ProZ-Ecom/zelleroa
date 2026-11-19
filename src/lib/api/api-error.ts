import { HTTP_STATUS, type HttpStatusCode } from "./http-status";

export class ApiError extends Error {
  public readonly statusCode: HttpStatusCode;
  public readonly errors?: string[];
  public readonly isOperational: boolean;
  public readonly details?: unknown;
  public readonly code?: string;

  constructor(
    message: string,
    statusCode: HttpStatusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    errors?: string[],
    isOperational = true,
    details?: unknown,
    code?: string
  ) {
    super(message);
    this.code = code;
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = isOperational;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = "Bad request", errors?: string[]) {
    return new ApiError(message, HTTP_STATUS.BAD_REQUEST, errors);
  }

  static unauthorized(message = "You must be logged in") {
    return new ApiError(message, HTTP_STATUS.UNAUTHORIZED);
  }

  static forbidden(message = "You don't have permission") {
    return new ApiError(message, HTTP_STATUS.FORBIDDEN);
  }

  /** Signed-in account was blocked/deactivated; the client reacts by logging out. */
  static accountBlocked(
    message = "Your account is inactive or blocked. Please contact support."
  ) {
    return new ApiError(
      message,
      HTTP_STATUS.FORBIDDEN,
      undefined,
      true,
      undefined,
      "ACCOUNT_BLOCKED"
    );
  }

  static notFound(message = "Resource not found") {
    return new ApiError(message, HTTP_STATUS.NOT_FOUND);
  }

  static conflict(message = "Resource already exists", details?: unknown) {
    return new ApiError(message, HTTP_STATUS.CONFLICT, undefined, true, details);
  }

  static tooManyRequests(message = "Too many requests. Please try again later.") {
    return new ApiError(message, HTTP_STATUS.TOO_MANY_REQUESTS);
  }

  static validation(errors: string[], message = "Validation failed") {
    return new ApiError(message, HTTP_STATUS.UNPROCESSABLE_ENTITY, errors);
  }

  static internal(message = "Something went wrong") {
    return new ApiError(message, HTTP_STATUS.INTERNAL_SERVER_ERROR, undefined, false);
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function handlePrismaError(error: unknown): ApiError {
  const prismaError = error as { code?: string; meta?: Record<string, unknown> };

  switch (prismaError.code) {
    case "P2002":
      return ApiError.conflict(
        `A record with the same value already exists${
          prismaError.meta?.target ? ` for field: ${String(prismaError.meta.target)}` : ""
        }`
      );
    case "P2025":
      return ApiError.notFound("The requested record was not found");
    case "P2003":
      return ApiError.badRequest("Related record not found");
    case "P2014":
      return ApiError.badRequest("Required relation violation");
    case "P2011": {
      const column = prismaError.meta?.constraint ?? prismaError.meta?.target;
      console.error("[prisma P2011] null constraint violation", prismaError.meta);
      return ApiError.badRequest(
        `Null constraint violation${column ? ` on ${String(column)}` : ""}`
      );
    }
    case "P2012":
      return ApiError.badRequest("Missing required value");
    default:
      return ApiError.internal("A database error occurred");
  }
}
