import { Hono } from "hono";
import { first, run, writeAudit } from "../services/db";
import { requireAdminWrite } from "../middleware/auth";
import { newId } from "../utils/id";
import type { AppContext } from "../types/env";

/**
 * Product catalog import from CSV. Two formats:
 *  - "shopify": a Shopify product export (grouped by Handle, Option1/2
 *    columns detected as size/color by their Option Name).
 *  - "simple": our own minimal template —
 *    name,slug,category,gender,price,sizes,colorway
 *    where sizes is pipe-separated ("S|M|L") and price is decimal ("185.00").
 *
 * Everything imports as an unpublished draft with zero inventory so nothing
 * accidentally goes live — review in Products, then publish.
 */
export const adminImportRoutes = new Hono<AppContext>();

const MAX_CSV_BYTES = 2 * 1024 * 1024; // 2MB ≈ thousands of rows, plenty
const MAX_ROWS = 2000;

/** RFC-4180-ish CSV parser: quoted fields, escaped quotes, CRLF/LF. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      // Skip fully empty trailing lines.
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.length > 1 || row[0] !== "") rows.push(row);
  }
  return rows;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 80);
}

function parsePriceCents(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value) || value < 0 || value > 1_000_000) return null;
  return Math.round(value * 100);
}

const GENDERS = new Set(["mens", "womens", "unisex"]);

function normalizeGender(raw: string): string {
  const g = raw.trim().toLowerCase().replace(/[^a-z]/g, "");
  if (g === "men" || g === "mens" || g === "male" || g === "m") return "mens";
  if (g === "women" || g === "womens" || g === "female" || g === "w") return "womens";
  return GENDERS.has(g) ? g : "unisex";
}

interface ImportedProduct {
  name: string;
  slug: string;
  category: string;
  gender: string;
  priceCents: number;
  description: string | null;
  variants: { colorway: string; size: string; sku: string | null; priceCents: number | null }[];
}

interface ImportResult {
  created: number;
  skipped: { slug: string; reason: string }[];
  errors: string[];
}

/** Shopify export: rows grouped by Handle; first row carries product fields. */
function parseShopifyRows(header: string[], rows: string[][], errors: string[]): ImportedProduct[] {
  const col = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name);
  const iHandle = col("handle");
  const iTitle = col("title");
  const iBody = col("body (html)");
  const iType = col("type");
  const iOpt1Name = col("option1 name");
  const iOpt1Value = col("option1 value");
  const iOpt2Name = col("option2 name");
  const iOpt2Value = col("option2 value");
  const iSku = col("variant sku");
  const iPrice = col("variant price");
  if (iHandle < 0 || iTitle < 0) {
    errors.push('Not a Shopify export: missing "Handle" or "Title" column.');
    return [];
  }

  const byHandle = new Map<string, ImportedProduct>();
  for (const row of rows) {
    const handle = (row[iHandle] ?? "").trim();
    if (!handle) continue;
    let product = byHandle.get(handle);
    if (!product) {
      const title = (row[iTitle] ?? "").trim();
      if (!title) continue; // continuation row for a handle we never saw with a title
      const bodyHtml = iBody >= 0 ? (row[iBody] ?? "") : "";
      product = {
        name: title,
        slug: slugify(handle),
        category: iType >= 0 && row[iType]?.trim() ? row[iType].trim().toLowerCase() : "imported",
        gender: "unisex",
        priceCents: 0,
        description: bodyHtml ? bodyHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 2000) : null,
        variants: [],
      };
      byHandle.set(handle, product);
    }
    // Which option is size vs color? Match on the Option Name.
    let size = "OS";
    let colorway = "Default";
    const assign = (nameIdx: number, valueIdx: number) => {
      if (nameIdx < 0 || valueIdx < 0) return;
      const optName = (row[nameIdx] ?? "").trim().toLowerCase();
      const optValue = (row[valueIdx] ?? "").trim();
      if (!optValue) return;
      if (optName.includes("size")) size = optValue;
      else if (optName.includes("color") || optName.includes("colour")) colorway = optValue;
      else if (optName && size === "OS") size = optValue; // unknown single option → treat as size
    };
    assign(iOpt1Name, iOpt1Value);
    assign(iOpt2Name, iOpt2Value);
    const priceCents = iPrice >= 0 ? parsePriceCents(row[iPrice] ?? "") : null;
    if (priceCents !== null && product.priceCents === 0) product.priceCents = priceCents;
    product.variants.push({
      colorway,
      size,
      sku: iSku >= 0 && row[iSku]?.trim() ? row[iSku].trim() : null,
      priceCents,
    });
  }
  return [...byHandle.values()].filter((p) => {
    if (p.priceCents <= 0) {
      errors.push(`"${p.name}": no valid variant price found — skipped.`);
      return false;
    }
    return true;
  });
}

