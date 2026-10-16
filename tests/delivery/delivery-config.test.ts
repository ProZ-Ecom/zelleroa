import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isProductionEnvironment,
  isManualDeliveryStatusEnabled,
} from "@/features/delivery/lib/delivery-config";

test("when NEXT_PUBLIC_IS_PRODUCTION is 'false', manual delivery updates are enabled", () => {
  const originalPublic = process.env.NEXT_PUBLIC_IS_PRODUCTION;
  const originalProd = process.env.IS_PRODUCTION;
  const originalExplicit = process.env.NEXT_PUBLIC_ENABLE_MANUAL_DELIVERY_STATUS;

  try {
    delete process.env.NEXT_PUBLIC_ENABLE_MANUAL_DELIVERY_STATUS;
    process.env.NEXT_PUBLIC_IS_PRODUCTION = "false";
    process.env.IS_PRODUCTION = "false";

    assert.equal(isProductionEnvironment(), false);
    assert.equal(isManualDeliveryStatusEnabled(), true);
  } finally {
    process.env.NEXT_PUBLIC_IS_PRODUCTION = originalPublic;
    process.env.IS_PRODUCTION = originalProd;
    if (originalExplicit !== undefined) {
      process.env.NEXT_PUBLIC_ENABLE_MANUAL_DELIVERY_STATUS = originalExplicit;
    }
  }
});

test("when NEXT_PUBLIC_IS_PRODUCTION is 'true', manual delivery updates are disabled", () => {
  const originalPublic = process.env.NEXT_PUBLIC_IS_PRODUCTION;
  const originalProd = process.env.IS_PRODUCTION;
  const originalExplicit = process.env.NEXT_PUBLIC_ENABLE_MANUAL_DELIVERY_STATUS;

  try {
    delete process.env.NEXT_PUBLIC_ENABLE_MANUAL_DELIVERY_STATUS;
    process.env.NEXT_PUBLIC_IS_PRODUCTION = "true";
    process.env.IS_PRODUCTION = "true";

    assert.equal(isProductionEnvironment(), true);
    assert.equal(isManualDeliveryStatusEnabled(), false);
  } finally {
    process.env.NEXT_PUBLIC_IS_PRODUCTION = originalPublic;
    process.env.IS_PRODUCTION = originalProd;
    if (originalExplicit !== undefined) {
      process.env.NEXT_PUBLIC_ENABLE_MANUAL_DELIVERY_STATUS = originalExplicit;
    }
  }
});

test("explicit NEXT_PUBLIC_ENABLE_MANUAL_DELIVERY_STATUS overrides production flag", () => {
  const originalPublic = process.env.NEXT_PUBLIC_IS_PRODUCTION;
  const originalProd = process.env.IS_PRODUCTION;
  const originalExplicit = process.env.NEXT_PUBLIC_ENABLE_MANUAL_DELIVERY_STATUS;

  try {
    // In production, but manual override explicitly set to true
    process.env.NEXT_PUBLIC_IS_PRODUCTION = "true";
    process.env.IS_PRODUCTION = "true";
    process.env.NEXT_PUBLIC_ENABLE_MANUAL_DELIVERY_STATUS = "true";

    assert.equal(isManualDeliveryStatusEnabled(), true);

    // In dev, but manual override explicitly set to false
    process.env.NEXT_PUBLIC_IS_PRODUCTION = "false";
    process.env.IS_PRODUCTION = "false";
    process.env.NEXT_PUBLIC_ENABLE_MANUAL_DELIVERY_STATUS = "false";

    assert.equal(isManualDeliveryStatusEnabled(), false);
  } finally {
    process.env.NEXT_PUBLIC_IS_PRODUCTION = originalPublic;
    process.env.IS_PRODUCTION = originalProd;
    if (originalExplicit !== undefined) {
      process.env.NEXT_PUBLIC_ENABLE_MANUAL_DELIVERY_STATUS = originalExplicit;
    } else {
      delete process.env.NEXT_PUBLIC_ENABLE_MANUAL_DELIVERY_STATUS;
    }
  }
});
