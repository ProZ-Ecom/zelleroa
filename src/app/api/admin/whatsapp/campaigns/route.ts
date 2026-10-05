import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/prisma";
import { apiSuccess, apiError } from "@/lib/api/api-response";
import { triggerWorker } from "@/lib/whatsapp/whatsapp-campaign-worker";
import { withApiRoles } from "@/lib/api/api-handler";

async function handleGET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const campaigns = await db.whatsAppCampaign.findMany({
      where: status && status !== "ALL" ? { status } : undefined,
      orderBy: { created_at: "desc" },
      take: 50,
    });

    const serialized = campaigns.map((c) => ({
      ...c,
      id: String(c.id),
      total_recipients: Number(c.total_recipients),
      sent_count: Number(c.sent_count),
      failed_count: Number(c.failed_count),
    }));

    return apiSuccess(serialized);
  } catch (err: any) {
    console.error("[WhatsApp Campaigns GET] Error:", err);
    return NextResponse.json(
      { success: false, message: err?.message || "Failed to fetch campaigns" },
      { status: 500 }
    );
  }
}

async function handlePOST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      description,
      type,
      message,
      media_url,
      scheduled_at,
      recipients, // Array of { id?: string, name?: string, phone: string }
    } = body || {};

    if (!name || typeof name !== "string" || !name.trim()) {
      return apiError("Campaign name is required", 400);
    }

    if (!message || typeof message !== "string" || !message.trim()) {
      return apiError("Campaign message content is required", 400);
    }

    if (!Array.isArray(recipients) || recipients.length === 0) {
      return apiError("At least one customer recipient must be selected", 400);
    }

    const scheduledDate = scheduled_at ? new Date(scheduled_at) : null;
    const isScheduledForFuture = scheduledDate && scheduledDate.getTime() > Date.now();
    const initialStatus = isScheduledForFuture ? "SCHEDULED" : "RUNNING";

    // Deduplicate recipients by phone number
    const uniqueRecipients = new Map<string, { id?: string; name?: string; phone: string }>();
    for (const r of recipients) {
      if (r.phone && r.phone.trim()) {
        const cleaned = r.phone.replace(/\D/g, "");
        if (cleaned.length >= 10 && !uniqueRecipients.has(cleaned)) {
          uniqueRecipients.set(cleaned, r);
        }
      }
    }

    const recipientList = Array.from(uniqueRecipients.values());

    // 1. Create Campaign row
    const campaign = await db.whatsAppCampaign.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        type: type || "CUSTOM",
        status: initialStatus,
        message: message.trim(),
        media_url: media_url || null,
        scheduled_at: scheduledDate,
        started_at: isScheduledForFuture ? null : new Date(),
        total_recipients: recipientList.length,
        sent_count: 0,
        failed_count: 0,
      },
    });

    // 2. Insert Recipient rows with status QUEUED
    if (recipientList.length > 0) {
      await db.whatsAppCampaignRecipient.createMany({
        data: recipientList.map((r) => ({
          campaign_id: campaign.id,
          customer_id: r.id ? BigInt(r.id) : null,
          customer_name: r.name || "Valued Customer",
          phone_number: r.phone.trim(),
          status: "QUEUED",
        })),
        skipDuplicates: true,
      });
    }

    // 3. If immediate, kick off the background worker
    if (!isScheduledForFuture) {
      triggerWorker();
    }

    return apiSuccess(
      {
        id: String(campaign.id),
        name: campaign.name,
        status: campaign.status,
        totalRecipients: recipientList.length,
      },
      "Campaign created and queued successfully",
      201
    );
  } catch (err: any) {
    console.error("[WhatsApp Campaigns POST] Error:", err);
    return NextResponse.json(
      { success: false, message: err?.message || "Failed to create campaign" },
      { status: 500 }
    );
  }
}

export const GET = withApiRoles(["ADMIN", "STAFF"], handleGET);
export const POST = withApiRoles(["ADMIN", "STAFF"], handlePOST);
