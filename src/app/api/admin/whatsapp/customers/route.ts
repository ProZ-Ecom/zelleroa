import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/prisma";
import { apiSuccess } from "@/lib/api/api-response";
import { withApiRoles } from "@/lib/api/api-handler";

async function handleGET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter") || "all"; // all, whatsapp_only, recent_buyers, with_orders
    const search = searchParams.get("search")?.trim() || "";

    // 1. Fetch customer profiles
    const customers = await db.customer_profiles.findMany({
      where: {
        is_active: true,
        ...(search
          ? {
              OR: [
                { name: { contains: search } },
                { phone: { contains: search } },
                { whatsapp_no: { contains: search } },
              ],
            }
          : {}),
      },
      include: {
        users_customer_profiles_user_idTousers: {
          select: {
            id: true,
            email: true,
            phone: true,
            name: true,
            orders: {
              select: {
                id: true,
                createdAt: true,
                totalAmount: true,
              },
              orderBy: { createdAt: "desc" },
            },
          },
        },
      },
      take: 500,
    });

    // 2. Format and calculate metrics
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const formatted = customers
      .map((c) => {
        const user = c.users_customer_profiles_user_idTousers;
        const orders = user?.orders || [];
        const rawPhone = c.whatsapp_no || c.phone || user?.phone || "";
        const cleanDigits = rawPhone.replace(/\D/g, "");
        const hasValidPhone = cleanDigits.length >= 10;
        const lastOrder = orders[0] || null;
        const isRecentBuyer = lastOrder ? new Date(lastOrder.createdAt) >= thirtyDaysAgo : false;

        return {
          id: String(c.id),
          name: c.name || user?.name || "Customer",
          email: c.email || user?.email || null,
          phone: rawPhone,
          cleanPhone: cleanDigits,
          isWhatsapp: Boolean(c.is_whatsapp || c.whatsapp_no || hasValidPhone),
          orderCount: orders.length,
          lastOrderDate: lastOrder?.createdAt || null,
          isRecentBuyer,
          isValidPhone: hasValidPhone,
        };
      })
      .filter((c) => c.isValidPhone);

    // Apply audience filter
    let filteredList = formatted;
    if (filter === "whatsapp_only") {
      filteredList = formatted.filter((c) => c.isWhatsapp);
    } else if (filter === "with_orders") {
      filteredList = formatted.filter((c) => c.orderCount > 0);
    } else if (filter === "recent_buyers") {
      filteredList = formatted.filter((c) => c.isRecentBuyer);
    }

    return apiSuccess({
      customers: filteredList,
      totalCount: formatted.length,
      filteredCount: filteredList.length,
    });
  } catch (err: any) {
    console.error("[WhatsApp Customers API] Error:", err);
    return NextResponse.json(
      { success: false, message: err?.message || "Failed to fetch customers" },
      { status: 500 }
    );
  }
}

export const GET = withApiRoles(["ADMIN", "STAFF"], handleGET);
