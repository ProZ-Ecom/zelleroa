import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { referralCookieMaxAge, referralLandingRedirect, safeLandingPath, REFERRAL_AGENT_COOKIE } from "@/lib/referral/cookie";
import { handleReferralLanding } from "@/lib/referral/landing";

const req = (url: string, init?: ConstructorParameters<typeof NextRequest>[1]) => new NextRequest(new URL(url, "http://localhost:3000"), init);
const live = async (c: string | null | undefined) => (c === "ZEL-A7K9P2" ? { id: BigInt(7), name: "Agent", agentCode: "AGT007", referralCode: "ZEL-A7K9P2" } : null);

test("homepage and product pages: ?ref= hands off to /ref and returns to the same page, query kept", () => {
  const home = referralLandingRedirect(req("/?ref=ZEL-A7K9P2"))!;
  assert.equal(home.pathname, "/ref/ZEL-A7K9P2");
  assert.equal(home.searchParams.get("to"), "/");
  const pdp = referralLandingRedirect(req("/products/blue-shirt?size=M&ref=ZEL-A7K9P2"))!;
  assert.equal(pdp.searchParams.get("to"), "/products/blue-shirt?size=M");
});

test("no ref, junk ref, non-GET, and /ref itself are not redirected (no loops)", () => {
  assert.equal(referralLandingRedirect(req("/products")), null);
  assert.equal(referralLandingRedirect(req("/?ref=<script>")), null);
  assert.equal(referralLandingRedirect(req("/?ref=ZEL-A7K9P2", { method: "POST" })), null);
  assert.equal(referralLandingRedirect(req("/ref/ZEL-A7K9P2?ref=ZEL-A7K9P2")), null);
});

test("valid code: cookie is HttpOnly, SameSite=Lax, 30 days, path /, and visitor is sent on", async () => {
  const res = await handleReferralLanding(req("/ref/ZEL-A7K9P2?to=%2Fproducts%2Fx"), "ZEL-A7K9P2", live);
  assert.equal(res.headers.get("location"), "http://localhost:3000/products/x");
  const c = res.cookies.get(REFERRAL_AGENT_COOKIE)!;
  assert.equal(c.value, "ZEL-A7K9P2");
  assert.equal(c.httpOnly, true);
  assert.equal(String(c.sameSite).toLowerCase(), "lax");
  assert.equal(c.maxAge, 30 * 24 * 3600);
  assert.equal(c.path, "/");
});

test("invalid / disabled / deleted code sets NO cookie, so it cannot overwrite a valid attribution", async () => {
  for (const code of ["ZEL-ZZZZZZ", "AGT001", "x", "ZEL-A7K9P2 OR 1=1"]) {
    const res = await handleReferralLanding(req(`/ref/${encodeURIComponent(code)}`), code, live);
    assert.equal(res.cookies.get(REFERRAL_AGENT_COOKIE), undefined, code);
    assert.equal(res.status, 307);
  }
});

test("expiry is configurable via REFERRAL_COOKIE_DAYS, defaulting to 30 days", () => {
  assert.equal(referralCookieMaxAge(undefined), 30 * 86400);
  assert.equal(referralCookieMaxAge("7"), 7 * 86400);
  assert.equal(referralCookieMaxAge("abc"), 30 * 86400);
  assert.equal(referralCookieMaxAge("-3"), 30 * 86400);
});

test("landing destination can never be an off-site URL", () => {
  for (const bad of ["//evil.com", "https://evil.com", "/\\evil.com", "javascript:1", "/a\r\nSet-Cookie:x", "", null]) {
    assert.equal(safeLandingPath(bad as string | null), "/", String(bad));
  }
  assert.equal(safeLandingPath("/products?a=1"), "/products?a=1");
});
