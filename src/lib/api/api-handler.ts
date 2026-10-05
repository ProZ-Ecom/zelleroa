import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ZodSchema } from "zod";
import { apiError, apiValidationError, apiFromError } from "./api-response";
import { ApiError } from "./api-error";
import { handlePrismaError } from "./api-error";
import { auth } from "@/lib/auth/config";
import { verifyAccessToken } from "@/lib/auth/jwt";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limiter";
import type { Session } from "next-auth";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

interface ApiHandlerOptions {
  method?: HttpMethod | HttpMethod[];
  requireAuth?: boolean;
  /** Resolve a session/JWT if one is present, but don't reject the request when there isn't one (guest access). */
  optionalAuth?: boolean;
  requiredRole?: string[];
  bodySchema?: ZodSchema;
  querySchema?: ZodSchema;
  /** Per-IP, per-route request cap. Defaults to 60 requests/minute; pass `false` to disable. */
  rateLimit?: RateLimitOptions | false;
}

const DEFAULT_RATE_LIMIT: RateLimitOptions = { limit: 60, windowMs: 60_000 };

export interface HandlerContext {
  params?: Record<string, string>;
  searchParams?: URLSearchParams;
  session?: Session | null;
  body?: unknown;
  query?: Record<string, unknown>;
}

type HandlerFn = (
  request: NextRequest,
  context: HandlerContext
) => Promise<NextResponse>;

function parseSearchParams(
  searchParams: URLSearchParams,
  schema?: ZodSchema
): { data: Record<string, unknown> } | { errors: string[] } {
  const raw: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    raw[key] = value;
  });

  if (!schema) return { data: raw };

  const result = schema.safeParse(raw);
  if (result.success) {
    return { data: result.data as Record<string, unknown> };
  }
  // Never hand unvalidated query values to a handler that expects parsed ones.
  return {
    errors: result.error.issues.map(
      (issue) => `${issue.path.join(".")}: ${issue.message}`
    ),
  };
}

export function createApiHandler(
  handlers: Partial<Record<HttpMethod, HandlerFn>>,
  options: ApiHandlerOptions = {}
) {
  return async (
    request: NextRequest,
    routeContext: { params: Promise<any> }
  ) => {
    const method = request.method as HttpMethod;

    if (options.method) {
      const allowedMethods = Array.isArray(options.method)
        ? options.method
        : [options.method];
      if (!allowedMethods.includes(method)) {
        return apiError("Method not allowed", 405);
      }
    }

    const handler = handlers[method];
    if (!handler) {
      return apiError("Method not allowed", 405);
    }

    const rateLimitConfig =
      options.rateLimit === false ? null : options.rateLimit || DEFAULT_RATE_LIMIT;

    if (rateLimitConfig) {
      const key = `${request.nextUrl.pathname}:${getClientIp(request)}`;
      const result = checkRateLimit(key, rateLimitConfig);

      if (!result.allowed) {
        return NextResponse.json(
          {
            success: false,
            data: null,
            message: "Too many requests. Please try again later.",
          },
          {
            status: 429,
            headers: {
              "Retry-After": Math.ceil((result.resetAt - Date.now()) / 1000).toString(),
            },
          }
        );
      }
    }

    let session: Session | null = null;

    if (options.requireAuth || options.optionalAuth) {
      try {
        // 1. Try NextAuth session (Google OAuth & NextAuth Credentials)
        session = (await auth()) as Session | null;
      } catch {
        session = null;
      }

      // 2. Fallback: Try HttpOnly access_token cookie or Authorization header
      if (!session?.user) {
        let cookieStore;
        try {
          cookieStore = await cookies();
        } catch {
          cookieStore = null;
        }
        const token =
          cookieStore?.get("access_token")?.value ||
          request.headers.get("authorization")?.replace("Bearer ", "");

        if (token) {
          try {
            const payload = verifyAccessToken(token);
            session = {
              user: {
                id: payload.userId, // UUID string
                email: payload.email,
                role: payload.role || "CUSTOMER",
                status: "active",
              },
              expires: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
            } as unknown as Session;
          } catch {
            if (options.requireAuth) {
              return apiError("Session expired. Please log in again.", 401);
            }
            session = null;
          }
        }
      }

      if (!session?.user) {
        if (options.requireAuth) {
          return apiError("You must be logged in", 401);
        }
      } else if (options.requiredRole && options.requiredRole.length > 0) {
        const userRole = (session.user as { role?: string }).role;
        if (!userRole || !options.requiredRole.includes(userRole)) {
          return apiError("You don't have permission", 403);
        }
      }
    }

    const resolvedParams = routeContext?.params
      ? await routeContext.params
      : undefined;
    const searchParams = new URL(request.url).searchParams;

    const context: HandlerContext = {
      params: resolvedParams,
      searchParams,
      session,
    };

    if (options.querySchema) {
      const parsedQuery = parseSearchParams(searchParams, options.querySchema);
      if ("errors" in parsedQuery) {
        return apiValidationError(parsedQuery.errors);
      }
      context.query = parsedQuery.data;
    }

    if (
      options.bodySchema &&
      (method === "POST" || method === "PATCH" || method === "PUT")
    ) {
      try {
        const body = await request.json();
        const validation = options.bodySchema.safeParse(body);
        if (!validation.success) {
          const errors = validation.error.issues.map(
            (issue) => `${issue.path.join(".")}: ${issue.message}`
          );
          return apiValidationError(errors);
        }
        context.body = validation.data;
      } catch {
        return apiError("Invalid request body", 400);
      }
    }

    try {
      return await handler(request, context);
    } catch (error: any) {
      if (error instanceof ApiError) {
        return apiFromError(error);
      }

      if (
        error instanceof TypeError &&
        error.message.includes("Content-Type")
      ) {
        return apiError("Content-Type must be multipart/form-data", 400);
      }

      const prismaResult = handlePrismaError(error);
      if (prismaResult && prismaResult.message !== "A database error occurred") {
        return apiFromError(prismaResult);
      }

      console.error(`Unhandled API Error [${method}]:`, error);
      return apiError("Something went wrong", 500);
    }
  };
}

/**
 * Role guard for raw route handlers that don't go through createApiHandler.
 * Resolves the session the same way (NextAuth, then the access_token cookie /
 * bearer token) and rejects with 401/403 before the wrapped handler runs.
 */
export function withApiRoles<A extends unknown[]>(
  roles: string[],
  handler: (request: NextRequest, ...args: A) => Promise<Response> | Response
) {
  return async (request: NextRequest, ...args: A): Promise<Response> => {
    let role: string | undefined;
    let authed = false;

    try {
      const session = await auth();
      if (session?.user) {
        authed = true;
        role = (session.user as { role?: string }).role;
      }
    } catch {
      // fall through to the token check
    }

    if (!authed) {
      let token: string | undefined;
      try {
        token = (await cookies()).get("access_token")?.value;
      } catch {
        token = undefined;
      }
      token = token || request.headers.get("authorization")?.replace("Bearer ", "");
      if (token) {
        try {
          role = verifyAccessToken(token).role;
          authed = true;
        } catch {
          return apiError("Session expired. Please log in again.", 401);
        }
      }
    }

    if (!authed) return apiError("You must be logged in", 401);
    if (!role || !roles.includes(role)) return apiError("You don't have permission", 403);

    return handler(request, ...args);
  };
}
