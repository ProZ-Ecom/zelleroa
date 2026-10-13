import { test } from "node:test";
import assert from "node:assert/strict";
import { allocateReferralCode, generateReferralCode, isGeneratedReferralCode } from "@/lib/referral/code";
import { backfillAgentReferralCodes } from "@/lib/referral/backfill";

test("generated codes look like ZEL-XXXXXX with unambiguous symbols", () => {
  for (let i = 0; i < 500; i++) assert.match(generateReferralCode(), /^ZEL-[2-9A-HJKMNP-Z]{6}$/);
});

test("codes cannot be guessed from sequential agent ids (no correlation, no repeats)", () => {
  const codes = Array.from({ length: 5000 }, () => generateReferralCode());
  assert.ok(new Set(codes).size >= codes.length - 2); // birthday collisions are possible (the DB UNIQUE index + retry handles them)
  // consecutive "agents" share no predictable increment: count adjacent codes differing by 1 in suffix value
  const sorted = [...codes].sort();
  const near = sorted.filter((c, i) => i > 0 && c.slice(0, 8) === sorted[i - 1].slice(0, 8)).length;
  assert.ok(near < 300, `suspiciously clustered: ${near}`);
});

test("collision: allocator regenerates until a free code is found", async () => {
  const seq = ["ZEL-AAAAAA", "ZEL-AAAAAA", "ZEL-BBBBBB"];
  const taken = new Set(["ZEL-AAAAAA"]);
  let i = 0;
  const code = await allocateReferralCode(async (c) => taken.has(c), () => seq[i++]);
  assert.equal(code, "ZEL-BBBBBB");
  assert.equal(i, 3);
});

test("allocator gives up rather than loop forever", async () => {
  await assert.rejects(allocateReferralCode(async () => true, generateReferralCode, 3));
});

test("backfill gives legacy/null agents unique codes, is idempotent, keeps other data", async () => {
  const agents = [
    { id: BigInt(1), referralCode: "AGT001", name: "A" },
    { id: BigInt(2), referralCode: null, name: "B" },
    { id: BigInt(3), referralCode: "ZEL-KEEPME", name: "C" }, // already a valid generated code: kept
    { id: BigInt(4), referralCode: "ZEL-A7K9P2", name: "D" },
  ];
  const store = {
    async agents(after: bigint, limit: number) {
      return agents.filter((a) => a.id > after).slice(0, limit);
    },
    async codeExists(code: string) {
      return agents.some((a) => a.referralCode === code);
    },
    async setCode(id: bigint, code: string, prev: string | null) {
      const a = agents.find((x) => x.id === id)!;
      if (a.referralCode !== prev) return false;
      a.referralCode = code;
      return true;
    },
  };
  const first = await backfillAgentReferralCodes(store);
  assert.equal(first.scanned, 4);
  const codes = agents.map((a) => a.referralCode);
  assert.ok(codes.every((c) => isGeneratedReferralCode(c)), JSON.stringify(codes));
  assert.equal(new Set(codes).size, 4);
  assert.equal(agents[3].referralCode, "ZEL-A7K9P2"); // already-valid code untouched
  assert.deepEqual(agents.map((a) => a.name), ["A", "B", "C", "D"]);
  const snapshot = JSON.stringify(agents, (_, v) => (typeof v === "bigint" ? String(v) : v));
  const second = await backfillAgentReferralCodes(store);
  assert.equal(second.updated, 0);
  assert.equal(JSON.stringify(agents, (_, v) => (typeof v === "bigint" ? String(v) : v)), snapshot);
});

test("backfill dry run writes nothing", async () => {
  let writes = 0;
  const r = await backfillAgentReferralCodes(
    {
      agents: async (after) => (after === BigInt(0) ? [{ id: BigInt(1), referralCode: "AGT001" }] : []),
      codeExists: async () => false,
      setCode: async () => {
        writes++;
        return true;
      },
    },
    { dryRun: true }
  );
  assert.equal(writes, 0);
  assert.equal(r.updated, 1);
});
