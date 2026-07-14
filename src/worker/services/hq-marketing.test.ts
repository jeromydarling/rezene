import { describe, expect, it } from "vitest";
import { emailMarkdownToHtml, unsubscribeToken, verifyUnsubscribeToken, SEGMENTS } from "./hq-marketing";
import type { Env } from "../types/env";

const env = { SESSION_SECRET: "test-secret" } as unknown as Env;

describe("emailMarkdownToHtml", () => {
  it("renders paragraphs, bold, links and lists", () => {
    const html = emailMarkdownToHtml("Hi **there**,\n\nSee [the guide](https://verto.style/kb).\n\n- one\n- two");
    expect(html).toContain("<strong>there</strong>");
    expect(html).toContain('href="https://verto.style/kb"');
    expect(html).toContain("<li");
    expect(html.match(/<p /g)?.length).toBe(2);
  });

  it("escapes raw HTML so injected markup can't reach the email", () => {
    const html = emailMarkdownToHtml(`<script>alert(1)</script>`);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("only linkifies http(s) targets", () => {
    const html = emailMarkdownToHtml("[x](javascript:alert(1))");
    expect(html).not.toContain('href="javascript');
  });
});

describe("unsubscribe tokens", () => {
  it("verifies its own tokens, case-insensitively on the address", async () => {
    const t = await unsubscribeToken(env, "Person@Example.com");
    expect(await verifyUnsubscribeToken(env, "person@example.com", t)).toBe(true);
  });

  it("rejects forged or cross-address tokens", async () => {
    const t = await unsubscribeToken(env, "a@example.com");
    expect(await verifyUnsubscribeToken(env, "b@example.com", t)).toBe(false);
    expect(await verifyUnsubscribeToken(env, "a@example.com", "0".repeat(32))).toBe(false);
    expect(await verifyUnsubscribeToken(env, "a@example.com", "")).toBe(false);
  });
});

describe("segments", () => {
  it("exposes the audience segments the UI offers", () => {
    const keys = SEGMENTS.map((s) => s.key);
    expect(keys).toContain("all");
    expect(keys).toContain("active_shops");
    expect(keys).toContain("leads");
    expect(keys).toContain("makers_waitlist");
  });
});