/** Simple template: name,slug,category,gender,price,sizes,colorway */
function parseSimpleRows(header: string[], rows: string[][], errors: string[]): ImportedProduct[] {
  const col = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name);
  const iName = col("name");
  const iSlug = col("slug");
  const iCategory = col("category");
  const iGender = col("gender");
  const iPrice = col("price");
  const iSizes = col("sizes");
  const iColorway = col("colorway");
  if (iName < 0 || iPrice < 0) {
    errors.push('Not a valid simple template: missing "name" or "price" column.');
    return [];
  }
  const products: ImportedProduct[] = [];
  rows.forEach((row, idx) => {
    const name = (row[iName] ?? "").trim();
    if (!name) return;
    const priceCents = parsePriceCents(row[iPrice] ?? "");
    if (priceCents === null || priceCents <= 0) {
      errors.push(`Row ${idx + 2} ("${name}"): invalid price — skipped.`);
      return;
    }
    const sizes = (iSizes >= 0 ? (row[iSizes] ?? "") : "")
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);
    const colorway = (iColorway >= 0 ? (row[iColorway] ?? "").trim() : "") || "Default";
    products.push({
      name,
      slug: slugify((iSlug >= 0 && row[iSlug]?.trim()) || name),
      category: (iCategory >= 0 && row[iCategory]?.trim().toLowerCase()) || "imported",
      gender: normalizeGender(iGender >= 0 ? (row[iGender] ?? "") : ""),
      priceCents,
      description: null,
      variants: (sizes.length > 0 ? sizes : ["OS"]).map((size) => ({
        colorway,
        size,
        sku: null,
        priceCents: null,
      })),
    });
  });
  return products;
}

