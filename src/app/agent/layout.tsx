import { AgentShell } from "@/features/agents/components/AgentNav";
import { agentProfileService } from "@/features/agents/services/agent-profile.service";
import { requireAgentPage } from "@/features/agents/lib/page-context";

export const dynamic = "force-dynamic";

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  const agent = await requireAgentPage();
  const { completion } = await agentProfileService.get(agent.agentId);

  return (
    <AgentShell name={agent.name} completionPercent={completion.percent}>
      {children}
    </AgentShell>
  );
}
