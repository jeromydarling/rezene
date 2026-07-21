import { describe, expect, it } from "vitest";
import { buildStructuredData, buildFaqLd } from "./seo";
import { FAQ, FAQ_FLAT } from "../../shared/faq";
import type { Env } from "../types/env";

const env = { APP_URL: "https://verto.style", BRAND_NAME: "Verto" } as unknown as Env;

describe("buildStructuredData — platform marketing site", () => {
  const json = buildStructuredData(env, null, { title: "Verto", description: "d", image: null });

  it("publishes Organization, WebSite and SoftwareApplication", () => {
    expect(json).toContain('"@type":"Organization"');
    expect(json).toContain('"@type":"WebSite"');
    expect(json).toContain('"@type":"SoftwareApplication"');
  });

  it("carries the real plan pricing as an AggregateOffer", () => {
    expect(json).toContain('"@type":"AggregateOffer"');
    expect(json).toContain('"lowPrice":"29"');
    expect(json).toContain('"highPrice":"399"');
    expect(json).toContain('"offerCount":4');
  });
});

describe("buildFaqLd — marketing FAQ", () => {
  const json = buildFaqLd();

  it("emits a FAQPage with one Question per real Q&A", () => {
    expect(json).toContain('"@type":"FAQPage"');
    expect(json).toContain('"@type":"Question"');
    expect(json).toContain('"@type":"Answer"');
    const questions = (json.match(/"@type":"Question"/g) ?? []).length;
    expect(questions).toBe(FAQ_FLAT.length);
    expect(FAQ_FLAT.length).toBeGreaterThan(15);
  });

  it("carries the real question text (schema matches visible content)", () => {
    const sample = FAQ[0].items[0];
    expect(json).toContain(JSON.stringify(sample.q).slice(1, -1).slice(0, 20));
  });

  it("every FAQ answer is non-empty plain text", () => {
    for (const item of FAQ_FLAT) {
      expect(item.a.length).toBeGreaterThan(20);
      expect(item.a).not.toContain("<");
    }
  });
});

describe("buildStructuredData — a shop", () => {
  it("emits an Organization, not the SoftwareApplication", () => {
    const json = buildStructuredData(
      env,
      { slug: "maison", name: "Maison", basePath: "/maison" },
      { title: "Maison", description: "d", image: null },
    );
    expect(json).toContain('"@type":"Organization"');
    expect(json).not.toContain("SoftwareApplication");
  });
});