adminImportRoutes.post("/products", requireAdminWrite, async (c) => {
  const form = await c.req.formData().catch(() => null);
  if (!form) return c.json({ error: "Send multipart form data with a `file` CSV." }, 400);
  const file = form.get("file");
  const mode = String(form.get("mode") ?? "simple");
  if (!(file instanceof File)) return c.json({ error: "Missing `file` upload." }, 400);
  if (file.size > MAX_CSV_BYTES) return c.json({ error: "CSV too large (max 2MB)." }, 413);
  if (mode !== "shopify" && mode !== "simple") {
    return c.json({ error: 'mode must be "shopify" or "simple".' }, 400);
  }

  const text = await file.text();
  const allRows = parseCsv(text);
  if (allRows.length < 2) {
    return c.json({ error: "CSV needs a header row and at least one data row." }, 400);
  }
  if (allRows.length - 1 > MAX_ROWS) {
    return c.json({ error: `CSV has too many rows (max ${MAX_ROWS}).` }, 400);
  }

  const [header, ...rows] = allRows;
  const result: ImportResult = { created: 0, skipped: [], errors: [] };
  const products =
    mode === "shopify"
      ? parseShopifyRows(header, rows, result.errors)
      : parseSimpleRows(header, rows, result.errors);

  const maxSort = await first<{ n: number }>(
    c.var.db,
    `SELECT COALESCE(MAX(sort_order), 0) AS n FROM products`,
  );
  let sortOrder = (maxSort?.n ?? 0) + 1;

  for (const product of products) {
    if (!product.slug) {
      result.errors.push(`"${product.name}": could not derive a slug — skipped.`);
      continue;
    }
    const existing = await first(
      c.var.db,
      `SELECT id FROM products WHERE slug = ?`,
      product.slug,
    );
    if (existing) {
      result.skipped.push({ slug: product.slug, reason: "slug already exists" });
      continue;
    }

    const productId = newId("prd");
    await run(
      c.var.db,
      `INSERT INTO products (id, slug, name, description, gender, category,
         base_price_cents, availability, is_published, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', 0, ?)`,
      productId,
      product.slug,
      product.name,
      product.description,
      product.gender,
      product.category.slice(0, 60),
      product.priceCents,
      sortOrder++,
    );

    // Dedupe variants on (colorway, size) — Shopify exports can repeat.
    const seen = new Set<string>();
    for (const variant of product.variants) {
      const key = `${variant.colorway}::${variant.size}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const variantId = newId("var");
      await run(
        c.var.db,
        `INSERT INTO product_variants (id, product_id, colorway_name, size, price_cents)
         VALUES (?, ?, ?, ?, ?)`,
        variantId,
        productId,
        variant.colorway.slice(0, 60),
        variant.size.slice(0, 30),
        variant.priceCents !== null && variant.priceCents !== product.priceCents
          ? variant.priceCents
          : null,
      );
      await run(
        c.var.db,
        `INSERT INTO inventory_items (id, variant_id, on_hand) VALUES (?, ?, 0)`,
        newId("inv"),
        variantId,
      );
    }
    result.created++;
  }

  await writeAudit(c.var.db, c.var.userId, "products.import", "product", "csv", {
    mode,
    created: result.created,
    skipped: result.skipped.length,
  });
  return c.json(result, 201);
});

// ============================================================
// AI-assisted import studio: map any spreadsheet, preview, then apply.
// ============================================================

/** Canonical product fields the studio can populate from arbitrary columns. */
const IMPORT_FIELDS = [
  { key: "name", label: "Product name", required: true },
  { key: "price", label: "Price" },
  { key: "compareAtPrice", label: "Compare-at price" },
  { key: "description", label: "Description" },
  { key: "category", label: "Category" },
  { key: "gender", label: "Audience (mens/womens/unisex)" },
  { key: "collection", label: "Collection" },
  { key: "colorway", label: "Colour" },
  { key: "size", label: "Size" },
  { key: "sku", label: "SKU code" },
  { key: "stock", label: "Stock on hand" },
  { key: "image", label: "Image URL" },
  { key: "currency", label: "Currency" },
] as const;
type ImportField = (typeof IMPORT_FIELDS)[number]["key"];

const HEURISTICS: Record<ImportField, RegExp> = {
  name: /(^name$|title|product ?name|^product$|^handle$|style ?name|item ?name|^item$)/i,
  price: /(^price$|retail|msrp|amount|unit ?price|base ?price)/i,
  compareAtPrice: /(compare|was|rrp|original|list ?price)/i,
  description: /(desc|description|details|body|about)/i,
  category: /(category|type|garment|product ?type|dept)/i,
  gender: /(gender|audience|sex|dept|department)/i,
  collection: /(collection|season|line|capsule|group)/i,
  colorway: /(colou?r|colorway|shade|finish)/i,
  size: /(size|dimension)/i,
  sku: /(sku|code|barcode|upc|ean|variant ?id)/i,
  stock: /(stock|qty|quantity|inventory|on ?hand|units)/i,
  image: /(image|photo|img|picture|url|src)/i,
  currency: /(currency|curr|ccy)/i,
};

function heuristicMap(headers: string[]): Record<ImportField, number | null> {
  const map = Object.fromEntries(IMPORT_FIELDS.map((f) => [f.key, null])) as Record<ImportField, number | null>;
  for (const f of IMPORT_FIELDS) {
    const idx = headers.findIndex((h) => HEURISTICS[f.key].test(h.trim()));
    if (idx >= 0) map[f.key] = idx;
  }
  return map;
}

// Step 1 — analyze: parse the sheet and propose a column mapping (AI, with a
// deterministic heuristic fallback). Returns headers, samples, and the rows so
// the client can confirm and apply without re-uploading.
adminImportRoutes.post("/analyze", requireAdminWrite, async (c) => {
  const form = await c.req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return c.json({ error: "Upload a CSV file." }, 400);
  const grid = parseCsv(await file.text());
  if (grid.length < 2) return c.json({ error: "That file has no data rows." }, 400);
  const headers = grid[0].map((h) => h.trim());
  const rows = grid.slice(1, 2001); // cap
  const truncated = grid.length - 1 > 2000;

  let mapping = heuristicMap(headers);
  let mappedBy: "ai" | "heuristic" = "heuristic";
  try {
    const { aiComplete } = await import("../services/ai");
    const { parseModelJson } = await import("../services/anthropic");
    const sample = [headers, ...rows.slice(0, 3)].map((r) => r.join(" | ")).join("\n");
    const res = await aiComplete(c.env, {
      system:
        "You map spreadsheet columns to a fashion catalog schema. Given the header row and a few sample rows, return ONLY compact JSON mapping each of these fields to the best 0-based column index, or null if absent: " +
        IMPORT_FIELDS.map((f) => f.key).join(", ") +
        '. Example: {"name":0,"price":2,"size":null}. Consider the sample values, not just header names.',
      prompt: `Columns and samples:\n${sample}`,
      maxTokens: 300,
    });
    const ai = parseModelJson(res.text) as Record<string, unknown>;
    const aiMap = { ...mapping };
    let any = false;
    for (const f of IMPORT_FIELDS) {
      const v = ai[f.key];
      if (typeof v === "number" && v >= 0 && v < headers.length) {
        aiMap[f.key] = v;
        any = true;
      } else if (v === null) {
        aiMap[f.key] = null;
      }
    }
    if (any) {
      mapping = aiMap;
      mappedBy = "ai";
    }
  } catch {
    // heuristic mapping already in place
  }

  return c.json({ headers, rows, rowCount: rows.length, truncated, mapping, mappedBy, fields: IMPORT_FIELDS });
});

// Step 2 — apply: create products (grouped by name) + variants + images,
// resolving/creating collections as needed.
adminImportRoutes.post("/apply", requireAdminWrite, async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    headers?: string[];
    rows?: string[][];
    mapping?: Record<string, number | null>;
  } | null;
  if (!body?.rows || !body.mapping) return c.json({ error: "Missing rows or mapping." }, 400);
  const m = body.mapping;
  if (m.name == null) return c.json({ error: "Map a Product name column first." }, 400);
  const cell = (row: string[], field: ImportField): string => {
    const idx = m[field];
    return idx == null ? "" : (row[idx] ?? "").trim();
  };

  const collectionCache = new Map<string, string | null>();
  async function resolveCollection(name: string): Promise<string | null> {
    const key = name.toLowerCase();
    if (collectionCache.has(key)) return collectionCache.get(key)!;
    const existing = await first<{ id: string }>(c.var.db, `SELECT id FROM collections WHERE lower(name) = ?`, key);
    let id = existing?.id ?? null;
    if (!id) {
      id = newId("col");
      const next = await first<{ n: number }>(c.var.db, `SELECT COALESCE(MAX(sort_order),0)+1 AS n FROM collections`);
      await run(
        c.var.db,
        `INSERT INTO collections (id, slug, name, sort_order, is_published) VALUES (?, ?, ?, ?, 0)`,
        id,
        `${slugify(name)}-${(next?.n ?? 1)}`,
        name,
        next?.n ?? 1,
      );
    }
    collectionCache.set(key, id);
    return id;
  }

  const result = { productsCreated: 0, variantsCreated: 0, skipped: [] as string[] };
  // Group rows by product name (order-preserving).
  const groups = new Map<string, string[][]>();
  for (const row of body.rows) {
    const name = cell(row, "name");
    if (!name) continue;
    (groups.get(name) ?? groups.set(name, []).get(name)!).push(row);
  }

  const sortStart = await first<{ n: number }>(c.var.db, `SELECT COALESCE(MAX(sort_order),0) AS n FROM products`);
  let sort = sortStart?.n ?? 0;

  for (const [name, rows] of groups) {
    const head = rows[0];
    const priceCents = parsePriceCents(cell(head, "price")) ?? 0;
    const genderRaw = cell(head, "gender").toLowerCase();
    const gender = GENDERS.has(genderRaw) ? genderRaw : "unisex";
    const collectionName = cell(head, "collection");
    const collectionId = collectionName ? await resolveCollection(collectionName) : null;
    const currency = (cell(head, "currency") || "USD").toUpperCase().slice(0, 3);
    const productId = newId("prod");
    let slug = slugify(name);
    if (await first(c.var.db, `SELECT id FROM products WHERE slug = ?`, slug)) slug = `${slug}-${sort + 1}`;
    try {
      await run(
        c.var.db,
        `INSERT INTO products (id, slug, name, description, gender, category, collection_id, base_price_cents, compare_at_price_cents, currency, availability, is_published, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 0, ?)`,
        productId,
        slug,
        name,
        cell(head, "description") || null,
        gender,
        cell(head, "category") || "apparel",
        collectionId,
        priceCents,
        parsePriceCents(cell(head, "compareAtPrice")),
        currency,
        ++sort,
      );
    } catch {
      result.skipped.push(name);
      continue;
    }
    result.productsCreated++;

    // Images (dedupe across rows).
    const seenImg = new Set<string>();
    let imgSort = 0;
    for (const row of rows) {
      const url = cell(row, "image");
      if (url && !seenImg.has(url)) {
        seenImg.add(url);
        await run(
          c.var.db,
          `INSERT INTO product_images (id, product_id, url, sort_order) VALUES (?, ?, ?, ?)`,
          newId("img"),
          productId,
          url,
          imgSort++,
        );
      }
    }

    // Variants (dedupe colour+size).
    const seenVar = new Set<string>();
    for (const row of rows) {
      const colorway = cell(row, "colorway") || "Default";
      const size = cell(row, "size") || "OS";
      const vkey = `${colorway}|${size}`;
      if (seenVar.has(vkey)) continue;
      seenVar.add(vkey);
      const variantId = newId("var");
      const vprice = parsePriceCents(cell(row, "price"));
      await run(
        c.var.db,
        `INSERT INTO product_variants (id, product_id, colorway_name, size, sku_code, price_cents, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)`,
        variantId,
        productId,
        colorway,
        size,
        cell(row, "sku") || null,
        vprice != null && vprice !== priceCents ? vprice : null,
      );
      const stock = parseInt(cell(row, "stock").replace(/[^0-9]/g, ""), 10);
      await run(
        c.var.db,
        `INSERT INTO inventory_items (id, variant_id, on_hand) VALUES (?, ?, ?)`,
        newId("inv"),
        variantId,
        Number.isFinite(stock) ? Math.min(stock, 1_000_000) : 0,
      );
      result.variantsCreated++;
    }
  }

  await writeAudit(c.var.db, c.var.userId, "products.import_studio", "product", "csv", {
    productsCreated: result.productsCreated,
    variantsCreated: result.variantsCreated,
  });
  return c.json(result, 201);
});
