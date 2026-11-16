import type { Metadata } from "next";
import { AgentShell } from "@/features/agents/components/AgentNav";
import { getAgentProfileDetails, requireAgentPage } from "@/features/agents/lib/page-context";
import { constructMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = constructMetadata({
  title: "Sales Partner Portal",
  noIndex: true,
});

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  const agent = await requireAgentPage();
  const { completion } = await getAgentProfileDetails(agent.agentId);

  return (
    <AgentShell name={agent.name} completionPercent={completion.percent}>
      {children}
    </AgentShell>
  );
}
