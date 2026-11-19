import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/prisma";
import { apiSuccess, apiError } from "@/lib/api/api-response";
import { withApiRoles } from "@/lib/api/api-handler";

const INITIAL_TEMPLATES = [
  {
    name: "Festive Season 20% Special Offer",
    category: "FESTIVAL",
    message:
      "Namaste {{customer_name}}! ✨\n\nCelebrate this season with exquisite designer wear and luxury timepieces from *Zellora*! ❤️\n\nEnjoy an exclusive *20% OFF* on all evening dresses and watches using coupon code *ZELLORA20* at checkout.\n\nShop the collection today: zellora.com 👗⌚",
  },
  {
    name: "Festive Luxe Gift Box",
    category: "FESTIVAL",
    message:
      "Hello {{customer_name}}! 🎁\n\nTreat someone special to Zellora bespoke ethnic wear and handcrafted leather bags.\n\nComplimentary luxury gift wrapping on orders above ₹1999! ✨",
  },
  {
    name: "Weekend Flash Sale",
    category: "OFFER",
    message:
      "Hello {{customer_name}}! ⚡\n\nLooking for the perfect weekend look? We've got you covered!\n\nFlat 15% off on our relaxed linen shirts & denim collection this Saturday & Sunday only. Don't miss out! ✨",
  },
  {
    name: "New Collection Drop",
    category: "PROMOTION",
    message:
      "Exciting news {{customer_name}}! 🌟\n\nWe just launched our all-new *AeroChrono Sapphire Watch* & *Emerald Silk Evening Gown*!\n\nBe among the first to explore the new drop with an introductory 15% discount. Discover luxury! ❤️",
  },
];

async function handleGET() {
  try {
    let templates = await db.whatsAppTemplate.findMany({
      where: { is_active: true },
      orderBy: { created_at: "desc" },
    });

    // Seed default festive templates if table is empty
    if (templates.length === 0) {
      await db.whatsAppTemplate.createMany({
        data: INITIAL_TEMPLATES,
      });

      templates = await db.whatsAppTemplate.findMany({
        where: { is_active: true },
        orderBy: { created_at: "desc" },
      });
    }

    const serialized = templates.map((t) => ({
      ...t,
      id: String(t.id),
    }));

    return apiSuccess(serialized);
  } catch (err: any) {
    console.error("[WhatsApp Templates GET] Error:", err);
    return NextResponse.json(
      { success: false, message: err?.message || "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

async function handlePOST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, category, message, media_url } = body || {};

    if (!name || typeof name !== "string") {
      return apiError("Template name is required", 400);
    }
    if (!message || typeof message !== "string") {
      return apiError("Template message content is required", 400);
    }

    const template = await db.whatsAppTemplate.create({
      data: {
        name: name.trim(),
        category: category || "CUSTOM",
        message: message.trim(),
        media_url: media_url || null,
        is_active: true,
      },
    });

    return apiSuccess(
      {
        ...template,
        id: String(template.id),
      },
      "Template created successfully",
      201
    );
  } catch (err: any) {
    console.error("[WhatsApp Templates POST] Error:", err);
    return NextResponse.json(
      { success: false, message: err?.message || "Failed to create template" },
      { status: 500 }
    );
  }
}

export const GET = withApiRoles(["ADMIN", "STAFF"], handleGET);
export const POST = withApiRoles(["ADMIN", "STAFF"], handlePOST);
