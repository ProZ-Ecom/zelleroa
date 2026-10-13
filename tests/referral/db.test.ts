import { test, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "@/lib/db/prisma";
import { findAgentByReferralCode, referralService } from "@/features/agents/services/referral.service";
import { customerAssignmentService } from "@/features/agents/services/customer-assignment.service";
import { allocateReferralCode } from "@/lib/referral/code";
import { backfillAgentReferralCodes } from "@/lib/referral/backfill";
import { inRollback, makeUser } from "./helpers";

// These run against the local dev DB inside transactions that are always rolled back.
after(() => db.$disconnect());

test("DB: duplicate referral codes are rejected by the UNIQUE index", () =>
  inRollback(async (tx) => {
    await makeUser(tx, "agent", { referral_code: "ZEL-DUPTST" });
    await assert.rejects(makeUser(tx, "agent", { referral_code: "ZEL-DUPTST" }), (e: { code?: string }) => e.code === "P2002");
  }));

test("DB: new agents get distinct random codes", () =>
  inRollback(async (tx) => {
    const free = async (c: string) => (await tx.user.count({ where: { referral_code: c } })) > 0;
    const u1 = await makeUser(tx, "agent", { referral_code: await allocateReferralCode(free) });
    const u2 = await makeUser(tx, "agent", { referral_code: await allocateReferralCode(free) });
    assert.notEqual(u1.referral_code, u2.referral_code);
    assert.match(u1.referral_code!, /^ZEL-/);
  }));

test("DB: valid code identifies the agent; invalid / disabled / deleted / customer codes are rejected", () =>
  inRollback(async (tx) => {
    const ok = await makeUser(tx, "agent", { referral_code: "ZEL-OKAGT2" });
    await makeUser(tx, "agent", { referral_code: "ZEL-OFFAGT", is_active: false, status: "banned" });
    await makeUser(tx, "agent", { referral_code: "ZEL-DELAGT", deleted_at: new Date() });
    await makeUser(tx, "customer", { referral_code: "ZEL-CUSTMR" });

    const hit = await findAgentByReferralCode("zel-okagt2", tx); // case-insensitive
    assert.equal(hit?.id, ok.id);
    assert.equal(hit?.referralCode, "ZEL-OKAGT2");
    for (const code of ["ZEL-OFFAGT", "ZEL-DELAGT", "ZEL-CUSTMR", "ZEL-NOPE22", "", null, "x' OR '1'='1", "ZEL-OKAGT2' --"]) {
      assert.equal(await findAgentByReferralCode(code, tx), null, String(code));
    }
  }));

test("DB: legacy AGT codes keep working unless REFERRAL_ACCEPT_LEGACY_CODES=false", () =>
  inRollback(async (tx) => {
    const agent = await makeUser(tx, "agent", { referral_code: "ZEL-LEGAC2" });
    await tx.agent_profiles.create({ data: { user_id: agent.id, agent_code: "AGT9T1" } });
    const hit = await findAgentByReferralCode("AGT9T1", tx);
    assert.equal(hit?.referralCode, "ZEL-LEGAC2"); // cookie is upgraded to the new code
    process.env.REFERRAL_ACCEPT_LEGACY_CODES = "false";
    try {
      assert.equal(await findAgentByReferralCode("AGT9T1", tx), null);
      assert.equal((await findAgentByReferralCode("ZEL-LEGAC2", tx))?.id, agent.id);
    } finally {
      delete process.env.REFERRAL_ACCEPT_LEGACY_CODES;
    }
  }));

test("DB: backfill upgrades existing agents without touching their other data", () =>
  inRollback(async (tx) => {
    const old = await makeUser(tx, "agent", { referral_code: "AGT9T2", phone: "9000000001" });
    const fresh = await makeUser(tx, "agent", { referral_code: "ZEL-KEEP22" });
    await tx.agent_profiles.create({ data: { user_id: old.id, agent_code: "AGT9T2", notes: "keep me" } });
    const store = {
      agents: async (afterId: bigint, limit: number) =>
        (
          await tx.user.findMany({
            where: { id: { in: [old.id, fresh.id], gt: afterId } },
            orderBy: { id: "asc" },
            take: limit,
            select: { id: true, referral_code: true },
          })
        ).map((r) => ({ id: r.id, referralCode: r.referral_code })),
      codeExists: async (c: string) => (await tx.user.count({ where: { referral_code: c } })) > 0,
      setCode: async (id: bigint, code: string, prev: string | null) =>
        (await tx.user.updateMany({ where: { id, referral_code: prev }, data: { referral_code: code } })).count === 1,
    };
    await backfillAgentReferralCodes(store);
    const after1 = await tx.user.findUniqueOrThrow({ where: { id: old.id }, include: { agent_profile: true } });
    assert.match(after1.referral_code!, /^ZEL-/);
    assert.equal(after1.phone, "9000000001");
    assert.equal(after1.agent_profile?.notes, "keep me");
    assert.equal(after1.agent_profile?.agent_code, "AGT9T2");
    assert.equal((await tx.user.findUniqueOrThrow({ where: { id: fresh.id } })).referral_code, "ZEL-KEEP22");
    await backfillAgentReferralCodes(store); // re-run: codes stay stable
    assert.equal((await tx.user.findUniqueOrThrow({ where: { id: old.id } })).referral_code, after1.referral_code);
  }));

test("DB: a referral code never reassigns an already-assigned customer; an empty slot is filled once", () =>
  inRollback(async (tx) => {
    const a1 = await makeUser(tx, "agent", { referral_code: "ZEL-AGNT11" });
    await makeUser(tx, "agent", { referral_code: "ZEL-AGNT22" });
    const cust = await makeUser(tx, "customer");
    const current = async () => (await tx.user.findUniqueOrThrow({ where: { id: cust.id } })).current_agent_id;

    assert.equal(await customerAssignmentService.assignFromReferralCode(cust.id, "ZEL-AGNT11", tx), a1.id);
    assert.equal(await customerAssignmentService.assignFromReferralCode(cust.id, "ZEL-AGNT22", tx), a1.id);
    assert.equal(await current(), a1.id);
    assert.equal(await customerAssignmentService.assignFromReferralCode(cust.id, "ZEL-NOPE22", tx), null);
    assert.equal(await current(), a1.id);
  }));

test("DB: orders are attributed from the validated code only; self-referral and bogus codes earn nothing", () =>
  inRollback(async (tx) => {
    const agent = await makeUser(tx, "agent", { referral_code: "ZEL-ORDAG2" });
    const cust = await makeUser(tx, "customer");
    const mk = (v?: string) => ({ cookies: { get: () => (v ? { value: v } : undefined) } }) as never;
    assert.equal((await referralService.resolveForOrder(cust.id, mk("ZEL-ORDAG2"), tx))?.id, agent.id);
    assert.equal(await referralService.resolveForOrder(cust.id, mk("ZEL-FORGED"), tx), null);
    assert.equal(await referralService.resolveForOrder(agent.id, mk("ZEL-ORDAG2"), tx), null);
    assert.equal(await referralService.resolveForOrder(cust.id, mk(), tx), null);
  }));

test("Authorization: only an admin can transfer customers", async () => {
  for (const role of ["CUSTOMER", "AGENT", "STAFF"] as const) {
    await assert.rejects(
      customerAssignmentService.transferCustomer({ customerRef: "1", toAgentRef: "2" }, { id: BigInt(5), role } as never),
      /Only an admin/
    );
  }
  await assert.rejects(
    customerAssignmentService.transferCustomer({ customerRef: "1", toAgentRef: "2" }, { id: null, role: "ADMIN" } as never),
    /Only an admin/
  );
});
