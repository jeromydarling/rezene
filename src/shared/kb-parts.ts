/**
 * Knowledge Base part slugs + titles, shared by the worker (chapter drafter,
 * override validation) and the client (which adds icons/descriptions on top).
 * Keep in sync with src/app/kb/index.ts KB_PARTS.
 */
export const KB_PARTS: { slug: string; title: string }[] = [
  { slug: "getting-started", title: "Getting started" },
  { slug: "catalog", title: "Catalog & inventory" },
  { slug: "design", title: "Design & development" },
  { slug: "sourcing", title: "Sourcing & production" },
  { slug: "finance", title: "Costing & finance" },
  { slug: "marketing", title: "Marketing & content" },
  { slug: "commerce", title: "Selling" },
  { slug: "account", title: "Account & platform" },
];
