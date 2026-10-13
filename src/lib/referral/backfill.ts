import { allocateReferralCode, generateReferralCode, isGeneratedReferralCode } from "./code";

export interface BackfillStore {
  /** Agents (id + current users.referral_code) in id order, after `afterId`. */
  agents(afterId: bigint, limit: number): Promise<{ id: bigint; referralCode: string | null }[]>;
  codeExists(code: string): Promise<boolean>;
  setCode(agentId: bigint, newCode: string, previousCode: string | null): Promise<boolean>;
}

/**
 * Gives every agent without a generated `ZEL-` code one. Safe to re-run: agents that already
 * have one are skipped, so codes never change after the first run. Only `users.referral_code`
 * is written; orders/commissions keep the code snapshot they were created with.
 */
export async function backfillAgentReferralCodes(
  store: BackfillStore,
  opts: { dryRun?: boolean; generate?: () => string } = {}
) {
  const result = { scanned: 0, updated: 0, skipped: 0 };
  let after = BigInt(0);
  for (;;) {
    const page = await store.agents(after, 200);
    if (page.length === 0) break;
    for (const agent of page) {
      after = agent.id;
      result.scanned++;
      if (isGeneratedReferralCode(agent.referralCode)) {
        result.skipped++;
        continue;
      }
      if (opts.dryRun) {
        result.updated++;
        continue;
      }
      const code = await allocateReferralCode((c) => store.codeExists(c), opts.generate ?? generateReferralCode);
      // Conditional on the old value, so a concurrent change is never clobbered.
      if (await store.setCode(agent.id, code, agent.referralCode)) result.updated++;
      else result.skipped++;
    }
  }
  return result;
}
