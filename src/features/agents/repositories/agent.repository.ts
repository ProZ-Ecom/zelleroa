import { db } from "@/lib/db/prisma";

export const agentRepository = {
  async findAgentById(agentId: bigint) {
    return db.user.findFirst({
      where: { id: agentId, role: { slug: "agent" } },
      select: { id: true, uuid: true, name: true, email: true, referral_code: true },
    });
  },

  async setReferralCode(agentId: bigint, code: string) {
    return db.user.update({
      where: { id: agentId },
      data: { referral_code: code },
    });
  },

  async countAttributedOrders(agentId: bigint) {
    return db.order.count({ where: { agent_id: agentId, is_active: true } });
  },

  async sumAttributedOrderValue(agentId: bigint) {
    const result = await db.order.aggregate({
      where: { agent_id: agentId, is_active: true },
      _sum: { totalAmount: true },
    });
    return Number(result._sum.totalAmount ?? 0);
  },

  async listAttributedOrders(agentId: bigint, page: number, limit: number) {
    return db.order.findMany({
      where: { agent_id: agentId, is_active: true },
      select: {
        uuid: true,
        orderNumber: true,
        totalAmount: true,
        order_status: true,
        payment_status: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });
  },
};
