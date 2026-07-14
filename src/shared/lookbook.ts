/**
 * Shared lookbook types — used by the worker (resolve render model) and the
 * client (render the print HTML). A lookbook is an ordered set of product
 * "spreads" plus editorial copy; the product data is resolved fresh at read
 * time so the magazine always reflects current pricing/imagery.
 */

export type LookbookLayout = "hero" | "editorial" | "clean";

export const LOOKBOOK_LAYOUTS: { id: LookbookLayout; label: string; hint: string }[] = [
  { id: "hero", label: "Full bleed", hint: "Edge-to-edge image with the piece named over it" },
  { id: "editorial", label: "Editorial", hint: "Image beside the piece's story" },
  { id: "clean", label: "Clean", hint: "Image with name, price & fabric caption" },
];

export interface LookbookSpread {
  productId: string;
  layout: LookbookLayout;
  caption?: string;
}

export interface LookbookSpec {
  spreads: LookbookSpread[];
}

export interface LookbookProduct {
  id: string;
  name: string;
  subtitle: string | null;
  editorialStory: string | null;
  fabric: string | null;
  origin: string | null;
  priceCents: number;
  currency: string;
  imageUrl: string | null;
  imageAlt: string | null;
}

export interface LookbookRecord {
  id: string;
  title: string;
  subtitle: string | null;
  intro: string | null;
  template: string;
  spec: LookbookSpec;
  status: string;
  createdAt: string;
  updatedAt: string;
}

/** Everything the print composer needs, resolved server-side. */
export interface LookbookRenderModel {
  lookbook: LookbookRecord;
  spreads: { product: LookbookProduct; layout: LookbookLayout; caption: string }[];
  /** All available products, for the "add a piece" picker. */
  catalog: LookbookProduct[];
}
