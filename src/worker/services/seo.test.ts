import { describe, expect, it } from "vitest";
import { buildStructuredData } from "./seo";
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
