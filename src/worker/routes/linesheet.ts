import { Hono } from "hono";
import { z } from "zod";
import { all, first, run } from "../services/db";
import { getBrandName } from "../services/brand";
import { leadNotification, sendNotification } from "../services/email";
import { parseBody } from "../services/validators";
import { rateLimit } from "../middleware/rate-limit";
import { newId, sha256Hex } from "../utils/id";
import type { AppContext } from "../types/env";

/** Public, tokenized wholesale line sheet + inquiry submission. */
export const lineSheetRoutes = new Hono<AppContext>();

async function resolveSheet(db: D1Database, token: string) {
  if (!token || token.length < 20 || token.length > 100) return null;
  const sheet = await first<{
    id: string;
    title: string;
    season: string | null;
    currency: string;
    note: string | null;
    status: string;
  }>(
    db,
    `SELECT id, title, season, currency, note, status FROM line_sheets WHERE token_hash = ?`,
    await sha256Hex(token),
  );
  if (!sheet || sheet.status !== "active") return null;
  return sheet;
}

lineSheetRoutes.get(
  "/:token",
  rateLimit({ key: "linesheet-view", limit: 120, windowSeconds: 3600 }),
  async (c) => {
    const sheet = await resolveSheet(c.var.db, c.req.param("token"));
    if (!sheet) return c.json({ error: "This line sheet link is invalid or has been revoked." }, 404);

    const items = await all(
      c.var.db,
      `SELECT i.product_id, i.wholesale_price_cents, i.min_qty,
              p.name, p.subtitle, p.category, p.gender, p.base_price_cents AS msrp_cents,
              p.fabric_composition, p.origin_statement,
              (SELECT url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.sort_order LIMIT 1) AS image_url,
              (SELECT GROUP_CONCAT(DISTINCT v.colorway_name) FROM product_variants v WHERE v.product_id = p.id) AS colorways,
              (SELECT GROUP_CONCAT(DISTINCT v.size) FROM product_variants v WHERE v.product_id = p.id) AS sizes
       FROM line_sheet_items i JOIN products p ON p.id = i.product_id
       WHERE i.line_sheet_id = ? ORDER BY i.sort_order`,
      sheet.id,
    );
    return c.json({
      brandName: await getBrandName(c.env),
      title: sheet.title,
      season: sheet.season,
      currency: sheet.currency,
      note: sheet.note,
      items,
    });
  },
);

const inquirySchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(200),
  company: z.string().max(200).optional(),
  message: z.string().max(2000).optional(),
  requests: z
    .array(z.object({ productId: z.string().max(80), quantity: z.number().int().min(1).max(100000) }))
    .max(100)
    .optional(),
});

lineSheetRoutes.post(
  "/:token/inquiry",
  rateLimit({ key: "linesheet-inquiry", limit: 10, windowSeconds: 3600 }),
  async (c) => {
    const sheet = await resolveSheet(c.var.db, c.req.param("token"));
    if (!sheet) return c.json({ error: "This line sheet link is invalid or has been revoked." }, 404);
    const body = await parseBody(c, inquirySchema);

    // Requested quantities resolve to product names for a readable lead.
    let requestLines = "";
    if (body.requests && body.requests.length > 0) {
      const parts: string[] = [];
      for (const req of body.requests) {
        const product = await first<{ name: string }>(
          c.var.db,
          `SELECT name FROM products WHERE id = ?`,
          req.productId,
        );
        if (product) parts.push(`${req.quantity} × ${product.name}`);
      }
      requestLines = parts.join("; ");
    }
    const message = [
      `Line sheet: ${sheet.title}${sheet.season ? ` (${sheet.season})` : ""}`,
      requestLines ? `Requested: ${requestLines}` : null,
      body.message ?? null,
    ]
      .filter(Boolean)
      .join("\n");

    await run(
      c.var.db,
      `INSERT INTO leads (id, kind, email, name, company, message, source_path)
       VALUES (?, 'wholesale_inquiry', ?, ?, ?, ?, ?)`,
      newId("lead"),
      body.email.toLowerCase(),
      body.name,
      body.company ?? null,
      message,
      `/linesheet (${sheet.title})`,
    );
    c.executionCtx.waitUntil(
      sendNotification(
        c.env,
        leadNotification({
          kind: "wholesale_inquiry",
          email: body.email,
          name: body.name,
          company: body.company,
          message,
        }),
      ),
    );
    return c.json({ ok: true }, 201);
  },
);
