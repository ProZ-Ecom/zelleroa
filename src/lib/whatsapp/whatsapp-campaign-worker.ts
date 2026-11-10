import path from "node:path";
import fs from "node:fs";
import { db } from "@/lib/db/prisma";
import { initWhatsAppClient } from "./whatsapp-client";
import { normalizePhoneNumber } from "./whatsapp-utils";

declare global {
  // eslint-disable-next-line no-var
  var __whatsapp_campaign_worker_running__: boolean | undefined;
  // eslint-disable-next-line no-var
  var __whatsapp_scheduler_interval__: NodeJS.Timeout | undefined;
}

/**
 * Replace placeholders like {{customer_name}} in the message template
 */
export function interpolateVariables(
  template: string,
  variables: {
    customer_name?: string | null;
    store_name?: string;
    [key: string]: string | null | undefined;
  }
): string {
  let result = template;
  const defaults: Record<string, string> = {
    customer_name: variables.customer_name || "Valued Customer",
    store_name: "Zellora",
  };

  for (const [k, v] of Object.entries(variables)) {
    if (v != null) {
      defaults[k] = v;
    }
  }

  for (const [key, val] of Object.entries(defaults)) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, "gi");
    result = result.replace(regex, val || "");
  }

  return result;
}

/**
 * Main background campaign loop - strictly sequential (1 recipient at a time)
 */
async function processActiveCampaigns() {
  if (globalThis.__whatsapp_campaign_worker_running__) {
    return;
  }

  globalThis.__whatsapp_campaign_worker_running__ = true;

  try {
    // 1. Find any campaign currently in RUNNING state
    const runningCampaign = await db.whatsAppCampaign.findFirst({
      where: { status: "RUNNING" },
      orderBy: { started_at: "asc" },
    });

    if (!runningCampaign) {
      globalThis.__whatsapp_campaign_worker_running__ = false;
      return;
    }

    // 2. Verify WhatsApp connection before processing
    const client = await initWhatsAppClient(false);
    if (!client.sock || client.status !== "CONNECTED") {
      console.warn(
        `[WhatsApp Worker] Connection not open. Auto-pausing campaign #${runningCampaign.id}`
      );
      await db.whatsAppCampaign.update({
        where: { id: runningCampaign.id },
        data: {
          status: "PAUSED",
        },
      });
      globalThis.__whatsapp_campaign_worker_running__ = false;
      return;
    }

    // 3. Pick the next queued recipient
    const recipient = await db.whatsAppCampaignRecipient.findFirst({
      where: {
        campaign_id: runningCampaign.id,
        status: "QUEUED",
      },
      orderBy: { id: "asc" },
    });

    if (!recipient) {
      // All recipients processed! Mark campaign as COMPLETED
      console.log(`[WhatsApp Worker] Campaign #${runningCampaign.id} complete!`);
      await db.whatsAppCampaign.update({
        where: { id: runningCampaign.id },
        data: {
          status: "COMPLETED",
          completed_at: new Date(),
        },
      });
      globalThis.__whatsapp_campaign_worker_running__ = false;

      // Trigger next campaign if any
      setImmediate(processActiveCampaigns);
      return;
    }

    // 4. Validate phone number format
    const norm = normalizePhoneNumber(recipient.phone_number);
    if (!norm.isValid) {
      console.warn(`[WhatsApp Worker] Recipient #${recipient.id} has invalid phone: "${recipient.phone_number}"`);
      await db.whatsAppCampaignRecipient.update({
        where: { id: recipient.id },
        data: {
          status: "FAILED",
          error_message: "Invalid phone number: missing or invalid Indian (+91) format",
        },
      });
      await db.whatsAppCampaign.update({
        where: { id: runningCampaign.id },
        data: { failed_count: { increment: 1 } },
      });
      setImmediate(processActiveCampaigns);
      return;
    }

    // 5. Mark recipient as SENDING
    await db.whatsAppCampaignRecipient.update({
      where: { id: recipient.id },
      data: { status: "SENDING" },
    });

    // 6. Build personalized message
    const personalizedMessage = interpolateVariables(runningCampaign.message, {
      customer_name: recipient.customer_name,
    });

    const jid = `${norm.digits}@s.whatsapp.net`;

    let sendSuccess = false;
    let messageId: string | undefined = undefined;
    let errorMessage: string | undefined = undefined;

    try {
      // Human typing simulation (1.5s)
      try {
        await client.sock.sendPresenceUpdate("composing", jid);
      } catch {
        // Ignore presence failures
      }

      // Safe jitter delay (2.5s - 4.5s)
      const jitterDelay = Math.floor(Math.random() * 2000) + 2500;
      await new Promise((r) => setTimeout(r, jitterDelay));

      // Check for image attachment
      if (runningCampaign.media_url) {
        let mediaTarget = runningCampaign.media_url;
        // If local relative file path like /document/... or /uploads/...
        if (mediaTarget.startsWith("/") && !mediaTarget.startsWith("http")) {
          const localPath = path.join(process.cwd(), mediaTarget);
          if (fs.existsSync(localPath)) {
            mediaTarget = localPath;
          }
        }

        const res = await client.sock.sendMessage(jid, {
          image: { url: mediaTarget },
          caption: personalizedMessage,
        });
        sendSuccess = true;
        messageId = res?.key?.id || undefined;
      } else {
        // Pure text message
        const res = await client.sock.sendMessage(jid, {
          text: personalizedMessage,
        });
        sendSuccess = true;
        messageId = res?.key?.id || undefined;
      }

      try {
        await client.sock.sendPresenceUpdate("paused", jid);
      } catch {
        // Ignore presence failures
      }
    } catch (sendErr: unknown) {
      console.error(`[WhatsApp Worker] Send error for ${recipient.phone_number}:`, sendErr);
      sendSuccess = false;
      const sendErrorObj = sendErr as { message?: string; output?: { statusCode?: number } };
      errorMessage = sendErrorObj?.message || "WhatsApp delivery failed";

      // If socket dropped completely, pause campaign
      if (
        sendErrorObj?.message?.includes("Closed") ||
        sendErrorObj?.output?.statusCode === 428 ||
        sendErrorObj?.output?.statusCode === 440
      ) {
        console.warn("[WhatsApp Worker] Socket closed during send. Pausing campaign.");
        await db.whatsAppCampaign.update({
          where: { id: runningCampaign.id },
          data: { status: "PAUSED" },
        });
      }
    }

    // 6. Update recipient and campaign counters in database
    if (sendSuccess) {
      await db.whatsAppCampaignRecipient.update({
        where: { id: recipient.id },
        data: {
          status: "SENT",
          sent_at: new Date(),
          message_id: messageId,
        },
      });

      await db.whatsAppCampaign.update({
        where: { id: runningCampaign.id },
        data: {
          sent_count: { increment: 1 },
        },
      });
    } else {
      await db.whatsAppCampaignRecipient.update({
        where: { id: recipient.id },
        data: {
          status: "FAILED",
          error_message: errorMessage,
        },
      });

      await db.whatsAppCampaign.update({
        where: { id: runningCampaign.id },
        data: {
          failed_count: { increment: 1 },
        },
      });
    }
  } catch (workerErr) {
    console.error("[WhatsApp Worker] Unexpected worker error:", workerErr);
  } finally {
    globalThis.__whatsapp_campaign_worker_running__ = false;

    // Check if campaign is still RUNNING and schedule next recipient
    const stillRunning = await db.whatsAppCampaign.findFirst({
      where: { status: "RUNNING" },
      select: { id: true },
    });

    if (stillRunning) {
      // Natural breath between customers: 1.5s
      setTimeout(processActiveCampaigns, 1500);
    }
  }
}

