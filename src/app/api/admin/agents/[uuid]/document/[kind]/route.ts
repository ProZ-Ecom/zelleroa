import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/api/api-handler";
import { ApiError } from "@/lib/api/api-error";
import { agentProfileService } from "@/features/agents/services/agent-profile.service";
import { DOC_KINDS, type DocKind } from "@/features/agents/validations/agent-profile.schema";

export const GET = createApiHandler(
  {
    GET: async (_request, context) => {
      const kind = context.params?.kind;
      if (!DOC_KINDS.includes(kind as DocKind)) throw ApiError.notFound("Unknown document type");
      const doc = await agentProfileService.readDocumentByRef(context.params?.uuid ?? "", kind as DocKind);
      return new NextResponse(new Uint8Array(doc.buffer), {
        headers: { "Content-Type": doc.contentType, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
      });
    },
  },
  { requireAuth: true, requiredRole: ["ADMIN", "STAFF"] }
);
