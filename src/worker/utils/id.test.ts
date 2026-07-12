import { describe, it, expect } from "vitest";
import { newId, randomToken, sha256Hex } from "./id";

describe("newId", () => {
  it("prefixes and produces a 20-hex suffix", () => {
    const id = newId("ord");
    expect(id).toMatch(/^ord_[0-9a-f]{20}$/);
  });
  it("is unique across calls", () => {
    const ids = new Set(Array.from({ length: 200 }, () => newId("x")));
    expect(ids.size).toBe(200);
  });
});

describe("randomToken", () => {
  it("returns a hex string of 2× the byte length", () => {
    expect(randomToken(32)).toMatch(/^[0-9a-f]{64}$/);
    expect(randomToken(20)).toMatch(/^[0-9a-f]{40}$/);
  });
});

describe("sha256Hex (session token hashing)", () => {
  it("is deterministic and 64 hex chars", async () => {
    const a = await sha256Hex("secret");
    const b = await sha256Hex("secret");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
  it("matches the known SHA-256 of 'abc'", async () => {
    expect(await sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
  it("differs for different inputs", async () => {
    expect(await sha256Hex("a")).not.toBe(await sha256Hex("b"));
  });
});
