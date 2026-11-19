import { agentService } from "@/features/agents/services/agent.service";
import { payoutService } from "@/features/agents/services/payout.service";
import { requireAgentPage } from "@/features/agents/lib/page-context";
import { RequestPayoutForm } from "@/features/agents/components/RequestPayoutForm";
import { Panel } from "@/features/agents/components/shared";
import { AgentPayoutHistorySection } from "./AgentPayoutHistorySection";

export const metadata = { title: "Payouts" };

export default async function AgentPayoutsPage() {
  const { agentId } = await requireAgentPage("/agent/payouts");

  const [balance, profile] = await Promise.all([
    payoutService.availableBalance(agentId),
    agentService.getProfile(agentId),
  ]);

  const p = profile.payment;
  const bankSummary = p.hasBank ? `${p.bankName} · ${p.accountNumberMasked}` : null;

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Payouts</h1>
        <p className="text-sm text-neutral-500">Request a payout of your approved commission. Every payout is reviewed by the admin before it is paid.</p>
      </div>

      <Panel title="Request payout">
        <RequestPayoutForm
          amount={balance.amount}
          commissionCount={balance.count}
          hasUpi={p.hasUpi}
          hasBank={p.hasBank}
          preferredMethod={p.preferredMethod}
          upiId={p.upiId}
          bankSummary={bankSummary}
        />
      </Panel>

      <AgentPayoutHistorySection />
    </>
  );
}
