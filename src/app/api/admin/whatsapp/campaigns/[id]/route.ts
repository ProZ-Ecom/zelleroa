import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/prisma";
import { apiSuccess, apiError } from "@/lib/api/api-response";
import { withApiRoles } from "@/lib/api/api-handler";

async function handleGET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const campaignId = BigInt(id);

    const campaign = await db.whatsAppCampaign.findUnique({
      where: { id: campaignId },
      include: {
        recipients: {
          orderBy: { id: "asc" },
          take: 100,
        },
      },
    });

    if (!campaign) {
      return apiError("Campaign not found", 404);
    }

    const recipientCounts = await db.whatsAppCampaignRecipient.groupBy({
      by: ["status"],
      where: { campaign_id: campaignId },
      _count: { status: true },
    });

    const statusBreakdown: Record<string, number> = {
      QUEUED: 0,
      SENDING: 0,
      SENT: 0,
      FAILED: 0,
      SKIPPED: 0,
    };

    for (const item of recipientCounts) {
      statusBreakdown[item.status] = item._count.status;
    }

    return apiSuccess({
      ...campaign,
      id: String(campaign.id),
      total_recipients: Number(campaign.total_recipients),
      sent_count: Number(campaign.sent_count),
      failed_count: Number(campaign.failed_count),
      statusBreakdown,
      recipients: campaign.recipients.map((r) => ({
        ...r,
        id: String(r.id),
        campaign_id: String(r.campaign_id),
        customer_id: r.customer_id ? String(r.customer_id) : null,
      })),
    });
  } catch (err: any) {
    console.error("[WhatsApp Campaign Detail GET] Error:", err);
    return NextResponse.json(
      { success: false, message: err?.message || "Failed to fetch campaign details" },
      { status: 500 }
    );
  }
}

async function handleDELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const campaignId = BigInt(id);

    await db.whatsAppCampaign.delete({
      where: { id: campaignId },
    });

    return apiSuccess(null, "Campaign deleted successfully");
  } catch (err: any) {
    console.error("[WhatsApp Campaign DELETE] Error:", err);
    return NextResponse.json(
      { success: false, message: err?.message || "Failed to delete campaign" },
      { status: 500 }
    );
  }
}

export const GET = withApiRoles(["ADMIN", "STAFF"], handleGET);
export const DELETE = withApiRoles(["ADMIN", "STAFF"], handleDELETE);
