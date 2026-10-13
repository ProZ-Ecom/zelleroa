import { cache } from "react";
import { redirect } from "next/navigation";
import { agentProfileService } from "../services/agent-profile.service";
import { getPageSessionUser } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/constants";
import { agentService } from "../services/agent.service";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Resolves the signed-in agent for a Server Component page. The agent id comes
 * only from the session - page query params can never change whose data is shown.
 */
export async function requireAgentPage(callbackUrl = "/agent/dashboard") {
  const user = await getPageSessionUser();
  if (!user) redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  if (user.role !== ROLES.AGENT) redirect("/unauthorized");

  const agent = await resolveAgentContext(user.id);
  if (!agent) redirect("/unauthorized");
  return agent;
}

// Layout and page both resolve the agent in the same request; cache() makes that one DB lookup.
const resolveAgentContext = cache(async (userId: string) => {
  try {
    return await agentService.requireAgentContext(userId);
  } catch {
    // Deactivated or removed since the token was issued.
    return null;
  }
});

/** Per-request memoised profile (layout + dashboard both need the completion figures). */
export const getAgentProfileDetails = cache((agentId: bigint) => agentProfileService.get(agentId));

/** First value of each whitelisted query param, trimmed. */
export function pickParams(sp: SearchParams, keys: string[]) {
  const out: Record<string, string | undefined> = {};
  for (const key of keys) {
    const raw = sp[key];
    const value = (Array.isArray(raw) ? raw[0] : raw)?.trim();
    out[key] = value ? value.slice(0, 100) : undefined;
  }
  return out;
}

export function pageParam(sp: SearchParams) {
  const raw = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
}
