import { AgentShell } from "@/features/agents/components/AgentNav";
import { requireAgentPage } from "@/features/agents/lib/page-context";

export const dynamic = "force-dynamic";

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  const agent = await requireAgentPage();

  return <AgentShell name={agent.name}>{children}</AgentShell>;
}
