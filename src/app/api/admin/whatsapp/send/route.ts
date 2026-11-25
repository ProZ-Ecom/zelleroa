import { NextRequest, NextResponse } from "next/server";
import { sendWhatsAppMessage } from "@/lib/whatsapp/whatsapp-client";
import { apiSuccess, apiError } from "@/lib/api/api-response";
import { withApiRoles } from "@/lib/api/api-handler";
import {
  MOBILE_REGEX,
  STORED_MOBILE_REGEX,
  MOBILE_INVALID_MESSAGE,
} from "@/lib/validations/mobile";

async function handlePOST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, message } = body || {};

    if (!phone || typeof phone !== "string" || !phone.trim()) {
      return apiError("Recipient phone number is required", 400);
    }

    const clean = phone.trim().replace(/[\s-]/g, "");
    if (!STORED_MOBILE_REGEX.test(clean) && !MOBILE_REGEX.test(clean)) {
      return apiError(MOBILE_INVALID_MESSAGE, 400);
    }

    if (!message || typeof message !== "string" || !message.trim()) {
      return apiError("Message text is required", 400);
    }

    const result = await sendWhatsAppMessage(clean, message.trim());

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
