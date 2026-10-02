import { agentService } from "@/features/agents/services/agent.service";
import { agentProfileService } from "@/features/agents/services/agent-profile.service";
import { requireAgentPage, pickParams } from "@/features/agents/lib/page-context";
import { PaymentDetailsForm } from "@/features/agents/components/PaymentDetailsForm";
import { ProfileWizard } from "@/features/agents/components/ProfileWizard";
import { ReferralLinkCard } from "@/features/agents/components/ReferralLinkCard";
import { PageHeader, Panel } from "@/features/agents/components/shared";

export const metadata = { title: "My Profile" };

export default async function AgentProfilePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { agentId } = await requireAgentPage("/agent/profile");
  const { step } = pickParams(await searchParams, ["step"]);
  const [profile, details] = await Promise.all([agentService.getProfile(agentId), agentProfileService.get(agentId)]);

  return (
    <>
      <PageHeader title="My Profile" description="Complete your profile step by step – you can save a draft and continue later." />

      <ProfileWizard initial={details} initialStep={step} />

      {profile.referralCode && profile.referralLink && (
        <ReferralLinkCard referralCode={profile.referralCode} referralLink={profile.referralLink} />
      )}

      <Panel title="Payout method (UPI / bank transfer)">
        <PaymentDetailsForm payment={profile.payment} />
        <p className="border-t border-neutral-100 px-4 py-3 text-xs text-neutral-500 sm:px-5">
          Used when you request a payout. Your account number is stored encrypted and only shown masked. It is snapshotted onto a payout when
          you request one, so later changes here never affect a payout already in progress. Changing bank details sends them for admin
          verification again.
        </p>
      </Panel>
    </>
  );
}
