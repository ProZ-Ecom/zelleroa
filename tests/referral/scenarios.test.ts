import { test, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/prisma";
import { customerAssignmentService as svc } from "@/features/agents/services/customer-assignment.service";
import { clearReferralCookie, setReferralCookie, referralCookieMaxAge, REFERRAL_AGENT_COOKIE } from "@/lib/referral/cookie";
import { handleReferralLanding } from "@/lib/referral/landing";
import { findAgentByReferralCode } from "@/features/agents/services/referral.service";
import { inRollback, makeUser } from "./helpers";

after(() => db.$disconnect());

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

/**
 * A browser cookie jar driven by the SAME building blocks the routes use:
 *  /ref landing -> handleReferralLanding; login/register -> assignFromReferralCode + clearReferralCookie;
 *  logout -> clearReferralCookie. Applying a Set-Cookie response to the jar mirrors what a browser does.
 */
function browser(tx: Tx) {
  const jar = new Map<string, string>();
  const apply = (res: NextResponse) => {
    for (const c of res.cookies.getAll()) {
      if (c.value === "") jar.delete(c.name);
      else jar.set(c.name, c.value);
    }
  };
  const ref = () => jar.get(REFERRAL_AGENT_COOKIE);
  return {
    ref,
    async openLink(code: string) {
      const r = await handleReferralLanding(
        new NextRequest(new URL(`/ref/${code}`, "http://localhost:3000")),
        code,
        (c) => findAgentByReferralCode(c, tx)
      );
      apply(r as NextResponse);
    },
    /** login + register route behaviour: assign from the pending cookie (empty slot only), then consume it. */
    async authenticate(userId: bigint) {
      const had = ref();
      if (had) await svc.assignFromReferralCode(userId, had, tx);
      if (had !== undefined) apply(clearReferralCookie(NextResponse.json({})));
    },
    logout: () => apply(clearReferralCookie(NextResponse.json({}))),
  };
}
const agentOf = async (tx: Tx, id: bigint) => (await tx.user.findUniqueOrThrow({ where: { id } })).current_agent_id;

test("Scenario A: Account B logging in without a link is NOT given Account A's agent", () =>
  inRollback(async (tx) => {
    const agentA = await makeUser(tx, "agent", { referral_code: "ZEL-SCNAA1" });
    const a = await makeUser(tx, "customer");
    const b = await makeUser(tx, "customer");
    const br = browser(tx);
    await br.openLink("ZEL-SCNAA1");
    assert.equal(br.ref(), "ZEL-SCNAA1");
    await br.authenticate(a.id); // register A
    assert.equal(await agentOf(tx, a.id), agentA.id);
    assert.equal(br.ref(), undefined, "referral consumed by registration");
    br.logout();
    await br.authenticate(b.id); // direct login, no link
    assert.equal(await agentOf(tx, b.id), null);
    assert.equal(await agentOf(tx, a.id), agentA.id);
  }));

test("Scenario A': logout alone also drops an unused pending referral", () =>
  inRollback(async (tx) => {
    await makeUser(tx, "agent", { referral_code: "ZEL-SCNAB1" });
    const b = await makeUser(tx, "customer");
    const br = browser(tx);
    await br.openLink("ZEL-SCNAB1");
    br.logout();
    await br.authenticate(b.id);
    assert.equal(await agentOf(tx, b.id), null);
  }));

test("Scenario B: unassigned Account B via Agent B's link gets Agent B; Account A keeps Agent A", () =>
  inRollback(async (tx) => {
    const agentA = await makeUser(tx, "agent", { referral_code: "ZEL-SCNBA1" });
    const agentB = await makeUser(tx, "agent", { referral_code: "ZEL-SCNBB1" });
    const a = await makeUser(tx, "customer");
    const b = await makeUser(tx, "customer");
    const br = browser(tx);
    await br.openLink("ZEL-SCNBA1");
    await br.authenticate(a.id);
    br.logout();
    await br.openLink("ZEL-SCNBB1");
    await br.authenticate(b.id);
    assert.equal(await agentOf(tx, b.id), agentB.id);
    assert.equal(await agentOf(tx, a.id), agentA.id);
  }));

test("Scenario C: assigned Account A after Agent B's link keeps Agent A, across repeated logout/login", () =>
  inRollback(async (tx) => {
    const agentA = await makeUser(tx, "agent", { referral_code: "ZEL-SCNCA1" });
    await makeUser(tx, "agent", { referral_code: "ZEL-SCNCB1" });
    const a = await makeUser(tx, "customer", { current_agent_id: agentA.id });
    const br = browser(tx);
    br.logout();
    await br.openLink("ZEL-SCNCB1");
    await br.authenticate(a.id);
    assert.equal(await agentOf(tx, a.id), agentA.id);
    for (let i = 0; i < 3; i++) {
      await br.openLink("ZEL-SCNCB1");
      br.logout();
      await br.authenticate(a.id);
    }
    assert.equal(await agentOf(tx, a.id), agentA.id);
    assert.equal(await tx.customer_agent_history.count({ where: { customer_id: a.id } }), 0);
  }));

test("invalid / inactive codes never set a cookie and never replace a valid one", () =>
  inRollback(async (tx) => {
    await makeUser(tx, "agent", { referral_code: "ZEL-VALID1" });
    await makeUser(tx, "agent", { referral_code: "ZEL-INACT1", is_active: false, status: "banned" });
    const br = browser(tx);
    await br.openLink("ZEL-INACT1");
    assert.equal(br.ref(), undefined);
    await br.openLink("ZEL-VALID1");
    for (const bad of ["ZEL-INACT1", "ZEL-NOPE99", "AGT001-OR-1"]) await br.openLink(bad);
    assert.equal(br.ref(), "ZEL-VALID1");
  }));

test("expiry: cookie lifetime is bounded; an agent disabled after the visit assigns nobody", () =>
  inRollback(async (tx) => {
    assert.equal(referralCookieMaxAge(undefined), 30 * 86400);
    assert.equal(referralCookieMaxAge("2"), 2 * 86400);
    const agent = await makeUser(tx, "agent", { referral_code: "ZEL-LATEOF" });
    const c = await makeUser(tx, "customer");
    await tx.user.update({ where: { id: agent.id }, data: { is_active: false, status: "banned" } });
    assert.equal(await svc.assignFromReferralCode(c.id, "ZEL-LATEOF", tx), null);
    assert.equal(await agentOf(tx, c.id), null);
  }));

test("cookie flags: HttpOnly, SameSite=Lax; clearing expires it", () => {
  const set = setReferralCookie(NextResponse.json({}), "ZEL-X").cookies.get(REFERRAL_AGENT_COOKIE)!;
  assert.equal(set.httpOnly, true);
  assert.equal(set.sameSite, "lax");
  const gone = clearReferralCookie(NextResponse.json({})).headers.get("set-cookie")!;
  assert.match(gone, /Max-Age=0/i);
  assert.match(gone, /HttpOnly/i);
});

test("two accounts share one agent code; repeated registration does not duplicate history", () =>
  inRollback(async (tx) => {
    const agent = await makeUser(tx, "agent", { referral_code: "ZEL-SHARE1" });
    const c1 = await makeUser(tx, "customer");
    const c2 = await makeUser(tx, "customer");
    for (let i = 0; i < 3; i++) await svc.assignFromReferralCode(c1.id, "ZEL-SHARE1", tx);
    await svc.assignFromReferralCode(c2.id, "ZEL-SHARE1", tx);
    assert.equal(await agentOf(tx, c1.id), agent.id);
    assert.equal(await agentOf(tx, c2.id), agent.id);
    assert.equal(await tx.customer_agent_history.count({ where: { customer_id: c1.id } }), 1);
  }));

test("concurrent assignment (committed rows): one winner, one history row; admin transfer is the only way to move", async () => {
  const agentRole = await db.role.findFirstOrThrow({ where: { slug: "agent" } });
  const custRole = await db.role.findFirstOrThrow({ where: { slug: "customer" } });
  const tag = crypto.randomBytes(4).toString("hex");
  const mk = (roleId: bigint, n: string) =>
    db.user.create({
      data: { uuid: crypto.randomUUID(), name: `T ${tag} ${n}`, email: `t-${tag}-${n}@example.test`, password_hash: "x", roleId, status: "active" },
    });
  const a1 = await mk(agentRole.id, "a1");
  const a2 = await mk(agentRole.id, "a2");
  const cust = await mk(custRole.id, "c");
  try {
    const results = await Promise.all([
      svc.assignFromReferral(cust.id, a1.id),
      svc.assignFromReferral(cust.id, a2.id),
      svc.assignFromReferral(cust.id, a1.id),
      svc.assignFromReferral(cust.id, a2.id),
    ]);
    const final = (await db.user.findUniqueOrThrow({ where: { id: cust.id } })).current_agent_id;
    assert.ok(final === a1.id || final === a2.id);
    assert.ok(results.every((r) => r === final), "every caller sees the single winner");
    assert.equal(await db.customer_agent_history.count({ where: { customer_id: cust.id } }), 1);

    const admin = await db.user.findFirst({ where: { role: { slug: "admin" } } });
    assert.ok(admin, "an admin user must exist in the dev DB for the transfer check");
    const other = final === a1.id ? a2 : a1;
    await svc.transferCustomer({ customerRef: String(cust.id), toAgentRef: String(other.id), reason: "test" }, { id: admin.id, role: "ADMIN" } as never);
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: cust.id } })).current_agent_id, other.id);
    const hist = await db.customer_agent_history.findMany({ where: { customer_id: cust.id }, orderBy: { id: "asc" } });
    assert.deepEqual(hist.map((h) => h.action), ["assigned", "transferred"]);
    assert.equal(hist[1].transferred_by, admin.id);
    await svc.assignFromReferral(cust.id, final!); // a later referral cannot move them back
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: cust.id } })).current_agent_id, other.id);
  } finally {
    await db.customer_agent_history.deleteMany({ where: { customer_id: cust.id } });
    await db.commission_audit_logs.deleteMany({ where: { entity_type: "assignment", entity_id: cust.id } });
    await db.user.delete({ where: { id: cust.id } });
    await db.user.deleteMany({ where: { id: { in: [a1.id, a2.id] } } });
  }
});
