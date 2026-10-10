import { NextRequest, NextResponse } from "next/server";
import { safeLandingPath, setReferralCookie } from "./cookie";
import { findAgentByReferralCode } from "@/features/agents/services/referral.service";

type Resolve = typeof findAgentByReferralCode;

/**
 * Referral landing: /ref/ZEL-A7K9P2 (also the target of `/?ref=` links, via middleware).
 * The code is checked against a live agent on the server and the cookie is written only when
 * it is valid - an unknown/disabled/deleted code is ignored and never replaces an existing
 * attribution. Either way the visitor lands on the page they asked for (`to`, default "/").
 */
export async function handleReferralLanding(request: NextRequest, code: string, resolve: Resolve = findAgentByReferralCode) {
  const to = safeLandingPath(request.nextUrl.searchParams.get("to"));
  const response = NextResponse.redirect(new URL(to, request.url));
  const agent = await resolve(code);
  if (agent) setReferralCookie(response, agent.referralCode);
  return response;
}
