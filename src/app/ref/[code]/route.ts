import { NextRequest } from "next/server";
import { handleReferralLanding } from "@/lib/referral/landing";

export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return handleReferralLanding(request, code);
}
