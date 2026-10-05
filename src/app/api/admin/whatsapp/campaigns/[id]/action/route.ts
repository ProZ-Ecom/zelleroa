import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/prisma";
import { apiSuccess, apiError } from "@/lib/api/api-response";
import { triggerWorker } from "@/lib/whatsapp/whatsapp-campaign-worker";
import { withApiRoles } from "@/lib/api/api-handler";

async function handlePOST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const campaignId = BigInt(id);
    const body = await request.json();
    const { action } = body || {};

    const campaign = await db.whatsAppCampaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      return apiError("Campaign not found", 404);
    }

    if (action === "PAUSE") {
      await db.whatsAppCampaign.update({
        where: { id: campaignId },
        data: { status: "PAUSED" },
      });
      return apiSuccess({ status: "PAUSED" }, "Campaign paused successfully");
    }

    if (action === "RESUME") {
      await db.whatsAppCampaign.update({
        where: { id: campaignId },
        data: { status: "RUNNING" },
      });
      triggerWorker();
      return apiSuccess({ status: "RUNNING" }, "Campaign resumed successfully");
    }

    if (action === "CANCEL") {
      await db.whatsAppCampaign.update({
        where: { id: campaignId },
        data: { status: "CANCELLED" },
      });
      return apiSuccess({ status: "CANCELLED" }, "Campaign cancelled successfully");
    }

    if (action === "RETRY_FAILED") {
      // Reset all failed recipients back to QUEUED
      const updated = await db.whatsAppCampaignRecipient.updateMany({
        where: {
          campaign_id: campaignId,
          status: "FAILED",
        },
        data: {
          status: "QUEUED",
          error_message: null,
        },
      });

      await db.whatsAppCampaign.update({
        where: { id: campaignId },
        data: {
          status: "RUNNING",
          failed_count: { decrement: updated.count },
        },
      });

      triggerWorker();
      return apiSuccess(
        { requeuedCount: updated.count, status: "RUNNING" },
        `${updated.count} failed message(s) re-queued for sending`
      );
    }

    return apiError("Invalid action specified", 400);
  } catch (err: any) {
    console.error("[WhatsApp Campaign Action POST] Error:", err);
    return NextResponse.json(
      { success: false, message: err?.message || "Failed to execute campaign action" },
      { status: 500 }
    );
  }
}

export const POST = withApiRoles(["ADMIN", "STAFF"], handlePOST);
