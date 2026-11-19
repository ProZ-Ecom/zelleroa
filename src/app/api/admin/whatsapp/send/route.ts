import { NextRequest, NextResponse } from "next/server";
import { sendWhatsAppMessage } from "@/lib/whatsapp/whatsapp-client";
import { apiSuccess, apiError } from "@/lib/api/api-response";
import { withApiRoles } from "@/lib/api/api-handler";

async function handlePOST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, message } = body || {};

    if (!phone || typeof phone !== "string") {
      return apiError("Recipient phone number is required", 400);
    }

    if (!message || typeof message !== "string") {
      return apiError("Message text is required", 400);
    }

    const result = await sendWhatsAppMessage(phone, message);

    if (!result.success) {
      return apiError(result.error || "Failed to deliver WhatsApp message", 400);
    }

    return apiSuccess(result, "WhatsApp message sent successfully");
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || "Failed to send message" },
      { status: 500 }
    );
  }
}

export const POST = withApiRoles(["ADMIN", "STAFF"], handlePOST);
