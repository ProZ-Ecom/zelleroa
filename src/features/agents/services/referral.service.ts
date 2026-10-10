import type { NextRequest } from "next/server";
import type { Prisma } from "@/generated/prisma";
import { db } from "@/lib/db/prisma";
import { REFERRAL_AGENT_COOKIE, REFERRAL_CODE_PATTERN } from "@/lib/referral/cookie";
import { isGeneratedReferralCode } from "@/lib/referral/code";

type Client = Prisma.TransactionClient | typeof db;

export interface ReferralAgent {
  id: bigint;
  name: string;
  agentCode: string | null;
  referralCode: string;
}

/**
 * Pre-`ZEL-` links carry the sequential agent code (AGT001) and are already shared in the wild, so
 * they keep resolving unless `REFERRAL_ACCEPT_LEGACY_CODES=false`. Once agents have re-shared their
 * new links, turning that off removes the guessable codes entirely.
 */
const acceptLegacyCodes = () => process.env.REFERRAL_ACCEPT_LEGACY_CODES !== "false";

/** Looks a public referral code up. Only active AGENT users can be credited. */
export async function findAgentByReferralCode(
  code: string | null | undefined,
  client: Client = db
): Promise<ReferralAgent | null> {
  const raw = (code ?? "").trim();
  if (!REFERRAL_CODE_PATTERN.test(raw)) return null;
  const upper = raw.toUpperCase();
  const clean = isGeneratedReferralCode(upper) ? upper : raw;
  const legacy = acceptLegacyCodes() && !isGeneratedReferralCode(upper);

  const agent = await client.user.findFirst({
    where: {
      is_active: true,
      status: "active",
      deleted_at: null,
      role: { slug: "agent" },
      OR: legacy ? [{ referral_code: clean }, { agent_profile: { agent_code: clean } }] : [{ referral_code: clean }],
    },
    select: { id: true, name: true, referral_code: true, agent_profile: { select: { agent_code: true } } },
  });
  if (!agent) return null;
  return {
    id: agent.id,
    name: agent.name,
    agentCode: agent.agent_profile?.agent_code ?? null,
    referralCode: agent.referral_code ?? clean,
  };
}

/**
 * The referral that applies to the order being placed RIGHT NOW.
 *
 * Attribution is per order: it comes only from the referral code the visitor
 * currently carries (the `referral_agent` cookie, last link/code wins) and is
 * validated on the spot. Nothing about the customer's earlier orders, agents
 * or account is consulted, so a customer can use a different agent each time.
 * No / invalid / inactive code -> null, and the order simply has no commission.
 */
export const referralService = {
  async resolveForOrder(
    customerId: bigint,
    request?: NextRequest | null,
    client: Client = db
  ): Promise<ReferralAgent | null> {
    const code = request?.cookies.get(REFERRAL_AGENT_COOKIE)?.value;
    const agent = await findAgentByReferralCode(code, client);
    // An agent is never credited for their own purchases.
    if (!agent || agent.id === customerId) return null;
    return agent;
  },
};
