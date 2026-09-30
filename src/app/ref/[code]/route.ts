import { NextRequest, NextResponse } from "next/server";
import { REFERRAL_CODE_PATTERN, setReferralCookie } from "@/lib/referral/cookie";

/**
 * Short referral link: /ref/AGT001 stores the agent code in the referral cookie
 * and lands the visitor on the storefront. Same effect as /?ref=AGT001.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const response = NextResponse.redirect(new URL("/", request.url));
  if (REFERRAL_CODE_PATTERN.test(code)) setReferralCookie(response, code);
  return response;
}
