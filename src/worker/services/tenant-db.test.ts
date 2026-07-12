import { describe, it, expect } from "vitest";
import { primaryUsesBoundD1 } from "./tenant-db";

const PRIMARY = "shop_primary";

describe("primaryUsesBoundD1 (tenant resolution)", () => {
  it("keeps the primary shop on the bound D1 until it's migrated to its DO", () => {
    expect(primaryUsesBoundD1(PRIMARY, PRIMARY, undefined)).toBe(true);
    expect(primaryUsesBoundD1(PRIMARY, PRIMARY, "0")).toBe(true);
  });
  it("moves the primary shop to its DO once PRIMARY_ON_DO is '1'", () => {
    expect(primaryUsesBoundD1(PRIMARY, PRIMARY, "1")).toBe(false);
  });
  it("NEVER puts another shop on the bound D1 — the tenant-isolation invariant", () => {
    expect(primaryUsesBoundD1("shop_other", PRIMARY, undefined)).toBe(false);
    expect(primaryUsesBoundD1("shop_other", PRIMARY, "0")).toBe(false);
    expect(primaryUsesBoundD1("shop_other", PRIMARY, "1")).toBe(false);
  });
});
