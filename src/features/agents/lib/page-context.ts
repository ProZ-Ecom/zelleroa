import { redirect } from "next/navigation";
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

  try {
    return await agentService.requireAgentContext(user.id);
  } catch {
    // Deactivated or removed since the token was issued.
    redirect("/unauthorized");
  }
}

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
