import { describe, it, expect } from "vitest";
import { isSuperAdmin } from "./auth";
import type { Env } from "../types/env";

function env(superadminEmails?: string): Env {
  return { SUPERADMIN_EMAILS: superadminEmails } as unknown as Env;
}

describe("isSuperAdmin", () => {
  it("grants access to anyone holding the superadmin role", () => {
    expect(isSuperAdmin(env(), "anyone@example.com", ["superadmin"])).toBe(true);
  });
  it("grants access to an allow-listed email (case/space-insensitive)", () => {
    const e = env("gardener@thecros.app, boss@verto.style");
    expect(isSuperAdmin(e, "  Gardener@TheCros.app ", [])).toBe(true);
    expect(isSuperAdmin(e, "boss@verto.style", [])).toBe(true);
  });
  it("denies an email that isn't on the list and has no role", () => {
    expect(isSuperAdmin(env("boss@verto.style"), "stranger@example.com", ["admin"])).toBe(false);
  });
  it("denies when there is no email and no role", () => {
    expect(isSuperAdmin(env("boss@verto.style"), null, [])).toBe(false);
  });
  it("denies when the allow-list is empty", () => {
    expect(isSuperAdmin(env(), "someone@example.com", [])).toBe(false);
  });
});
