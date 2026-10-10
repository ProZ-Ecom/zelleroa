import { agentService } from "@/features/agents/services/agent.service";
import { getAgentProfileDetails, requireAgentPage, pickParams } from "@/features/agents/lib/page-context";
import { PaymentDetailsForm } from "@/features/agents/components/PaymentDetailsForm";
import { AccountQuickLinks } from "@/features/agents/components/AccountQuickLinks";
import { ProfileWizard } from "@/features/agents/components/ProfileWizard";
import { CollapsiblePanel, PageHeader } from "@/features/agents/components/shared";

export const metadata = { title: "My Profile" };

export default async function AgentProfilePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { agentId } = await requireAgentPage("/agent/profile");
  const { step } = pickParams(await searchParams, ["step"]);
  const [profile, details] = await Promise.all([agentService.getProfile(agentId), getAgentProfileDetails(agentId)]);

  return (
    <>
      <PageHeader title="My Profile" description="Complete your profile step by step – you can save a draft and continue later." />

      <AccountQuickLinks kycStatus={details.kyc.status} bankStatus={details.bank.status} />

      <ProfileWizard initial={details} initialStep={step} />

      {/* Open only until a payout method exists; the referral link lives on the dashboard. */}
      <CollapsiblePanel title="Payout method (UPI / bank transfer)" defaultOpen={!profile.payment.hasUpi && !profile.payment.hasBank}>
        <PaymentDetailsForm payment={profile.payment} />
        <p className="border-t border-neutral-100 px-4 py-3 text-xs text-neutral-500 sm:px-5">
          Used when you request a payout. Your account number is stored encrypted and only shown masked. It is snapshotted onto a payout when
          you request one, so later changes here never affect a payout already in progress. Changing bank details sends them for admin
          verification again.
        </p>
      </CollapsiblePanel>
    </>
  );
}
