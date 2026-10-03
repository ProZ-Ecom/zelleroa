import { NextResponse } from "next/server";
import { initWhatsAppClient, waitForQrCode } from "@/lib/whatsapp/whatsapp-client";
import { apiSuccess } from "@/lib/api/api-response";
import { withApiRoles } from "@/lib/api/api-handler";

async function handlePOST() {
  try {
    // Trigger initialization
    initWhatsAppClient(true).catch((err) => {
      console.error("[WhatsApp] Init failed:", err);
    });

    // Wait up to 5 seconds for QR or connection to be generated
    const statusData = await waitForQrCode(5000);
    return apiSuccess(statusData, "WhatsApp initialization active");
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || "Failed to start WhatsApp" },
      { status: 500 }
    );
  }
}

export const POST = withApiRoles(["ADMIN", "STAFF"], handlePOST);
