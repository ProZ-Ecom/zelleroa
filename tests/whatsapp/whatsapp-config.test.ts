import { test } from "node:test";
import assert from "node:assert/strict";
import { isWhatsAppModuleEnabled } from "@/lib/whatsapp/whatsapp-config";

test("when NEXT_PUBLIC_ENABLE_WHATSAPP_MODULE is 'true', WhatsApp module is enabled", () => {
  const original = process.env.NEXT_PUBLIC_ENABLE_WHATSAPP_MODULE;
  try {
    process.env.NEXT_PUBLIC_ENABLE_WHATSAPP_MODULE = "true";
    assert.equal(isWhatsAppModuleEnabled(), true);
  } finally {
    if (original !== undefined) {
      process.env.NEXT_PUBLIC_ENABLE_WHATSAPP_MODULE = original;
    } else {
      delete process.env.NEXT_PUBLIC_ENABLE_WHATSAPP_MODULE;
    }
  }
});

test("when NEXT_PUBLIC_ENABLE_WHATSAPP_MODULE is 'false' or unset, WhatsApp module is disabled", () => {
  const original = process.env.NEXT_PUBLIC_ENABLE_WHATSAPP_MODULE;
  try {
    process.env.NEXT_PUBLIC_ENABLE_WHATSAPP_MODULE = "false";
    assert.equal(isWhatsAppModuleEnabled(), false);

    delete process.env.NEXT_PUBLIC_ENABLE_WHATSAPP_MODULE;
    assert.equal(isWhatsAppModuleEnabled(), false);
  } finally {
    if (original !== undefined) {
      process.env.NEXT_PUBLIC_ENABLE_WHATSAPP_MODULE = original;
    } else {
      delete process.env.NEXT_PUBLIC_ENABLE_WHATSAPP_MODULE;
    }
  }
});