function isBuildTime(): boolean {
  return (
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.npm_lifecycle_event === "build" ||
    Boolean(process.env.NEXT_IS_EXPORT) ||
    Boolean(process.env.CI && process.env.NODE_ENV === "production" && !process.env.PORT)
  );
}

/**
 * Scheduler Tick - Checks scheduled campaigns and starts them at due date/time
 */
export async function tickCampaignScheduler() {
  if (isBuildTime()) return;

  try {
    const now = new Date();
    const dueCampaigns = await db.whatsAppCampaign.findMany({
      where: {
        status: "SCHEDULED",
        scheduled_at: { lte: now },
      },
      select: { id: true },
    });

    for (const camp of dueCampaigns) {
      console.log(`[WhatsApp Scheduler] Launching due campaign #${camp.id}`);
      await db.whatsAppCampaign.update({
        where: { id: camp.id },
        data: {
          status: "RUNNING",
          started_at: now,
        },
      });
    }

    if (dueCampaigns.length > 0) {
      triggerWorker();
    }
  } catch (schedErr: unknown) {
    const errObj = schedErr as { code?: string; meta?: { driverAdapterError?: { message?: string } }; message?: string };
    if (errObj?.code === "P2021" || errObj?.meta?.driverAdapterError?.message?.includes("TableDoesNotExist")) {
      // Table doesn't exist in the database yet
      return;
    }
    console.error("[WhatsApp Scheduler] Tick error:", errObj?.message || schedErr);
  }
}

/**
 * Trigger worker manually (e.g. after clicking 'Send Now' or 'Resume')
 */
export function triggerWorker() {
  if (typeof window === "undefined" && !isBuildTime()) {
    if (!globalThis.__whatsapp_scheduler_interval__) {
      globalThis.__whatsapp_scheduler_interval__ = setInterval(tickCampaignScheduler, 15000);
    }
    setImmediate(processActiveCampaigns);
  }
}

// Ensure scheduler is active in Node server process (only during live runtime, not build time)
if (typeof window === "undefined" && !isBuildTime() && !globalThis.__whatsapp_scheduler_interval__) {
  globalThis.__whatsapp_scheduler_interval__ = setInterval(tickCampaignScheduler, 15000);
}

