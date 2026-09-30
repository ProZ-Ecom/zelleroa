import { agentService } from "@/features/agents/services/agent.service";
import { requireAgentPage } from "@/features/agents/lib/page-context";
import { PaymentDetailsForm } from "@/features/agents/components/PaymentDetailsForm";
import { ReferralLinkCard } from "@/features/agents/components/ReferralLinkCard";
import { Panel, dateOnly } from "@/features/agents/components/shared";

export const metadata = { title: "Profile & Payment Details" };

export default async function AgentProfilePage() {
  const { agentId } = await requireAgentPage("/agent/profile");
  const profile = await agentService.getProfile(agentId);

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Profile &amp; Payment Details</h1>
        <p className="text-sm text-neutral-500">Your account details and where your payouts are sent.</p>
      </div>

      <Panel title="Your profile">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 p-4 text-sm sm:grid-cols-2 sm:p-5">
          {[
            ["Name", profile.name],
            ["Sales Partner ID", profile.agentCode ?? "—"],
            ["Email", profile.email ?? "—"],
            ["Phone", profile.phone ?? "—"],
            ["Member since", dateOnly(profile.createdAt)],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-medium text-neutral-500">{label}</dt>
              <dd className="font-medium text-neutral-900">{value}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      {profile.referralCode && profile.referralLink && (
        <ReferralLinkCard referralCode={profile.referralCode} referralLink={profile.referralLink} />
      )}

      <Panel title="Payment details">
        <PaymentDetailsForm payment={profile.payment} />
        <p className="border-t border-neutral-100 px-4 py-3 text-xs text-neutral-500 sm:px-5">
          Your account number is stored encrypted and is only shown masked. It is snapshotted onto a payout when you request one, so
          later changes here never affect a payout already in progress.
        </p>
      </Panel>
    </>
  );
}
