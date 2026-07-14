import { describe, it, expect } from "vitest";
import { buildLookbookDoc } from "./lookbook-doc";
import type { LookbookBrand, LookbookRenderModel } from "./lookbook";

const brand: LookbookBrand = {
  name: "Test",
  tagline: "Made slowly",
  website: "test.com",
  logo: null,
  palette: { primary: "#123456", accent: "#abcdef", ink: "#111111", bg: "#ffffff" },
  headingFamily: "serif",
  bodyFamily: "sans-serif",
};

const P = (id: string) => ({ id, name: id, subtitle: null, editorialStory: null, fabric: null, origin: null, priceCents: 1000, currency: "USD", imageUrl: `/i/${id}.jpg`, imageAlt: id });
const model: LookbookRenderModel = {
  lookbook: { id: "lb", title: "SS26", subtitle: null, intro: "Hi", template: "lookbook", spec: { spreads: [] }, status: "draft", createdAt: "", updatedAt: "" },
  spreads: [
    { product: P("a"), layout: "hero", caption: "" },
    { product: P("b"), layout: "clean", caption: "" },
  ],
  catalog: [],
};

const pages = (doc: string) => (doc.match(/class="page"/g) || []).length;

describe("lookbook doc part splitting", () => {
  it("full = cover + intro + spreads + back", () => {
    expect(pages(buildLookbookDoc(model, brand, { part: "full" }))).toBe(5); // cover+intro+2+back
  });
  it("cover = one page", () => {
    expect(pages(buildLookbookDoc(model, brand, { part: "cover" }))).toBe(1);
  });
  it("interior = everything but the cover, and the two parts sum to the whole", () => {
    const interior = pages(buildLookbookDoc(model, brand, { part: "interior" }));
    expect(interior).toBe(4); // intro+2+back
    expect(interior + 1).toBe(pages(buildLookbookDoc(model, brand, { part: "full" })));
  });
});
