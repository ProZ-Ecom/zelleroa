import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/api/api-handler";
import { apiSuccess } from "@/lib/api/api-response";
import { ApiError } from "@/lib/api/api-error";
import { agentProfileService } from "@/features/agents/services/agent-profile.service";
import { DOC_KINDS, type DocKind } from "@/features/agents/validations/agent-profile.schema";
import { requireSessionAgent } from "@/features/agents/lib/api-helpers";

function kindOf(raw: string | undefined): DocKind {
  if (!DOC_KINDS.includes(raw as DocKind)) throw ApiError.notFound("Unknown document type");
  return raw as DocKind;
}

const handler = createApiHandler(
  {
    GET: async (_request, context) => {
      const { agentId } = await requireSessionAgent(context.session);
      const doc = await agentProfileService.readDocument(agentId, kindOf(context.params?.kind));
      return new NextResponse(new Uint8Array(doc.buffer), {
        headers: { "Content-Type": doc.contentType, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
      });
    },
    POST: async (request, context) => {
      const { agentId } = await requireSessionAgent(context.session);
      let formData: FormData;
      try {
        formData = await request.formData();
      } catch {
        throw ApiError.badRequest("Content-Type must be multipart/form-data");
      }
      const file = formData.get("file");
      if (!(file instanceof File)) throw ApiError.badRequest("No file provided");
      return apiSuccess(await agentProfileService.saveDocument(agentId, kindOf(context.params?.kind), file), "Document uploaded");
    },
  },
  { requireAuth: true, requiredRole: ["AGENT"], rateLimit: { limit: 30, windowMs: 60_000 } }
);

export const GET = handler;
export const POST = handler;
