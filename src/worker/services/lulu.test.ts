import { describe, it, expect } from "vitest";
import {
  luluConfigured,
  luluApiBase,
  luluMarkup,
  applyMarkup,
  magazinePageCount,
  verifyLuluWebhook,
  getAccessToken,
  LuluNotConfiguredError,
} from "./lulu";
import type { Env } from "../types/env";

const configured = { LULU_CLIENT_KEY: "k", LULU_CLIENT_SECRET: "s" } as unknown as Env;

async function sign(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

describe("lulu config + pricing", () => {
  it("is a no-op until both credentials are set", () => {
    expect(luluConfigured({} as Env)).toBe(false);
    expect(luluConfigured({ LULU_CLIENT_KEY: "k" } as unknown as Env)).toBe(false);
    expect(luluConfigured(configured)).toBe(true);
  });

  it("targets sandbox by default, production only when asked", () => {
    expect(luluApiBase({} as Env)).toContain("sandbox");
    expect(luluApiBase({ LULU_ENV: "production" } as unknown as Env)).toBe("https://api.lulu.com");
  });

  it("applies the configured markup (default 35%)", () => {
    expect(luluMarkup({} as Env)).toBeCloseTo(0.35);
    expect(luluMarkup({ LULU_MARKUP_PCT: "50" } as unknown as Env)).toBeCloseTo(0.5);
    // $10.00 wholesale + 35% = $13.50
    expect(applyMarkup(1000, 0.35)).toBe(1350);
    expect(applyMarkup(797, 0.5)).toBe(1196); // rounds
  });

  it("rounds saddle-stitch page count to a multiple of 4, clamped 4–48", () => {
    expect(magazinePageCount(0)).toBe(4); // 0 spreads → cover+intro+back = 3 → 4
    expect(magazinePageCount(9)).toBe(12); // 9+3=12
    expect(magazinePageCount(10)).toBe(16); // 13 → 16
    expect(magazinePageCount(100)).toBe(48); // clamp
  });

  it("throws LuluNotConfiguredError when fetching a token unconfigured", async () => {
    await expect(getAccessToken({} as Env)).rejects.toBeInstanceOf(LuluNotConfiguredError);
  });
});

describe("lulu webhook verification", () => {
  const secret = "whsec_test";
  const body = JSON.stringify({ topic: "PRINT_JOB_STATUS_CHANGED", data: { id: 42, status: { name: "SHIPPED" } } });

  it("accepts a correctly-signed payload (with or without sha256= prefix)", async () => {
    const sig = await sign(secret, body);
    expect(await verifyLuluWebhook(secret, body, sig)).toBe(true);
    expect(await verifyLuluWebhook(secret, body, `sha256=${sig}`)).toBe(true);
  });

  it("rejects a tampered body, wrong secret, or missing signature", async () => {
    const sig = await sign(secret, body);
    expect(await verifyLuluWebhook(secret, body + " ", sig)).toBe(false);
    expect(await verifyLuluWebhook("other", body, sig)).toBe(false);
    expect(await verifyLuluWebhook(secret, body, "")).toBe(false);
  });
});
